from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from openai import OpenAI
import os, json
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any
import re
import io, asyncio
from typing import List, Optional, Tuple
import httpx, numpy as np
from PIL import Image
from paddleocr import PaddleOCR
import torch
from transformers import AutoProcessor, AutoModelForVision2Seq
import pypdfium2 as pdfium

os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"  # allow duplicate OpenMP runtime
os.environ["OMP_NUM_THREADS"] = "1"  

load_dotenv()
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL = "gpt-4o"
MODEL_MINI = "gpt-4o-mini"
TOOLS = [{"type": "web_search"}]
DEV_MSG = "You are an expert Deep Researcher. Provide structured, deep, and concise research responses."

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ---- PaddleOCR (documents/PDFs) ----
OCR_LANG = os.getenv("OCR_LANG", "en")
ocr = PaddleOCR(use_angle_cls=True, lang=OCR_LANG)

# ---- Qwen-VL (images/screenshots) ----
QWEN_MODEL = "Qwen/Qwen2-VL-2B-Instruct"

vl_processor = AutoProcessor.from_pretrained(QWEN_MODEL, trust_remote_code=True)

vl_model = AutoModelForVision2Seq.from_pretrained(
    QWEN_MODEL,
    trust_remote_code=True,
    device_map="cpu",
    dtype=torch.float32,
    low_cpu_mem_usage=True,
).to("cpu").eval()

async def _fetch_bytes(url: str, timeout: int = 20) -> bytes:
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as c:
        r = await c.get(url)
        r.raise_for_status()
        return r.content

def _is_pdf(name: str) -> bool:
    return (name or "").lower().endswith(".pdf")

def _load_img(b: bytes) -> Image.Image:
    return Image.open(io.BytesIO(b)).convert("RGB")

def _pdf_to_images(b: bytes, dpi: int = 200):
    pdf = pdfium.PdfDocument(io.BytesIO(b))
    out = []
    for i in range(len(pdf)):
        page = pdf[i]
        bitmap = page.render(scale=dpi / 72.0)
        out.append(bitmap.to_pil().convert("RGB"))
    return out

def _ocr_image(img: Image.Image):
    arr = np.array(img)
    res = ocr.ocr(arr, cls=True)
    lines, texts = [], []
    for page in (res or []):
        for (bbox, (text, score)) in page or []:
            flat = np.array(bbox).reshape(-1).tolist()
            lines.append({"bbox": [float(x) for x in flat], "text": text, "score": float(score)})
            texts.append(text)
    return " ".join(texts).strip(), lines

@torch.inference_mode()
def _qwen_image(img, question):
    prompt = question.strip() + "\nIf unknown or unreadable, say 'unknown'. Be concise."
    inputs = vl_processor(text=prompt, images=img, return_tensors="pt")
    ids = vl_model.generate(**inputs, max_new_tokens=256, temperature=0.0)
    return vl_processor.batch_decode(ids, skip_special_tokens=True)[0].strip()

@torch.inference_mode()
def _qwen_text(text, question):
    prompt = (
        "You are given extracted document text. Answer briefly. If unknown, say 'unknown'.\n\n"
        f"Text:\n{text[:8000]}\n\nQuestion: {question}\nAnswer:"
    )
    inputs = vl_processor(text=prompt, return_tensors="pt")
    ids = vl_model.generate(**inputs, max_new_tokens=256, temperature=0.0)
    return vl_processor.batch_decode(ids, skip_special_tokens=True)[0].strip()

def sanitize_json_text(raw: str) -> str:
    """Clean LLM output to ensure it's valid JSON."""
    import re
    text = raw.strip()

    # Remove leading/trailing code fences
    text = re.sub(r"^```(?:json)?", "", text)
    text = re.sub(r"```$", "", text)
    text = text.strip()

    # Attempt to isolate the JSON part if the model added extra text
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        text = match.group(0)

    return text


# ------------------- Request Schemas -------------------

class TopicRequest(BaseModel):
    topic: str

class ClarifyRequest(BaseModel):
    topic: str

class AnswerRequest(BaseModel):
    topic: str
    questions: List[str]
    answers: List[str]

class FollowupRequest(BaseModel):
    user_message: str
    goal: str
    collected: List[Dict[str, Any]] = []

class ResearchRequest(BaseModel):
    topic: str

# ------------------- Endpoints -------------------

@app.post("/clarify")
async def clarify(req: ClarifyRequest):
    prompt = f"Ask 5 numbered clarifying questions about: {req.topic}. Reply only with questions."
    resp = client.responses.create(model=MODEL_MINI, input=prompt, instructions=DEV_MSG)
    questions = resp.output[0].content[0].text.split("\n")
    return {"questions": [q.strip() for q in questions if q.strip()]}

@app.post("/goal")
async def goal(req: AnswerRequest):
    prompt = f"""
Using answers {req.answers} to questions {req.questions},
write ONLY valid JSON in the format:
{{"goal": "...", "queries": ["q1", "q2", "q3", "q4", "q5"]}}
Topic: {req.topic}
No explanations, no code fences, no extra text.
"""
    resp = client.responses.create(model=MODEL, input=prompt, instructions=DEV_MSG)
    raw_output = resp.output[0].content[0].text
    print("Model raw output:", raw_output)

    try:
        cleaned = sanitize_json_text(raw_output)
        plan = json.loads(cleaned)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse JSON output: {str(e)}\nRaw model output:\n{raw_output}"
        )
    return plan

@app.post("/search")
async def search(req: TopicRequest):
    resp = client.responses.create(
        model=MODEL,
        input=f"Search: {req.topic}",
        tools=TOOLS,
        instructions=DEV_MSG
    )
    try:
        output = resp.output[1].content[0].text
    except Exception:
        output = resp.output[0].content[0].text
    return {"query": req.topic, "research_output": output}

@app.post("/followup")
async def followup(req: FollowupRequest):
    # Simple conversational follow-up — can later mirror your handle_followup()
    messages = [
        {"role": "system", "content": DEV_MSG},
        {"role": "assistant", "content": f"Research goal: {req.goal}"},
        {"role": "assistant", "content": f"Collected evidence: {json.dumps(req.collected)[:2000]}"},
        {"role": "user", "content": req.user_message}
    ]
    resp = client.responses.create(model=MODEL, input=messages, instructions=DEV_MSG)
    return {"reply": resp.output[0].content[0].text}

@app.post("/research/summarize")
async def research_summarize(req: ResearchRequest):
    try:
        prompt = f"""
        Conduct deep research on the topic "{req.topic}".
        Provide a structured markdown report.
        Then, return a JSON object describing the main sections.

        Output strictly in JSON format:
        {{
            "report_markdown": "the full markdown report",
            "sections": [
                {{
                    "title": "Section title",
                    "summary": ["key takeaway 1", "key takeaway 2"],
                    "full_text": "the full markdown for this section"
                }}
            ]
        }}
        """

        resp = client.responses.create(
            model=MODEL,
            input=prompt,
            instructions=DEV_MSG
        )

        raw = resp.output[0].content[0].text
        print("\n=== RAW MODEL OUTPUT ===")
        print(raw)
        print("========================\n")

        cleaned = sanitize_json_text(raw)
        parsed = json.loads(cleaned)

        return parsed

    except Exception as e:
        import traceback
        print("\n❌ Error in /research/summarize:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    
class AnalyzeResp(BaseModel):
    text: str
    details: dict | None = None

@app.post("/api/analyze", response_model=AnalyzeResp)
async def analyze(
    question: str = Form(...),
    image_urls: Optional[List[str]] = Form(None),
    image_files: Optional[List[UploadFile]] = File(None),
    document_urls: Optional[List[str]] = Form(None),
    document_files: Optional[List[UploadFile]] = File(None),
    space_id: Optional[str] = Form(None),
    space_topic: Optional[str] = Form(None),
):
    image_urls = [u for u in (image_urls or []) if u.strip()]
    document_urls = [u for u in (document_urls or []) if u.strip()]
    image_files = image_files or []
    document_files = document_files or []

    # Gather pages/images
    doc_pages, vis_imgs = [], []

    # documents: files/urls (pdf or image scans)
    for f in document_files:
        b = await f.read()
        if _is_pdf(f.filename or ""):
            doc_pages.extend(_pdf_to_images(b))
        else:
            doc_pages.append(_load_img(b))
    for u in document_urls:
        try:
            b = await _fetch_bytes(u)
            if _is_pdf(u):
                doc_pages.extend(_pdf_to_images(b))
            else:
                doc_pages.append(_load_img(b))
        except Exception:
            pass

    # images/screenshots: files/urls
    for f in image_files:
        vis_imgs.append(_load_img(await f.read()))
    for u in image_urls:
        try:
            vis_imgs.append(_load_img(await _fetch_bytes(u)))
        except Exception:
            pass

    # OCR documents → optional Qwen summarization
    ocr_texts, ocr_blocks = [], []
    for p in doc_pages:
        t, lines = _ocr_image(p)
        if t: ocr_texts.append(t)
        ocr_blocks.append({"page_chars": len(t), "lines": lines[:20]})

    combined = "\n".join(ocr_texts).strip()
    doc_ans = _qwen_text(combined, question) if combined else ""

    # Qwen-VL over images/screenshots
    vis_answers = [_qwen_image(img, question) for img in vis_imgs]

    # Compose
    parts = []
    if doc_ans: parts.append(f"Document:\n{doc_ans}")
    if vis_answers:
        uniq, seen = [], set()
        for a in vis_answers:
            k = a.strip().lower()
            if k not in seen: seen.add(k); uniq.append(a)
        parts.append("Visual:\n" + "\n".join(uniq))
    final = "\n\n".join(parts) if parts else "No content processed or nothing was readable."

    return AnalyzeResp(
        text=final,
        details={
            "counts": {
                "document_pages": len(doc_pages),
                "images": len(vis_imgs),
                "ocr_chars": len(combined),
            },
            "space": {"id": space_id, "topic": space_topic},
            "ocr_preview": combined[:1000],
            "ocr_blocks": ocr_blocks[:3],
        },
    )

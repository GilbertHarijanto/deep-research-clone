from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from openai import OpenAI
import os, json
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any
import re


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

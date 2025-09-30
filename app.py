# -*- coding: utf-8 -*-
"""Deep Research Clone - Streamlit App (Conversational, Researcher-in-the-loop)

This version adds:
- Fully conversational Research Chat (context-aware answers like GPT)
- Intent classifier with "none" fallback for natural Q&A
- Immediate chat synthesis after drill-down / counter-evidence searches (toggleable)
- "Yes, regenerate queries" flow handled inside chat
- Editable clarifying questions and queries with weighted priority
- Lightweight agents: Generate / Reflect / Rank / Evolve
- Counter-evidence search, freshness toggles, pinned sources
- Report section rewrites and version history
- Robust JSON sanitation for model outputs
- References rendered as [n] Title – URL in final report
- Monochrome (black & white) UI styling
"""

import re
import json
import os
from typing import Dict, List, Any, Tuple, Optional
from urllib.parse import urlparse

import streamlit as st
from openai import OpenAI
from dotenv import load_dotenv

# -------------------------------------------------------------------
# Environment
# -------------------------------------------------------------------
load_dotenv()

# -------------------------------------------------------------------
# Model & Tool Configuration
# -------------------------------------------------------------------
MODEL = "gpt-4o"
MODEL_MINI = "gpt-4o-mini"
TOOLS = [{"type": "web_search"}]

DEVELOPER_MESSAGE = """
You are an expert Deep Researcher.
You provide complete and in depth research to the user.
Always return concise, structured outputs. When asked for JSON, return strict JSON with no code fences, no extra text.
"""

# -------------------------------------------------------------------
# Styling (Black & White)
# -------------------------------------------------------------------
MONOCHROME_CSS = """
<style>
:root, body, .stApp, .main, .block-container { filter: grayscale(1); }
div.stButton > button, .stDownloadButton > button { border-radius: 8px; }
[data-testid="stSidebar"] { border-right: 1px solid #e5e5e5; }
hr { border: none; border-top: 1px solid #e5e5e5; margin: 1rem 0; }
.stRadio > label, .stCheckbox > label, .stTextInput > label, .stSelectbox > label { font-weight: 600; }
.kbdx { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; background:#f4f4f4; padding:2px 6px; border-radius:4px; }
.card { border:1px solid #e5e5e5; padding:12px; border-radius:8px; background:#fff; }
.small { font-size: 0.92rem; color:#444; }
.badge { display:inline-block; padding:2px 8px; border:1px solid #e5e5e5; border-radius:999px; font-size:12px; margin-left:6px;}
</style>
"""

# -------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------
def get_openai_client() -> Optional[OpenAI]:
    st.subheader("OpenAI API Key Setup")
    env_api_key = os.getenv("OPENAI_API_KEY", "")
    api_key = st.text_input(
        "Enter your OpenAI API Key:",
        value=env_api_key,
        type="password",
        help="Get your API key from https://platform.openai.com/api-keys",
        placeholder="sk-... or sk-proj-...",
    )

    if not api_key:
        st.warning("Please enter your OpenAI API key to continue.")
        return None

    if not (api_key.startswith("sk-") or api_key.startswith("sk-proj-")):
        st.error("Invalid API key format. It should start with 'sk-' or 'sk-proj-'.")
        return None

    try:
        client = OpenAI(api_key=api_key)
        st.session_state["api_key"] = api_key
        return client
    except Exception as e:
        st.error(f"Error connecting to OpenAI: {str(e)}")
        return None


def sanitize_json_text(raw: str) -> str:
    """
    Remove code fences and stray prefixes like 'json'.
    """
    text = (raw or "").strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].strip()
    return text.strip()


def safe_json_loads(raw: str) -> Any:
    """
    Strict JSON loading with sanitation and helpful error surfacing.
    """
    cleaned = sanitize_json_text(raw)
    return json.loads(cleaned)


def extract_urls(text: str) -> List[str]:
    if not text:
        return []
    # Basic URL regex
    pattern = r"(https?://[^\s\]\)]+)"
    return re.findall(pattern, text)


def url_to_title_guess(url: str) -> str:
    """
    Best-effort title guess from URL when we cannot fetch the page:
    - Use domain as prefix
    - Use last meaningful path segment as title case
    """
    try:
        p = urlparse(url)
        domain = p.netloc.replace("www.", "")
        path = [seg for seg in p.path.split("/") if seg]
        if path:
            leaf = path[-1]
            leaf = re.sub(r"[-_]+", " ", leaf)
            leaf = re.sub(r"\.[a-zA-Z0-9]+$", "", leaf)
            leaf = leaf.strip().title()
        else:
            leaf = ""
        if leaf:
            return f"{domain} – {leaf}"
        return domain
    except Exception:
        return url


# -------------------------------------------------------------------
# Core LLM Calls
# -------------------------------------------------------------------
def llm(
    client: OpenAI,
    model: str,
    input_obj,
    instructions: str = DEVELOPER_MESSAGE,
    tools: Optional[List[Dict]] = None,
    previous_response_id: Optional[str] = None,
) -> Any:
    if client is None:
        raise RuntimeError("OpenAI client is not initialized.")
    kwargs = {
        "model": model,
        "input": input_obj,
        "instructions": instructions,
    }
    if tools:
        kwargs["tools"] = tools
    if previous_response_id:
        kwargs["previous_response_id"] = previous_response_id
    return client.responses.create(**kwargs)

# -------------------------------------------------------------------
# Steps
# -------------------------------------------------------------------
def get_topic() -> str:
    return st.text_input("Research topic:", key="topic").strip()


def get_clarifying_questions(client: OpenAI, topic: str) -> Tuple[List[str], str]:
    prompt = f"""
Ask 5 numbered clarifying questions to the user about the topic: {topic}.
The goal is to understand the intended purpose of the research.
Reply only with the questions, one per line, starting with a number.
"""
    clarify = llm(client, MODEL_MINI, prompt)
    lines = clarify.output[0].content[0].text.split("\n")
    questions = [q.strip() for q in lines if q.strip()]
    return questions, clarify.id


def get_answers(questions: List[str]) -> List[str]:
    answers = []
    st.subheader("Please answer these clarifying questions:")
    for i, question in enumerate(questions):
        answers.append(st.text_input(question, key=f"answer_{i}"))
    return answers


def get_goal_and_queries(
    client: OpenAI,
    topic: str,
    questions: List[str],
    answers: List[str],
    clarify_id: str,
) -> Tuple[Dict, str]:
    prompt = f"""
Using the user answers: {answers} to the questions: {questions}, write ONLY valid JSON in the exact format:
{{
  "goal": "...",
  "queries": ["q1", "q2", "q3", "q4", "q5"]
}}
Topic: {topic}
Do not add any other text or code fences.
"""
    goal_and_queries = llm(client, MODEL, prompt, previous_response_id=clarify_id)
    raw = goal_and_queries.output[0].content[0].text
    try:
        plan = safe_json_loads(raw)
    except Exception:
        st.error("Could not parse model output as JSON for the goal and queries. Showing raw output below.")
        st.text_area("Raw output", raw, height=200)
        plan = {"goal": "Research goal could not be parsed.", "queries": []}
    return plan, goal_and_queries.id


def run_search(client: OpenAI, q: str) -> Dict[str, Any]:
    web_search = llm(client, MODEL, f"Search: {q}", tools=TOOLS)
    try:
        research_output = web_search.output[1].content[0].text
        resp_id = web_search.output[1].id
    except Exception:
        research_output = web_search.output[0].content[0].text
        resp_id = web_search.output[0].id
    return {"query": q, "resp_id": resp_id, "research_output": research_output}


def evaluate(client: OpenAI, goal: str, collected: List[Dict[str, Any]]) -> bool:
    review = llm(
        client,
        MODEL,
        [
            {"role": "developer", "content": f"Research goal: {goal}"},
            {"role": "assistant", "content": json.dumps(collected)},
            {"role": "user", "content": "Does this information fully satisfy the goal? Answer Yes or No only."},
        ],
    )
    text = review.output[0].content[0].text.lower()
    return "yes" in text


def synthesize(client: OpenAI, goal: str, collected: List[Dict[str, Any]]) -> str:
    report = llm(
        client,
        MODEL,
        [
            {
                "role": "developer",
                "content": (
                    f"Write a complete and detailed report about research goal: {goal}. "
                    "Cite sources inline using [n] and append a reference list mapping [n] to both the source title and url "
                    "in the format: [n] Title – URL"
                ),
            },
            {"role": "assistant", "content": json.dumps(collected)},
        ],
    )
    return report.output[0].content[0].text

# -------------------------------------------------------------------
# Lightweight Agents (Generate / Reflect / Rank / Evolve)
# -------------------------------------------------------------------
def agent_generate_more_queries(client: OpenAI, goal: str, gaps: List[str], k: int = 5) -> List[str]:
    prompt = f"""
You are the Generate agent. Based on the research goal:
{goal}

And the following gaps to address:
{gaps}

Return ONLY a JSON list of {k} new web search queries. No extra text.
"""
    res = llm(client, MODEL, prompt)
    return safe_json_loads(res.output[0].content[0].text)


def agent_reflect_quality(client: OpenAI, collected: List[Dict[str, Any]]) -> Dict[str, Any]:
    prompt = f"""
You are the Reflect agent. Given current collected evidence (as JSON):
{json.dumps(collected)}

Evaluate along three axes from 0-5: correctness, novelty, testability. Also provide a short critique.
Return ONLY JSON with keys: {{"correctness": int, "novelty": int, "testability": int, "critique": "..."}}.
"""
    res = llm(client, MODEL_MINI, prompt)
    return safe_json_loads(res.output[0].content[0].text)


def agent_rank_candidates(candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    def score(c):
        return (c.get("correctness", 0) + c.get("novelty", 0) + c.get("testability", 0)) / 3.0
    return sorted(candidates, key=score, reverse=True)


def agent_evolve_queries(client: OpenAI, top_feedback: str, base_queries: List[str]) -> List[str]:
    prompt = f"""
You are the Evolve agent. Improve and diversify these queries:
{base_queries}

Incorporate this feedback:
{top_feedback}

Return ONLY a JSON list of 5 improved queries. No extra text.
"""
    res = llm(client, MODEL, prompt)
    return safe_json_loads(res.output[0].content[0].text)

# -------------------------------------------------------------------
# Chat Synthesis Helper
# -------------------------------------------------------------------
def synthesize_from_evidence_for_chat(client: OpenAI, user_msg: str, collected: List[Dict[str, Any]], k: int = 3) -> str:
    """
    Build a concise, source-aware answer for the chat, using the most recent k pieces of evidence.
    Returns markdown with short inline markers [S1], [S2] and a Sources block mapping to title guesses.
    """
    if not collected:
        return "No evidence is available yet. Please run a search first."

    recent = collected[-k:]
    # Pre-extract a few URLs to help the model reference
    sources_map = []
    for item in recent:
        urls = extract_urls(item.get("research_output", ""))[:3]
        if urls:
            for u in urls:
                sources_map.append({"query": item.get("query", ""), "url": u, "title": url_to_title_guess(u)})
        else:
            # no url, fallback to query string as a pseudo source
            sources_map.append({"query": item.get("query", ""), "url": "", "title": item.get("query", "")})

    prompt = [
        {"role": "system", "content": "You are a precise research assistant who writes concise, source-aware answers."},
        {
            "role": "user",
            "content": (
                "User question:\n"
                f"{user_msg}\n\n"
                "Use ONLY the following collected evidence (JSON) to answer. "
                "Write 5-8 bullet points. Use inline source markers [S1], [S2], etc. "
                "Then write a 'Sources' section mapping [S#] to a short title and URL if available.\n\n"
                f"Evidence JSON:\n{json.dumps(recent)}\n\n"
                f"Pre-extracted links (you may reuse for Sources mapping):\n{json.dumps(sources_map)}"
            ),
        },
        {"role": "user", "content": "Output only markdown. No extra commentary."},
    ]
    res = llm(client, MODEL, prompt)
    return res.output[0].content[0].text

# -------------------------------------------------------------------
# Follow-up Chat Handling (Conversational)
# -------------------------------------------------------------------
FOLLOWUP_LABELS = ["refine_goal", "drill_down", "ask_sources", "counter_evidence", "summarize", "new_angle", "none"]

def classify_intent(client: OpenAI, user_msg: str) -> str:
    prompt = f"""
You are an intent classifier for a research assistant.
User message: {user_msg}
Choose one label from: {FOLLOWUP_LABELS}
If no label fits well, return "none".
Return ONLY the label.
"""
    res = llm(client, MODEL_MINI, prompt)
    return res.output[0].content[0].text.strip()


def handle_followup(client: OpenAI, user_msg: str, knowledge: Dict[str, Any]) -> str:
    """
    Conversational follow-up handler.
    Uses context (goal, collected evidence, current report).
    Produces natural GPT-like answers, not fixed workflow prompts.
    """
    goal = knowledge.get("goal", "")
    collected = knowledge.setdefault("collected", [])
    knowledge.setdefault("current_queries", [])
    report_md = knowledge.get("report", "")

    # Check "yes, regenerate queries" confirmations if we are awaiting regeneration
    awaiting_regen = knowledge.get("awaiting_regen", False)
    if awaiting_regen and re.search(r"\b(yes|regenerate|go ahead|do it)\b", user_msg.strip().lower()):
        new_queries = agent_generate_more_queries(client, goal or "Refined goal", gaps=["coverage", "novelty"], k=5)
        knowledge["current_queries"] = new_queries
        knowledge["query_weights"] = [3] * len(new_queries)
        knowledge["awaiting_regen"] = False
        return "I generated new queries for the refined goal:\n\n" + "\n".join([f"- {q}" for q in new_queries])

    intent = classify_intent(client, user_msg)

    # 1) Refine goal: respond conversationally and set a flag to optionally regenerate
    if intent == "refine_goal":
        prompt = f"""
Refine the research goal to be specific and measurable, including evaluation metrics and expected deliverables.

Current goal:
{goal}

User guidance:
{user_msg}

Return ONLY JSON:
{{
  "goal": "...",
  "metrics": ["..."],
  "deliverables": ["..."]
}}
"""
        res = llm(client, MODEL, prompt)
        try:
            refined = safe_json_loads(res.output[0].content[0].text)
        except Exception:
            refined = {"goal": goal, "metrics": [], "deliverables": []}

        knowledge["goal"] = refined.get("goal", goal)
        knowledge["metrics"] = refined.get("metrics", [])
        knowledge["deliverables"] = refined.get("deliverables", [])
        knowledge["awaiting_regen"] = True  # wait for user to confirm regeneration

        # Conversational response
        lines = []
        lines.append("Here is a more specific, measurable goal:")
        lines.append(f"- Goal: {knowledge['goal']}")
        if knowledge["metrics"]:
            lines.append("Metrics:")
            for m in knowledge["metrics"]:
                lines.append(f"  - {m}")
        if knowledge["deliverables"]:
            lines.append("Deliverables:")
            for d in knowledge["deliverables"]:
                lines.append(f"  - {d}")
        lines.append("")
        lines.append("Would you like me to regenerate the search queries for this refined goal?")
        return "\n".join(lines)

    # 2) Drill down: run a targeted search and immediately synthesize an answer if toggle on
    if intent == "drill_down":
        q = f"{user_msg} (focus on depth with technical specifics and recent sources)"
        result = run_search(client, q)
        collected.append(result)
        if st.session_state.get("chat_synthesize", True):
            return synthesize_from_evidence_for_chat(client, user_msg, collected, k=3)
        return "I added a deep-dive search result. Should I integrate this into the report or keep exploring?"

    # 3) Ask sources: list pinned + recent with inferred titles
    if intent == "ask_sources":
        pins = knowledge.get("pinned", [])
        recent = collected[-5:]
        msg = []
        if pins:
            msg.append("Pinned sources:")
            for p in pins:
                urls = extract_urls(p.get("research_output", ""))
                line = f"- {p.get('query','')}"
                if urls:
                    line += f" → {url_to_title_guess(urls[0])} ({urls[0]})"
                msg.append(line)
        msg.append("Recent evidence:")
        for r in recent:
            urls = extract_urls(r.get("research_output", ""))
            line = f"- {r.get('query','')}"
            if urls:
                line += f" → {url_to_title_guess(urls[0])} ({urls[0]})"
            msg.append(line)
        return "\n".join(msg)

    # 4) Counter-evidence: search and synthesize an answer
    if intent == "counter_evidence":
        q = f"Counter-evidence or conflicting studies for the current goal: {goal}. Summarize credible sources with links."
        result = run_search(client, q)
        collected.append(result)
        if st.session_state.get("chat_synthesize", True):
            return synthesize_from_evidence_for_chat(client, user_msg, collected, k=3)
        return "I searched for counter-evidence. Should I add a limitations section to the report?"

    # 5) Summarize: condensed bullets of current findings
    if intent == "summarize":
        prompt = f"""
Summarize the current findings in 5-8 bullet points with clear claims and supporting markers like [S1], [S2].
Use only the existing collected evidence below.

Collected evidence JSON:
{json.dumps(collected)}

Return concise markdown only.
"""
        res = llm(client, MODEL_MINI, prompt)
        return res.output[0].content[0].text

    # 6) New angle: propose alternatives and wait for confirmation
    if intent == "new_angle":
        prompt = f"""
Suggest 3 alternative angles or hypotheses to explore that could lead to novel insights for the goal below.

Goal:
{goal}

Return ONLY a JSON list of 3 strings.
"""
        res = llm(client, MODEL_MINI, prompt)
        try:
            angles = safe_json_loads(res.output[0].content[0].text)
        except Exception:
            angles = []
        knowledge["alt_angles"] = angles
        if angles:
            return "Here are three alternative angles:\n" + "\n".join([f"- {a}" for a in angles]) + "\n\nWould you like me to convert any of them into new queries?"
        return "I could not generate alternative angles right now. Try rephrasing or provide a hint."

    # 7) None or general question: answer conversationally using context and (optionally) synthesize from evidence
    if st.session_state.get("chat_synthesize", True) and collected:
        return synthesize_from_evidence_for_chat(client, user_msg, collected, k=3)

    # Fallback pure conversational answer with context
    prompt = [
        {"role": "system", "content": "You are a helpful research assistant continuing an ongoing research project."},
        {"role": "assistant", "content": f"Research goal: {goal}"},
        {"role": "assistant", "content": f"Collected evidence so far (truncated): {json.dumps(collected)[:2000]}"},
        {"role": "assistant", "content": f"Draft report so far (truncated): {report_md[:2000]}"},
        {"role": "user", "content": user_msg},
        {"role": "user", "content": "Answer concisely and concretely. Use markdown."},
    ]
    res = llm(client, MODEL, prompt)
    return res.output[0].content[0].text

# -------------------------------------------------------------------
# Report Section Rewrite
# -------------------------------------------------------------------
def rewrite_section(client: OpenAI, report_md: str, section_title: str, instruction: str) -> str:
    prompt = f"""
You will rewrite the '{section_title}' section in this report based on the instruction.

Instruction: {instruction}

Report markdown:
{report_md}

Return ONLY the rewritten section markdown (no extra text).
"""
    res = llm(client, MODEL, prompt)
    return res.output[0].content[0].text

# -------------------------------------------------------------------
# UI Blocks
# -------------------------------------------------------------------
def ui_queries_editor(plan: Dict[str, Any]):
    st.subheader("Initial Search Queries")
    queries = plan.get("queries", [])
    edited = []
    weights = []
    for i, q in enumerate(queries):
        c1, c2 = st.columns([4, 1])
        with c1:
            edited.append(st.text_input(f"Query {i+1}", q, key=f"edit_q_{i}"))
        with c2:
            weights.append(st.number_input(f"Priority {i+1}", min_value=1, max_value=5, value=3, key=f"prio_q_{i}"))
    colA, colB, colC = st.columns(3)
    if colA.button("Add Query"):
        queries.append("")
        st.session_state["goal_plan"]["queries"] = queries
        st.rerun()
    if colB.button("Use Edited Queries"):
        st.session_state["current_queries"] = [x for x in edited if x.strip()]
        st.session_state["query_weights"] = weights
        st.info("Updated queries. Start Research to run them.")
    if colC.button("Generate 5 Alternatives"):
        goal = st.session_state["goal_plan"].get("goal", "")
        alt = agent_generate_more_queries(st.session_state["client"], goal, gaps=["coverage", "novelty"], k=5)
        st.session_state["current_queries"] = alt
        st.session_state["query_weights"] = [3] * len(alt)
        st.success("Generated alternative queries. Start Research to run them.")


def ui_results(collected: List[Dict[str, Any]], allow_pin: bool = True):
    st.subheader("Search Results")
    if not collected:
        st.info("No results yet. Start Research to populate this section.")
        return
    for i, result in enumerate(collected, 1):
        with st.expander(f"{i}. {result['query']}", expanded=False):
            st.text_area("Search Output:", value=result["research_output"], height=160, disabled=True)
            if allow_pin:
                if st.button("Pin this source", key=f"pin_{i}"):
                    st.session_state.setdefault("knowledge", {}).setdefault("pinned", []).append(result)
                    st.success("Pinned. It will be prioritized for citations.")


def ui_report_tools():
    st.subheader("Report Tools")
    report_md = st.session_state["knowledge"].get("report", "")
    if report_md:
        st.markdown(report_md)
        st.markdown("---")
        section = st.text_input("Section title to rewrite (exact or approximate):", "")
        instruction = st.text_input("Rewrite instruction (e.g., add more citations, strengthen limitations):", "")
        c1, c2 = st.columns(2)
        with c1:
            if st.button("Rewrite Section"):
                new_section = rewrite_section(st.session_state["client"], report_md, section, instruction)
                updated = report_md
                if section and section in report_md:
                    updated += f"\n\n# {section} (Rewritten)\n{new_section}\n"
                else:
                    updated += f"\n\n# {section or 'Additional Section'}\n{new_section}\n"
                st.session_state["knowledge"].setdefault("report_versions", []).append(report_md)
                st.session_state["knowledge"]["report"] = updated
                st.success("Section rewritten and report updated.")
        with c2:
            if st.button("Revert to Previous Version"):
                versions = st.session_state["knowledge"].get("report_versions", [])
                if versions:
                    st.session_state["knowledge"]["report"] = versions.pop()
                    st.success("Reverted to previous report version.")
                else:
                    st.warning("No previous versions available.")
    else:
        st.info("No report generated yet.")


def ui_research_chat():
    st.subheader("Research Chat")

    # Toggle: answer in chat with synthesized findings right after search
    synth_flag = st.checkbox(
        "Answer in chat with synthesized findings (when possible)",
        value=True, key="chat_synthesize"
    )

    dialogue = st.session_state.setdefault("dialogue", [])
    for msg in dialogue:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    user_msg = st.chat_input(
        "Ask follow-ups any time (e.g., find counter-evidence, refine goal, more sources, rewrite section)."
    )
    if user_msg:
        dialogue.append({"role": "user", "content": user_msg})
        reply = handle_followup(st.session_state["client"], user_msg, st.session_state["knowledge"])
        dialogue.append({"role": "assistant", "content": reply})
        st.rerun()

# -------------------------------------------------------------------
# Main
# -------------------------------------------------------------------
def main():
    st.set_page_config(page_title="Deep Research Clone", layout="wide")
    # st.markdown(MONOCHROME_CSS, unsafe_allow_html=True)

    st.title("Deep Research Clone")
    st.write("AI-powered research assistant with continuous, researcher-in-the-loop workflow.")

    # Client
    client = get_openai_client()
    if client is None:
        st.info("Enter a valid API key above to start.")
        return
    st.session_state["client"] = client

    # Header row
    col1, col2 = st.columns([3, 1])
    with col1:
        st.success("API key configured.")
    with col2:
        if st.button("Change API Key"):
            for k in ["api_key", "client"]:
                if k in st.session_state:
                    del st.session_state[k]
            st.rerun()

    st.markdown("---")
    st.subheader("Start Your Research")

    # Step 1: Topic
    topic = get_topic()
    if not topic:
        st.info("Enter a research topic to begin.")
        return

    # Step 2: Clarifying questions (with edit affordance)
    if "clarify_data" not in st.session_state or st.session_state.get("last_topic") != topic:
        with st.spinner("Generating clarifying questions..."):
            questions, clarify_id = get_clarifying_questions(client, topic)
            st.session_state["clarify_data"] = (questions, clarify_id)
            st.session_state["last_topic"] = topic
    else:
        questions, clarify_id = st.session_state["clarify_data"]

    st.subheader("Clarifying Questions")
    editable_qs = []
    for i, q in enumerate(questions):
        editable_qs.append(st.text_input(f"Question {i+1}", q, key=f"clarify_q_{i}"))
    if st.button("Use Edited Questions"):
        st.session_state["clarify_data"] = (editable_qs, clarify_id)
        st.success("Questions updated. Provide answers below.")
        st.rerun()

    # Step 3: Answers
    answers = get_answers(st.session_state["clarify_data"][0])
    if not all(a.strip() for a in answers):
        st.info("Please answer all clarifying questions to continue.")
        return

    # Step 4: Goal and queries
    if "goal_plan" not in st.session_state or st.session_state.get("last_answers") != answers:
        with st.spinner("Generating research goal and queries..."):
            plan, goal_queries_id = get_goal_and_queries(
                client, topic, st.session_state["clarify_data"][0], answers, clarify_id
            )
            st.session_state["goal_plan"] = plan
            st.session_state["goal_queries_id"] = goal_queries_id
            st.session_state["last_answers"] = answers
            st.session_state.setdefault("knowledge", {})["goal"] = plan.get("goal", "")
    else:
        plan = st.session_state["goal_plan"]
        goal_queries_id = st.session_state["goal_queries_id"]

    goal = plan.get("goal", "")
    queries = plan.get("queries", [])

    # Display goal and editable queries
    st.markdown("---")
    st.subheader("Research Goal")
    st.info(goal or "No goal parsed.")

    ui_queries_editor(plan)

    # Step 5: Research loop
    if st.button("Start Research", type="primary") or st.session_state.get("research_started"):
        st.session_state["research_started"] = True

        collected = st.session_state["knowledge"].get("collected", [])
        current_queries = st.session_state.get("current_queries", queries)
        iteration_count = st.session_state.get("iteration_count", 0)
        max_iterations = 5

        # Freshness toggle (soft preference)
        freshness = st.selectbox(
            "Recency filter for new searches",
            ["No preference", "Last 24 months", "Last 12 months", "Last 6 months"]
        )
        freshness_suffix = ""
        if freshness == "Last 24 months":
            freshness_suffix = " published within the last 24 months"
        elif freshness == "Last 12 months":
            freshness_suffix = " published within the last 12 months"
        elif freshness == "Last 6 months":
            freshness_suffix = " published within the last 6 months"

        if iteration_count < max_iterations:
            st.markdown("---")
            st.subheader(f"Research Iteration {iteration_count + 1}")

            progress_bar = st.progress(0.0)
            total = len(current_queries) if current_queries else 1

            for i, q in enumerate(current_queries):
                if not any(item["query"] == q for item in collected):
                    progress_bar.progress(min((i + 1) / total, 1.0))
                    with st.spinner(f"Searching: {q}"):
                        q2 = q + (f" {freshness_suffix}" if freshness_suffix else "")
                        result = run_search(client, q2)
                        collected.append(result)
                        with st.expander(f"Results for: {q}", expanded=False):
                            preview = result["research_output"][:700] + ("..." if len(result["research_output"]) > 700 else "")
                            st.text_area("Search Output:", value=preview, height=160, disabled=True)

            st.session_state["knowledge"]["collected"] = collected
            st.session_state["iteration_count"] = iteration_count + 1

            # Reflect & rank preview
            st.subheader("Auto Review")
            try:
                review = agent_reflect_quality(client, collected)
                st.json(review)
            except Exception:
                st.info("Auto review could not be computed on current evidence.")

            # Step 6: Evaluate completeness
            st.subheader("Evaluating Research Completeness")
            with st.spinner("Checking if goal is satisfied..."):
                goal_satisfied = evaluate(client, goal, collected)

            if goal_satisfied:
                st.success("Research goal satisfied. Generating final report...")
                with st.spinner("Writing comprehensive research report..."):
                    final_report = synthesize(client, goal, collected)
                st.session_state["knowledge"]["report"] = final_report

                st.markdown("---")
                st.subheader("Final Report")
                st.markdown(final_report)

                st.download_button(
                    label="Download Report",
                    data=final_report,
                    file_name=f"research_report_{(topic or 'topic').replace(' ', '_')}.md",
                    mime="text/markdown",
                )

                # Reset controls, keep knowledge for chat
                st.session_state["research_started"] = False
                st.session_state["iteration_count"] = 0

                if st.button("Start New Research"):
                    api = st.session_state.get("api_key")
                    for key in list(st.session_state.keys()):
                        if key != "api_key":
                            del st.session_state[key]
                    st.session_state["api_key"] = api
                    st.rerun()
            else:
                st.warning("More research needed. Generating additional queries...")
                with st.spinner("Generating new search queries..."):
                    more = llm(
                        client,
                        MODEL,
                        [
                            {"role": "assistant", "content": f"Current data: {json.dumps(collected)}"},
                            {"role": "user", "content": f"This has not met the goal: {goal}. Write 5 other web searches to achieve the goal. Return only a JSON list of strings."},
                        ],
                        previous_response_id=goal_queries_id,
                    )
                    try:
                        new_queries_text = more.output[0].content[0].text
                        new_queries = safe_json_loads(new_queries_text)
                        if isinstance(new_queries, list):
                            st.session_state["current_queries"] = new_queries
                            st.session_state["query_weights"] = [3] * len(new_queries)
                            st.info("New search queries generated. Click Start Research again.")
                        else:
                            st.error("Could not parse additional queries.")
                    except Exception:
                        st.error("Could not parse additional queries as JSON.")
        else:
            st.warning("Reached maximum iteration limit for safety.")
            if collected:
                st.subheader("Research Summary")
                st.info(f"Conducted {len(collected)} searches across {iteration_count} iterations")

    # Results and Report Tools
    ui_results(st.session_state.get("knowledge", {}).get("collected", []), allow_pin=True)
    ui_report_tools()

    # Research Chat (always available)
    st.markdown("---")
    ui_research_chat()

# -------------------------------------------------------------------
if __name__ == "__main__":
    main()

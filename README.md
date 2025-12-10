# Honda AURA - Deep Research Studio

AI-powered research platform with structured workflows, multi-source search, and comprehensive report generation.

## Features

- 🔐 Firebase Authentication & Supabase History
- 📊 LangGraph Orchestration + Langfuse Tracking
- 🔍 Multi-Source Search (Web + arXiv)
- 🤖 Weighted Query Generation (1-5 priority)
- 💬 Interactive Chat with MCP Support
- 🎨 Dual Interfaces: Next.js (production) + Streamlit (experimental)

## Project Structure

```
deep-research-clone/
├── react-ui/              # Next.js 15 production interface
├── streamlit-ui/          # Streamlit experimental prototype
├── mcp/                   # Model Context Protocol servers
└── backend/               # Optional backend services
```

## Quick Start

### React Interface (Recommended)

```bash
cd react-ui
npm install --legacy-peer-deps
cp .env.example .env.local  # Add your API keys
npm run dev
```

Access at: http://localhost:3000

### Streamlit Interface (Experimental)

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
streamlit run streamlit-ui/app.py
```

Access at: http://localhost:8501

## Configuration

Create `.env.local` in `react-ui/`:

```env
OPENAI_API_KEY=your_openai_key
SERPER_API_KEY=your_serper_key

# Optional
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
```

## Usage

1. **Enter Topic** → Research question
2. **Clarify Scope** → Answer 3-5 questions
3. **Set Priorities** → Assign weights (1-5)
4. **Review Queries** → Edit search queries
5. **Generate Report** → AI synthesizes 50+ sources
6. **Chat** → Ask follow-up questions

## Tech Stack

- Next.js 15, React 19, TypeScript, Tailwind CSS v4
- LangGraph, OpenAI GPT-4o, Serper API, arXiv API
- Firebase, Supabase, Langfuse

## Troubleshooting

**pnpm warnings** - Safe to ignore, use `npm install --legacy-peer-deps`

**ArXiv no results** - Normal for non-academic topics

**Context exceeded** - ArXiv limited to 5 results per query

## License

MIT

---

Built with Next.js, LangGraph, and GPT-4o
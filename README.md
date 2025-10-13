# Deep Research Clone (Unified Repository)

This repository contains two separate frontend projects managed under a single environment.

## Project Structure
\`\`\`
deep-research-clone/
├── react-ui/        # React (Next.js) interface
├── streamlit-ui/    # Streamlit experimental interface
├── requirements.txt # Python dependencies
└── venv/            # Shared virtual environment
\`\`\`

## How to Run

### 1. Streamlit (Python)
\`\`\`bash
source venv/bin/activate
pip install -r requirements.txt
streamlit run streamlit-ui/app.py
\`\`\`

### 2. React (Next.js)
\`\`\`bash
cd react-ui
npm install
npm run dev
\`\`\`

## Branch Information
- main: base branch  
- hanjo: development branch

## Notes
- Streamlit app runs at: http://localhost:8501  
- React app runs at: http://localhost:3000  
- Use \`pip freeze > requirements.txt\` to lock dependencies after updates.

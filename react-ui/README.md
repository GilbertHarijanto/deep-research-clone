# Honda IRIS - Deep Research Studio

A minimal, monochrome AI research interface for structured research workflows.

## Features

- 🔐 **Firebase Authentication** - Secure login with email/password and Google OAuth
- 📚 **Research History** - Save and access previous research sessions via Supabase
- 📊 **Langfuse Tracking** - Track all LLM calls with detailed telemetry
- 🎨 **Monochrome Design** - Clean, minimal black & white interface
- 🔄 **Structured Workflow** - Topic → Clarify → Queries → Run → Report → Chat

## Setup

### 1. Install Dependencies

\`\`\`bash
npm install
\`\`\`

### 2. Configure Environment Variables

Copy `.env.local` and fill in your credentials:

\`\`\`env
# OpenAI
OPENAI_API_KEY=your_openai_key

# Langfuse
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_HOST=https://us.cloud.langfuse.com

# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
\`\`\`

### 3. Set Up Supabase Database

Run the SQL script in your Supabase SQL editor:

\`\`\`bash
# The script is located at: scripts/create-research-sessions-table.sql
\`\`\`

This creates the `research_sessions` table with Row Level Security enabled.

### 4. Run Development Server

\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Architecture

### Authentication (Firebase)
- Email/password and Google OAuth
- User context managed via React Context API
- Protected routes and session persistence

### Data Storage (Supabase)
- Research sessions stored with user_id
- Row Level Security ensures users only see their own data
- Real-time updates supported

### LLM Tracking (Langfuse)
- All OpenAI calls tracked with metadata
- Similar to Python OpenTelemetry implementation
- Tracks: model, input, output, duration, errors
- See `lib/langfuse.ts` for implementation

### API Routes
- `/api/research` - Generate questions and queries
- Uses `trackedLLMCall` wrapper for automatic Langfuse logging

## Usage

1. **Sign In** - Click "Sign In" in the top right
2. **Start Research** - Enter your research topic
3. **Answer Questions** - Clarify your research scope
4. **Review Queries** - Edit generated research queries
5. **Run Research** - Execute the research workflow
6. **View Report** - Read the generated report
7. **Chat** - Ask follow-up questions

Your research sessions are automatically saved and accessible via the burger menu (☰) on the left.

## Development

- Built with Next.js 15, React 19, TypeScript
- Styled with Tailwind CSS v4
- UI components from shadcn/ui
- Monochrome design system (black, white, grays only)

## License

MIT

import { type NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { trackedLLMCall } from "@/lib/langfuse"
import { Langfuse } from "langfuse"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const langfuse = new Langfuse({
  publicKey: process.env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_BASE_URL,
})

function safeJsonParse<T = unknown>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T
  } catch {
    return fallback
  }
}

// Helper function: Log event to Langfuse
async function logEvent(
  name: string,
  metadata: Record<string, any>,
  traceId?: string
) {
  try {
    const trace = traceId 
      ? langfuse.trace({ id: traceId })
      : langfuse.trace({ name })
    
    trace.event({
      name,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
      },
    })
    
    await langfuse.flushAsync()
  } catch (error) {
    console.error(`[Langfuse] Failed to log event "${name}":`, error)
  }
}

// ✅ NEW: Helper function to parse arXiv XML response
function parseArxivXML(xmlText: string): any[] {
  const entries: any[] = []
  
  // Simple regex-based XML parsing (for production, use a proper XML parser)
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
  const matches = xmlText.matchAll(entryRegex)
  
  for (const match of matches) {
    const entryXML = match[1]
    
    // Extract fields
    const title = entryXML.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim().replace(/\s+/g, ' ') || ''
    const summary = entryXML.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.trim().replace(/\s+/g, ' ') || ''
    const published = entryXML.match(/<published>([\s\S]*?)<\/published>/)?.[1]?.trim() || ''
    const updated = entryXML.match(/<updated>([\s\S]*?)<\/updated>/)?.[1]?.trim() || ''
    const id = entryXML.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim() || ''
    
    // Extract authors
    const authorRegex = /<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g
    const authors: string[] = []
    const authorMatches = entryXML.matchAll(authorRegex)
    for (const authorMatch of authorMatches) {
      authors.push(authorMatch[1].trim())
    }
    
    // Extract PDF link
    const pdfLink = entryXML.match(/<link.*?title="pdf".*?href="([\s\S]*?)"/) || 
                    entryXML.match(/<link.*?href="([\s\S]*?)".*?title="pdf"/)
    const pdfUrl = pdfLink?.[1]?.trim() || id.replace('/abs/', '/pdf/')
    
    entries.push({
      title,
      summary,
      authors,
      published,
      updated,
      id,
      pdfUrl,
    })
  }
  
  return entries
}

// ✅ NEW: Helper function to search arXiv
async function performArxivSearch(
  query: string,
  maxResults: number = 10,
  traceId?: string
) {
  const startTime = Date.now()
  
  try {
    await logEvent('arxiv_search_start', {
      query,
      maxResults,
    }, traceId)
    
    // arXiv API endpoint
    const encodedQuery = encodeURIComponent(query)
    const url = `http://export.arxiv.org/api/query?search_query=all:${encodedQuery}&start=0&max_results=${maxResults}&sortBy=relevance&sortOrder=descending`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'IRIS-Research-Agent/1.0',
      },
    })

    if (!response.ok) {
      console.error(`[arXiv] Search failed: ${response.status}`)
      
      await logEvent('arxiv_search_failed', {
        query,
        statusCode: response.status,
        duration: Date.now() - startTime,
      }, traceId)
      
      return []
    }

    const xmlText = await response.text()
    const results = parseArxivXML(xmlText)
    
    await logEvent('arxiv_search_success', {
      query,
      resultsCount: results.length,
      duration: Date.now() - startTime,
      topResults: results.slice(0, 3).map(r => ({
        title: r.title.substring(0, 100),
        authors: r.authors.slice(0, 2).join(', '),
      })),
    }, traceId)
    
    return results
  } catch (error) {
    console.error('[arXiv] Error:', error)
    
    await logEvent('arxiv_search_error', {
      query,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    }, traceId)
    
    return []
  }
}

// Helper function: Perform web search using Serper API WITH TRACING
async function performWebSearch(
  query: string, 
  numResults: number = 10,
  traceId?: string
) {
  const startTime = Date.now()
  
  try {
    await logEvent('web_search_start', {
      query,
      numResults,
      provider: 'serper',
    }, traceId)
    
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.SERPER_API_KEY || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        num: numResults,
      }),
    })

    if (!response.ok) {
      console.error(`[Serper] Search failed: ${response.status}`)
      
      await logEvent('web_search_failed', {
        query,
        statusCode: response.status,
        duration: Date.now() - startTime,
      }, traceId)
      
      return []
    }

    const data = await response.json()
    const results = data.organic || []
    
    await logEvent('web_search_success', {
      query,
      resultsCount: results.length,
      duration: Date.now() - startTime,
      topResults: results.slice(0, 3).map((r: any) => ({
        title: r.title,
        url: r.link,
      })),
    }, traceId)
    
    return results
  } catch (error) {
    console.error('[Serper] Error:', error)
    
    await logEvent('web_search_error', {
      query,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    }, traceId)
    
    return []
  }
}

// ✅ NEW: Combined search function (Web + arXiv)
async function performCombinedSearch(
  query: string,
  includeArxiv: boolean = true,
  traceId?: string
) {
  const startTime = Date.now()
  
  await logEvent('combined_search_start', {
    query,
    includeArxiv,
  }, traceId)
  
  // Perform searches in parallel
  const searchPromises: Promise<any>[] = [
    performWebSearch(query, 8, traceId)
  ]
  
  if (includeArxiv) {
    searchPromises.push(performArxivSearch(query, 5, traceId))
  }
  
  const [webResults, arxivResults = []] = await Promise.all(searchPromises)
  
  await logEvent('combined_search_completed', {
    query,
    webResultsCount: webResults.length,
    arxivResultsCount: arxivResults.length,
    duration: Date.now() - startTime,
  }, traceId)
  
  return {
    web: webResults,
    arxiv: arxivResults,
  }
}

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now()
  
  try {
    const body = await request.json()
    const { action, topic } = body ?? {}

    if (!action) {
      return NextResponse.json({ error: "Missing 'action'." }, { status: 400 })
    }

    // Log incoming request
    await logEvent('api_request', {
      action,
      topic,
      hasBody: !!body,
    })

    // Generate initial clarifying questions
    if (action === "generate_questions") {
      if (!topic) {
        return NextResponse.json({ error: "Topic is required" }, { status: 400 })
      }

      const result = await trackedLLMCall(
        {
          model: "gpt-4o-mini",
          input: topic,
          instructions: `You are an expert research strategist. Generate 3-5 sharp, specific clarifying questions to understand the user's research intent.`,
          metadata: {
            action: 'generate_questions',
            topic,
            step: 1,
          },
        },
        async () => {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0.7,
            messages: [
              {
                role: "system",
                content:
                  "You are an expert research strategist helping to clarify a research topic. Your goal is to ask insightful questions that will help narrow down the scope and understand the user's specific interests, constraints, and goals.\n\n" +
                  "Ask questions that reveal:\n" +
                  "- What specific aspect they're most interested in (not just general curiosity)\n" +
                  "- Their concrete goals or intended outcomes (are they building something? learning? deciding?)\n" +
                  "- Practical constraints (time, budget, technical requirements, team size)\n" +
                  "- Desired depth and scope (overview vs deep dive, theory vs implementation)\n" +
                  "- Context or existing knowledge they're building upon\n\n" +
                  "Make questions specific and actionable. Avoid vague questions like 'tell me more' - instead ask targeted questions that will shape the research direction.\n\n" +
                  "Return ONLY a JSON array of question strings - no additional prose, markdown, or formatting.",
              },
              {
                role: "user",
                content: `Research Topic: "${topic}"\n\nGenerate 3-5 clarifying questions as a JSON array of strings.`,
              },
            ],
          })
          const output = completion.choices[0]?.message?.content ?? "[]"
          return { output, responseId: completion.id }
        }
      )

      const questions = safeJsonParse<string[]>(result.output, [
        `What specific aspect of "${topic}" interests you most?`,
        "What is your primary goal or outcome for this research?",
        "Are there constraints (time, data, tools) we should consider?",
      ])

      await logEvent('questions_generated', {
        topic,
        questionCount: questions.length,
        questions: questions.map(q => q.substring(0, 100)),
      })

      return NextResponse.json({ questions })
    }

    // Generate follow-up clarifying question
    if (action === "clarify_followup") {
      const { context } = body as {
        context: Array<{ question: string; answer: string }>
      }

      if (!topic || !Array.isArray(context)) {
        return NextResponse.json(
          { error: "Both 'topic' and 'context' (Q&A array) are required." },
          { status: 400 }
        )
      }

      const result = await trackedLLMCall(
        {
          model: "gpt-4o-mini",
          input: { topic, context },
          instructions:
            "Generate one insightful follow-up question based on previous answers to further clarify the research direction.",
          metadata: {
            action: 'clarify_followup',
            topic,
            contextLength: context.length,
            step: 2,
          },
        },
        async () => {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0.7,
            messages: [
              {
                role: "system",
                content:
                  "You are an expert research strategist conducting a clarifying interview. Based on the research topic and the user's previous answers, generate ONE insightful follow-up question.\n\n" +
                  "Your follow-up question should:\n" +
                  "- Build naturally on what they've already said (reference their previous answers)\n" +
                  "- Help narrow down or expand the research scope appropriately\n" +
                  "- Reveal practical constraints, preferences, or priorities they haven't mentioned yet\n" +
                  "- Feel conversational and relevant (not generic)\n" +
                  "- Dig deeper into the most important aspects they've indicated\n\n" +
                  "Examples of GOOD follow-ups:\n" +
                  "- 'You mentioned wanting to implement this in 2 weeks - what's your current team's skill level with these tools?'\n" +
                  "- 'Since you're focused on production deployment, do you need examples that work with your specific CI/CD setup?'\n\n" +
                  "Examples of BAD follow-ups:\n" +
                  "- 'Tell me more about that' (too vague)\n" +
                  "- 'What else should I know?' (not specific)\n\n" +
                  "Output must be a single line of plain text - just the question, no quotes, no extra formatting.",
              },
              {
                role: "user",
                content:
                  `Research Topic: ${topic}\n\n` +
                  `Previous Q&A:\n${context.map((qa, i) => `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}`).join("\n\n")}\n\n` +
                  `Based on their answers, what's ONE relevant follow-up question to ask next?`,
              },
            ],
          })
          const output = (completion.choices[0]?.message?.content ?? "").trim()
          return { output, responseId: completion.id }
        }
      )

      const nextQuestion = result.output.replace(/^["']|["']$/g, "").trim()
      
      await logEvent('followup_generated', {
        topic,
        contextLength: context.length,
        question: nextQuestion.substring(0, 200),
      })

      return NextResponse.json({ nextQuestion })
    }

    // Generate initial research queries from clarifying answers
    if (action === "generate_queries") {
      const { clarifyingData } = body as {
        clarifyingData: Array<{ question: string; answer: string; weight?: number }>
      }
      
      if (!topic) {
        return NextResponse.json({ error: "Topic is required" }, { status: 400 })
      }

      const result = await trackedLLMCall(
        {
          model: "gpt-4o-mini",
          input: { topic, clarifyingData },
          instructions:
            "Generate 5-7 specific, actionable research queries. Prioritize and allocate more queries to aspects with higher weight values (1-5 scale).",
          metadata: {
            action: 'generate_queries',
            topic,
            questionCount: clarifyingData.length,
            weights: clarifyingData.map(d => d.weight || 3),
            averageWeight: clarifyingData.reduce((sum, d) => sum + (d.weight || 3), 0) / clarifyingData.length,
            step: 3,
          },
        },
        async () => {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0.7,
            messages: [
              {
                role: "system",
                content:
                  "You are an expert research strategist. Based on the user's clarifying answers and their priority weights (1-5), generate specific, actionable research queries.\n\n" +
                  "=== WEIGHT ALLOCATION STRATEGY ===\n" +
                  "- Weight 5 (Critical Priority): Generate 2-3 detailed, specific queries about this aspect\n" +
                  "- Weight 4 (High Priority): Generate 1-2 focused queries\n" +
                  "- Weight 3 (Medium Priority): Generate 1 query\n" +
                  "- Weight 2 (Low Priority): Generate 0-1 brief queries\n" +
                  "- Weight 1 (Minimal Priority): Skip or only include if space allows\n\n" +
                  "Total: Generate 5-7 queries overall.\n\n" +
                  "=== QUERY QUALITY GUIDELINES ===\n" +
                  "Each query must be:\n" +
                  "1. SPECIFIC: Include exact technologies, tools, or methodologies mentioned by the user\n" +
                  "   - BAD: 'code style best practices'\n" +
                  "   - GOOD: 'ESLint Prettier configuration for Next.js TypeScript projects'\n\n" +
                  "2. SEARCHABLE: Written as you would type into a search engine\n" +
                  "   - Include specific version numbers if mentioned (Next.js 14, React 18)\n" +
                  "   - Include constraints (time limits, team size, budget)\n\n" +
                  "3. ACTIONABLE: Should lead to concrete, implementable results\n" +
                  "   - BAD: 'understand code consistency'\n" +
                  "   - GOOD: 'GitHub Actions setup automated code formatting React'\n\n" +
                  "4. TAILORED: Directly reflect the user's stated goals and constraints\n" +
                  "   - If they mentioned 2-4 weeks timeline, include 'quick setup' or 'fast implementation'\n" +
                  "   - If they mentioned specific tools, use those exact names\n\n" +
                  "=== EXAMPLES ===\n" +
                  "If user wants 'ESLint setup for React with 2-week timeline' (weight 5):\n" +
                  "- 'ESLint Prettier configuration examples Next.js TypeScript starter template'\n" +
                  "- 'Step-by-step ESLint React setup guide 2024 best practices'\n" +
                  "- 'Pre-commit hooks Husky Lint-staged React projects quick setup'\n\n" +
                  "Return ONLY a JSON array of query strings. No commentary, explanations, or markdown formatting.",
              },
              {
                role: "user",
                content:
                  `Research Topic: "${topic}"\n\n` +
                  `Clarifying Q&A with priority weights (1=minimal, 5=critical):\n\n${clarifyingData.map((qa, i) => 
                    `${i + 1}. [Weight: ${qa.weight || 3}/5]\n` +
                    `   Q: ${qa.question}\n` +
                    `   A: ${qa.answer}`
                  ).join("\n\n")}\n\n` +
                  `Generate 5-7 specific research queries as a JSON array of strings.\n\n` +
                  `CRITICAL: Allocate MORE queries to higher-weighted aspects:\n` +
                  `- Weight 5 answers → 2-3 queries each\n` +
                  `- Weight 4 answers → 1-2 queries each\n` +
                  `- Weight 3 answers → 1 query each\n` +
                  `- Weight 1-2 answers → 0-1 queries or skip\n\n` +
                  `Make queries hyper-specific using exact tools, technologies, and constraints they mentioned.`,
              },
            ],
          })
          const output = completion.choices[0]?.message?.content ?? "[]"
          return { output, responseId: completion.id }
        }
      )

      const queries = safeJsonParse<string[]>(result.output, [
        `Overview of ${topic}`,
        `Recent developments in ${topic}`,
        `Key challenges in ${topic}`,
      ])

      await logEvent('queries_generated', {
        topic,
        queryCount: queries.length,
        queries: queries.map(q => q.substring(0, 100)),
        weights: clarifyingData.map(d => d.weight || 3),
      })

      return NextResponse.json({ queries })
    }

    // Generate alternative research queries
    if (action === "generate_alternative_queries") {
      const { clarifyingData, currentQueries } = body as {
        clarifyingData: Array<{ question: string; answer: string; weight?: number }>
        currentQueries: string[]
      }
      
      if (!topic) {
        return NextResponse.json({ error: "Topic is required" }, { status: 400 })
      }

      const result = await trackedLLMCall(
        {
          model: "gpt-4o-mini",
          input: { topic, clarifyingData, currentQueries },
          instructions:
            "Generate 5-7 alternative research queries that explore different angles and perspectives from the current queries.",
          metadata: {
            action: 'generate_alternative_queries',
            topic,
            currentQueryCount: currentQueries.length,
            step: 3.5,
          },
        },
        async () => {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0.85,
            messages: [
              {
                role: "system",
                content:
                  "You are a creative research strategist. Your task is to generate ALTERNATIVE queries that explore DIFFERENT perspectives from the current ones.\n\n" +
                  "=== DIFFERENTIATION STRATEGY ===\n" +
                  "If current queries focus on:\n" +
                  "- 'HOW to implement' → Try 'WHY it works', 'WHEN to use', 'WHAT can go wrong'\n" +
                  "- 'Configuration setup' → Try 'Real-world case studies', 'Common pitfalls', 'Alternative approaches'\n" +
                  "- 'Tool A' → Try 'Tool A vs Tool B comparison', 'Tool A limitations', 'Tool A alternatives'\n" +
                  "- 'Technical implementation' → Try 'Team adoption strategies', 'ROI and metrics', 'Change management'\n\n" +
                  "=== EXPLORATION ANGLES ===\n" +
                  "Consider these different perspectives:\n" +
                  "1. Implementation vs Theory: If current is practical, try conceptual (or vice versa)\n" +
                  "2. Narrow vs Broad: If current is specific tools, try ecosystem-level view\n" +
                  "3. Success vs Failure: Include 'common mistakes', 'anti-patterns', 'what not to do'\n" +
                  "4. Short-term vs Long-term: 'Quick wins' vs 'Scalability considerations'\n" +
                  "5. Different stakeholders: Developer experience, team lead perspective, business impact\n" +
                  "6. Edge cases: 'Large teams', 'Legacy codebases', 'Monorepo setups'\n\n" +
                  "=== QUALITY GUIDELINES ===\n" +
                  "- Still respect priority weights (more alternatives for high-weight aspects)\n" +
                  "- Maintain specificity and searchability\n" +
                  "- Stay relevant to user's core goals\n" +
                  "- Balance creativity with practicality\n\n" +
                  "=== EXAMPLES ===\n" +
                  "Current: 'ESLint Prettier setup Next.js'\n" +
                  "Alternatives:\n" +
                  "- 'ESLint vs Biome vs dprint performance comparison 2024'\n" +
                  "- 'Common ESLint configuration mistakes React projects avoid'\n" +
                  "- 'Migrating existing codebase to strict ESLint rules gradually'\n" +
                  "- 'Developer adoption resistance ESLint solving team pushback'\n\n" +
                  "Return ONLY a JSON array of 5-7 query strings. No commentary.",
              },
              {
                role: "user",
                content:
                  `Research Topic: "${topic}"\n\n` +
                  `Current queries (generate DIFFERENT angles from these):\n${currentQueries.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\n` +
                  `User context with weights:\n${clarifyingData.map((qa, i) => 
                    `${i + 1}. [Weight: ${qa.weight || 3}/5]\n` +
                    `   ${qa.answer.substring(0, 150)}${qa.answer.length > 150 ? '...' : ''}`
                  ).join("\n\n")}\n\n` +
                  `Generate 5-7 alternative queries that explore DIFFERENT angles.\n` +
                  `Make them creative but still practical and relevant to high-priority aspects.`,
              },
            ],
          })
          const output = completion.choices[0]?.message?.content ?? "[]"
          return { output, responseId: completion.id }
        }
      )

      const queries = safeJsonParse<string[]>(result.output, [
        `Alternative perspective on ${topic}`,
        `Emerging trends in ${topic}`,
        `Best practices for ${topic}`,
        `Common misconceptions about ${topic}`,
        `Future outlook for ${topic}`,
      ])

      await logEvent('alternative_queries_generated', {
        topic,
        queryCount: queries.length,
        queries: queries.map(q => q.substring(0, 100)),
      })

      return NextResponse.json({ queries })
    }

    // ✅ MODIFIED: Synthesize final research report with WEB SEARCH + ARXIV
    if (action === "synthesize_report") {
      const { queries, includeArxiv = true } = body as {
        queries: Array<{ id: string; query: string; priority: number }>
        includeArxiv?: boolean
      }
      
      if (!topic) {
        return NextResponse.json({ error: "Topic is required" }, { status: 400 })
      }

      // Check if SERPER_API_KEY is configured
      if (!process.env.SERPER_API_KEY) {
        return NextResponse.json({ 
          error: "SERPER_API_KEY not configured. Please add it to your .env file." 
        }, { status: 500 })
      }

      try {
        console.log(`[Research] Starting searches for ${queries.length} queries... (arXiv: ${includeArxiv})`)
        
        await logEvent('report_synthesis_start', {
          topic,
          queryCount: queries.length,
          includeArxiv,
          queries: queries.map(q => ({ query: q.query, priority: q.priority })),
        })
        
        // ✅ Step 1: Execute combined searches (Web + arXiv) for each query
        const searchResults: Array<{
          query: string
          priority: number
          webResults: any[]
          arxivResults: any[]
        }> = []

        for (const query of queries) {
          try {
            console.log(`[Research] Searching: ${query.query}`)
            
            const { web, arxiv } = await performCombinedSearch(query.query, includeArxiv)
            
            if (web.length > 0 || arxiv.length > 0) {
              searchResults.push({
                query: query.query,
                priority: query.priority,
                webResults: web,
                arxivResults: arxiv,
              })
            }

            // Rate limiting - wait 1 second between requests
            await new Promise(resolve => setTimeout(resolve, 1000))
          } catch (searchError) {
            console.error(`[Research] Error searching query "${query.query}":`, searchError)
            
            await logEvent('search_query_error', {
              query: query.query,
              error: searchError instanceof Error ? searchError.message : 'Unknown error',
            })
          }
        }

        if (searchResults.length === 0) {
          await logEvent('report_synthesis_failed', {
            topic,
            reason: 'no_search_results',
          })
          
          return NextResponse.json({ 
            error: "No search results found. Unable to generate report. Please check your SERPER_API_KEY." 
          }, { status: 500 })
        }

        const totalWebSources = searchResults.reduce((sum, sr) => sum + sr.webResults.length, 0)
        const totalArxivSources = searchResults.reduce((sum, sr) => sum + sr.arxivResults.length, 0)

        console.log(`[Research] Collected ${searchResults.length} search result sets (Web: ${totalWebSources}, arXiv: ${totalArxivSources})`)

        await logEvent('web_searches_completed', {
          topic,
          totalQueries: queries.length,
          successfulSearches: searchResults.length,
          totalWebSources,
          totalArxivSources,
        })

        // ✅ Step 2: Extract and structure relevant content (combine web + arXiv)
        const structuredData = searchResults.map(sr => {
          // Format web results
          const webSources = sr.webResults.map((result: any) => ({
            type: 'web',
            title: result.title || 'Untitled',
            url: result.link || result.url || '',
            snippet: result.snippet || result.description || '',
          }))
          
          // Format arXiv results
          const arxivSources = sr.arxivResults.map((paper: any) => ({
            type: 'arxiv',
            title: paper.title,
            url: paper.id,
            pdfUrl: paper.pdfUrl,
            snippet: paper.summary,
            authors: paper.authors.join(', '),
            published: paper.published,
          }))
          
          return {
            query: sr.query,
            priority: sr.priority,
            sources: [...webSources, ...arxivSources], // Combine both
          }
        })

        // Step 3: Generate Markdown report
        const markdownResult = await trackedLLMCall(
          {
            model: "gpt-4o",
            input: { topic, queries, searchResults: structuredData },
            instructions:
              "Generate a comprehensive research report in MARKDOWN format based ONLY on the provided web search results and arXiv papers.",
            metadata: {
              action: 'synthesize_report_markdown',
              topic,
              queryCount: queries.length,
              webSourceCount: totalWebSources,
              arxivSourceCount: totalArxivSources,
              step: 4,
            },
          },
          async () => {
            const completion = await openai.chat.completions.create({
              model: "gpt-4o",
              temperature: 0.3,
              messages: [
                {
                  role: "system",
                  content:
                    "You are an expert research report writer. Generate a comprehensive, FACTUAL report based ONLY on the provided web search results and arXiv papers.\n\n" +
                    "=== CRITICAL RULES ===\n" +
                    "1. ONLY use information from the provided search results\n" +
                    "2. NEVER make up facts, statistics, or claims\n" +
                    "3. EVERY factual claim MUST have a citation [n]\n" +
                    "4. If information is not in the search results, explicitly state 'Information not available in current search results'\n" +
                    "5. Use exact titles and URLs from search results in References\n" +
                    "6. For arXiv papers, include author names and publication dates\n" +
                    "7. Do NOT hallucinate or invent information\n\n" +
                    "=== SOURCE TYPES ===\n" +
                    "You have two types of sources:\n" +
                    "- Web sources: General web pages, blog posts, documentation\n" +
                    "- arXiv papers: Academic preprints with authors and abstracts\n" +
                    "Prioritize academic sources (arXiv) for theoretical foundations and recent research.\n\n" +
                    "=== REPORT STRUCTURE ===\n" +
                    "# [Topic Title]\n\n" +
                    "## Executive Summary\n" +
                    "2-3 paragraphs summarizing key findings from search results. Lead with the most actionable insight.\n\n" +
                    "## Key Findings\n" +
                    "Organize findings by themes (use ### for sub-sections). Each finding must cite sources [n].\n\n" +
                    "## Academic Literature Review (if arXiv papers found)\n" +
                    "Summarize key academic papers, their methodologies, and findings.\n\n" +
                    "## Detailed Analysis\n" +
                    "Deep dive into each major aspect found in search results.\n\n" +
                    "## Practical Recommendations\n" +
                    "Based on search results, provide actionable steps.\n\n" +
                    "## Implementation Considerations\n" +
                    "Challenges, best practices, common pitfalls.\n\n" +
                    "## Research Gaps\n" +
                    "Explicitly state what information was NOT found.\n\n" +
                    "## Conclusion\n" +
                    "Synthesize key points and suggest next steps.\n\n" +
                    "## References\n" +
                    "[1] Title – https://url.com\n" +
                    "[2] Authors (Year). Paper Title. arXiv:XXXX.XXXXX\n\n" +
                    "=== CITATION FORMAT ===\n" +
                    "Use [1], [2], [3] for inline citations. Every factual claim needs a citation.\n\n" +
                    "=== ABSOLUTELY FORBIDDEN ===\n" +
                    "❌ Do NOT invent statistics or data\n" +
                    "❌ Do NOT cite sources not provided\n" +
                    "❌ Do NOT make claims without citations\n" +
                    "❌ Do NOT use placeholder URLs",
                },
                {
                  role: "user",
                  content:
                    `Research Topic: "${topic}"\n\n` +
                    `=== SEARCH RESULTS (Web + arXiv) ===\n\n` +
                    structuredData.map((sd, idx) => 
                      `Query ${idx + 1}: "${sd.query}" (Priority: ${sd.priority})\n\n` +
                      sd.sources.map((source, sIdx) => {
                        if (source.type === 'arxiv') {
                          return `[Source ${idx + 1}.${sIdx + 1}] [arXiv Paper]\n` +
                                 `Title: ${source.title}\n` +
                                 `Authors: ${source.authors}\n` +
                                 `Published: ${source.published}\n` +
                                 `URL: ${source.url}\n` +
                                 `PDF: ${source.pdfUrl}\n` +
                                 `Abstract: ${source.snippet.substring(0, 500)}...\n\n`
                        } else {
                          return `[Source ${idx + 1}.${sIdx + 1}] [Web]\n` +
                                 `Title: ${source.title}\n` +
                                 `URL: ${source.url}\n` +
                                 `Snippet: ${source.snippet}\n\n`
                        }
                      }).join('')
                    ).join('---\n\n') +
                    `\n\nGenerate a comprehensive Markdown research report using ONLY the information provided above.`,
                },
              ],
            })
            const output = completion.choices[0]?.message?.content ?? ""
            return { output, responseId: completion.id }
          }
        )

        // Step 4: Generate structured JSON report
        const jsonResult = await trackedLLMCall(
          {
            model: "gpt-4o",
            input: { topic, queries, searchResults: structuredData },
            instructions:
              "Generate a structured JSON report based ONLY on the provided web search results and arXiv papers.",
            metadata: {
              action: 'synthesize_report_json',
              topic,
              queryCount: queries.length,
              webSourceCount: totalWebSources,
              arxivSourceCount: totalArxivSources,
              step: 4.5,
            },
          },
          async () => {
            const completion = await openai.chat.completions.create({
              model: "gpt-4o",
              temperature: 0.3,
              response_format: { type: "json_object" },
              messages: [
                {
                  role: "system",
                  content:
                    "You are an expert research report writer. Generate a STRUCTURED JSON report based ONLY on the provided web search results and arXiv papers.\n\n" +
                    "=== JSON SCHEMA ===\n" +
                    "{\n" +
                    '  "title": "string - research topic title",\n' +
                    '  "executiveSummary": "string - 2-3 paragraph summary",\n' +
                    '  "keyFindings": [\n' +
                    '    {\n' +
                    '      "theme": "string - theme name",\n' +
                    '      "findings": ["string - finding 1", "string - finding 2"],\n' +
                    '      "citations": [1, 2] // reference IDs\n' +
                    '    }\n' +
                    '  ],\n' +
                    '  "academicPapers": [\n' +
                    '    {\n' +
                    '      "title": "string",\n' +
                    '      "authors": "string",\n' +
                    '      "year": "string",\n' +
                    '      "summary": "string",\n' +
                    '      "arxivId": "string",\n' +
                    '      "pdfUrl": "string"\n' +
                    '    }\n' +
                    '  ],\n' +
                    '  "detailedAnalysis": {\n' +
                    '    "sections": [\n' +
                    '      {\n' +
                    '        "heading": "string",\n' +
                    '        "content": "string",\n' +
                    '        "citations": [1, 2]\n' +
                    '      }\n' +
                    '    ]\n' +
                    '  },\n' +
                    '  "recommendations": [\n' +
                    '    {\n' +
                    '      "title": "string",\n' +
                    '      "description": "string",\n' +
                    '      "priority": "high|medium|low",\n' +
                    '      "citations": [1, 2]\n' +
                    '    }\n' +
                    '  ],\n' +
                    '  "implementationConsiderations": {\n' +
                    '    "challenges": ["string"],\n' +
                    '    "bestPractices": ["string"],\n' +
                    '    "pitfalls": ["string"],\n' +
                    '    "resourceRequirements": {\n' +
                    '      "time": "string",\n' +
                    '      "cost": "string",\n' +
                    '      "skills": ["string"]\n' +
                    '    }\n' +
                    '  },\n' +
                    '  "researchGaps": ["string - what info was NOT found"],\n' +
                    '  "conclusion": "string - synthesis and next steps",\n' +
                    '  "references": [\n' +
                    '    {\n' +
                    '      "id": 1,\n' +
                    '      "type": "web|arxiv",\n' +
                    '      "title": "string",\n' +
                    '      "url": "string",\n' +
                    '      "authors": "string (for arXiv)",\n' +
                    '      "year": "string (for arXiv)",\n' +
                    '      "source": "string - domain name"\n' +
                    '    }\n' +
                    '  ]\n' +
                    '}\n\n' +
                    "=== CRITICAL RULES ===\n" +
                    "1. ONLY use information from provided search results\n" +
                    "2. Every finding/recommendation MUST include citations array\n" +
                    "3. Reference IDs must match the references array\n" +
                    "4. If information missing, include in researchGaps\n" +
                    "5. Separate arXiv papers in academicPapers array\n" +
                    "6. Do NOT invent data or sources\n\n" +
                    "Output valid JSON matching this exact schema.",
                },
                {
                  role: "user",
                  content:
                    `Research Topic: "${topic}"\n\n` +
                    `=== SEARCH RESULTS (Web + arXiv) ===\n\n` +
                    structuredData.map((sd, idx) => 
                      `Query ${idx + 1}: "${sd.query}"\n\n` +
                      sd.sources.map((source, sIdx) => {
                        if (source.type === 'arxiv') {
                          return `[Source ${idx + 1}.${sIdx + 1}] [arXiv]\n` +
                                 `Title: ${source.title}\n` +
                                 `Authors: ${source.authors}\n` +
                                 `Published: ${source.published}\n` +
                                 `URL: ${source.url}\n` +
                                 `Abstract: ${source.snippet.substring(0, 300)}...\n\n`
                        } else {
                          return `[Source ${idx + 1}.${sIdx + 1}] [Web]\n` +
                                 `Title: ${source.title}\n` +
                                 `URL: ${source.url}\n` +
                                 `Snippet: ${source.snippet}\n\n`
                        }
                      }).join('')
                    ).join('---\n\n') +
                    `\n\nGenerate a structured JSON report using ONLY the information above.\n` +
                    `Create the references array first by numbering all unique sources (both web and arXiv), then use those IDs in citations.`,
                },
              ],
            })
            const output = completion.choices[0]?.message?.content ?? "{}"
            return { output, responseId: completion.id }
          }
        )

        // Parse JSON output
        const structuredReport = safeJsonParse(jsonResult.output, {
          title: topic,
          executiveSummary: "Report generation failed",
          keyFindings: [],
          academicPapers: [],
          detailedAnalysis: { sections: [] },
          recommendations: [],
          implementationConsiderations: {
            challenges: [],
            bestPractices: [],
            pitfalls: [],
            resourceRequirements: { time: "", cost: "", skills: [] }
          },
          researchGaps: ["Failed to generate structured report"],
          conclusion: "",
          references: []
        })

        await logEvent('report_synthesis_completed', {
          topic,
          markdownLength: markdownResult.output.length,
          referenceCount: structuredReport.references.length,
          arxivPaperCount: structuredReport.academicPapers?.length || 0,
          recommendationCount: structuredReport.recommendations.length,
          researchGapCount: structuredReport.researchGaps.length,
        })

        // Step 5: Return BOTH formats
        return NextResponse.json({ 
          markdown: markdownResult.output,
          structured: structuredReport,
          metadata: {
            topic: topic,
            queriesSearched: searchResults.length,
            totalWebSources,
            totalArxivSources,
            totalSources: totalWebSources + totalArxivSources,
            timestamp: new Date().toISOString(),
            models: {
              markdown: "gpt-4o",
              structured: "gpt-4o"
            }
          },
          searchData: structuredData
        })

      } catch (error) {
        console.error("[Research] Error in synthesize_report:", error)
        
        await logEvent('report_synthesis_error', {
          topic,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        })
        
        return NextResponse.json(
          { 
            error: "Failed to generate research report",
            details: error instanceof Error ? error.message : "Unknown error"
          },
          { status: 500 }
        )
      }
    }

    // Chat with research context
    if (action === "chat") {
      const { markdown, structured, messages, userQuery } = body as {
        markdown: string
        structured: any
        messages: Array<{ role: string; content: string }>
        userQuery: string
      }

      if (!topic) {
        return NextResponse.json({ error: "Topic is required" }, { status: 400 })
      }

      try {
        await logEvent('chat_start', {
          topic,
          messageCount: messages.length,
          userQuery: userQuery.substring(0, 200),
          hasMarkdown: !!markdown,
          hasStructured: !!structured,
        })

        const result = await trackedLLMCall(
          {
            model: "gpt-4o",
            input: { topic, userQuery, messages },
            instructions:
              "Answer user questions about the research report using the provided context.",
            metadata: {
              action: 'chat',
              topic,
              messageCount: messages.length,
              userQueryLength: userQuery.length,
              markdownLength: markdown?.length || 0,
              step: 5,
            },
          },
          async () => {
            const completion = await openai.chat.completions.create({
              model: "gpt-4o",
              temperature: 0.7,
              messages: [
                {
                  role: "system",
                  content:
                    `You are a helpful research assistant discussing a report about "${topic}".\n\n` +
                    `=== RESEARCH CONTEXT ===\n\n` +
                    `Full Report:\n${markdown}\n\n` +
                    `Structured Data:\n${JSON.stringify(structured, null, 2)}\n\n` +
                    `=== YOUR ROLE ===\n` +
                    `- Answer questions based on the research report\n` +
                    `- Cite specific sections or findings when relevant\n` +
                    `- If asked about something not in the report, clearly state that\n` +
                    `- Provide additional context or explanations when helpful\n` +
                    `- Suggest related questions or areas to explore\n` +
                    `- Be conversational but accurate\n\n` +
                    `=== RESPONSE STYLE ===\n` +
                    `- Keep responses concise (2-4 paragraphs max)\n` +
                    `- Use bullet points for lists\n` +
                    `- Reference specific sources from the report when relevant\n` +
                    `- If the user wants more detail, offer to elaborate`,
                },
                ...messages.map((m) => ({
                  role: m.role as "user" | "assistant",
                  content: m.content,
                })),
              ],
            })
            const output = completion.choices[0]?.message?.content ?? "I couldn't generate a response."
            return { output, responseId: completion.id }
          }
        )

        await logEvent('chat_completed', {
          topic,
          responseLength: result.output.length,
          messageCount: messages.length + 1,
        })

        return NextResponse.json({
          response: result.output,
          traceUrl: `https://cloud.langfuse.com/trace/${result.responseId}`,
        })
      } catch (error) {
        console.error("[Research Chat] Error:", error)
        
        await logEvent('chat_error', {
          topic,
          error: error instanceof Error ? error.message : 'Unknown error',
          userQuery: userQuery.substring(0, 200),
        })
        
        return NextResponse.json(
          {
            error: "Failed to generate chat response",
            details: error instanceof Error ? error.message : "Unknown error",
          },
          { status: 500 }
        )
      }
    }

    await logEvent('unknown_action', {
      action,
      availableActions: [
        'generate_questions',
        'clarify_followup',
        'generate_queries',
        'generate_alternative_queries',
        'synthesize_report',
        'chat',
      ],
    })

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    
  } catch (error) {
    console.error("[Research API] Error:", error)
    
    await logEvent('api_error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: Date.now() - requestStartTime,
    })
    
    return NextResponse.json(
      { 
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  } finally {
    // Ensure all events are flushed
    await langfuse.flushAsync()
  }
}
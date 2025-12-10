/**
 * Query Generation Node
 * 
 * Generates specific, actionable search queries based on clarifying answers.
 * Takes into account priority weights to allocate queries effectively.
 */

import OpenAI from "openai"
import { ResearchState, SearchQuery } from "../state/types"
import { v4 as uuidv4 } from "uuid"

function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T
  } catch {
    return fallback
  }
}

/**
 * Generate initial research queries from clarifying answers
 */
export async function queryGenerationNode(
  state: ResearchState,
  openai: OpenAI
): Promise<Partial<ResearchState>> {
  console.log(`[QueryGen] State has clarifyingAnswers:`, state.clarifyingAnswers ? `Yes (${state.clarifyingAnswers.length})` : "No")

  if (!state.clarifyingAnswers || state.clarifyingAnswers.length === 0) {
    console.log("[QueryGen] No clarifying answers, using enhanced default queries")
    return {
      searchQueries: [
        {
          id: uuidv4(),
          query: `${state.topic} comprehensive guide 2024`,
          priority: 5,
        },
        {
          id: uuidv4(),
          query: `${state.topic} best practices latest`,
          priority: 5,
        },
        {
          id: uuidv4(),
          query: `${state.topic} implementation tutorial step by step`,
          priority: 4,
        },
        {
          id: uuidv4(),
          query: `${state.topic} common mistakes pitfalls avoid`,
          priority: 4,
        },
        {
          id: uuidv4(),
          query: `${state.topic} tools setup configuration`,
          priority: 3,
        },
        {
          id: uuidv4(),
          query: `${state.topic} real world examples case studies`,
          priority: 3,
        },
        {
          id: uuidv4(),
          query: `${state.topic} advanced tips tricks optimization`,
          priority: 3,
        },
      ],
      currentStep: "query_generation",
    }
  }

  console.log(
    `[QueryGen] Generating queries from ${state.clarifyingAnswers.length} answers`
  )
  console.log(`[QueryGen] Clarifying answers:`, JSON.stringify(state.clarifyingAnswers, null, 2))

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",  // Changed to gpt-4o for better quality
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `You are an expert research strategist who generates HYPER-SPECIFIC, actionable search queries.

Based on the user's clarifying answers and their priority weights (1-5), generate specific, detailed research queries.

=== CRITICAL: MANDATORY MINIMUM ===
You MUST generate AT LEAST 7 queries. Preferably 8-10 queries for comprehensive coverage.

=== WEIGHT ALLOCATION STRATEGY ===
- Weight 5 (Critical Priority): Generate 3-4 highly detailed, specific queries
- Weight 4 (High Priority): Generate 2-3 focused queries
- Weight 3 (Medium Priority): Generate 1-2 queries
- Weight 2 (Low Priority): Generate 1 query
- Weight 1 (Minimal Priority): Generate 0-1 queries

=== QUERY QUALITY REQUIREMENTS ===

1. HYPER-SPECIFIC: Extract and use EXACT details from user's answers
   - BAD: "code style best practices"
   - GOOD: "ESLint Prettier TypeScript React 18 Next.js 14 configuration 2024"
   
2. INCLUDE ALL MENTIONED TECHNOLOGIES:
   - If user mentions "TypeScript, React 18, Next.js 14" → Include ALL in query
   - If user mentions "Husky lint-staged pre-commit" → Use exact names
   - If user mentions "GitHub Actions CI/CD" → Include in queries

3. INCORPORATE CONSTRAINTS:
   - If user says "2-3 days" → Add "quick setup" or "fast implementation"
   - If user says "team of 5" → Add "team collaboration" or "shared config"
   - If user says "easy to maintain" → Add "simple" or "maintainable"

4. ACTION-ORIENTED:
   - Focus on "how to", "setup guide", "step-by-step", "best practices"
   - Include year "2024" or "2025" for recent results

5. SEARCHABLE FORMAT:
   - Write as you would type into Google
   - Use natural keyword ordering
   - Avoid unnecessary articles (a, an, the)

=== EXAMPLES ===

User says: "TypeScript React 18 Next.js 14, Husky lint-staged, GitHub Actions, 2-3 days"

GOOD queries:
✅ "ESLint Prettier configuration Next.js 14 TypeScript React 18 best practices 2024"
✅ "Husky lint-staged pre-commit hooks React TypeScript setup guide"
✅ "GitHub Actions ESLint CI/CD pipeline Next.js TypeScript configuration"
✅ "Quick ESLint TypeScript React setup guide complete in 2 days"
✅ "ESLint rules React TypeScript modern recommended settings 2024"
✅ "Prettier ESLint integration Next.js 14 step by step tutorial"
✅ "TypeScript ESLint configuration team shared rules best practices"
✅ "ESLint auto-fix pre-commit Husky lint-staged Next.js setup"

BAD queries (too generic):
❌ "ESLint setup"
❌ "code linting best practices"
❌ "React configuration"

=== OUTPUT FORMAT ===
Return ONLY a valid JSON array of query strings. No markdown, no explanations.
Example: ["query 1", "query 2", "query 3", ...]`,
        },
        {
          role: "user",
          content:
            `Research Topic: "${state.topic}"\n\n` +
            `=== USER'S DETAILED REQUIREMENTS ===\n\n${state.clarifyingAnswers.map((qa, i) => 
              `${i + 1}. [WEIGHT: ${qa.weight || 3}/5]\n` +
              `   Question: ${qa.question}\n` +
              `   Answer: ${qa.answer}\n`
            ).join("\n")}\n\n` +
            `=== YOUR TASK ===\n` +
            `Generate 7-10 HYPER-SPECIFIC search queries that:\n` +
            `1. Use EXACT technologies/tools mentioned (TypeScript, React 18, Next.js 14, Husky, etc.)\n` +
            `2. Incorporate TIME constraints (2-3 days → "quick setup")\n` +
            `3. Incorporate TEAM constraints (easy to maintain, team rules)\n` +
            `4. Focus on ACTIONABLE results (setup guides, tutorials, best practices)\n` +
            `5. Include year "2024" or "2025" for recent content\n\n` +
            `IMPORTANT: Generate AT LEAST 7 queries. Aim for 8-10 for best coverage.\n\n` +
            `Return ONLY a JSON array of query strings.`,
        },
      ],
    })

    const output = completion.choices[0]?.message?.content ?? "[]"
    console.log(`[QueryGen] Raw LLM output:`, output.substring(0, 500))

    const queryStrings = safeJsonParse<string[]>(output, [
      `Overview of ${state.topic}`,
      `Recent developments in ${state.topic}`,
    ])

    console.log(`[QueryGen] Parsed query strings:`, queryStrings)

    // Convert to SearchQuery objects
    const queries: SearchQuery[] = queryStrings.map((query, idx) => ({
      id: uuidv4(),
      query,
      priority: 5 - Math.floor(idx / 2), // Decay priority: 5, 5, 4, 4, 3, 3, 2...
    }))

    console.log(`[QueryGen] Generated ${queries.length} queries`)

    if (queries.length === 0) {
      console.error(`[QueryGen] WARNING: Generated 0 queries! Using fallback queries.`)
      return {
        searchQueries: [
          {
            id: uuidv4(),
            query: `${state.topic} overview research 2024`,
            priority: 5,
          },
          {
            id: uuidv4(),
            query: `${state.topic} recent developments`,
            priority: 5,
          },
          {
            id: uuidv4(),
            query: `${state.topic} current state of art`,
            priority: 4,
          },
        ],
        currentStep: "query_generation",
      }
    }

    return {
      searchQueries: queries,
      currentStep: "query_generation",
    }
  } catch (error) {
    console.error("[QueryGen] Error:", error)
    return {
      errors: [
        ...(state.errors || []),
        `Query generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      ],
    }
  }
}

/**
 * Generate alternative research queries for different perspectives
 */
export async function alternativeQueryNode(
  state: ResearchState,
  openai: OpenAI
): Promise<Partial<ResearchState>> {
  if (!state.searchQueries || state.searchQueries.length === 0) {
    return state
  }

  console.log(
    `[AltQueryGen] Generating alternatives to ${state.searchQueries.length} queries`
  )

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.85, // Higher for creativity
      messages: [
        {
          role: "system",
          content: `You are a creative research strategist.

Your task is to generate ALTERNATIVE queries that explore DIFFERENT perspectives from the current ones.

DIFFERENTIATION STRATEGY:
- If current = "HOW to implement" → Try "WHY it works", "WHEN to use"
- If current = "Configuration setup" → Try "Case studies", "Common pitfalls"
- If current = "Tool A" → Try "Tool A vs Tool B", "Tool A limitations"

EXPLORATION ANGLES:
1. Implementation vs Theory
2. Narrow vs Broad perspective
3. Success vs Failure cases
4. Short-term vs Long-term
5. Different stakeholders
6. Edge cases

Return ONLY a JSON array of 5-7 alternative query strings.`,
        },
        {
          role: "user",
          content:
            `Research Topic: "${state.topic}"\n\n` +
            `Current queries:\n${state.searchQueries.map((q, i) => `${i + 1}. ${q.query}`).join("\n")}\n\n` +
            `Generate 5-7 alternative queries exploring DIFFERENT angles.`,
        },
      ],
    })

    const output = completion.choices[0]?.message?.content ?? "[]"
    const queryStrings = safeJsonParse<string[]>(output, [])

    const altQueries: SearchQuery[] = queryStrings.map((query, idx) => ({
      id: uuidv4(),
      query,
      priority: 3, // Medium priority for alternatives
    }))

    console.log(`[AltQueryGen] Generated ${altQueries.length} alternatives`)

    return {
      alternativeQueries: altQueries,
    }
  } catch (error) {
    console.error("[AltQueryGen] Error:", error)
    return {
      errors: [
        ...(state.errors || []),
        `Alternative query generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      ],
    }
  }
}
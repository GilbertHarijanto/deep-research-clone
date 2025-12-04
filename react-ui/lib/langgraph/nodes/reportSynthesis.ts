/**
 * Report Synthesis Node
 * 
 * Generates comprehensive research report from search results.
 * Produces both Markdown and structured JSON formats.
 */

import OpenAI from "openai"
import { ResearchState, ResearchReport } from "../state/types"

function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T
  } catch {
    return fallback
  }
}

/**
 * Report Synthesis Node
 */
export async function reportSynthesisNode(
  state: ResearchState,
  openai: OpenAI
): Promise<Partial<ResearchState>> {
  if (!state.searchResults || state.searchResults.length === 0) {
    console.log("[ReportSynthesis] No search results available")
    return {
      errors: [...(state.errors || []), "Cannot generate report without search results"],
    }
  }

  console.log(`[ReportSynthesis] Generating report from ${state.searchResults.length} result sets`)

  try {
    // Format search results for LLM
    const formattedResults = state.searchResults
      .map((sr, idx) => {
        const webSources = sr.webResults
          .map(
            (r, sIdx) =>
              `[Source ${idx + 1}.${sIdx + 1}] [Web]\n` +
              `Title: ${r.title}\n` +
              `URL: ${r.url}\n` +
              `Snippet: ${r.snippet}\n`
          )
          .join("\n")

        const arxivSources = sr.arxivResults
          .map(
            (r, sIdx) =>
              `[Source ${idx + 1}.${sIdx + sr.webResults.length + 1}] [arXiv]\n` +
              `Title: ${r.title}\n` +
              `Authors: ${r.authors}\n` +
              `Published: ${r.published}\n` +
              `URL: ${r.url}\n` +
              `Abstract: ${r.snippet.substring(0, 300)}...\n`
          )
          .join("\n")

        return (
          `Query ${idx + 1}: "${sr.query}" (Priority: ${sr.priority})\n\n` +
          webSources +
          arxivSources
        )
      })
      .join("\n---\n\n")

    // Step 1: Generate Markdown report
    const markdownCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `You are an expert research report writer. Generate a comprehensive, FACTUAL report based ONLY on the provided search results.

=== CRITICAL RULES ===
1. ONLY use information from provided search results
2. NEVER make up facts, statistics, or claims
3. EVERY factual claim MUST have a citation [n]
4. If info not in results, state "Information not available"
5. Use exact titles and URLs in References

=== REPORT STRUCTURE ===
# [Topic Title]

## Executive Summary
2-3 paragraphs summarizing key findings. Lead with most actionable insight.

## Key Findings
Organize by themes (use ### for sub-sections). Cite sources [n].

## Academic Literature Review (if arXiv papers found)
Summarize key papers, methodologies, findings.

## Detailed Analysis
Deep dive into major aspects.

## Practical Recommendations
Actionable steps based on results.

## Implementation Considerations
Challenges, best practices, common pitfalls.

## Research Gaps
Explicitly state what was NOT found.

## Conclusion
Synthesize key points and suggest next steps.

## References
[1] Title – https://url.com
[2] Authors (Year). Paper Title. arXiv:XXXX

Use [1], [2], [3] for inline citations.`,
        },
        {
          role: "user",
          content:
            `Research Topic: "${state.topic}"\n\n` +
            `=== SEARCH RESULTS (Web + arXiv) ===\n\n` +
            formattedResults +
            `\n\nGenerate a comprehensive Markdown research report using ONLY the information above.`,
        },
      ],
    })

    const markdown = markdownCompletion.choices[0]?.message?.content ?? ""

    // Step 2: Generate structured JSON report
    const jsonCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Generate a STRUCTURED JSON report based ONLY on provided search results.

JSON SCHEMA:
{
  "title": "string",
  "executiveSummary": "string",
  "keyFindings": [
    {
      "theme": "string",
      "findings": ["string"],
      "citations": [1, 2]
    }
  ],
  "academicPapers": [
    {
      "title": "string",
      "authors": "string",
      "year": "string",
      "summary": "string",
      "arxivId": "string",
      "pdfUrl": "string"
    }
  ],
  "detailedAnalysis": {
    "sections": [
      {
        "heading": "string",
        "content": "string",
        "citations": [1, 2]
      }
    ]
  },
  "recommendations": [
    {
      "title": "string",
      "description": "string",
      "priority": "high|medium|low",
      "citations": [1, 2]
    }
  ],
  "implementationConsiderations": {
    "challenges": ["string"],
    "bestPractices": ["string"],
    "pitfalls": ["string"],
    "resourceRequirements": {
      "time": "string",
      "cost": "string",
      "skills": ["string"]
    }
  },
  "researchGaps": ["string"],
  "conclusion": "string",
  "references": [
    {
      "id": 1,
      "type": "web|arxiv",
      "title": "string",
      "url": "string",
      "authors": "string (arXiv)",
      "year": "string (arXiv)",
      "source": "string"
    }
  ]
}

CRITICAL: Every finding/recommendation MUST include citations array.`,
        },
        {
          role: "user",
          content:
            `Research Topic: "${state.topic}"\n\n` +
            `=== SEARCH RESULTS ===\n\n` +
            formattedResults +
            `\n\nGenerate structured JSON report using ONLY the information above.`,
        },
      ],
    })

    const jsonOutput = jsonCompletion.choices[0]?.message?.content ?? "{}"
    const structured = safeJsonParse(jsonOutput, {
      title: state.topic,
      executiveSummary: "Report generation failed",
      keyFindings: [],
      academicPapers: [],
      detailedAnalysis: { sections: [] },
      recommendations: [],
      implementationConsiderations: {
        challenges: [],
        bestPractices: [],
        pitfalls: [],
        resourceRequirements: { time: "", cost: "", skills: [] },
      },
      researchGaps: ["Failed to generate report"],
      conclusion: "",
      references: [],
    })

    // Calculate metadata
    const totalWebSources = state.searchResults.reduce(
      (sum, r) => sum + r.webResults.length,
      0
    )
    const totalArxivSources = state.searchResults.reduce(
      (sum, r) => sum + r.arxivResults.length,
      0
    )

    const report: ResearchReport = {
      markdown,
      structured,
      metadata: {
        topic: state.topic,
        queriesSearched: state.searchResults.length,
        totalWebSources,
        totalArxivSources,
        totalSources: totalWebSources + totalArxivSources,
        timestamp: new Date().toISOString(),
        models: {
          markdown: "gpt-4o",
          structured: "gpt-4o",
        },
      },
    }

    console.log(
      `[ReportSynthesis] Generated report (${markdown.length} chars, ${structured.references.length} references)`
    )

    return {
      report,
      currentStep: "report_complete",
    }
  } catch (error) {
    console.error("[ReportSynthesis] Error:", error)
    return {
      errors: [
        ...(state.errors || []),
        `Report synthesis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      ],
    }
  }
}

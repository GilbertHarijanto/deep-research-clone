/**
 * LangGraph State Definition
 * 
 * This defines the shared state that flows through the entire research pipeline.
 * Each node in the graph can read from and write to this state.
 */

export interface Message {
  role: "user" | "assistant" | "system"
  content: string
  timestamp?: string
}

export interface ClarifyingQA {
  question: string
  answer: string
  weight?: number // 1-5, indicates priority
}

export interface SearchQuery {
  id: string
  query: string
  priority: number
}

export interface SearchResult {
  type: "web" | "arxiv"
  title: string
  url: string
  snippet: string
  authors?: string
  published?: string
  pdfUrl?: string
}

export interface QuerySearchResults {
  query: string
  priority: number
  webResults: SearchResult[]
  arxivResults: SearchResult[]
}

export interface ResearchReport {
  markdown: string
  structured: {
    title: string
    executiveSummary: string
    keyFindings: Array<{
      theme: string
      findings: string[]
      citations: number[]
    }>
    academicPapers: Array<{
      title: string
      authors: string
      year: string
      summary: string
      arxivId: string
      pdfUrl: string
    }>
    detailedAnalysis: {
      sections: Array<{
        heading: string
        content: string
        citations: number[]
      }>
    }
    recommendations: Array<{
      title: string
      description: string
      priority: "high" | "medium" | "low"
      citations: number[]
    }>
    implementationConsiderations: {
      challenges: string[]
      bestPractices: string[]
      pitfalls: string[]
      resourceRequirements: {
        time: string
        cost: string
        skills: string[]
      }
    }
    researchGaps: string[]
    conclusion: string
    references: Array<{
      id: number
      type: "web" | "arxiv"
      title: string
      url: string
      authors?: string
      year?: string
      source: string
    }>
  }
  metadata: {
    topic: string
    queriesSearched: number
    totalWebSources: number
    totalArxivSources: number
    totalSources: number
    timestamp: string
    models: {
      markdown: string
      structured: string
    }
  }
}

/**
 * Main Research State
 * 
 * This is the single source of truth that flows through all nodes in the graph.
 * Nodes can update specific fields as they execute.
 */
export interface ResearchState {
  // Input
  topic: string
  action?: string
  
  // Clarification Phase
  clarifyingQuestions?: string[]
  clarifyingAnswers?: ClarifyingQA[]
  clarificationComplete?: boolean
  
  // Query Generation Phase
  searchQueries?: SearchQuery[]
  alternativeQueries?: SearchQuery[]
  selectedQueries?: SearchQuery[]
  
  // Search Phase
  searchResults?: QuerySearchResults[]
  includeArxiv?: boolean
  
  // Synthesis Phase
  report?: ResearchReport
  
  // Chat Phase
  chatMessages?: Message[]
  chatResponse?: string
  
  // Agent Collaboration Phase (NEW)
  metaAgentPlan?: string
  criticFeedback?: string[]
  ideationSuggestions?: string[]
  refinementIterations?: number
  
  // Metadata
  currentStep?: string
  errors?: string[]
  warnings?: string[]
  traceId?: string
  startTime?: number
  endTime?: number
}

/**
 * Graph Configuration
 */
export interface GraphConfig {
  openaiApiKey: string
  serperApiKey: string
  langfusePublicKey?: string
  langfuseSecretKey?: string
  langfuseBaseUrl?: string
  maxClarifyingQuestions?: number
  maxSearchQueries?: number
  enableArxiv?: boolean
  enableAgentCollaboration?: boolean
  enableMCP?: boolean
  mcpConfigPath?: string
}

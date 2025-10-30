import { Langfuse } from "langfuse"

interface LLMCallOptions {
  model: string
  input: any
  instructions: string
  tools?: any[]
  previousResponseId?: string
  metadata?: Record<string, any> 
}

interface LLMCallResult {
  output: string
  responseId: string
  duration: number
}

// Initialize Langfuse client (singleton pattern)
let langfuseClient: Langfuse | null = null

function getLangfuseClient(): Langfuse | null {
  if (typeof window !== "undefined") {
    // Don't initialize on client side
    return null
  }

  if (!langfuseClient) {
    const publicKey = process.env.LANGFUSE_PUBLIC_KEY
    const secretKey = process.env.LANGFUSE_SECRET_KEY
    const host = process.env.LANGFUSE_HOST || "https://us.cloud.langfuse.com"

    if (publicKey && secretKey) {
      langfuseClient = new Langfuse({
        publicKey,
        secretKey,
        baseUrl: host,
      })
    }
  }

  return langfuseClient
}

/**
 * Wrapper function for LLM calls with Langfuse tracking
 * Similar to the Python llm() function with OpenTelemetry tracing
 */
export async function trackedLLMCall<T>(
  options: LLMCallOptions,
  llmFunction: () => Promise<{ output: string; responseId?: string }>,
): Promise<{ output: string; responseId?: string }> {
  const client = getLangfuseClient()
  const startTime = Date.now()

  const traceName = options.metadata?.action || options.metadata?.step || "llm_call"
  
  // Create a trace for this LLM call
  const trace = client?.trace({
    name: traceName,
    metadata: {
      model: options.model,
      tools: options.tools ? JSON.stringify(options.tools) : undefined,
      instructions: options.instructions.trim(),
      ...options.metadata, 
      timestamp: new Date().toISOString(),
    },
    input: typeof options.input === "string" ? options.input : JSON.stringify(options.input),
  })

  try {
    // Execute the LLM function
    const result = await llmFunction()
    const duration = (Date.now() - startTime) / 1000

    // Truncate output if too long (similar to Python implementation)
    const truncatedOutput = result.output.length > 800 ? result.output.substring(0, 800) + "..." : result.output

    // Update trace with success
    trace?.update({
      output: truncatedOutput,
      metadata: {
        status: "success",
        response_id: result.responseId || "unknown",
        duration_sec: Math.round(duration * 1000) / 1000,
        ...options.metadata,
      },
    })

    // Flush to ensure data is sent
    await client?.flushAsync()

    return result
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000

    // Update trace with error
    trace?.update({
      metadata: {
        status: "error",
        level: "ERROR",
        error: error instanceof Error ? error.message : String(error),
        duration_sec: Math.round(duration * 1000) / 1000,
        ...options.metadata, 
      },
    })

    // Flush to ensure error is sent
    await client?.flushAsync()

    throw error
  }
}

/**
 * Helper to create a generation span within a trace
 * Useful for tracking individual LLM generations
 */
export function createGeneration(traceName: string, options: LLMCallOptions) {
  const client = getLangfuseClient()
  if (!client) return null

  const trace = client.trace({
    name: traceName,
    metadata: options.metadata,
  })

  const generation = trace.generation({
    name: "llm_generation",
    model: options.model,
    input: options.input,
    metadata: {
      instructions: options.instructions,
      tools: options.tools,
      ...options.metadata, 
    },
  })

  return { trace, generation }
}

// Export the client for advanced usage
export { getLangfuseClient }

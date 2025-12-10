/**
 * MCP Client Module
 *
 * Handles connection and communication with MCP servers.
 * This module provides a unified interface to interact with various MCP servers
 * configured in mcp_config.json
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import * as fs from "fs"
import * as path from "path"

export interface MCPServerConfig {
  command: string
  args: string[]
  env?: Record<string, string>
}

export interface MCPConfig {
  mcpServers: Record<string, MCPServerConfig>
}

export interface MCPTool {
  name: string
  description: string
  inputSchema: any
}

export interface MCPClient {
  serverName: string
  client: Client
  tools: MCPTool[]
  connected: boolean
}

/**
 * Load MCP configuration from JSON file
 */
export function loadMCPConfig(configPath?: string): MCPConfig {
  const defaultPath = path.join(process.cwd(), "lib/mcp/mcp_config.json")
  const finalPath = configPath || defaultPath

  if (!fs.existsSync(finalPath)) {
    throw new Error(`MCP config file not found at ${finalPath}`)
  }

  const configContent = fs.readFileSync(finalPath, "utf-8")
  return JSON.parse(configContent)
}

/**
 * Connect to a single MCP server
 */
export async function connectToMCPServer(
  serverName: string,
  config: MCPServerConfig
): Promise<MCPClient> {
  console.log(`[MCP] Connecting to ${serverName}...`)

  const client = new Client(
    {
      name: `langgraph-${serverName}-client`,
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  )

  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args,
    env: {
      ...process.env,
      ...config.env,
    },
  })

  await client.connect(transport)

  // List available tools
  const toolsResponse = await client.listTools()
  const tools = toolsResponse.tools.map((tool) => ({
    name: tool.name,
    description: tool.description || "",
    inputSchema: tool.inputSchema,
  }))

  console.log(`[MCP] Connected to ${serverName}. Available tools:`, tools.map(t => t.name))

  return {
    serverName,
    client,
    tools,
    connected: true,
  }
}

/**
 * Connect to all configured MCP servers
 */
export async function connectToAllMCPServers(
  config?: MCPConfig
): Promise<MCPClient[]> {
  const mcpConfig = config || loadMCPConfig()
  const clients: MCPClient[] = []

  for (const [serverName, serverConfig] of Object.entries(mcpConfig.mcpServers)) {
    try {
      const client = await connectToMCPServer(serverName, serverConfig)
      clients.push(client)
    } catch (error) {
      console.error(`[MCP] Failed to connect to ${serverName}:`, error)
    }
  }

  return clients
}

/**
 * Call a tool on an MCP server
 */
export async function callMCPTool(
  mcpClient: MCPClient,
  toolName: string,
  args: Record<string, any>
): Promise<any> {
  console.log(`[MCP] Calling ${toolName} on ${mcpClient.serverName}`)

  const result = await mcpClient.client.callTool({
    name: toolName,
    arguments: args,
  })

  return result
}

/**
 * Get all available tools from all connected MCP clients
 */
export function getAllMCPTools(clients: MCPClient[]): Array<{
  serverName: string
  tool: MCPTool
}> {
  const allTools: Array<{ serverName: string; tool: MCPTool }> = []

  for (const client of clients) {
    for (const tool of client.tools) {
      allTools.push({
        serverName: client.serverName,
        tool,
      })
    }
  }

  return allTools
}

/**
 * Close all MCP connections
 */
export async function closeAllMCPConnections(clients: MCPClient[]): Promise<void> {
  for (const client of clients) {
    try {
      await client.client.close()
      console.log(`[MCP] Closed connection to ${client.serverName}`)
    } catch (error) {
      console.error(`[MCP] Error closing ${client.serverName}:`, error)
    }
  }
}

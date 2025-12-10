# MCP Integration with LangGraph

This directory contains the MCP (Model Context Protocol) integration for the LangGraph research workflow.

## Overview

The MCP integration allows your LangGraph workflow to connect to external MCP servers and use their tools during the research process. This enables capabilities like:

- Storing research results in Notion
- Accessing databases and APIs
- Integrating with external services
- And more, depending on which MCP servers you configure

## Files

- **`client.ts`**: Core MCP client functionality for connecting to and communicating with MCP servers
- **`mcp_config.json`**: Configuration file specifying which MCP servers to use
- **`test-mcp.ts`**: Test script to verify MCP server connections

## Configuration

MCP servers are configured in `mcp_config.json`. Example:

```json
{
  "mcpServers": {
    "notionApi": {
      "command": "npx",
      "args": ["-y", "@notionhq/notion-mcp-server"],
      "env": {
        "NOTION_TOKEN": "your-notion-token-here"
      }
    }
  }
}
```

Each server configuration includes:
- **`command`**: The command to run the MCP server
- **`args`**: Arguments to pass to the command
- **`env`**: Environment variables (like API keys)

## Testing MCP Servers

Test your MCP server connections:

```bash
cd react-ui
npx tsx lib/mcp/test-mcp.ts
```

This will:
1. Connect to all configured MCP servers
2. List available tools from each server
3. Test calling a simple tool (if available)

## Using MCP in LangGraph

### 1. Enable MCP in Graph Configuration

```typescript
import { createResearchGraph, GraphConfig } from "./lib/langgraph/graph"

const config: GraphConfig = {
  openaiApiKey: process.env.OPENAI_API_KEY!,
  serperApiKey: process.env.SERPER_API_KEY!,
  enableMCP: true, // Enable MCP integration
  // ... other config
}

const graph = await createResearchGraph(config)
```

### 2. How It Works

When `enableMCP: true` is set:

1. The graph connects to all configured MCP servers at initialization
2. After the search phase, the MCP tools node is executed
3. An AI agent analyzes the research context and determines which MCP tools (if any) would be helpful
4. Relevant tools are called automatically
5. Results are incorporated into the research state

### 3. Workflow

```
Clarification → Query Generation → Search → MCP Tools → Report Synthesis
```

The MCP tools node:
- Receives the current research state (topic, queries, search results)
- Uses GPT-4 to determine which MCP tools are relevant
- Executes those tools
- Stores results in the state for use in report synthesis

## Example Use Cases

### Notion Integration

With the Notion MCP server, your research workflow can:
- Create a new page for each research topic
- Store findings in a Notion database
- Update existing research pages
- Create task lists for follow-up research

### Custom MCP Servers

You can add any MCP server to extend functionality:
- Database tools for storing/retrieving data
- Filesystem tools for reading/writing files
- API integrations for external services
- Custom business logic

## API Reference

### Client Functions

#### `connectToAllMCPServers(config?): Promise<MCPClient[]>`
Connects to all MCP servers defined in `mcp_config.json`.

#### `callMCPTool(client, toolName, args): Promise<any>`
Calls a specific tool on an MCP server.

#### `getAllMCPTools(clients): Array<{serverName, tool}>`
Gets all available tools from all connected clients.

#### `closeAllMCPConnections(clients): Promise<void>`
Closes all MCP connections.

## Troubleshooting

### Connection Issues

If MCP servers fail to connect:
1. Check that the server package is installed
2. Verify environment variables are set correctly
3. Run the test script to see detailed error messages

### Tool Call Failures

If tools fail to execute:
1. Check the tool's input schema requirements
2. Verify you have proper permissions/credentials
3. Review the server's documentation

## Adding New MCP Servers

1. Install the MCP server package:
   ```bash
   npm install @yourvendor/your-mcp-server
   ```

2. Add configuration to `mcp_config.json`:
   ```json
   {
     "mcpServers": {
       "yourServer": {
         "command": "npx",
         "args": ["-y", "@yourvendor/your-mcp-server"],
         "env": {
           "API_KEY": "your-api-key"
         }
       }
     }
   }
   ```

3. Test the connection:
   ```bash
   npx tsx lib/mcp/test-mcp.ts
   ```

## Learn More

- [Model Context Protocol Specification](https://modelcontextprotocol.io)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/typescript-sdk)
- [Available MCP Servers](https://github.com/modelcontextprotocol/servers)

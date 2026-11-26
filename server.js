import { createRequire } from 'node:module'
import { McpServer } from '@modelcontextprotocol/server'
import { tools } from './tools.js'

const { version } = createRequire(import.meta.url)('./package.json')

const asText = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] })

const asError = (error) => ({
  content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
  isError: true,
})

export { tools }

export function createServer() {
  const server = new McpServer({ name: 'israel-mcp', version })
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: { readOnlyHint: true, openWorldHint: tool.network },
      },
      async (input) => {
        try {
          return asText(await tool.run(input))
        } catch (error) {
          return asError(error)
        }
      },
    )
  }
  return server
}

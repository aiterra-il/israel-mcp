#!/usr/bin/env node
import { serveStdio } from '@modelcontextprotocol/server/stdio'
import { createServer } from './server.js'

const handle = serveStdio(createServer)

const shutdown = () => {
  void handle.close().finally(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

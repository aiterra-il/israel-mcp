import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { checkCompanyNumber } from 'israel-companies'
import { createPublicFetch } from './public-fetch.js'

const TOOL_COUNT = 16
const PUBLIC_PAGE = 'http://93.184.216.34/'
const redirectTo = (location) => new Response(null, { status: 302, headers: { location } })
const command = process.env.ISRAEL_MCP_COMMAND
const launch = command
  ? { command, args: [] }
  : { command: process.execPath, args: [fileURLToPath(new URL('./cli.js', import.meta.url))] }

const connect = async (env = {}) => {
  const client = new Client({ name: 'israel-mcp-test', version: '1.0.0' })
  await client.connect(new StdioClientTransport({ ...launch, env: { ...process.env, ...env } }))
  return client
}

const call = (client, name, input) => client.callTool({ name, arguments: input })
const json = (result) => JSON.parse(result.content[0].text)

const validCompanyNumber = Array.from({ length: 10 }, (_, digit) => `51000000${digit}`).find(
  (number) => checkCompanyNumber(number).valid,
)

let client

before(async () => {
  client = await connect()
})

after(async () => {
  await client.close()
})

test('lists every tool with a description and a schema', async () => {
  const { tools } = await client.listTools()
  assert.equal(tools.length, TOOL_COUNT)
  for (const tool of tools) {
    assert.ok(tool.description.length > 40, tool.name)
    assert.equal(tool.inputSchema.type, 'object', tool.name)
    assert.equal(tool.annotations.readOnlyHint, true, tool.name)
  }
})

test('adds and extracts VAT', async () => {
  const added = json(await call(client, 'vat', { amount: 100 }))
  assert.equal(added.net, 100)
  assert.equal(added.gross, added.net + added.vat)
  const extracted = json(await call(client, 'vat', { amount: added.gross, mode: 'extract' }))
  assert.equal(extracted.net, 100)
})

test('calculates a net salary below the gross', async () => {
  const salary = json(await call(client, 'net-salary', { gross: 15000 }))
  assert.equal(salary.gross, 15000)
  assert.ok(salary.net > 9000 && salary.net < 15000)
  const back = json(await call(client, 'gross-for-net', { net: salary.net }))
  assert.ok(Math.abs(back.gross - 15000) <= 2)
})

test('runs the other calculators', async () => {
  assert.ok(json(await call(client, 'purchase-tax', { value: 2500000, buyer: 'additional' })).tax > 0)
  assert.ok(json(await call(client, 'self-employed-tax', { revenue: 300000, expenses: 60000 })).net > 0)
  assert.ok(json(await call(client, 'severance-pay', { start: '2020-01-01', end: '2025-12-31', salary: 12000 })).severance > 60000)
  assert.ok(json(await call(client, 'minimum-wage', {})).monthly > 5000)
})

test('checks a company number offline', async () => {
  assert.equal(json(await call(client, 'company-number-check', { number: '123' })).reason, 'length')
  assert.equal(json(await call(client, 'company-number-check', { number: validCompanyNumber })).valid, true)
  const lookup = json(await call(client, 'company-lookup', { number: '123' }))
  assert.deepEqual([lookup.found, lookup.valid], [false, false])
})

test('formats a phone number', async () => {
  const parsed = json(await call(client, 'phone', { number: '03-5551234', whatsappMessage: 'שלום' }))
  assert.equal(parsed.status, 'valid')
  assert.equal(parsed.phone.e164, '+97235551234')
  assert.equal(json(await call(client, 'phone', { number: '12' })).status, 'invalid')
})

test('explains and expands Hebrew acronyms', async () => {
  const found = json(await call(client, 'acronym', { acronym: 'צה"ל' }))
  assert.equal(found.found, true)
  assert.equal(found.entry.meanings[0].text, 'צבא הגנה לישראל')
  const expanded = json(await call(client, 'expand-acronyms', { text: 'המחיר כולל מע"מ' }))
  assert.match(expanded.text, /מס ערך מוסף/)
})

test('rejects arguments the schema does not allow', async () => {
  const result = await call(client, 'vat', { amount: -5 })
  assert.equal(result.isError, true)
})

test('refuses to audit local and private addresses', async () => {
  const local = ['http://127.0.0.1:1/', 'http://localhost:1/', 'http://192.168.1.1/', 'http://[::1]/', 'http://[::ffff:127.0.0.1]/', 'http://2130706433/']
  for (const url of local) {
    const result = await call(client, 'seo-audit', { url })
    assert.equal(result.isError, true, url)
    assert.match(result.content[0].text, /public pages/, url)
  }
  for (const url of ['ftp://example.com/', 'file:///etc/hosts']) {
    const result = await call(client, 'seo-audit', { url })
    assert.equal(result.isError, true, url)
    assert.doesNotMatch(result.content[0].text, /ENOTFOUND/, url)
  }
})

test('does not follow a redirect from a public page to a local address', async () => {
  const requested = []
  const guarded = createPublicFetch(async (url) => {
    requested.push(url)
    return redirectTo('http://127.0.0.1/admin')
  })
  await assert.rejects(guarded(PUBLIC_PAGE), /public pages/)
  assert.deepEqual(requested, [PUBLIC_PAGE])
})

test('follows a redirect between public addresses', async () => {
  const requested = []
  const guarded = createPublicFetch(async (url) => {
    requested.push(url)
    return requested.length === 1 ? redirectTo('/moved') : new Response('ok')
  })
  const response = await guarded(PUBLIC_PAGE)
  assert.equal(await response.text(), 'ok')
  assert.deepEqual(requested, [PUBLIC_PAGE, `${PUBLIC_PAGE}moved`])
})

test('returns a tool error when the registry cannot be reached and keeps serving', async () => {
  const hurried = await connect({ ISRAEL_MCP_TIMEOUT_MS: '1' })
  try {
    const failed = await call(hurried, 'company-lookup', { number: validCompanyNumber })
    assert.equal(failed.isError, true)
    assert.equal(json(await call(hurried, 'vat', { amount: 100 })).net, 100)
  } finally {
    await hurried.close()
  }
})

test('reads the live registries', { skip: !process.env.ISRAEL_MCP_LIVE }, async () => {
  const companies = json(await call(client, 'company-search', { name: 'טבע תעשיות', limit: 3 }))
  assert.ok(companies.count > 0)
  const company = json(await call(client, 'company-lookup', { number: companies.companies[0].number }))
  assert.equal(company.found, true)
  const branches = json(await call(client, 'bank-branch-search', { query: 'בת ים', limit: 3 }))
  assert.ok(branches.count > 0)
  const branch = json(await call(client, 'bank-branch', { bankCode: branches.branches[0].bankCode, branchCode: branches.branches[0].code }))
  assert.equal(branch.found, true)
})

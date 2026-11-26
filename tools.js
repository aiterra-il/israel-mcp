import * as z from 'zod/v4'
import { DATASET_URL, checkCompanyNumber, getCompany, searchCompanies } from 'israel-companies'
import { BRANCHES_DATASET_URL, getBranch, loadBranches, searchBranches } from 'israel-bank-branches'
import { TAX_YEAR, grossForNet, minimumWage, netSalary, purchaseTax, selfEmployedTax, severancePay, vat } from 'israel-tax'
import { parsePhone, whatsappLink } from 'israeli-phone'
import { expand, lookup, search } from 'hebrew-acronyms'
import { auditUrl } from 'hebrew-seo-audit'
import { createPublicFetch } from './public-fetch.js'

const SITE = 'https://www.aiterra.co.il/tools'
const DEFAULT_TIMEOUT_MS = 15000

const requestOptions = () => ({ timeoutMs: Number(process.env.ISRAEL_MCP_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS })

const gender = z.enum(['man', 'woman']).optional().describe('Sets the default tax credit points when creditPoints is not given. Default: man')
const creditPoints = z.number().min(0).max(30).optional().describe('Tax credit points (נקודות זיכוי). When omitted, the resident default for the gender is used')
const hishtalmut = z.boolean().optional().describe('Whether the employee has a study fund (קרן השתלמות). Default: false')
const shekels = (label) => z.number().positive().describe(`${label}, in shekels`)
const isoDate = (label) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe(`${label}, as YYYY-MM-DD`)

const publicFetch = createPublicFetch()

let branches = null

const allBranches = () => {
  branches ??= loadBranches(requestOptions()).catch((error) => {
    branches = null
    throw error
  })
  return branches
}

export const tools = [
  {
    name: 'company-lookup',
    title: 'Israeli company by number',
    description:
      'Look up a company in the Israeli Companies Registrar (רשם החברות) by its 9-digit company number (ח.פ). Returns the Hebrew and English name, type, status, violations, founding date, last annual report year and registered address. Live data from data.gov.il.',
    network: true,
    inputSchema: z.object({ number: z.string().describe('Company number (ח.פ), 9 digits. Dashes and spaces are ignored') }),
    async run({ number }) {
      const check = checkCompanyNumber(number)
      if (!check.valid) return { found: false, valid: false, reason: check.reason, message: check.message }
      const company = await getCompany(check.number, requestOptions())
      return { found: Boolean(company), valid: true, company, source: DATASET_URL, page: `${SITE}/company-lookup` }
    },
  },
  {
    name: 'company-search',
    title: 'Israeli companies by name',
    description:
      'Search the Israeli Companies Registrar (רשם החברות) by company name in Hebrew or English. Returns up to 20 matches with number, status and address. Live data from data.gov.il.',
    network: true,
    inputSchema: z.object({
      name: z.string().min(2).describe('Company name or part of it, in Hebrew or English'),
      limit: z.number().int().min(1).max(20).optional().describe('How many matches to return. Default: 5'),
    }),
    async run({ name, limit = 5 }) {
      const companies = await searchCompanies(name, { ...requestOptions(), limit })
      return { count: companies.length, companies, source: DATASET_URL }
    },
  },
  {
    name: 'company-number-check',
    title: 'Check an Israeli company number',
    description:
      'Validate the check digit of an Israeli company, partnership or non-profit number (ח.פ) offline and tell the entity type from its prefix. Does not query the registry.',
    network: false,
    inputSchema: z.object({ number: z.string().describe('The number to check, up to 9 digits') }),
    run: ({ number }) => checkCompanyNumber(number),
  },
  {
    name: 'bank-branch',
    title: 'Israeli bank branch by code',
    description:
      'Get one Israeli bank branch by bank code and branch number: name, address, city, phone, accessibility, opening and closing dates, and the branch it was merged into. Live data from the Bank of Israel list on data.gov.il.',
    network: true,
    inputSchema: z.object({
      bankCode: z.number().int().min(1).max(999).describe('Bank code, for example 12 for Hapoalim or 10 for Leumi'),
      branchCode: z.number().int().min(1).max(9999).describe('Branch number'),
    }),
    async run({ bankCode, branchCode }) {
      const branch = await getBranch(bankCode, branchCode, requestOptions())
      return { found: Boolean(branch), branch, source: BRANCHES_DATASET_URL, page: `${SITE}/bank-branch-lookup` }
    },
  },
  {
    name: 'bank-branch-search',
    title: 'Search Israeli bank branches',
    description:
      'Search Israeli bank branches by branch name, city or address in Hebrew, optionally inside one bank. Closed branches are left out unless asked for. Live data from the Bank of Israel list on data.gov.il.',
    network: true,
    inputSchema: z.object({
      query: z.string().min(2).describe('Branch name, city or street, in Hebrew'),
      bankCode: z.number().int().min(1).max(999).optional().describe('Limit the search to one bank code'),
      includeClosed: z.boolean().optional().describe('Also return closed branches. Default: false'),
      limit: z.number().int().min(1).max(25).optional().describe('How many branches to return. Default: 5'),
    }),
    async run({ query, bankCode, includeClosed = false, limit = 5 }) {
      const found = searchBranches(await allBranches(), query, { bankCode, includeClosed, limit })
      return { count: found.length, branches: found, source: BRANCHES_DATASET_URL }
    },
  },
  {
    name: 'net-salary',
    title: 'Israeli net salary from gross',
    description: `Calculate an Israeli employee's monthly net salary from gross for tax year ${TAX_YEAR}: income tax by brackets, credit points, National Insurance and health tax, pension and study fund, plus the employer's cost. Amounts are monthly, in shekels. An estimate, not a payslip.`,
    network: false,
    inputSchema: z.object({ gross: shekels('Monthly gross salary'), creditPoints, gender, hishtalmut }),
    run: (input) => ({ taxYear: TAX_YEAR, ...netSalary(input), page: `${SITE}/net-salary-calculator` }),
  },
  {
    name: 'gross-for-net',
    title: 'Israeli gross salary for a target net',
    description: `Find the monthly gross salary that gives a target net salary in Israel for tax year ${TAX_YEAR}. Amounts are monthly, in shekels.`,
    network: false,
    inputSchema: z.object({ net: shekels('Target monthly net salary'), creditPoints, gender, hishtalmut }),
    run: ({ net, ...options }) => ({ taxYear: TAX_YEAR, net, gross: grossForNet(net, options) }),
  },
  {
    name: 'vat',
    title: 'Israeli VAT',
    description:
      'Add Israeli VAT (מע"מ) to a price or extract it from a price that already includes it. Uses the current standard rate unless another rate is given.',
    network: false,
    inputSchema: z.object({
      amount: shekels('The price'),
      mode: z.enum(['add', 'extract']).optional().describe('add: the amount is before VAT. extract: the amount already includes VAT. Default: add'),
      rate: z.number().min(0).max(100).optional().describe('VAT rate in percent. Default: the current standard rate'),
    }),
    run: ({ amount, mode = 'add', rate }) => ({ ...vat(amount, rate === undefined ? { mode } : { mode, rate }), page: `${SITE}/vat-calculator` }),
  },
  {
    name: 'purchase-tax',
    title: 'Israeli purchase tax on a home',
    description:
      'Calculate Israeli purchase tax (מס רכישה) on a residential property by the tax brackets: a single home, an additional home, or a new immigrant. Returns the tax by bracket and the effective rate.',
    network: false,
    inputSchema: z.object({
      value: shekels('Property price'),
      buyer: z.enum(['single', 'additional', 'oleh']).optional().describe('single: only home. additional: second home or investment. oleh: new immigrant. Default: single'),
    }),
    run: ({ value, buyer = 'single' }) => ({ ...purchaseTax(value, buyer), page: `${SITE}/purchase-tax-calculator` }),
  },
  {
    name: 'self-employed-tax',
    title: 'Israeli self-employed tax',
    description: `Estimate income tax, National Insurance and health tax of an Israeli self-employed person (עצמאי) for tax year ${TAX_YEAR} from revenue and recognised expenses, with the net left, the effective and marginal rates and the advance payment rate.`,
    network: false,
    inputSchema: z.object({
      revenue: shekels('Revenue for the period, without VAT'),
      expenses: z.number().min(0).optional().describe('Recognised expenses for the period, in shekels. Default: 0'),
      creditPoints,
      gender,
      months: z.number().int().min(1).max(12).optional().describe('How many months the figures cover. Default: 12'),
    }),
    run: (input) => ({ taxYear: TAX_YEAR, ...selfEmployedTax(input), page: `${SITE}/self-employed-tax-calculator` }),
  },
  {
    name: 'severance-pay',
    title: 'Israeli severance pay',
    description:
      'Calculate Israeli severance pay (פיצויי פיטורים) from the employment dates and the last monthly salary: tenure, the amount, and the tax-exempt and taxable parts.',
    network: false,
    inputSchema: z.object({
      start: isoDate('First day of employment'),
      end: isoDate('Last day of employment'),
      salary: shekels('Last monthly salary'),
      section14: z.enum(['none', 'full']).optional().describe('full: Section 14 arrangement applied to the whole salary. Default: none'),
    }),
    run: (input) => ({ ...severancePay(input), page: `${SITE}/severance-pay-calculator` }),
  },
  {
    name: 'minimum-wage',
    title: 'Israeli minimum wage',
    description: 'Israeli minimum wage by age group: monthly, hourly and daily rates for the current period or for the previous one.',
    network: false,
    inputSchema: z.object({
      age: z.enum(['adult', 'age17', 'age16', 'under16', 'apprentice']).optional().describe('Age group. Default: adult'),
      period: z.enum(['2026', '2025']).optional().describe('Wage period. Default: the current one'),
    }),
    run: (input) => ({ ...minimumWage(input), page: `${SITE}/minimum-wage-2026` }),
  },
  {
    name: 'phone',
    title: 'Israeli phone number',
    description:
      'Validate and format an Israeli phone number by the Ministry of Communications numbering plan: mobile, landline, 07X, 1-800 and star numbers. Returns the kind, local and international formats, E.164 and a WhatsApp link.',
    network: false,
    inputSchema: z.object({
      number: z.string().min(1).max(40).describe('The phone number in any common spelling'),
      whatsappMessage: z.string().max(1000).optional().describe('Text to prefill in the WhatsApp link'),
    }),
    run({ number, whatsappMessage }) {
      const parsed = parsePhone(number)
      if (parsed.status !== 'valid' || !whatsappMessage) return parsed
      return { ...parsed, whatsappWithMessage: whatsappLink(number, whatsappMessage) }
    },
  },
  {
    name: 'acronym',
    title: 'Hebrew acronym meaning',
    description:
      'Explain a Hebrew acronym (ראשי תיבות) such as צה"ל, מע"מ or בע"מ: all known meanings with their field (army, law, business, Torah and others). Falls back to a search when there is no exact match.',
    network: false,
    inputSchema: z.object({ acronym: z.string().min(1).max(40).describe('The acronym in Hebrew, with or without the gershayim mark') }),
    run({ acronym }) {
      const exact = lookup(acronym)
      if (exact) return { found: true, entry: exact }
      const similar = search(acronym, { limit: 10 })
      return { found: false, similar }
    },
  },
  {
    name: 'expand-acronyms',
    title: 'Expand Hebrew acronyms in a text',
    description:
      'Replace Hebrew acronyms in a text with their full wording, for text-to-speech or for readers who do not know them. Acronyms with several meanings are left as they are.',
    network: false,
    inputSchema: z.object({ text: z.string().min(1).max(5000).describe('Hebrew text') }),
    run: ({ text }) => ({ text: expand(text) }),
  },
  {
    name: 'seo-audit',
    title: 'SEO audit of a Hebrew page',
    description:
      'Fetch one public web page and audit it for Hebrew SEO: title and description length, lang and dir attributes, H1, canonical, hreflang, structured data, robots rules for AI crawlers, llms.txt and an accessibility statement. Returns a score and the list of checks. Local and private network addresses are refused, also when a public page redirects to one.',
    network: true,
    inputSchema: z.object({ url: z.url({ protocol: /^https?$/ }).describe('Full address of the page, starting with https://') }),
    async run({ url }) {
      const audit = await auditUrl(url, { ...requestOptions(), fetch: publicFetch })
      return {
        url: audit.url,
        finalUrl: audit.finalUrl,
        status: audit.status,
        score: audit.score,
        checks: audit.checks.map((check) => ({ id: check.id, status: check.status, message: check.messageEn, detail: check.detail })),
      }
    },
  },
]

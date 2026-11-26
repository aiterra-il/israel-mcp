<div dir="rtl">

# israel-mcp · שרת MCP לנתונים ולחישובים ישראליים

[![npm](https://img.shields.io/npm/v/israel-mcp?color=2447D6)](https://www.npmjs.com/package/israel-mcp)
[![tests](https://github.com/aiterra-il/israel-mcp/actions/workflows/tests.yml/badge.svg)](https://github.com/aiterra-il/israel-mcp/actions/workflows/tests.yml)
[![license](https://img.shields.io/badge/license-MIT-3E96F9)](LICENSE)

שרת [MCP](https://modelcontextprotocol.io) שנותן ל-Claude, ל-Cursor, ל-VS Code ולכל סוכן AI אחר 16 כלים על ישראל: חיפוש ברשם החברות, סניפי בנקים, חישובי מס ושכר לשנת 2026, מספרי טלפון, ראשי תיבות ובדיקת SEO לעמוד בעברית.

מודל שפה מנחש מדרגות מס וכתובות של חברות. כאן הוא מקבל תשובה מחושבת: הנתונים מגיעים ישר מהמאגרים הפתוחים ב-data.gov.il, והחישובים רצים על טבלאות המס של 2026. אין מפתח API, אין הרשמה ואין תשלום.

**מה אפשר לשאול אחרי ההתקנה?**

- ״מה הסטטוס של חברה 520000118 ומה הכתובת הרשומה שלה?״
- ״כמה נטו יוצא משכר ברוטו של 18,000 ש״ח, עם קרן השתלמות?״
- ״כמה מס רכישה משלמים על דירה שנייה ב-2.5 מיליון?״
- ״איזה סניף זה 12-600, ומה הטלפון שלו?״
- ״תבדוק את עמוד הבית שלי מבחינת SEO בעברית.״

## התקנה

צריך Node.js 20 ומעלה. הפקודה שמפעילה את השרת זהה בכל מקום: `npx -y israel-mcp`.

**Claude Code**

```bash
claude mcp add israel -- npx -y israel-mcp
```

**Claude Desktop** (`claude_desktop_config.json`) ו-**Cursor** (`.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "israel": {
      "command": "npx",
      "args": ["-y", "israel-mcp"]
    }
  }
}
```

**VS Code** (`.vscode/mcp.json`)

```json
{
  "servers": {
    "israel": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "israel-mcp"]
    }
  }
}
```

ב-Windows, אם התוכנה לא מוצאת את `npx`, כותבים `"command": "cmd"` ו-`"args": ["/c", "npx", "-y", "israel-mcp"]`.

## הכלים

| כלי | מה הוא מחזיר | רשת |
|---|---|---|
| `company-lookup` | חברה מרשם החברות לפי ח.פ.: שם בעברית ובאנגלית, סוג, סטטוס, הפרות, כתובת | כן |
| `company-search` | חיפוש חברות לפי שם בעברית או באנגלית, עד 20 תוצאות | כן |
| `company-number-check` | בדיקת ספרת הביקורת של ח.פ., שותפות או עמותה | לא |
| `bank-branch` | סניף בנק לפי קוד בנק ומספר סניף: כתובת, טלפון, נגישות, תאריך סגירה | כן |
| `bank-branch-search` | חיפוש סניפים לפי שם, עיר או רחוב | כן |
| `net-salary` | שכר נטו מברוטו: מס הכנסה, ביטוח לאומי, מס בריאות, פנסיה, עלות מעסיק | לא |
| `gross-for-net` | הברוטו שנותן נטו מבוקש | לא |
| `vat` | הוספת מע״מ למחיר או חילוץ שלו ממחיר שכולל אותו | לא |
| `purchase-tax` | מס רכישה לפי מדרגות: דירה יחידה, דירה נוספת, עולה חדש | לא |
| `self-employed-tax` | מס הכנסה, ביטוח לאומי ומס בריאות של עצמאי, ושיעור המקדמות | לא |
| `severance-pay` | פיצויי פיטורים לפי תאריכי העבודה והשכר האחרון, כולל החלק הפטור ממס | לא |
| `minimum-wage` | שכר מינימום לפי גיל: חודשי, שעתי ויומי | לא |
| `phone` | בדיקה ועיצוב של מספר טלפון ישראלי, E.164 וקישור ל-WhatsApp | לא |
| `acronym` | הפירוש של ראשי תיבות, עם התחום של כל פירוש | לא |
| `expand-acronyms` | טקסט שבו ראשי התיבות נפתחו למילים מלאות | לא |
| `seo-audit` | בדיקת SEO של עמוד ציבורי: כותרת, תיאור, `lang` ו-`dir`, נתונים מובנים, רובוטים של AI | כן |

כל הכלים קוראים בלבד: השרת לא כותב קבצים, לא שומר נתונים ולא שולח את השאלות שלכם לשום מקום. כלי שמסומן ״רשת״ פונה רק למאגר הממשלתי. `seo-audit` מוריד את העמוד שביקשתם ואת הקבצים `robots.txt` ו-`llms.txt` של אותו אתר, ומסרב לכתובות של רשת מקומית, גם כשעמוד ציבורי מפנה אליהן.

חישובי המס והשכר הם אומדן, לא תלוש שכר ולא ייעוץ מס.

## הגדרות

| משתנה סביבה | ברירת מחדל | מה הוא קובע |
|---|---|---|
| `ISRAEL_MCP_TIMEOUT_MS` | `15000` | כמה זמן מחכים לתשובה ממאגר ממשלתי או מעמוד שנבדק |

כשמאגר לא עונה, הכלי מחזיר שגיאה עם הסבר והשרת ממשיך לעבוד.

## שימוש כספרייה

אפשר לחבר את אותו שרת לתעבורה אחרת, למשל HTTP:

```js
import { createServer, tools } from 'israel-mcp'

const server = createServer()
```

## הספריות שמאחורי הכלים

כל כלי הוא עטיפה דקה מעל ספרייה שאפשר להתקין גם לבד:
[israel-companies](https://www.npmjs.com/package/israel-companies),
[israel-bank-branches](https://www.npmjs.com/package/israel-bank-branches),
[israel-tax](https://www.npmjs.com/package/israel-tax),
[israeli-phone](https://www.npmjs.com/package/israeli-phone),
[hebrew-acronyms](https://www.npmjs.com/package/hebrew-acronyms),
[hebrew-seo-audit](https://www.npmjs.com/package/hebrew-seo-audit).

אותם חישובים רצים גם בדפדפן, בלי התקנה, ב[כלים החינמיים של Aiterra](https://www.aiterra.co.il/tools).

## מי עומד מאחורי זה

[Aiterra](https://www.aiterra.co.il) היא סטודיו ישראלי שבונה סוכני AI, אוטומציות ואתרים לעסקים. את השרת כתבנו בשביל הסוכנים שאנחנו בונים ללקוחות, ופתחנו אותו לכולם.

</div>

---

## English

An [MCP](https://modelcontextprotocol.io) server that gives Claude, Cursor, VS Code and any other MCP host 16 read-only tools about Israel: Companies Registrar lookup, bank branches, 2026 tax and payroll calculators, phone numbers, Hebrew acronyms and a Hebrew SEO audit. No API key, no sign-up.

```bash
claude mcp add israel -- npx -y israel-mcp
```

For Claude Desktop and Cursor, add this to `mcpServers`:

```json
{
  "israel": {
    "command": "npx",
    "args": ["-y", "israel-mcp"]
  }
}
```

| Tool | Returns | Network |
|---|---|---|
| `company-lookup` | A company from the Companies Registrar by number: names, type, status, violations, address | yes |
| `company-search` | Companies by name in Hebrew or English, up to 20 matches | yes |
| `company-number-check` | Check digit of a company, partnership or non-profit number | no |
| `bank-branch` | A bank branch by bank code and branch number | yes |
| `bank-branch-search` | Branches by name, city or street | yes |
| `net-salary` | Net salary from gross: income tax, National Insurance, health tax, pension, employer cost | no |
| `gross-for-net` | The gross salary that gives a target net | no |
| `vat` | Add VAT to a price or extract it | no |
| `purchase-tax` | Purchase tax on a home by brackets | no |
| `self-employed-tax` | Income tax, National Insurance and health tax of a self-employed person | no |
| `severance-pay` | Severance pay with the tax-exempt part | no |
| `minimum-wage` | Minimum wage by age group | no |
| `phone` | Validation and formats of an Israeli phone number, E.164, WhatsApp link | no |
| `acronym` | Meanings of a Hebrew acronym | no |
| `expand-acronyms` | A text with its Hebrew acronyms written out | no |
| `seo-audit` | SEO audit of a public page: title, description, `lang` and `dir`, structured data, AI crawler rules | yes |

Registry data comes live from data.gov.il. `seo-audit` fetches the page you name plus `robots.txt` and `llms.txt` of the same site, and refuses local and private network addresses, also when a public page redirects to one. Tax and payroll results are estimates for tax year 2026, not tax advice. Set `ISRAEL_MCP_TIMEOUT_MS` to change the 15-second network timeout.

Built by [Aiterra](https://www.aiterra.co.il), an Israeli studio for AI agents, automation and websites. The same calculators run in the browser at [aiterra.co.il/tools](https://www.aiterra.co.il/tools).

## License

MIT

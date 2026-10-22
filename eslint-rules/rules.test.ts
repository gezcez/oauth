import { RuleTester } from "eslint"
import tseslint from "typescript-eslint"
import { describe, it } from "vitest"
import noHtml from "./no-dangerously-set-inner-html.js"
import noLocation from "./no-location-assign.js"

RuleTester.describe = describe
RuleTester.it = it
RuleTester.itOnly = it.only

const tester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

tester.run("no-location-assign", noLocation, {
  valid: [
    { code: "followRedirect(url)", filename: "src/routes/x.tsx" },
    { code: "window.location.replace(url)", filename: "src/lib/navigation.ts" },
    { code: "const o = window.location.origin", filename: "src/routes/x.tsx" },
    { code: "router.history.push('/a')", filename: "src/routes/x.tsx" },
  ],
  invalid: [
    {
      code: "window.location.href = url",
      filename: "src/routes/x.tsx",
      errors: [{ messageId: "noLocation" }],
    },
    { code: "location.href = url", filename: "src/routes/x.tsx", errors: [{ messageId: "noLocation" }] },
    { code: "window.location = url", filename: "src/routes/x.tsx", errors: [{ messageId: "noLocation" }] },
    { code: "location.assign(url)", filename: "src/routes/x.tsx", errors: [{ messageId: "noLocation" }] },
    {
      code: "window.location.replace(url)",
      filename: "src/features/x.ts",
      errors: [{ messageId: "noLocation" }],
    },
    {
      code: "document.location.assign(url)",
      filename: "src/features/x.ts",
      errors: [{ messageId: "noLocation" }],
    },
    { code: "window.open(url)", filename: "src/features/x.ts", errors: [{ messageId: "noLocation" }] },
  ],
})

tester.run("no-dangerously-set-inner-html", noHtml, {
  valid: [{ code: "<div>{text}</div>" }],
  invalid: [
    { code: "<div dangerouslySetInnerHTML={{ __html: x }} />", errors: [{ messageId: "noHtml" }] },
    {
      code: "createElement('div', { dangerouslySetInnerHTML: { __html: x } })",
      errors: [{ messageId: "noHtml" }],
    },
  ],
})

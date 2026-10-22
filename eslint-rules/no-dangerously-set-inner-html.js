/** Forbids the dangerouslySetInnerHTML prop anywhere (oauth.md section 10, XSS hardening). */
/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: { description: "Disallow dangerouslySetInnerHTML" },
    schema: [],
    messages: { noHtml: "dangerouslySetInnerHTML is not allowed. Render server strings as text." },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name.type === "JSXIdentifier" && node.name.name === "dangerouslySetInnerHTML")
          context.report({ node, messageId: "noHtml" })
      },
      Property(node) {
        if (!node.computed && node.key.type === "Identifier" && node.key.name === "dangerouslySetInnerHTML")
          context.report({ node, messageId: "noHtml" })
      },
    }
  },
}

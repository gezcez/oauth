/**
 * Forbids changing window.location (assign, replace, href =, location =) outside
 * src/lib/navigation.ts, so every way out of the SPA goes through followRedirect() or
 * safeInternalPath() (oauth.md section 10, open redirects).
 */
const NAV_METHODS = new Set(["assign", "replace", "reload"])
const NAV_PROPS = new Set(["href", "pathname", "search", "hash", "host", "hostname", "protocol", "port"])

function isLocation(node) {
  if (!node) return false
  if (node.type === "Identifier") return node.name === "location"
  if (node.type === "MemberExpression" && !node.computed && node.property.type === "Identifier") {
    return (
      node.property.name === "location" &&
      ["window", "document", "self", "globalThis", "top", "parent"].includes(node.object.name ?? "")
    )
  }
  return false
}

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: { description: "Disallow navigating via window.location outside src/lib/navigation.ts" },
    schema: [
      {
        type: "object",
        properties: { allow: { type: "array", items: { type: "string" } } },
        additionalProperties: false,
      },
    ],
    messages: {
      noLocation:
        "Do not navigate with location here. Use followRedirect() or safeInternalPath() from @/lib/navigation.",
    },
  },
  create(context) {
    const allow = context.options[0]?.allow ?? ["src/lib/navigation.ts"]
    const file = context.filename.replace(/\\/g, "/")
    if (allow.some((a) => file.endsWith(a))) return {}
    return {
      AssignmentExpression(node) {
        const left = node.left
        if (isLocation(left)) context.report({ node, messageId: "noLocation" })
        else if (
          left.type === "MemberExpression" &&
          isLocation(left.object) &&
          left.property.type === "Identifier" &&
          NAV_PROPS.has(left.property.name)
        )
          context.report({ node, messageId: "noLocation" })
      },
      CallExpression(node) {
        const c = node.callee
        if (
          c.type === "MemberExpression" &&
          isLocation(c.object) &&
          c.property.type === "Identifier" &&
          NAV_METHODS.has(c.property.name)
        )
          context.report({ node, messageId: "noLocation" })
        // window.open(...) is also a way out
        if (
          c.type === "MemberExpression" &&
          c.object.type === "Identifier" &&
          c.object.name === "window" &&
          c.property.type === "Identifier" &&
          c.property.name === "open"
        )
          context.report({ node, messageId: "noLocation" })
      },
    }
  },
}

/**
 * The only two ways this app leaves the current page:
 *
 * 1. followRedirect(redirect_to): a URL the API returned in the same response. The SPA never
 *    parses, builds or edits OAuth redirect URLs itself (backend owns redirect URI matching).
 * 2. safeInternalPath(p): an internal path taken from our own query string (`return=`), which
 *    must stay on this origin.
 *
 * The local eslint rule `local/no-location-assign` forbids touching window.location anywhere
 * else in src/.
 */

/**
 * Returns `p` when it is a same-origin path, otherwise "/". Rejects protocol-relative URLs,
 * backslash tricks, absolute URLs, `javascript:` and their percent-encoded forms.
 */
export function safeInternalPath(p: unknown, origin: string = currentOrigin()): string {
  if (typeof p !== "string" || p.length === 0 || p.length > 2048) return "/"
  if (!p.startsWith("/")) return "/"
  // Disallow `//host`, `/\host` and their encoded forms before parsing.
  let decoded = p
  try {
    decoded = decodeURIComponent(p)
  } catch {
    return "/"
  }
  for (const candidate of [p, decoded]) {
    if (candidate.startsWith("//") || candidate.startsWith("/\\")) return "/"
    if (candidate.includes("\\")) return "/"
    // Control characters (tab, newline) are stripped by URL parsers and can hide a second slash.
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u001f\u007f]/.test(candidate)) return "/"
  }
  let url: URL
  try {
    url = new URL(p, origin)
  } catch {
    return "/"
  }
  if (url.origin !== new URL(origin).origin) return "/"
  return `${url.pathname}${url.search}${url.hash}`
}

function currentOrigin(): string {
  return typeof window !== "undefined" ? window.location.origin : "http://localhost"
}

/** Leave the SPA for a URL the API built. Uses replace so auth screens stay out of history. */
export function followRedirect(redirectTo: string): void {
  window.location.replace(redirectTo)
}

/** Full reload (error boundary "Reload" button). */
export function reloadPage(): void {
  window.location.reload()
}

/** Drop the raw OAuth query from the address bar without navigating (so reload does not retry). */
export function replaceUrl(path: string): void {
  window.history.replaceState(window.history.state, "", safeInternalPath(path))
}

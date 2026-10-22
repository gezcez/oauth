import { Fragment, type ReactNode } from "react"

/**
 * Renders a translated string with tag slots, e.g. "I accept the <terms>Terms</terms>." with
 * `{ terms: (c) => <a>{c}</a> }`. Keeps whole sentences in one catalog value so word order and
 * spacing (no space before a full stop) stay the translator's call. Tags do not nest. An unknown
 * tag renders its text plainly.
 */
export function rich(template: string, tags: Record<string, (children: string) => ReactNode>): ReactNode[] {
  const out: ReactNode[] = []
  const re = /<([a-z]+)>(.*?)<\/\1>/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(template))) {
    if (m.index > last) out.push(template.slice(last, m.index))
    const render = tags[m[1]!]
    out.push(<Fragment key={m.index}>{render ? render(m[2]!) : m[2]}</Fragment>)
    last = m.index + m[0].length
  }
  if (last < template.length) out.push(template.slice(last))
  return out
}

/** e***@gmail.com: first character of the local part, then the domain. Display only. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@")
  if (at < 1) return email
  return `${email.slice(0, 1)}***${email.slice(at)}`
}

/** Display-name suggestion from the email local part: "ada.lovelace" -> "Ada Lovelace". */
export function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? ""
  return local
    .replace(/[._-]+/g, " ")
    .replace(/\d+/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toLocaleUpperCase("tr") + w.slice(1))
    .join(" ")
    .slice(0, 40)
}

export function initialsOf(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p.charAt(0).toLocaleUpperCase("tr"))
      .join("") || "?"
  )
}

/**
 * Advisory only (oauth.md 5.3): length matters most, a little credit for variety, zero for
 * obvious patterns. The backend's breached-password check is the real gate.
 */
export function passwordStrength(pw: string): 0 | 1 | 2 {
  if (pw.length < 10) return 0
  if (/^(.)\1+$/.test(pw) || /(0123|1234|2345|abcd|qwer|password|parola|sifre|şifre)/i.test(pw)) return 0
  let score = 0
  if (pw.length >= 14) score++
  if (pw.length >= 20) score++
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9\s]/, /\s/].filter((r) => r.test(pw)).length
  if (classes >= 3) score++
  if (score >= 2) return 2
  if (score === 1 || pw.length >= 12) return 1
  return 0
}

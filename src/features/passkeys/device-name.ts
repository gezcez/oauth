export const MAX_PASSKEY_NAME = 64

/**
 * A starting name for a new passkey from the user agent ("iPhone", "Mac", "Android phone"),
 * so the list tells passkeys apart. The user can change it before saving. Empty when unknown.
 */
export function suggestPasskeyName(ua: string, platform = ""): string {
  if (/iPhone/i.test(ua)) return "iPhone"
  if (/iPad/i.test(ua)) return "iPad"
  // iPadOS 13+ reports itself as a Mac; touch support is the tell.
  if (/Macintosh/i.test(ua) && /Mobile\//.test(ua)) return "iPad"
  if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? "Android phone" : "Android tablet"
  if (/CrOS/i.test(ua)) return "Chromebook"
  if (/Windows/i.test(ua) || /^Win/i.test(platform)) return "Windows PC"
  if (/Mac OS X|Macintosh/i.test(ua) || /^Mac/i.test(platform)) return "Mac"
  if (/Linux/i.test(ua)) return "Linux PC"
  return ""
}

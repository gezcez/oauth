/**
 * Hand-off between screens without putting anything in URLs.
 *
 * - Email flow metadata (address, timers) is kept in sessionStorage so a reload of the code
 *   screen still shows "we sent a code to a***@x.com". No secrets live there.
 * - profile_token and reset_token are short-lived credentials: memory only. A reload sends the
 *   user back to the start with an explanation, which is the safer failure.
 * - Ban and pending-deletion details come from an error response: memory only.
 */
import type { EmailIntent } from "@/api/schema"
import type { ErrorDetails } from "./errors"

export interface FlowMeta {
  flow_id: string
  email?: string
  intent: EmailIntent
  expires_at: string
  resend_available_at: string
  code_length: number
}

const FLOW_KEY = "gz.flow."
const EMAIL_KEY = "gz.last-email"

function ss(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage
  } catch {
    return null
  }
}

export const flowStore = {
  save(meta: FlowMeta) {
    ss()?.setItem(FLOW_KEY + meta.flow_id, JSON.stringify(meta))
    if (meta.email) flowStore.setLastEmail(meta.email)
  },
  get(flowId: string | undefined): FlowMeta | null {
    if (!flowId) return null
    try {
      const raw = ss()?.getItem(FLOW_KEY + flowId)
      return raw ? (JSON.parse(raw) as FlowMeta) : null
    } catch {
      return null
    }
  },
  update(flowId: string, patch: Partial<FlowMeta>) {
    const cur = flowStore.get(flowId)
    if (cur) flowStore.save({ ...cur, ...patch })
  },
  remove(flowId: string) {
    ss()?.removeItem(FLOW_KEY + flowId)
  },
  setLastEmail(email: string) {
    ss()?.setItem(EMAIL_KEY, email)
  },
  lastEmail(): string {
    return ss()?.getItem(EMAIL_KEY) ?? ""
  },
}

interface Memory {
  profileToken?: { token: string; email?: string; req?: string; returnTo?: string }
  resetToken?: { token: string; req?: string }
  banned?: ErrorDetails
  pendingDeletion?: ErrorDetails
  welcome?: boolean
}

const memory: Memory = {}

export const secretStore = {
  set<K extends keyof Memory>(key: K, value: Memory[K]) {
    memory[key] = value
  },
  get<K extends keyof Memory>(key: K): Memory[K] {
    return memory[key]
  },
  take<K extends keyof Memory>(key: K): Memory[K] {
    const v = memory[key]
    delete memory[key]
    return v
  },
  clear() {
    for (const k of Object.keys(memory)) delete memory[k as keyof Memory]
  },
}

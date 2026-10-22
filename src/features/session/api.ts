import { api, unwrap } from "@/api/client"

export function switchSession(sessionId: string) {
  return unwrap(api.POST("/v1/account/session/switch", { body: { session_id: sessionId } }))
}

export function forgetDeviceAccount(sessionId: string) {
  return unwrap(api.DELETE("/v1/account/device-accounts/{sessionId}", { params: { path: { sessionId } } }))
}

export function logout(body: {
  scope: "session" | "device"
  client_id?: string
  post_logout_redirect_uri?: string
  state?: string
}) {
  return unwrap(api.POST("/v1/oauth/logout", { body }))
}

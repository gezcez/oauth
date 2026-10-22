import { api, unwrap } from "@/api/client"

export function passwordLogin(body: {
  email: string
  password: string
  request_id?: string
  turnstile_token?: string
}) {
  return unwrap(api.POST("/v1/account/password/login", { body }))
}

export function passwordReset(body: { reset_token: string; new_password: string }) {
  return unwrap(api.POST("/v1/account/password/reset", { body }))
}

export function reauthWithPassword(password: string) {
  return unwrap(api.POST("/v1/account/reauth", { body: { password } }))
}

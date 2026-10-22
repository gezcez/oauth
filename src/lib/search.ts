import { z } from "zod"
import { safeInternalPath } from "./navigation"

/** Search params are validated per route; anything malformed is dropped, never trusted. */
export const reqParam = z
  .string()
  .regex(/^ar_[0-9A-Za-z]{20,40}$/)
  .optional()
  .catch(undefined)

export const flowParam = z
  .string()
  .regex(/^fl_[0-9A-Za-z]{20,40}$/)
  .optional()
  .catch(undefined)

/** `return=` must be an internal path; anything else becomes undefined. */
export const returnParam = z
  .string()
  .optional()
  .catch(undefined)
  .transform((v) => {
    if (!v) return undefined
    const safe = safeInternalPath(v)
    return safe === "/" && v !== "/" ? undefined : safe
  })

export const authSearch = z.object({ req: reqParam, return: returnParam })
export const codeSearch = z.object({ req: reqParam, return: returnParam, flow: flowParam })

import type { Catalog } from "../types"
import { account } from "./account"
import { auth } from "./auth"
import { common } from "./common"
import { errors } from "./errors"
import { scopes } from "./scopes"

export const tr: Catalog = { common, auth, account, errors, scopes }

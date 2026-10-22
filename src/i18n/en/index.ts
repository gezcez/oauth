import { account } from "./account"
import { auth } from "./auth"
import { common } from "./common"
import { errors } from "./errors"
import { scopes } from "./scopes"

/** English is the source catalog: its shape defines the typed keys every locale must fill. */
export const en = { common, auth, account, errors, scopes }

import type { paths as generatedPaths } from "./schema.gen"
import type { paths as manualPaths } from "./schema.manual"

export type * from "./schema.manual"

/** Generated paths plus the hand-typed ones the backend does not publish yet. */
export type paths = generatedPaths & manualPaths

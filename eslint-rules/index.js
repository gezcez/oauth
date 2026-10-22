import noDangerouslySetInnerHtml from "./no-dangerously-set-inner-html.js"
import noLocationAssign from "./no-location-assign.js"

export default {
  meta: { name: "local" },
  rules: {
    "no-location-assign": noLocationAssign,
    "no-dangerously-set-inner-html": noDangerouslySetInnerHtml,
  },
}

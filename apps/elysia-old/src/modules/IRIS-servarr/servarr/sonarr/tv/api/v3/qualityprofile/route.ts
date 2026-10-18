import { defineRoute } from "@/router"
import {
  QualityProfileSchema,
  SERVARR_QUALITY_PROFILES,
} from "@/modules/IRIS-servarr/helpers"

export default defineRoute({
  GET: {
    schema: {
      response: {
        200: QualityProfileSchema,
      },
    },
    handler() {
      return SERVARR_QUALITY_PROFILES
    },
  },
})

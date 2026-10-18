import { defineRoute } from "@/router"
import {
  SystemStatusSchema,
  SERVARR_SYSTEM_STATUS,
} from "@/modules/IRIS-servarr/helpers"

export default defineRoute({
  GET: {
    schema: {
      response: {
        200: SystemStatusSchema,
      },
    },
    handler() {
      return SERVARR_SYSTEM_STATUS
    },
  },
})

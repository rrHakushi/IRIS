import { defineRoute, t } from "@/router"
import { SonarrSeriesItemSchema } from "@/modules/IRIS-servarr/helpers"
import { handleSonarrTv } from "@/modules/IRIS-servarr/servarr/sonarr/tv/route"

export default defineRoute({
  GET: {
    schema: {
      response: {
        200: t.Array(SonarrSeriesItemSchema),
      },
    },
    handler: handleSonarrTv,
  },
})

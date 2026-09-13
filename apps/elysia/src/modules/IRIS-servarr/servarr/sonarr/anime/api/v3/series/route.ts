import { defineRoute, t } from "@/router"
import { SonarrSeriesItemSchema } from "@/modules/IRIS-servarr/helpers"
import { handleSonarrAnime } from "@/modules/IRIS-servarr/servarr/sonarr/anime/route"

export default defineRoute({
  GET: {
    schema: {
      response: {
        200: t.Array(SonarrSeriesItemSchema),
      },
    },
    handler: handleSonarrAnime,
  },
})

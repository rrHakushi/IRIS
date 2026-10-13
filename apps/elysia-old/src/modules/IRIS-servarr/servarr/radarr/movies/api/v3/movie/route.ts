import { defineRoute, t } from "@/router"
import { RadarrMovieItemSchema } from "@/modules/IRIS-servarr/helpers"
import { handleRadarrMovies } from "@/modules/IRIS-servarr/servarr/radarr/movies/route"

export default defineRoute({
  GET: {
    schema: {
      response: {
        200: t.Array(RadarrMovieItemSchema),
      },
    },
    handler: handleRadarrMovies,
  },
})

import { defineRoute, t } from "@/router"
import { RadarrMovieItemSchema } from "@/modules/IRIS-servarr/helpers"
import { handleRadarrAnimeMovies } from "@/modules/IRIS-servarr/servarr/radarr/movies/anime/route"

export default defineRoute({
  GET: {
    schema: {
      response: {
        200: t.Array(RadarrMovieItemSchema),
      },
    },
    handler: handleRadarrAnimeMovies,
  },
})

import { defineRoute, t } from "../../../../router";
import { getSupportedProviders } from "@IRIS/connections";

export default defineRoute({
  GET: {
    schema: {
      response: {
        200: t.Object({
          success: t.Boolean(),
          providers: t.Array(
            t.Object({
              provider: t.String(),
              name: t.String(),
              category: t.String(),
              description: t.String(),
              iconUrl: t.String(),
              websiteUrl: t.String(),
              defaultHostUrl: t.Optional(t.Nullable(t.String())),
              accentColor: t.Optional(t.String()),
              isConfigured: t.Boolean(),
              capabilities: t.Object({
                authType: t.String(),
                category: t.String(),
                supportsOAuth: t.Boolean(),
                supportsApiKey: t.Boolean(),
                supportsCredentials: t.Boolean(),
                supportsSearch: t.Boolean(),
                supportsLibrarySync: t.Boolean(),
                supportsScrobble: t.Boolean(),
                supportsGamingLibrary: t.Boolean(),
              }),
            })
          ),
        }),
      },
    },
    async handler() {
      // Returns active supported connection providers list
      const providers = getSupportedProviders();
      return {
        success: true,
        providers,
      };
    },
  },
});

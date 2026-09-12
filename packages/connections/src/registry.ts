import type {
  ConnectionCategory,
  ConnectionProvider,
  ConnectionProviderAdapter,
  ProviderCapability,
} from "./types/index.js";
import {
  AniListAdapter,
  BangumiAdapter,
  DeezerAdapter,
  LastFmAdapter,
  MyAnimeListAdapter,
  RadarrAdapter,
  RiotGamesAdapter,
  SimklAdapter,
  SonarrAdapter,
  SteamAdapter,
  IrisAdapter,
} from "./providers/index.js";

export interface ProviderMetadata {
  provider: ConnectionProvider;
  name: string;
  category: ConnectionCategory;
  description: string;
  iconUrl: string;
  iconName?: string;
  accentColor?: string;
  websiteUrl: string;
  defaultHostUrl?: string | null;
  capabilities: ProviderCapability;
  isConfigured: boolean;
}

const adapterInstances = new Map<ConnectionProvider, ConnectionProviderAdapter>();

export function registerConnectionAdapter(adapter: ConnectionProviderAdapter): void {
  adapterInstances.set(adapter.provider, adapter);

  if (!adapter.isConfigured()) {
    const missing = adapter.getMissingEnvVars();
    console.warn(
      `\x1b[33m[Connections]\x1b[0m \x1b[31m[DISABLED]\x1b[0m Provider \x1b[1m${adapter.provider}\x1b[0m is disabled — missing required env: \x1b[33m${missing.join(", ")}\x1b[0m`
    );
  }
}

// Pre-register default standard adapters
registerConnectionAdapter(new AniListAdapter());
registerConnectionAdapter(new MyAnimeListAdapter());
registerConnectionAdapter(new SimklAdapter());
registerConnectionAdapter(new BangumiAdapter());
registerConnectionAdapter(new SteamAdapter());
registerConnectionAdapter(new RiotGamesAdapter());
registerConnectionAdapter(new RadarrAdapter());
registerConnectionAdapter(new SonarrAdapter());
registerConnectionAdapter(new DeezerAdapter());
registerConnectionAdapter(new LastFmAdapter());
registerConnectionAdapter(new IrisAdapter());

/**
 * Retrieves the adapter implementation for a given provider.
 * Throws if provider is unsupported.
 */
export function getConnectionAdapter(
  provider: ConnectionProvider
): ConnectionProviderAdapter {
  const adapter = adapterInstances.get(provider);
  if (!adapter) {
    throw new Error(`Unsupported connection provider: "${provider}"`);
  }
  return adapter;
}

/**
 * Validates and logs the configuration status of all registered connection providers.
 */
export function validateConnectionEnvironment(): {
  configured: ConnectionProvider[];
  disabled: Array<{ provider: ConnectionProvider; missingEnvVars: string[] }>;
} {
  const configured: ConnectionProvider[] = [];
  const disabled: Array<{ provider: ConnectionProvider; missingEnvVars: string[] }> = [];

  for (const [provider, adapter] of adapterInstances.entries()) {
    if (adapter.isConfigured()) {
      configured.push(provider);
    } else {
      disabled.push({
        provider,
        missingEnvVars: adapter.getMissingEnvVars(),
      });
    }
  }

  return { configured, disabled };
}

/**
 * Lists all supported providers with metadata and configuration status for UI rendering.
 */
export function getSupportedProviders(): ProviderMetadata[] {
  const definitions: Array<Omit<ProviderMetadata, "capabilities" | "isConfigured" | "iconUrl">> = [
    {
      provider: "ANILIST",
      name: "AniList",
      category: "TRACKING",
      description: "Track anime & manga, sync watchlists, and share progress via AniList API.",
      websiteUrl: "https://anilist.co",
      accentColor: "#02A9FF",
    },
    {
      provider: "MAL",
      name: "MyAnimeList",
      category: "TRACKING",
      description: "Sync your anime and manga list with MyAnimeList official OAuth2 API.",
      websiteUrl: "https://myanimelist.net",
      accentColor: "#2E51A2",
    },
    {
      provider: "SIMKL",
      name: "Simkl",
      category: "TRACKING",
      description: "Track TV shows, movies, and anime in one place with automated scrobbling.",
      websiteUrl: "https://simkl.com",
      accentColor: "#000000",
    },
    {
      provider: "BANGUMI",
      name: "Bangumi (番组计划)",
      category: "TRACKING",
      description: "Sync your ACG ratings, episodes, and subject collections with Bangumi.",
      websiteUrl: "https://bgm.tv",
      accentColor: "#F09199",
    },
    {
      provider: "DEEZER",
      name: "Deezer",
      category: "MUSIC",
      description: "Import playlists, sync favorite music, and discover tracks with Deezer.",
      websiteUrl: "https://www.deezer.com",
      accentColor: "#A238FF",
    },
    {
      provider: "LASTFM",
      name: "Last.fm",
      category: "MUSIC",
      description: "Scrobble playback progress, synchronize listening history and top tracks via Last.fm.",
      websiteUrl: "https://www.last.fm",
      accentColor: "#D51007",
    },
    {
      provider: "STEAM",
      name: "Steam",
      category: "GAMING",
      description: "Sync Steam library, achievements, and recently played game activity.",
      websiteUrl: "https://store.steampowered.com",
      accentColor: "#171A21",
    },
    {
      provider: "RIOT_GAMES",
      name: "Riot Games",
      category: "GAMING",
      description: "Link League of Legends and VALORANT accounts via Riot ID.",
      websiteUrl: "https://www.riotgames.com",
      accentColor: "#D13639",
    },
    {
      provider: "RADARR",
      name: "Radarr",
      category: "SERVARR",
      description: "Connect your Radarr instance to search, monitor, and manage movie collections.",
      websiteUrl: "https://radarr.video",
      accentColor: "#FFC230",
    },
    {
      provider: "SONARR",
      name: "Sonarr",
      category: "SERVARR",
      description: "Connect your Sonarr instance to search, monitor, and manage TV series downloads.",
      websiteUrl: "https://sonarr.tv",
      accentColor: "#00CDF0",
    },
    {
      provider: "IRIS",
      name: "IRIS Instance",
      category: "TRACKING",
      description: "Link another IRIS instance to synchronize media libraries, activity, and federate accounts.",
      websiteUrl: "https://github.com/rrHakushi/IRIS",
      accentColor: "#E11D48",
    },
  ];

  return definitions.map((def) => {
    const adapter = getConnectionAdapter(def.provider);
    return {
      ...def,
      iconUrl: adapter.iconUrl,
      defaultHostUrl: adapter.defaultHostUrl || null,
      capabilities: adapter.capabilities,
      isConfigured: adapter.isConfigured(),
    };
  });
}

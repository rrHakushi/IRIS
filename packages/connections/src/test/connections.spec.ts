import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  deriveUserConnectionKey,
  encryptConnectionData,
  decryptConnectionData,
  isEncryptedFormat,
} from "../crypto/index.js";
import {
  getConnectionAdapter,
  getSupportedProviders,
} from "../registry.js";
import { SearchProxyManager } from "../search/index.js";
import type { ConnectionCredentials } from "../types/index.js";

describe("@IRIS/connections - Cryptographic Envelope", () => {
  const userId = "user_test_12345";
  const otherUserId = "user_attacker_67890";

  const sampleTokens: ConnectionCredentials = {
    accessToken: "mal_oauth_access_token_secret_xyz123",
    refreshToken: "mal_refresh_token_secret_abc789",
    expiresAt: new Date(Date.now() + 3600000),
    apiKey: "radarr_api_key_32chars_hex",
    hostUrl: "https://radarr.myhomelab.internal",
  };

  it("should derive deterministic 32-byte key for same user", () => {
    const key1 = deriveUserConnectionKey(userId);
    const key2 = deriveUserConnectionKey(userId);
    assert.equal(key1.length, 32);
    assert.deepEqual(key1, key2);
  });

  it("should derive different keys for different users", () => {
    const key1 = deriveUserConnectionKey(userId);
    const key2 = deriveUserConnectionKey(otherUserId);
    assert.notDeepEqual(key1, key2);
  });

  it("should encrypt and decrypt connection credentials accurately", () => {
    const encrypted = encryptConnectionData(sampleTokens, userId);
    assert.ok(isEncryptedFormat(encrypted));

    const parts = encrypted.split(":");
    assert.equal(parts.length, 3);
    assert.equal(parts[0]!.length, 24); // 12 bytes IV hex
    assert.equal(parts[1]!.length, 32); // 16 bytes AuthTag hex

    const decrypted = decryptConnectionData<ConnectionCredentials>(encrypted, userId);
    assert.equal(decrypted.accessToken, sampleTokens.accessToken);
    assert.equal(decrypted.refreshToken, sampleTokens.refreshToken);
    assert.equal(decrypted.apiKey, sampleTokens.apiKey);
    assert.equal(decrypted.hostUrl, sampleTokens.hostUrl);
  });

  it("should fail decryption when attempted with another user's key", () => {
    const encrypted = encryptConnectionData(sampleTokens, userId);
    assert.throws(
      () => {
        decryptConnectionData(encrypted, otherUserId);
      },
      (err: any) => {
        return err !== undefined; // GCM authentication tag verification failure
      }
    );
  });

  it("should detect tampered ciphertext and reject decryption", () => {
    const encrypted = encryptConnectionData(sampleTokens, userId);
    const [iv, tag, cipher] = encrypted.split(":");
    // Tamper with last character of ciphertext
    const tamperedCipher = cipher!.slice(0, -1) + (cipher!.slice(-1) === "0" ? "1" : "0");
    const tamperedPayload = `${iv}:${tag}:${tamperedCipher}`;

    assert.throws(() => {
      decryptConnectionData(tamperedPayload, userId);
    });
  });
});

describe("@IRIS/connections - Provider Registry", () => {
  it("should register and retrieve all required providers", () => {
    const providers = [
      "ANILIST",
      "MAL",
      "SIMKL",
      "BANGUMI",
      "STEAM",
      "RIOT_GAMES",
      "RADARR",
      "SONARR",
    ] as const;

    for (const provider of providers) {
      const adapter = getConnectionAdapter(provider);
      assert.ok(adapter, `Adapter for ${provider} must exist`);
      assert.equal(adapter.provider, provider);
      assert.ok(adapter.capabilities);
    }
  });

  it("should list supported providers metadata for UI rendering", () => {
    const list = getSupportedProviders();
    assert.ok(list.length >= 8);
    assert.ok(list.some((p) => p.provider === "MAL"));
    assert.ok(list.some((p) => p.provider === "STEAM"));
    assert.ok(list.some((p) => p.provider === "RADARR"));
  });
});

describe("@IRIS/connections - Search Proxy", () => {
  it("should ensure ANILIST, MAL, SIMKL, and BANGUMI have search capability enabled", () => {
    const searchProviders = ["ANILIST", "MAL", "SIMKL", "BANGUMI"] as const;
    for (const prov of searchProviders) {
      const adapter = getConnectionAdapter(prov);
      assert.ok(adapter.capabilities.supportsSearch, `${prov} must have supportsSearch enabled`);
      assert.equal(typeof adapter.searchMedia, "function", `${prov} must implement searchMedia`);
    }
  });

  it("should throw error when searching on provider without search capability", async () => {
    await assert.rejects(
      async () => {
        await SearchProxyManager.search("STEAM" as any, "Elden Ring");
      },
      {
        message: /does not support media search/,
      }
    );
  });

  it("should support getMediaById on MAL adapter and parse ID patterns correctly", async () => {
    const malAdapter = getConnectionAdapter("MAL") as any;
    assert.equal(typeof malAdapter.getMediaById, "function", "MAL must implement getMediaById");

    // Test invalid ID returns null
    const invalidResult = await malAdapter.getMediaById("not-an-id");
    assert.equal(invalidResult, null);

    // Mock fetchJson on adapter to verify endpoint and header generation
    let requestedUrl = "";
    let requestedHeaders: Record<string, string> = {};
    malAdapter.fetchJson = async (url: string, init?: RequestInit) => {
      requestedUrl = url;
      requestedHeaders = (init?.headers as Record<string, string>) || {};
      return {
        id: 25623,
        title: "Test Anime Title",
        alternative_titles: { en: "Test English Title" },
        main_picture: { large: "https://cdn.myanimelist.net/large.jpg" },
        media_type: "tv",
        status: "finished_airing",
        num_episodes: 12,
      };
    };

    // 1. Direct id:25623 format
    const resId = await malAdapter.getMediaById("id:25623");
    assert.ok(resId, "Must return result for id:25623");
    assert.equal(resId.id, "25623");
    assert.equal(resId.externalId, "25623");
    assert.equal(resId.provider, "MAL");
    assert.equal(resId.title.userPreferred, "Test Anime Title");
    assert.ok(requestedUrl.includes("/anime/25623"), "URL must target anime/25623");

    // 2. Full MAL URL format with manga type
    const resUrl = await malAdapter.getMediaById(
      "https://myanimelist.net/manga/99999/sample_manga"
    );
    assert.ok(resUrl);
    assert.equal(resUrl.id, "25623");
    assert.ok(requestedUrl.includes("/manga/99999"), "URL must target manga/99999");

    // 3. searchMedia with "id:25623" syntax
    const searchById = await malAdapter.searchMedia("id:25623");
    assert.equal(searchById.length, 1);
    assert.equal(searchById[0]?.id, "25623");

    // 4. SearchProxyManager.getById for MAL
    const proxyById = await SearchProxyManager.getById("MAL", "id:25623");
    assert.ok(proxyById);
    assert.equal(proxyById.id, "25623");
  });
});

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
});

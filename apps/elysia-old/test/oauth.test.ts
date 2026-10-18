import { describe, expect, it } from "bun:test"
import { createHash, randomBytes } from "node:crypto"
import { app } from "../src/index"
import { prisma } from "@IRIS/database"

describe("IRIS OAuth 2.0 & OIDC End-to-End Test Suite", () => {
  let testClientId = ""
  let testClientSecret = ""
  let testUserId = ""
  let testUserEmail = `oauth-tester-${Date.now()}@iris.test`
  let testUsername = `tester_${Date.now().toString(36)}`
  let codeVerifier = ""
  let codeChallenge = ""
  let authCode = ""
  let accessToken = ""
  let refreshToken = ""

  it("1. OIDC Discovery endpoint returns valid metadata", async () => {
    const res = await app.handle(
      new Request("http://localhost:4000/.well-known/openid-configuration")
    )
    expect(res.status).toBe(200)
    const data = (await res.json()) as any

    expect(data.issuer).toBeDefined()
    expect(data.authorization_endpoint).toContain("/oauth/authorize")
    expect(data.token_endpoint).toContain("/oauth/token")
    expect(data.userinfo_endpoint).toContain("/oauth/userinfo")
    expect(data.code_challenge_methods_supported).toContain("S256")
    expect(data.scopes_supported).toContain("identify")
    expect(data.scopes_supported).toContain("lists:read")
  })

  it("2. Dynamic Client Registration (RFC 7591) creates a new OAuth client", async () => {
    const res = await app.handle(
      new Request("http://localhost:4000/oauth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: "Automated Test Suite Client",
          redirect_uris: ["https://myapp.test/callback"],
          scope: "identify profile email lists:read offline_access",
        }),
      })
    )

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    expect(data.client_id).toBeDefined()
    expect(data.client_secret).toBeDefined()
    expect(data.client_name).toBe("Automated Test Suite Client")

    testClientId = data.client_id
    testClientSecret = data.client_secret
  })

  it("3. GET /oauth/authorize validates client and redirect URI", async () => {
    // Generate PKCE
    codeVerifier = randomBytes(32).toString("base64url")
    codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url")

    const authUrl = `http://localhost:4000/oauth/authorize?client_id=${testClientId}&redirect_uri=https://myapp.test/callback&scope=identify%20lists:read&code_challenge=${codeChallenge}&code_challenge_method=S256`
    const res = await app.handle(new Request(authUrl))
    expect(res.status).toBe(200)
    const data = (await res.json()) as any

    expect(data.success).toBe(true)
    expect(data.client.name).toBe("Automated Test Suite Client")
    expect(data.scopeDetails.length).toBeGreaterThan(0)
  })

  it("4. POST /oauth/token exchanges authorization code with PKCE verification", async () => {
    // Ensure test user exists in DB
    const user = await prisma.user.upsert({
      where: { email: testUserEmail },
      update: {},
      create: {
        username: testUsername,
        email: testUserEmail,
        passwordHash: "hashed_dummy_password",
      },
    })
    testUserId = user.id

    // Simulate authorization code issuance
    const rawCode = `test_code_${randomBytes(24).toString("hex")}`

    const clientRecord = await prisma.oAuthClient.findUnique({
      where: { clientId: testClientId },
    })

    await prisma.oAuthAuthorizationCode.create({
      data: {
        code: rawCode,
        clientId: clientRecord!.id,
        userId: testUserId,
        redirectUri: "https://myapp.test/callback",
        scopes: ["identify", "profile", "email", "lists:read", "offline_access"],
        codeChallenge,
        codeChallengeMethod: "S256",
        expiresAt: new Date(Date.now() + 600000),
      },
    })

    authCode = rawCode

    // Call token exchange with correct code_verifier
    const tokenRes = await app.handle(
      new Request("http://localhost:4000/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          client_id: testClientId,
          client_secret: testClientSecret,
          code: authCode,
          redirect_uri: "https://myapp.test/callback",
          code_verifier: codeVerifier,
        }),
      })
    )

    expect(tokenRes.status).toBe(200)
    const tokenData = (await tokenRes.json()) as any
    expect(tokenData.access_token).toBeDefined()
    expect(tokenData.refresh_token).toBeDefined()
    expect(tokenData.token_type).toBe("Bearer")
    expect(tokenData.expires_in).toBeGreaterThan(0)

    accessToken = tokenData.access_token
    refreshToken = tokenData.refresh_token
  })

  it("5. GET /oauth/userinfo returns user identity claims with Bearer token", async () => {
    const res = await app.handle(
      new Request("http://localhost:4000/oauth/userinfo", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
    )

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    expect(data.sub).toBe(testUserId)
    expect(data.username).toBe(testUsername)
    expect(data.email).toBe(testUserEmail)
  })

  it("6. POST /oauth/introspect validates active token metadata", async () => {
    const res = await app.handle(
      new Request("http://localhost:4000/oauth/introspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: accessToken,
          client_id: testClientId,
          client_secret: testClientSecret,
        }),
      })
    )

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    expect(data.active).toBe(true)
    expect(data.sub).toBe(testUserId)
    expect(data.scope).toContain("identify")
  })

  it("7. POST /oauth/token refreshes token pair using refresh_token", async () => {
    const res = await app.handle(
      new Request("http://localhost:4000/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "refresh_token",
          client_id: testClientId,
          client_secret: testClientSecret,
          refresh_token: refreshToken,
        }),
      })
    )

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    expect(data.access_token).toBeDefined()
    expect(data.token_type).toBe("Bearer")

    // Update accessToken with refreshed token
    accessToken = data.access_token
    if (data.refresh_token) {
      refreshToken = data.refresh_token
    }
  })

  it("8. POST /oauth/revoke invalidates the token", async () => {
    const revokeRes = await app.handle(
      new Request("http://localhost:4000/oauth/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: accessToken,
          client_id: testClientId,
          client_secret: testClientSecret,
        }),
      })
    )

    expect(revokeRes.status).toBe(200)

    // UserInfo should now be 401 Unauthorized
    const userinfoRes = await app.handle(
      new Request("http://localhost:4000/oauth/userinfo", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
    )

    expect(userinfoRes.status).toBe(401)
  })

  it("9. Replay attack detection revokes access upon reusing authorization code", async () => {
    const replayRes = await app.handle(
      new Request("http://localhost:4000/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          client_id: testClientId,
          client_secret: testClientSecret,
          code: authCode,
          redirect_uri: "https://myapp.test/callback",
          code_verifier: codeVerifier,
        }),
      })
    )

    expect(replayRes.status).toBe(400)
    const data = (await replayRes.json()) as any
    expect(data.error).toBe("invalid_grant")
  })
})

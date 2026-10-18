/**
 * IRIS Pass — Backend API Client
 */
;(function (root) {
  const IrisApi = {}

  const DEFAULT_SERVER_URL = "http://localhost:4000"

  const ext = typeof browser !== "undefined" ? browser : chrome
  const storage = typeof IrisStorage !== "undefined" ? IrisStorage : ext.storage.local

  IrisApi.getServerUrl = async function () {
    const data = await storage.get(["serverUrl"])
    return (data.serverUrl || DEFAULT_SERVER_URL).replace(/\/+$/, "")
  }

  IrisApi.setServerUrl = async function (url) {
    const cleanUrl = (url || DEFAULT_SERVER_URL).trim().replace(/\/+$/, "")
    await storage.set({ serverUrl: cleanUrl })
    return cleanUrl
  }

  IrisApi.getToken = async function () {
    const data = await storage.get(["authToken", "apiKey"])
    return {
      authToken: data.authToken || "",
      apiKey: data.apiKey || "",
      token: data.authToken || data.apiKey || "",
    }
  }

  async function request(path, options = {}) {
    const serverUrl = await IrisApi.getServerUrl()
    const { authToken, apiKey } = await IrisApi.getToken()

    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    }

    if (apiKey) {
      headers["x-api-key"] = apiKey
    } else if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`
    }

    const res = await fetch(`${serverUrl}${path}`, {
      ...options,
      headers,
      credentials: "include", // For session cookies
    })

    if (!res.ok) {
      let errMessage = `HTTP error ${res.status}`
      try {
        const body = await res.json()
        if (body?.message) errMessage = body.message
        else if (body?.error) errMessage = body.error
      } catch {}
      throw new Error(errMessage)
    }

    return res.json()
  }

  /**
   * Log into IRIS account (returns mfaRequired/mfaTicket if 2FA active)
   */
  IrisApi.login = async function (identifier, password) {
    const data = await request("/carina/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    })

    if (data?.token) {
      await storage.set({
        authToken: data.token,
        apiKey: "",
        user: data.user,
      })

      // Fetch full profile (avatar, customization)
      try {
        const auth = await IrisApi.checkAuth()
        if (auth?.authenticated && auth?.user) {
          data.user = auth.user
          await storage.set({ user: auth.user })
        }
      } catch (e) {}
    }

    return data
  }

  /**
   * Complete MFA verification challenge (email OTP or totp)
   */
  IrisApi.verifyMfa = async function (mfaTicket, code, mfaType = "email") {
    const data = await request("/carina/auth/twofactor/email/verify", {
      method: "POST",
      body: JSON.stringify({
        mfaTicket,
        code: String(code).trim(),
      }),
    })

    if (data?.token) {
      await storage.set({
        authToken: data.token,
        apiKey: "",
        user: data.user,
      })

      try {
        const auth = await IrisApi.checkAuth()
        if (auth?.authenticated && auth?.user) {
          data.user = auth.user
          await storage.set({ user: auth.user })
        }
      } catch (e) {}
    }

    return data
  }

  /**
   * Dispatch / resend MFA verification email
   */
  IrisApi.sendMfaEmail = async function (mfaTicket) {
    return request("/carina/auth/twofactor/email/send", {
      method: "POST",
      body: JSON.stringify({ mfaTicket }),
    })
  }

  /**
   * Authenticate directly via API Key
   */
  IrisApi.loginWithApiKey = async function (apiKey) {
    const cleanKey = (apiKey || "").trim()
    if (!cleanKey) throw new Error("API Key cannot be empty")

    const serverUrl = await IrisApi.getServerUrl()
    const res = await fetch(`${serverUrl}/carina/users/me`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": cleanKey,
      },
    })

    if (!res.ok) {
      let errMessage = `HTTP error ${res.status}`
      try {
        const body = await res.json()
        if (body?.message) errMessage = body.message
        else if (body?.error) errMessage = body.error
      } catch {}
      throw new Error(errMessage)
    }

    const data = await res.json()
    const user = data?.user || data

    await storage.set({
      apiKey: cleanKey,
      authToken: "",
      user,
    })

    return user
  }

  /**
   * Log out of IRIS account and clear all credentials
   */
  IrisApi.logout = async function () {
    await storage.clear()
    if (ext.storage?.local) {
      await ext.storage.local.clear().catch(() => {})
    }
    if (ext.storage?.session) {
      await ext.storage.session.clear().catch(() => {})
    }
  }

  /**
   * Check connection and user status
   */
  IrisApi.checkAuth = async function () {
    try {
      const data = await request("/carina/users/me")
      return { authenticated: true, user: data?.user || data }
    } catch (err) {
      return { authenticated: false, error: err.message }
    }
  }

  /**
   * Fetch encryption keys (publicKey, encryptedPrivateKey, salt)
   */
  IrisApi.fetchEncryptionKeys = async function () {
    return request("/akaromi/encryption/keys")
  }

  /**
   * Fetch all vault ciphers
   */
  IrisApi.fetchCiphers = async function (query = {}) {
    const params = new URLSearchParams()
    if (query.type) params.append("type", query.type)
    if (typeof query.favorite === "boolean") params.append("favorite", String(query.favorite))
    if (typeof query.trash === "boolean") params.append("trash", String(query.trash))
    const qStr = params.toString() ? `?${params.toString()}` : ""
    return request(`/akaromi/ciphers${qStr}`)
  }

  /**
   * Create cipher in vault
   */
  IrisApi.createCipher = async function (payload) {
    return request("/akaromi/ciphers", {
      method: "POST",
      body: JSON.stringify(payload),
    })
  }

  /**
   * Update cipher in vault
   */
  IrisApi.updateCipher = async function (id, payload) {
    return request(`/akaromi/ciphers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    })
  }

  /**
   * Delete / trash cipher in vault
   */
  IrisApi.deleteCipher = async function (id, permanent = false) {
    const q = permanent ? "?permanent=true" : ""
    return request(`/akaromi/ciphers/${id}${q}`, {
      method: "DELETE",
    })
  }

  /**
   * Restore cipher from trash
   */
  IrisApi.restoreCipher = async function (id) {
    return request(`/akaromi/ciphers/${id}/restore`, {
      method: "POST",
    })
  }

  /**
   * Permanently empty trash bin
   */
  IrisApi.emptyTrash = async function () {
    return request("/akaromi/ciphers/trash", {
      method: "DELETE",
    })
  }

  /**
   * Delta sync
   */
  IrisApi.syncVault = async function (sinceTimestamp) {
    const query = sinceTimestamp ? `?since=${sinceTimestamp}` : ""
    return request(`/akaromi/sync${query}`)
  }

  root.IrisApi = IrisApi
})(typeof self !== "undefined" ? self : this)

/**
 * IRIS Pass — In-Page WebAuthn Passkey Interceptor
 * Runs in page context to mediate navigator.credentials.create and get
 */
;(function () {
  if (window.__IRIS_PASSKEY_INJECTED__) return
  window.__IRIS_PASSKEY_INJECTED__ = true

  const originalCreate = navigator.credentials?.create
    ? navigator.credentials.create.bind(navigator.credentials)
    : null
  const originalGet = navigator.credentials?.get
    ? navigator.credentials.get.bind(navigator.credentials)
    : null

  // Ensure PublicKeyCredential platform authenticator is reported as available
  if (window.PublicKeyCredential) {
    try {
      window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable =
        async function () {
          return true
        }
      if (window.PublicKeyCredential.isConditionalMediationAvailable) {
        window.PublicKeyCredential.isConditionalMediationAvailable =
          async function () {
            return true
          }
      }
    } catch (e) {}
  }

  // Helper to convert ArrayBuffer or Uint8Array to Base64URL
  function bufferToBase64Url(buf) {
    if (!buf) return ""
    let bytes
    if (buf instanceof Uint8Array) {
      bytes = buf
    } else if (ArrayBuffer.isView(buf)) {
      bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
    } else if (buf instanceof ArrayBuffer) {
      bytes = new Uint8Array(buf)
    } else if (typeof buf === "string") {
      return buf
    } else {
      try {
        bytes = new Uint8Array(buf)
      } catch {
        return ""
      }
    }
    let binary = ""
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")
  }

  // Helper to convert Base64URL to page-realm ArrayBuffer
  function base64UrlToBuffer(str) {
    if (!str) return new window.ArrayBuffer(0)
    const base64 =
      str.replace(/-/g, "+").replace(/_/g, "/") +
      "==".slice(0, (4 - (str.length % 4)) % 4)
    const binary = window.atob(base64)
    const bytes = new window.Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
  }

  // Intercept Passkey Registration
  if (navigator.credentials) {
    navigator.credentials.create = async function (options) {
      if (!options || !options.publicKey) {
        return originalCreate
          ? originalCreate(options)
          : Promise.reject(new Error("WebAuthn not supported"))
      }

      const pk = options.publicKey
      const rpId = pk.rp?.id || window.location.hostname
      const rpName = pk.rp?.name || window.location.hostname
      const user = pk.user || {}
      const userName = user.name || user.displayName || "Account"
      const userDisplayName = user.displayName || user.name || "Account"
      const userId = user.id ? bufferToBase64Url(user.id) : ""
      const challenge = pk.challenge ? bufferToBase64Url(pk.challenge) : ""
      const requestId =
        "iris_pk_create_" + Math.random().toString(36).slice(2) + Date.now()

      return new Promise((resolve, reject) => {
        function onMessage(event) {
          if (
            event.source !== window ||
            !event.data ||
            event.data.source !== "IRIS_PASSKEY_CONTENT" ||
            event.data.requestId !== requestId
          ) {
            return
          }

          window.removeEventListener("message", onMessage)

          if (event.data.fallback) {
            if (originalCreate) {
              originalCreate(options).then(resolve).catch(reject)
            } else {
              reject(
                new DOMException(
                  "The operation was canceled or not supported.",
                  "NotAllowedError"
                )
              )
            }
            return
          }

          if (event.data.canceled || !event.data.success) {
            reject(
              new DOMException(
                event.data.error ||
                  "The operation either timed out or was not allowed.",
                "NotAllowedError"
              )
            )
            return
          }

          // Build authentic PublicKeyCredential in the page realm
          const res = event.data.credential
          const rawIdBuf = base64UrlToBuffer(res.rawId)
          const clientDataBuf = base64UrlToBuffer(res.clientDataJSON)
          const attestationBuf = base64UrlToBuffer(res.attestationObject)

          const authDataBuf = attestationBuf.slice(
            res.authDataOffset || 0,
            (res.authDataOffset || 0) +
              (res.authDataLength || attestationBuf.byteLength)
          )

          const spkiBuf = res.spki ? base64UrlToBuffer(res.spki) : null

          const responseObj = {
            clientDataJSON: clientDataBuf,
            attestationObject: attestationBuf,
            getTransports: function () {
              return ["internal"]
            },
            getPublicKey: function () {
              return spkiBuf
            },
            getPublicKeyAlgorithm: function () {
              return -7
            },
            getAuthenticatorData: function () {
              return authDataBuf
            },
          }

          if (window.AuthenticatorAttestationResponse) {
            try {
              Object.setPrototypeOf(
                responseObj,
                window.AuthenticatorAttestationResponse.prototype
              )
            } catch (e) {}
          }

          const cred = {
            id: String(res.id),
            rawId: rawIdBuf,
            type: "public-key",
            authenticatorAttachment:
              options.publicKey.authenticatorSelection
                ?.authenticatorAttachment || "platform",
            response: responseObj,
            getClientExtensionResults: function () {
              return {}
            },
            toJSON: function () {
              return {
                id: this.id,
                rawId: res.rawId,
                type: this.type,
                authenticatorAttachment: this.authenticatorAttachment,
                response: {
                  clientDataJSON: res.clientDataJSON,
                  attestationObject: res.attestationObject,
                  transports: ["internal"],
                  publicKeyAlgorithm: -7,
                  publicKey: res.spki,
                  authenticatorData: res.authData,
                },
                clientExtensionResults: {},
              }
            },
          }

          if (window.PublicKeyCredential) {
            try {
              Object.setPrototypeOf(cred, window.PublicKeyCredential.prototype)
            } catch (e) {}
          }

          resolve(cred)
        }

        window.addEventListener("message", onMessage)

        window.postMessage(
          {
            source: "IRIS_PASSKEY_PAGE",
            action: "PASSKEY_CREATE_REQUEST",
            requestId,
            options: {
              rpId,
              rpName,
              userName,
              userDisplayName,
              userId,
              challenge,
              origin: window.location.origin,
            },
          },
          "*"
        )
      })
    }

    // Intercept Passkey Authentication
    navigator.credentials.get = async function (options) {
      if (!options || !options.publicKey) {
        return originalGet
          ? originalGet(options)
          : Promise.reject(new Error("WebAuthn not supported"))
      }

      // If conditional mediation (autofill in username field), let native browser or autofill handle
      if (options.mediation === "conditional") {
        return originalGet
          ? originalGet(options)
          : Promise.reject(new Error("Conditional mediation not supported"))
      }

      const pk = options.publicKey
      const rpId = pk.rpId || window.location.hostname
      const challenge = pk.challenge ? bufferToBase64Url(pk.challenge) : ""
      const allowCredentials = (pk.allowCredentials || []).map((c) => ({
        id: bufferToBase64Url(c.id),
        type: c.type || "public-key",
      }))
      const requestId =
        "iris_pk_get_" + Math.random().toString(36).slice(2) + Date.now()

      return new Promise((resolve, reject) => {
        function onMessage(event) {
          if (
            event.source !== window ||
            !event.data ||
            event.data.source !== "IRIS_PASSKEY_CONTENT" ||
            event.data.requestId !== requestId
          ) {
            return
          }

          window.removeEventListener("message", onMessage)

          if (event.data.fallback) {
            if (originalGet) {
              originalGet(options).then(resolve).catch(reject)
            } else {
              reject(
                new DOMException(
                  "The operation was canceled or not supported.",
                  "NotAllowedError"
                )
              )
            }
            return
          }

          if (event.data.canceled || !event.data.success) {
            reject(
              new DOMException(
                event.data.error ||
                  "The operation either timed out or was not allowed.",
                "NotAllowedError"
              )
            )
            return
          }

          const res = event.data.credential
          const rawIdBuf = base64UrlToBuffer(res.rawId)
          const clientDataBuf = base64UrlToBuffer(res.clientDataJSON)
          const authDataBuf = base64UrlToBuffer(res.authenticatorData)
          const sigBuf = base64UrlToBuffer(res.signature)
          const userHandleBuf = res.userHandle
            ? base64UrlToBuffer(res.userHandle)
            : null

          const responseObj = {
            clientDataJSON: clientDataBuf,
            authenticatorData: authDataBuf,
            signature: sigBuf,
            userHandle: userHandleBuf,
          }

          if (window.AuthenticatorAssertionResponse) {
            try {
              Object.setPrototypeOf(
                responseObj,
                window.AuthenticatorAssertionResponse.prototype
              )
            } catch (e) {}
          }

          const cred = {
            id: String(res.id),
            rawId: rawIdBuf,
            type: "public-key",
            authenticatorAttachment: "platform",
            response: responseObj,
            getClientExtensionResults: function () {
              return {}
            },
            toJSON: function () {
              return {
                id: this.id,
                rawId: res.rawId,
                type: this.type,
                authenticatorAttachment: this.authenticatorAttachment,
                response: {
                  clientDataJSON: res.clientDataJSON,
                  authenticatorData: res.authenticatorData,
                  signature: res.signature,
                  userHandle: res.userHandle || "",
                },
                clientExtensionResults: {},
              }
            },
          }

          if (window.PublicKeyCredential) {
            try {
              Object.setPrototypeOf(cred, window.PublicKeyCredential.prototype)
            } catch (e) {}
          }

          resolve(cred)
        }

        window.addEventListener("message", onMessage)

        window.postMessage(
          {
            source: "IRIS_PASSKEY_PAGE",
            action: "PASSKEY_GET_REQUEST",
            requestId,
            options: {
              rpId,
              challenge,
              allowCredentials,
              origin: window.location.origin,
            },
          },
          "*"
        )
      })
    }
  }

  console.log("[IRIS Pass] WebAuthn Passkey interceptor active in page realm")
})()

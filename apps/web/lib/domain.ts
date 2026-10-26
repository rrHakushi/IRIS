/**
 * Canonical domain, origin, and cookie configuration derived strictly from `NEXT_PUBLIC_URL`.
 *
 * Eliminates redundant environment variables (RP_ID, COOKIE_DOMAIN, NEXTAUTH_URL).
 */
export function getDomainConfig() {
  const urlStr =
    (typeof Bun !== "undefined" ? Bun.env.NEXT_PUBLIC_URL : process.env.NEXT_PUBLIC_URL)
  if (!urlStr) {
    throw new Error('NEXT_PUBLIC_URL environment variable is required')
  }

  const url = new URL(urlStr)
  const hostname = url.hostname
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1'

  // WebAuthn RP_ID (hostname only, without port or protocol)
  const rpId = hostname

  // Cookie domain: in production, set to root domain with leading dot (e.g. ".runerra.org") so subdomains share it,
  // or omit on localhost so browsers accept it across localhost ports
  let cookieDomain: string | undefined = undefined
  if (!isLocalhost) {
    const parts = hostname.split('.')
    cookieDomain = parts.length >= 2 ? `.${parts.slice(-2).join('.')}` : `.${hostname}`
  }

  const nodeEnv =
    typeof Bun !== "undefined" ? Bun.env.NODE_ENV : process.env.NODE_ENV
  const isSecure = nodeEnv === 'production' && !isLocalhost

  return {
    url: urlStr,
    origin: url.origin,
    hostname,
    rpId,
    cookieDomain,
    isSecure,
  }
}

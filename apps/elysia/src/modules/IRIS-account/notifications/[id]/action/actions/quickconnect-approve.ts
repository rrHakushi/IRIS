import type { NotificationActionHandler } from "./types"

/**
 * Action Handler: "auth.quickconnect.approve"
 * Approves a Quick Connect device pairing session via short pairing code.
 */
export const quickConnectApproveAction: NotificationActionHandler = async ({
  payload,
  resolvedStatus,
  sessionUser,
  cache,
}) => {
  if (resolvedStatus === "REJECTED") {
    return { success: true, message: "Pairing request rejected." }
  }

  const payloadObj =
    typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)
      : {}
  const codeValue =
    payloadObj.code ||
    payloadObj.selection ||
    (typeof payload === "string" ? payload : "")

  if (!codeValue) {
    return {
      success: false,
      error: "Missing Quick Connect pairing code in action payload.",
    }
  }

  const raw = String(codeValue).trim().toUpperCase()
  const cleanNoDash = raw.replaceAll("-", "")
  const formattedCode =
    cleanNoDash.length === 8
      ? `${cleanNoDash.slice(0, 4)}-${cleanNoDash.slice(4, 8)}`
      : raw

  // 1. Resolve sessionToken from code
  const sessionToken =
    (await cache.get<string>(`auth:quickconnect:code:${formattedCode}`)) ||
    (await cache.get<string>(`auth:quickconnect:code:${raw}`))

  if (!sessionToken) {
    return {
      success: false,
      error: "Invalid or expired Quick Connect pairing code.",
    }
  }

  // 2. Fetch session data
  const sessionData = await cache.get<{
    status: string
    code: string
    deviceName: string
    userId: string | null
  }>(`auth:quickconnect:session:${sessionToken}`)

  if (!sessionData) {
    return {
      success: false,
      error: "Quick Connect pairing session has expired.",
    }
  }

  // 3. Mark session as approved with the current user's ID
  await cache.set(
    `auth:quickconnect:session:${sessionToken}`,
    {
      ...sessionData,
      status: "approved",
      userId: sessionUser.id,
    },
    300
  )

  // 4. Invalidate lookup code so it cannot be claimed twice
  await Promise.all([
    cache.del(`auth:quickconnect:code:${formattedCode}`),
    cache.del(`auth:quickconnect:code:${raw}`),
  ])

  return {
    success: true,
    message: `Device '${sessionData.deviceName}' approved successfully.`,
    resultPayload: {
      code: formattedCode,
      deviceName: sessionData.deviceName,
      approvedAt: new Date().toISOString(),
    },
  }
}

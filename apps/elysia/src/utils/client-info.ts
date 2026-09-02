import { sendNotification } from "../services/notification.service";

export interface ClientDeviceInfo {
  ip: string;
  userAgent: string;
  browser: string;
  os: string;
  device: string;
  location: string | null;
  summary: string;
}

/**
 * Extracts and parses client network, device, and location metadata from HTTP request headers.
 */
export function extractClientInfo(request: Request): ClientDeviceInfo {
  const headers = request.headers;

  // 1. Resolve client IP
  const rawIp =
    headers.get("cf-connecting-ip") ||
    headers.get("x-real-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-client-ip") ||
    "127.0.0.1";

  const ip = rawIp.replace(/^::ffff:/, "");

  // 2. Parse User-Agent
  const ua = headers.get("user-agent") || "Unknown Device";

  let browser = "Web Browser";
  if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Edg/")) browser = "Microsoft Edge";
  else if (ua.includes("Chrome/") && !ua.includes("Edg/")) browser = "Google Chrome";
  else if (ua.includes("Safari/") && !ua.includes("Chrome/")) browser = "Safari";
  else if (ua.includes("Opera") || ua.includes("OPR/")) browser = "Opera";

  let os = "Unknown OS";
  if (ua.includes("Windows NT 10.0") || ua.includes("Windows 11") || ua.includes("Windows NT 11.0")) os = "Windows";
  else if (ua.includes("Windows NT")) os = "Windows";
  else if (ua.includes("Macintosh") || ua.includes("Mac OS X")) os = "macOS";
  else if (ua.includes("iPhone")) os = "iOS";
  else if (ua.includes("iPad")) os = "iPadOS";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("Linux")) os = "Linux";

  const device = `${browser} on ${os}`;

  // 3. Resolve location from cloud / proxy headers
  const city = headers.get("cf-ipcity") || headers.get("x-vercel-ip-city");
  const country =
    headers.get("cf-ipcountry") ||
    headers.get("x-vercel-ip-country") ||
    headers.get("x-geo-country");

  let location: string | null = null;
  if (city && country) {
    location = `${city}, ${country}`;
  } else if (country) {
    location = country;
  }

  // 4. Formatted summary string
  const locPart = location ? `, ${location}` : "";
  const summary = `${device} (IP: ${ip}${locPart})`;

  return {
    ip,
    userAgent: ua,
    browser,
    os,
    device,
    location,
    summary,
  };
}

/**
 * Sends a security notification when a user logs in.
 */
export async function notifyUserLogin(userId: string, request: Request) {
  try {
    const client = extractClientInfo(request);
    await sendNotification({
      userId,
      app: "IRIS Account",
      category: "Security",
      type: "INFO",
      priority: "NORMAL",
      content: {
        title: "New Sign-in Detected",
        body: `A new sign-in was detected from ${client.summary}.`,
        metadata: {
          ip: client.ip,
          device: client.device,
          location: client.location,
          userAgent: client.userAgent,
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (err) {
    // Non-blocking for login if user has no keys initialized yet
    console.warn(`[notifyUserLogin] Failed to send login notification to ${userId}:`, err);
  }
}

/**
 * Sends a security notification when account password changes.
 */
export async function notifyPasswordChanged(userId: string, request?: Request) {
  try {
    const client = request ? extractClientInfo(request) : null;
    const fromPart = client ? ` from ${client.summary}` : "";

    await sendNotification({
      userId,
      app: "IRIS Account",
      category: "Security",
      type: "INFO",
      priority: "HIGH",
      content: {
        title: "Account Password Changed",
        body: `Your account password was successfully updated${fromPart}. If you did not make this change, secure your account immediately.`,
        metadata: client ? { ip: client.ip, device: client.device, timestamp: new Date().toISOString() } : undefined,
      },
    });
  } catch (err) {
    console.warn(`[notifyPasswordChanged] Failed to send notification to ${userId}:`, err);
  }
}

/**
 * Sends a security notification when encryption password is added or changed.
 */
export async function notifyEncryptionPasswordUpdated(
  userId: string,
  isNew: boolean,
  request?: Request
) {
  try {
    const client = request ? extractClientInfo(request) : null;
    const fromPart = client ? ` from ${client.summary}` : "";

    await sendNotification({
      userId,
      app: "IRIS Account",
      category: "Security",
      type: "INFO",
      priority: "HIGH",
      content: {
        title: "Encryption Key Vault Updated",
        body: isNew
          ? `A dedicated encryption password was added to your account${fromPart}.`
          : `Your encryption vault password was successfully updated${fromPart}.`,
        metadata: client ? { ip: client.ip, device: client.device, timestamp: new Date().toISOString() } : undefined,
      },
    });
  } catch (err) {
    console.warn(`[notifyEncryptionPasswordUpdated] Failed to send notification to ${userId}:`, err);
  }
}

/**
 * Sends a Quick Connect pairing authorization request notification with an input action.
 */
export async function sendQuickConnectInputNotification(
  userId: string,
  suggestedCode?: string
) {
  try {
    await sendNotification({
      userId,
      app: "IRIS Account",
      category: "Quick Connect",
      type: "ACTION_INPUT",
      priority: "HIGH",
      actionHandler: "auth.quickconnect.approve",
      content: {
        title: "Quick Connect Authorization",
        body: "A new device is requesting to pair with your IRIS Account. Enter or verify the 8-character pairing code to approve it.",
        actionInputs: [
          {
            id: "code",
            label: "Pairing Code",
            type: "text",
            placeholder: "e.g. ABCD-1234",
            required: true,
            defaultValue: suggestedCode,
          },
        ],
      },
    });
  } catch (err) {
    console.warn(`[sendQuickConnectInputNotification] Failed to send to ${userId}:`, err);
  }
}

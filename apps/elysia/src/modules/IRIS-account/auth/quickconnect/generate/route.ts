import { randomBytes } from "node:crypto";
import { defineRoute, t } from "../../../../../router";

export default defineRoute({
  schema: {
    body: t.Optional(
      t.Object({
        deviceName: t.Optional(t.String({ maxLength: 64 })),
      })
    ),
    response: {
      200: t.Object({
        code: t.String(),
        sessionToken: t.String(),
        qrPayload: t.String(),
        expiresIn: t.Number(),
      }),
    },
  },

  async POST({ body, cache }) {
    // 1. Generate 8-character human-readable pairing code
    const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = randomBytes(8);
    let rawCode = "";
    for (let i = 0; i < 8; i++) {
      rawCode += CHARS[bytes[i]! % CHARS.length];
    }
    const code = `${rawCode.slice(0, 4)}-${rawCode.slice(4, 8)}`;

    // 2. Generate private 256-bit unguessable polling session token
    const sessionToken = randomBytes(32).toString("hex");

    const baseUrl =
      process.env.NEXTAUTH_URL ||
      process.env.NEXT_PUBLIC_URL ||
      "http://localhost:3000";
    const qrPayload = `${baseUrl.replace(/\/$/, "")}/auth-test?code=${code}`;

    // 3. Store pairing records in cache (300 seconds TTL)
    await Promise.all([
      cache.set(`auth:quickconnect:code:${code}`, sessionToken, 300),
      cache.set(
        `auth:quickconnect:session:${sessionToken}`,
        {
          status: "pending",
          code,
          deviceName: body?.deviceName ?? "Device",
          userId: null,
        },
        300
      ),
    ]);

    return {
      code,
      sessionToken,
      qrPayload,
      expiresIn: 300,
    };
  },
});

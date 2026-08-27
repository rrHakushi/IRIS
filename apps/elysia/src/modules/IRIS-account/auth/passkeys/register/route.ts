import { generateRegistrationOptions } from "@simplewebauthn/server";
import { defineRoute, t } from "../../../../../router";

export default defineRoute({
  schema: {
    response: {
      200: t.Object({
        challenge: t.String(),
        rp: t.Object({
          name: t.String(),
          id: t.String(),
        }),
        user: t.Object({
          id: t.String(),
          name: t.String(),
          displayName: t.String(),
        }),
        pubKeyCredParams: t.Array(
          t.Object({
            alg: t.Number(),
            type: t.Literal("public-key"),
          })
        ),
        timeout: t.Number(),
        attestation: t.String(),
      }),
    },
  },

  async POST({ session, prisma, cache }) {
    if (!session.isAuthenticated) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", message: "Authentication required" }),
        { status: 401, headers: { "content-type": "application/json" } }
      );
    }

    const sessionUser = session.getUser();
    if (!sessionUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", message: "User session not found" }),
        { status: 401, headers: { "content-type": "application/json" } }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      include: { passkeys: true },
    });

    if (!user) {
      return new Response(
        JSON.stringify({ error: "NotFound", message: "User not found" }),
        { status: 404, headers: { "content-type": "application/json" } }
      );
    }

    const nextUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
    let rpID = "localhost";
    try {
      rpID = process.env.RP_ID || new URL(nextUrl).hostname;
    } catch {
      rpID = "localhost";
    }

    const options = await generateRegistrationOptions({
      rpName: "IRIS",
      rpID,
      userID: new Uint8Array(Buffer.from(user.id)),
      userName: user.username,
      userDisplayName: user.username,
      excludeCredentials: user.passkeys.map((pk) => ({
        id: pk.id,
        type: "public-key" as const,
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });

    // Cache challenge for 5 minutes
    await cache.set(`auth:passkey-reg:${user.id}`, options.challenge, 300);

    return {
      challenge: options.challenge,
      rp: {
        name: options.rp.name,
        id: options.rp.id,
      },
      user: {
        id: user.id,
        name: user.username,
        displayName: user.username,
      },
      pubKeyCredParams: options.pubKeyCredParams.map((p) => ({
        alg: p.alg,
        type: "public-key" as const,
      })),
      timeout: options.timeout ?? 60000,
      attestation: options.attestation ?? "none",
    };
  },
});

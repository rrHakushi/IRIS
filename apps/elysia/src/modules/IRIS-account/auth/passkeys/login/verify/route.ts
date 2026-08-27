import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { defineRoute, t } from "../../../../../../router";
import { signUserJwt } from "../../../../../../utils/auth-crypto";

export default defineRoute({
  schema: {
    body: t.Object({
      passkeyResponse: t.Object({
        id: t.String(),
        rawId: t.String(),
        response: t.Any(),
        type: t.Optional(t.String()),
        clientExtensionResults: t.Optional(t.Any()),
      }),
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        user: t.Nullable(
          t.Object({
            id: t.String(),
            username: t.String(),
            email: t.String(),
            passwordChangedAt: t.Nullable(t.Number()),
          })
        ),
        token: t.Nullable(t.String()),
      }),
    },
  },

  async POST({ body, prisma, cache }) {
    // 1. Locate passkey and user in database
    const passkey = await prisma.passkey.findUnique({
      where: { id: body.passkeyResponse.id },
      include: { user: true },
    });

    if (!passkey || !passkey.user) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          message: "Passkey credential not recognized.",
        }),
        { status: 401, headers: { "content-type": "application/json" } }
      );
    }

    // 2. Extract challenge from clientDataJSON
    let challenge: string | null = null;
    try {
      const clientDataJSON = body.passkeyResponse.response?.clientDataJSON;
      if (clientDataJSON) {
        const clientData = JSON.parse(
          Buffer.from(clientDataJSON, "base64url").toString("utf8")
        );
        challenge = clientData.challenge;
      }
    } catch {
      challenge = null;
    }

    if (!challenge) {
      return new Response(
        JSON.stringify({
          error: "BadRequest",
          message: "Invalid client assertion payload.",
        }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    // 3. Verify challenge in cache
    const expectedChallenge = await cache.get<string>(
      `auth:passkey-auth:${challenge}`
    );

    if (!expectedChallenge) {
      return new Response(
        JSON.stringify({
          error: "BadRequest",
          message: "Passkey authentication challenge expired or invalid.",
        }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    const nextUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
    let expectedRPID = "localhost";
    try {
      expectedRPID = process.env.RP_ID || new URL(nextUrl).hostname;
    } catch {
      expectedRPID = "localhost";
    }

    // 4. Verify signature & counter
    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: body.passkeyResponse as any,
        expectedChallenge,
        expectedOrigin: nextUrl,
        expectedRPID,
        credential: {
          id: passkey.id,
          publicKey: Buffer.from(passkey.publicKey, "base64url"),
          counter: passkey.counter,
          transports: passkey.transports as any,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Passkey verification failed";
      return new Response(
        JSON.stringify({ error: "Unauthorized", message: msg }),
        { status: 401, headers: { "content-type": "application/json" } }
      );
    }

    if (!verification.verified || !verification.authenticationInfo) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          message: "Passkey authentication verification failed.",
        }),
        { status: 401, headers: { "content-type": "application/json" } }
      );
    }

    // 5. Update authenticator counter to prevent replay
    await prisma.passkey.update({
      where: { id: passkey.id },
      data: { counter: verification.authenticationInfo.newCounter },
    });

    // Invalidate cached challenge
    await cache.del(`auth:passkey-auth:${challenge}`);

    // 6. Sign session token
    const token = await signUserJwt({
      ...passkey.user,
      username: passkey.user.username.trim(),
    });

    return {
      success: true,
      user: {
        id: passkey.user.id,
        username: passkey.user.username.trim(),
        email: passkey.user.email,
        passwordChangedAt: passkey.user.passwordChangedAt
          ? Math.floor(passkey.user.passwordChangedAt.getTime() / 1000)
          : null,
      },
      token,
    };
  },
});

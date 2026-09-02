import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { defineRoute, t } from "../../../../../../router";
import { generateBackupCodes } from "../../../../../../utils/auth-crypto";

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
      name: t.Optional(t.String({ maxLength: 64 })),
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String(),
      }),
    },
  },

  async POST({ body, session, prisma, cache, request }) {
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

    // 1. Retrieve challenge from cache
    const expectedChallenge = await cache.get<string>(
      `auth:passkey-reg:${user.id}`
    );

    if (!expectedChallenge) {
      return new Response(
        JSON.stringify({
          error: "BadRequest",
          message: "Passkey registration challenge expired or not initiated.",
        }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    const originHeader = request?.headers.get("origin") || request?.headers.get("referer");
    let expectedOrigin = process.env.NEXTAUTH_URL!
    if (originHeader) {
      try {
        const u = new URL(originHeader);
        expectedOrigin = `${u.protocol}//${u.host}`;
      } catch { }
    }

    let expectedRPID = "localhost";
    try {
      expectedRPID = process.env.RP_ID || new URL(expectedOrigin).hostname;
    } catch {
      expectedRPID = "localhost";
    }

    // 2. Verify WebAuthn registration response
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: body.passkeyResponse as any,
        expectedChallenge,
        expectedOrigin,
        expectedRPID,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Passkey verification error";
      return new Response(
        JSON.stringify({ error: "BadRequest", message: msg }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    if (!verification.verified || !verification.registrationInfo) {
      return new Response(
        JSON.stringify({
          error: "BadRequest",
          message: "Passkey registration verification failed.",
        }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    const {
      id: credentialID,
      publicKey: credentialPublicKey,
      counter,
      transports,
    } = verification.registrationInfo.credential;

    // 3. Generate initial backup codes if this is the user's first MFA method
    let hashedBackupCodes: string[] | undefined = undefined;
    const isOtherMfaActive = user.TOTPEnabled || user.emailMfaEnabled;
    if (!isOtherMfaActive && user.backupCodes.length === 0) {
      const generated = await generateBackupCodes();
      hashedBackupCodes = generated.hashed;
    }

    // 4. Persist passkey in database
    await prisma.passkey.create({
      data: {
        id: credentialID,
        publicKey: Buffer.from(credentialPublicKey).toString("base64url"),
        counter,
        transports: transports ?? body.passkeyResponse.response?.transports ?? [],
        name: body.name || "Passkey",
        userId: user.id,
      },
    });

    if (hashedBackupCodes) {
      await prisma.user.update({
        where: { id: user.id },
        data: { backupCodes: hashedBackupCodes },
      });
    }

    // Clean up cached challenge and user cache
    await cache.del(`auth:passkey-reg:${user.id}`);
    await cache.del(`users:me:user:${user.id}`);
    await cache.del(`user:${user.id}`);

    return {
      success: true,
      message: "Passkey registered successfully",
    };
  },
});

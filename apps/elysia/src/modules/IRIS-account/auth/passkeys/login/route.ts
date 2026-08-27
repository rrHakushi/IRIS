import {
  generateAuthenticationOptions,
  type AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import { defineRoute, t } from "../../../../../router";

export default defineRoute({
  schema: {
    body: t.Optional(
      t.Object({
        identifier: t.Optional(t.String({ minLength: 3 })),
      })
    ),
    response: {
      200: t.Object({
        challenge: t.String(),
        rpId: t.String(),
        allowCredentials: t.Optional(
          t.Array(
            t.Object({
              id: t.String(),
              type: t.Literal("public-key"),
              transports: t.Optional(t.Array(t.String())),
            })
          )
        ),
        timeout: t.Number(),
        userVerification: t.Union([
          t.Literal("required"),
          t.Literal("preferred"),
          t.Literal("discouraged"),
        ]),
      }),
    },
  },

  async POST({ body, prisma, cache }) {
    const nextUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
    let rpID = "localhost";
    try {
      rpID = process.env.RP_ID || new URL(nextUrl).hostname;
    } catch {
      rpID = "localhost";
    }

    let allowCredentials:
      | { id: string; type: "public-key"; transports?: AuthenticatorTransportFuture[] }[]
      | undefined = undefined;

    if (body?.identifier) {
      const rawIdentifier = body.identifier.trim();
      const lowerIdentifier = rawIdentifier.toLowerCase();

      const user = await prisma.user.findFirst({
        where: {
          OR: [{ email: lowerIdentifier }, { username: rawIdentifier }],
        },
        include: { passkeys: true },
      });

      if (user && user.passkeys.length > 0) {
        allowCredentials = user.passkeys.map((pk) => ({
          id: pk.id,
          type: "public-key" as const,
          transports: pk.transports as AuthenticatorTransportFuture[],
        }));
      }
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: "preferred",
    });

    // Cache challenge for 5 minutes
    await cache.set(`auth:passkey-auth:${options.challenge}`, options.challenge, 300);

    return {
      challenge: options.challenge,
      rpId: rpID,
      allowCredentials,
      timeout: options.timeout ?? 60000,
      userVerification: "preferred" as const,
    };
  },
});

import { isReservedKeyword } from "@IRIS/shared";
import { IRISFlags } from "@IRIS/permissions";
import { defineRoute, t } from "../../../../router";
import { hashPassword, generateUserKeypair } from "../../../../utils/auth-crypto";

/**
 * In-memory cache tracking whether an administrator account already exists.
 * Avoids repetitive `prisma.user.count()` database queries on every registration attempt.
 */
let hasAdminCached: boolean | null = null;

export default defineRoute({
  schema: {
    body: t.Object({
      username: t.String({ minLength: 3, maxLength: 32 }),
      email: t.String({ format: "email" }),
      password: t.String({ minLength: 12, maxLength: 64 }),
      encryptionPassword: t.Optional(t.String({ minLength: 16, maxLength: 64 })),
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        user: t.Object({
          id: t.String(),
          username: t.String(),
          email: t.String(),
          passwordChangedAt: t.Nullable(t.Number()),
          publicKey: t.Nullable(t.String()),
        }),
      }),
    },
  },

  async POST({ body, prisma }) {
    const cleanUsername = body.username.trim();
    const sanitizedUsername = cleanUsername.replace(/[^a-zA-Z0-9_]/g, "");
    const lowerUsername = sanitizedUsername.toLowerCase();
    const lowerEmail = body.email.trim().toLowerCase();

    if (sanitizedUsername.length < 3) {
      return new Response(
        JSON.stringify({
          error: "BadRequest",
          message: "Username must be at least 3 alphanumeric characters.",
        }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    // 1. Reserved keyword check from @IRIS/shared
    if (isReservedKeyword(lowerUsername)) {
      return new Response(
        JSON.stringify({
          error: "Conflict",
          message: "Username cannot be a reserved system or language keyword.",
        }),
        { status: 409, headers: { "content-type": "application/json" } }
      );
    }

    // 2. Uniqueness check for username & email
    const conflicts = await prisma.user.findMany({
      where: {
        OR: [{ email: lowerEmail }, { username: lowerUsername }],
      },
      select: {
        email: true,
        username: true,
      },
    });

    if (conflicts.length > 0) {
      const isEmailTaken = conflicts.some(
        (u) => u.email.trim().toLowerCase() === lowerEmail
      );
      const isUsernameTaken = conflicts.some(
        (u) => u.username.trim().toLowerCase() === lowerUsername
      );

      let message: string;
      if (isEmailTaken && isUsernameTaken) {
        message = "Both username and email already exist.";
      } else if (isEmailTaken) {
        message = "An account with this email already exists.";
      } else {
        message = "This username is already taken.";
      }
      return new Response(
        JSON.stringify({
          error: "Conflict",
          message,
        }),
        { status: 409, headers: { "content-type": "application/json" } }
      );
    }

    // 3. Admin initialization check (cached in-memory)
    if (hasAdminCached === null) {
      const userCount = await prisma.user.count();
      hasAdminCached = userCount > 0;
    }

    const permissions: number[] = [];
    if (!hasAdminCached) {
      // First user becomes system administrator
      permissions.push(Number(IRISFlags.ADMINISTRATOR));
      hasAdminCached = true;
    }

    // 4. Secure password hash via scrypt
    const passwordHash = await hashPassword(body.password);

    // 5. Generate Post-Quantum (ML-KEM-768) keypair derived from encryption password (or account password)
    const hasSeparatePassword = Boolean(
      body.encryptionPassword && body.encryptionPassword.trim().length > 0
    );
    const effectiveEncryptionPassword = hasSeparatePassword
      ? body.encryptionPassword!.trim()
      : body.password;

    const encryptionPasswordHash = hasSeparatePassword
      ? await hashPassword(effectiveEncryptionPassword)
      : null;

    const { publicKey, encryptedPrivateKey } = await generateUserKeypair(
      effectiveEncryptionPassword
    );

    // 6. Persist user in database
    const user = await prisma.user.create({
      data: {
        username: sanitizedUsername,
        email: lowerEmail,
        passwordHash,
        permissions,
        publicKey,
        encryptedPrivateKey,
        encryptionPasswordHash,
      },
    });

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        passwordChangedAt: null,
        publicKey: user.publicKey ?? null,
      },
    };
  },
});

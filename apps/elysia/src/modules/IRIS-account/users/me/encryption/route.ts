import { defineRoute, t } from "../../../../../router";
import {
  decryptPrivateKey,
  encryptPrivateKey,
  generateUserKeypair,
  verifyPassword,
  hashPassword,
} from "../../../../../utils/auth-crypto";

export default defineRoute({
  GET: {
    schema: {
      response: {
        200: t.Object({
          success: t.Boolean(),
          userId: t.String(),
          publicKey: t.Nullable(t.String()),
          encryptedPrivateKey: t.Nullable(t.String()),
          hasEncryptionKeys: t.Boolean(),
          hasSeparateEncryptionPassword: t.Boolean(),
        }),
      },
    },
    async handler({ session, prisma }) {
      if (!session.isAuthenticated || !session.user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized", message: "Authentication required" }),
          { status: 401, headers: { "content-type": "application/json" } }
        );
      }

      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          publicKey: true,
          encryptedPrivateKey: true,
          encryptionPasswordHash: true,
        },
      });

      if (!user) {
        return new Response(
          JSON.stringify({ error: "NotFound", message: "User not found" }),
          { status: 404, headers: { "content-type": "application/json" } }
        );
      }

      return {
        success: true,
        userId: user.id,
        publicKey: user.publicKey ?? null,
        encryptedPrivateKey: user.encryptedPrivateKey ?? null,
        hasEncryptionKeys: Boolean(user.publicKey && user.encryptedPrivateKey),
        hasSeparateEncryptionPassword: Boolean(user.encryptionPasswordHash),
      };
    },
  },

  POST: {
    schema: {
      body: t.Object({
        currentPassword: t.String({ minLength: 1 }),
        newEncryptionPassword: t.String({ minLength: 16, maxLength: 64 }),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
          publicKey: t.Nullable(t.String()),
          hasSeparateEncryptionPassword: t.Boolean(),
        }),
      },
    },
    async handler({ body, session, prisma }) {
      if (!session.isAuthenticated || !session.user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized", message: "Authentication required" }),
          { status: 401, headers: { "content-type": "application/json" } }
        );
      }

      // Validate complexity: min 16 chars, 2 numbers, 2 special chars, 1 uppercase
      const hasLength = body.newEncryptionPassword.length >= 16;
      const hasTwoNumbers = (body.newEncryptionPassword.match(/\d/g) || []).length >= 2;
      const hasTwoSpecials = (body.newEncryptionPassword.match(/[!@#$%^&*(),.?":{}|<>~'_\-+=/\\\[\]\x60]/g) || []).length >= 2;
      const hasUpper = /[A-Z]/.test(body.newEncryptionPassword);

      if (!hasLength || !hasTwoNumbers || !hasTwoSpecials || !hasUpper) {
        return new Response(
          JSON.stringify({
            error: "BadRequest",
            message:
              "Encryption password must be at least 16 characters with at least 2 numbers, 2 special characters, and 1 uppercase letter.",
          }),
          { status: 400, headers: { "content-type": "application/json" } }
        );
      }

      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          passwordHash: true,
          publicKey: true,
          encryptedPrivateKey: true,
          encryptionPasswordHash: true,
        },
      });

      if (!user) {
        return new Response(
          JSON.stringify({ error: "NotFound", message: "User not found" }),
          { status: 404, headers: { "content-type": "application/json" } }
        );
      }

      // 1. Verify current password
      // If a separate encryption password is set, currentPassword must match encryptionPasswordHash.
      // Otherwise, it must match the account passwordHash.
      if (user.encryptionPasswordHash) {
        const isEncryptionPwdValid = await verifyPassword(
          body.currentPassword,
          user.encryptionPasswordHash
        );
        if (!isEncryptionPwdValid) {
          return new Response(
            JSON.stringify({
              error: "BadRequest",
              message: "Incorrect current encryption password.",
            }),
            { status: 400, headers: { "content-type": "application/json" } }
          );
        }
      } else {
        const isAccountPwdValid = await verifyPassword(
          body.currentPassword,
          user.passwordHash
        );
        if (!isAccountPwdValid) {
          return new Response(
            JSON.stringify({
              error: "BadRequest",
              message: "Incorrect current password.",
            }),
            { status: 400, headers: { "content-type": "application/json" } }
          );
        }
      }

      let updatedEncryptedPrivateKey: string;
      let updatedPublicKey = user.publicKey;

      if (user.encryptedPrivateKey) {
        try {
          const decryptedSecret = await decryptPrivateKey(
            user.encryptedPrivateKey,
            body.currentPassword
          );
          updatedEncryptedPrivateKey = await encryptPrivateKey(
            decryptedSecret,
            body.newEncryptionPassword
          );
        } catch {
          return new Response(
            JSON.stringify({
              error: "BadRequest",
              message: "Could not decrypt private key with the provided password.",
            }),
            { status: 400, headers: { "content-type": "application/json" } }
          );
        }
      } else {
        // User had no keypair yet; generate fresh ML-KEM-768 keypair
        const keypair = await generateUserKeypair(body.newEncryptionPassword);
        updatedPublicKey = keypair.publicKey;
        updatedEncryptedPrivateKey = keypair.encryptedPrivateKey;
      }

      // 2. Hash new encryption password (separate from account passwordHash)
      const newEncryptionPasswordHash = await hashPassword(body.newEncryptionPassword);

      // 3. Persist update in database without touching passwordHash (account password remains unchanged)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          publicKey: updatedPublicKey,
          encryptedPrivateKey: updatedEncryptedPrivateKey,
          encryptionPasswordHash: newEncryptionPasswordHash,
        },
      });

      return {
        success: true,
        message: "Encryption password updated successfully.",
        publicKey: updatedPublicKey ?? null,
        hasSeparateEncryptionPassword: true,
      };
    },
  },
});

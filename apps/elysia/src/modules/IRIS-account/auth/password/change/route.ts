import { defineRoute, t } from "../../../../../router";
import {
  verifyPassword,
  hashPassword,
  decryptPrivateKey,
  encryptPrivateKey,
  generateUserKeypair,
} from "../../../../../utils/auth-crypto";

export default defineRoute({
  schema: {
    body: t.Object({
      currentPassword: t.String({ minLength: 1 }),
      newPassword: t.String({ minLength: 12, maxLength: 64 }),
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String(),
      }),
    },
  },

  async POST({ body, session, prisma }) {
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
    });

    if (!user) {
      return new Response(
        JSON.stringify({ error: "NotFound", message: "User not found" }),
        { status: 404, headers: { "content-type": "application/json" } }
      );
    }

    // 1. Verify existing password
    const isCurrentValid = await verifyPassword(
      body.currentPassword,
      user.passwordHash
    );

    if (!isCurrentValid) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          message: "Incorrect current password.",
        }),
        { status: 401, headers: { "content-type": "application/json" } }
      );
    }

    // 2. Envelope re-encryption of post-quantum private key
    // Only re-encrypt if the user has NOT set a separate encryption password
    let updatedEncryptedPrivateKey = user.encryptedPrivateKey;
    let updatedPublicKey = user.publicKey;

    if (!user.encryptionPasswordHash) {
      if (user.encryptedPrivateKey) {
        try {
          const decryptedSecret = await decryptPrivateKey(
            user.encryptedPrivateKey,
            body.currentPassword
          );
          updatedEncryptedPrivateKey = await encryptPrivateKey(
            decryptedSecret,
            body.newPassword
          );
        } catch {
          // If decryption fails, leave as-is
        }
      } else {
        // Legacy user without encryption keys: generate fresh ML-KEM-768 keypair
        const keypair = await generateUserKeypair(body.newPassword);
        updatedPublicKey = keypair.publicKey;
        updatedEncryptedPrivateKey = keypair.encryptedPrivateKey;
      }
    }

    // 3. Hash new password and record passwordChangedAt
    const newHash = await hashPassword(body.newPassword);
    const now = new Date();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        publicKey: updatedPublicKey,
        encryptedPrivateKey: updatedEncryptedPrivateKey,
        passwordChangedAt: now,
      },
    });

    return {
      success: true,
      message: "Password changed successfully",
    };
  },
});

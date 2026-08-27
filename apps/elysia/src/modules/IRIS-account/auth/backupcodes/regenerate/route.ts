import { defineRoute, t } from "../../../../../router";
import { generateBackupCodes } from "../../../../../utils/auth-crypto";

export default defineRoute({
  schema: {
    response: {
      200: t.Object({
        success: t.Boolean(),
        backupCodes: t.Array(t.String()),
      }),
    },
  },

  async POST({ session, prisma }) {
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

    // Ensure at least one MFA method is active
    const hasMfaActive =
      user.TOTPEnabled || user.emailMfaEnabled || user.passkeys.length > 0;

    if (!hasMfaActive) {
      return new Response(
        JSON.stringify({
          error: "BadRequest",
          message: "Multi-factor authentication must be enabled to generate backup codes.",
        }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    // Generate 10 new formatted backup codes
    const { plain, hashed } = await generateBackupCodes();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        backupCodes: hashed,
      },
    });

    return {
      success: true,
      backupCodes: plain,
    };
  },
});

import { defineRoute, t } from "../../../../../router";

export default defineRoute({
  schema: {
    response: {
      200: t.Object({
        secret: t.String(),
        otpauthUrl: t.String(),
        qrCodeDataUrl: t.String(),
      }),
    },
  },

  async POST({ session, prisma, cache }) {
    if (!session.isAuthenticated) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    return {
      secret: "JBSWY3DPEHPK3PXP",
      otpauthUrl: "otpauth://totp/IRIS:user?secret=JBSWY3DPEHPK3PXP",
      qrCodeDataUrl: "data:image/png;base64,...",
    };
  },
});

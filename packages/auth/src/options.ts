import { NextAuthOptions } from "next-auth";
import { createCredentialsProvider } from "./providers/credentials.js";
import { getOAuthProviders } from "./providers/oauth.js";
import { AuthUser } from "./types.js";

/**
 * Global NextAuth configuration options for the IRIS ecosystem.
 *
 * Implements:
 * - Credentials provider with password, MFA, passkey-only, and login code support.
 * - OAuth identity providers for Google, Apple, and Discord.
 * - Lean JWT session storage containing exclusively `id`, `username`, `email`, and `passwordChangedAt`.
 * - Automatic session revocation if `passwordChangedAt` is newer than the token issue timestamp (`iat`).
 */
export const authOptions: NextAuthOptions = {
  providers: [createCredentialsProvider(), ...getOAuthProviders()],

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider && account.provider !== "credentials") {
        // OAuth login fallback defaults for username
        const authUser = user as AuthUser;
        if (!authUser.username && authUser.email) {
          authUser.username = authUser.email.split("@")[0] ?? "user";
        }
      }
      return true;
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }
      try {
        if (new URL(url).origin === baseUrl) {
          return url;
        }
      } catch {
        return baseUrl;
      }
      return baseUrl;
    },

    async jwt({ token, user, trigger, session }) {
      if (user) {
        const authUser = user as AuthUser;
        token.id = authUser.id;
        token.username = authUser.username;
        token.email = authUser.email;
        token.passwordChangedAt = authUser.passwordChangedAt ?? null;
        token.iat = Math.floor(Date.now() / 1000);
        token.error = null;
      }

      if (trigger === "update" && session) {
        const updatePayload = session as Partial<AuthUser>;
        if (updatePayload.username) {
          token.username = updatePayload.username;
        }
        if (updatePayload.email) {
          token.email = updatePayload.email;
        }
        if (updatePayload.passwordChangedAt !== undefined) {
          token.passwordChangedAt = updatePayload.passwordChangedAt;
        }
      }

      // Invalidate JWT session if the user's password was changed after this token was issued
      if (
        typeof token.passwordChangedAt === "number" &&
        typeof token.iat === "number" &&
        token.iat < token.passwordChangedAt
      ) {
        return {
          ...token,
          error: "TokenRevokedPasswordChanged",
        };
      }

      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user = {
          id: token.id,
          username: token.username,
          email: token.email,
          passwordChangedAt: token.passwordChangedAt ?? null,
        };
        session.error = token.error ?? null;
      }

      return session;
    },
  },

  debug: process.env.NODE_ENV !== "production",
};

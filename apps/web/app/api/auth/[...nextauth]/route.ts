import NextAuth from "next-auth";
import { authOptions } from "@IRIS/auth";

/**
 * NextAuth App Router API route handler for IRIS.
 *
 * Handles all authentication endpoints under `/api/auth/*` (signIn, callback, session, csrf, signOut).
 */
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

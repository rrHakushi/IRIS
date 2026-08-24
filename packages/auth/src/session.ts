import { getServerSession, Session } from "next-auth";
import { authOptions } from "./options.js";

/**
 * Retrieves the current authenticated NextAuth session on the server.
 *
 * Designed for Next.js Server Components, Server Actions, and API Route Handlers.
 *
 * @returns The active `Session` object, or `null` if unauthenticated.
 *
 * @example
 * ```typescript
 * import { auth } from "@IRIS/auth";
 *
 * export default async function ProfilePage() {
 *   const session = await auth();
 *   if (!session) {
 *     redirect("/login");
 *   }
 *   return <div>Hello, {session.user.username}</div>;
 * }
 * ```
 */
export async function getServerAuthSession(): Promise<Session | null> {
  return getServerSession(authOptions);
}

/**
 * Shorthand alias for `getServerAuthSession()`.
 */
export const auth = getServerAuthSession;

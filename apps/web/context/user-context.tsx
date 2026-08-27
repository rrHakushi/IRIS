"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { useSession } from "next-auth/react";
import { elysia } from "@/lib/elysia";

export interface FullUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  sidebarCardBackgroundUrl: string | null;
  customization?: Record<string, unknown> | null;
  settings?: Record<string, unknown> | null;
  permissions: number[];
  TOTPEnabled?: boolean;
  emailMfaEnabled?: boolean;
  publicKey?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface UserContextValue {
  user: FullUser | null;
  isLoading: boolean;
  error: string | null;
  refetchUser: () => Promise<FullUser | null>;
  updateUser: (data: {
    customization?: Record<string, unknown>;
    settings?: Record<string, unknown>;
  }) => Promise<FullUser | null>;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  isLoading: false,
  error: null,
  refetchUser: async () => null,
  updateUser: async () => null,
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<FullUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // In-flight request deduplication and user cache tracker
  const inFlightPromiseRef = useRef<Promise<FullUser | null> | null>(null);
  const lastFetchedUserIdRef = useRef<string | null>(null);

  const sessionId = (session?.user as Record<string, unknown> | undefined)?.id as
    | string
    | undefined;

  const fetchUser = useCallback(
    async (force = false): Promise<FullUser | null> => {
      if (status !== "authenticated" || !sessionId) {
        if (status === "unauthenticated") {
          setUser(null);
          lastFetchedUserIdRef.current = null;
        }
        setIsLoading(false);
        return null;
      }

      // Return immediately if already fetched and not forced
      if (!force && lastFetchedUserIdRef.current === sessionId && user) {
        return user;
      }

      // Deduplicate concurrent requests
      if (inFlightPromiseRef.current) {
        return inFlightPromiseRef.current;
      }

      setIsLoading(true);
      setError(null);

      const promise = (async () => {
        try {
          // Use Elysia Eden Treaty client to fetch from /users/me
          const { data, error: apiError } = await (elysia as any).users.me.get({
            fetch: { credentials: "include" },
          });

          if (apiError || !data?.user) {
            throw new Error(
              (apiError as any)?.value?.message || "Failed to fetch user from Elysia"
            );
          }

          const userData = data.user;
          const customization =
            (userData.customization as Record<string, unknown> | null) || {};

          const fullUser: FullUser = {
            id: userData.id,
            username: userData.username,
            email: userData.email,
            displayName:
              (customization.displayName as string | undefined) ||
              userData.username,
            avatarUrl: (customization.avatarUrl as string | undefined) || null,
            sidebarCardBackgroundUrl:
              (customization.sidebarCardBackgroundUrl as string | undefined) ||
              null,
            customization: userData.customization,
            settings: userData.settings,
            permissions: userData.permissions || [],
            TOTPEnabled: userData.TOTPEnabled,
            emailMfaEnabled: userData.emailMfaEnabled,
            publicKey: userData.publicKey,
            createdAt: userData.createdAt,
            updatedAt: userData.updatedAt,
          };

          lastFetchedUserIdRef.current = sessionId;
          setUser(fullUser);
          return fullUser;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Error fetching user";
          setError(msg);

          // Graceful fallback to session data
          if (session?.user) {
            const sUser = session.user as unknown as Record<string, unknown>;
            const fallbackUser: FullUser = {
              id: (sUser.id as string) || "operator",
              username:
                (sUser.username as string) || (sUser.name as string) || "operator",
              email: (sUser.email as string) || "operator@iris.local",
              displayName:
                (sUser.displayName as string) ||
                (sUser.name as string) ||
                (sUser.username as string) ||
                "IRIS Operator",
              avatarUrl: (sUser.avatarUrl as string) || null,
              sidebarCardBackgroundUrl:
                (sUser.sidebarCardBackgroundUrl as string) || null,
              permissions: (sUser.permissions as number[]) || [],
            };
            setUser(fallbackUser);
            return fallbackUser;
          }
          return null;
        } finally {
          setIsLoading(false);
          inFlightPromiseRef.current = null;
        }
      })();

      inFlightPromiseRef.current = promise;
      return promise;
    },
    [status, sessionId, user, session?.user]
  );

  useEffect(() => {
    if (status === "authenticated" && sessionId) {
      if (lastFetchedUserIdRef.current !== sessionId) {
        fetchUser();
      }
    }
  }, [status, sessionId, fetchUser]);

  const updateUser = async (data: {
    customization?: Record<string, unknown>;
    settings?: Record<string, unknown>;
  }): Promise<FullUser | null> => {
    try {
      const { data: resData, error: updateErr } = await (
        elysia as any
      ).users.me.patch(data, {
        fetch: { credentials: "include" },
      });

      if (updateErr || !resData?.user) {
        throw new Error(
          (updateErr as any)?.value?.message || "Failed to update user"
        );
      }

      const userData = resData.user;
      const customization =
        (userData.customization as Record<string, unknown> | null) || {};

      const updatedFullUser: FullUser = {
        id: userData.id,
        username: userData.username,
        email: userData.email,
        displayName:
          (customization.displayName as string | undefined) ||
          userData.username,
        avatarUrl: (customization.avatarUrl as string | undefined) || null,
        sidebarCardBackgroundUrl:
          (customization.sidebarCardBackgroundUrl as string | undefined) ||
          null,
        customization: userData.customization,
        settings: userData.settings,
        permissions: userData.permissions || [],
        TOTPEnabled: userData.TOTPEnabled,
        emailMfaEnabled: userData.emailMfaEnabled,
        publicKey: userData.publicKey,
        createdAt: userData.createdAt,
        updatedAt: userData.updatedAt,
      };

      setUser(updatedFullUser);
      return updatedFullUser;
    } catch (err: unknown) {
      console.error("Failed to update user settings:", err);
    }
    return null;
  };

  return (
    <UserContext.Provider
      value={{
        user,
        isLoading,
        error,
        refetchUser: () => fetchUser(true),
        updateUser,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}

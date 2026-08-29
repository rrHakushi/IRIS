"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useSession } from "next-auth/react";
import { elysia } from "@/lib/elysia";

import {
  getProfileCustomization,
  setProfileCustomization,
  type UserProfileCustomization,
  type DisplayNameStyle,
} from "@IRIS/shared";

export interface FullUser {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  displayNameStyle?: DisplayNameStyle;
  pronouns?: string;
  statusText?: string;
  bio?: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  nameplateUrl?: string | null;
  sidebarCardBackgroundUrl?: string | null;
  avatarFrame?: string | null;
  profile?: UserProfileCustomization;
  customization?: Record<string, any> | null;
  settings?: Record<string, any> | null;
  permissions?: number[];
  TOTPEnabled?: boolean;
  emailMfaEnabled?: boolean;
  publicKey?: string | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
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
  updateProfile: (patch: Partial<UserProfileCustomization>) => Promise<FullUser | null>;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  isLoading: false,
  error: null,
  refetchUser: async () => null,
  updateUser: async () => null,
  updateProfile: async () => null,
});

// In-memory cache across route changes
let cachedUser: FullUser | null = null;
let inFlightPromise: Promise<FullUser | null> | null = null;

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [user, setUser] = useState<FullUser | null>(cachedUser);
  const [isLoading, setIsLoading] = useState<boolean>(
    !cachedUser && status === "authenticated"
  );
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(
    async (force = false): Promise<FullUser | null> => {
      if (status !== "authenticated") {
        if (status === "unauthenticated") {
          cachedUser = null;
          setUser(null);
        }
        setIsLoading(false);
        return null;
      }

      if (!force && cachedUser) {
        return cachedUser;
      }

      if (inFlightPromise) {
        return inFlightPromise;
      }

      setIsLoading(true);
      setError(null);

      inFlightPromise = (async () => {
        try {
          const { data, error: apiError } = await (elysia as any).users.me.get({
            fetch: { credentials: "include" },
          });

          if (apiError || !data?.user) {
            throw new Error(
              (apiError as any)?.value?.message || "Failed to fetch user"
            );
          }

          const userData = data.user;
          const profile = getProfileCustomization(userData.customization);

          const fullUser: FullUser = {
            ...userData,
            displayName: profile.displayName || userData.username,
            displayNameStyle: profile.displayNameStyle,
            pronouns: profile.pronouns,
            statusText: profile.statusText,
            bio: profile.bio,
            avatarUrl: profile.avatarUrl,
            bannerUrl: profile.bannerUrl,
            nameplateUrl: profile.nameplateUrl,
            sidebarCardBackgroundUrl: profile.nameplateUrl,
            avatarFrame: profile.avatarFrame,
            profile,
          };

          cachedUser = fullUser;
          setUser(fullUser);
          return fullUser;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Error fetching user";
          setError(msg);
          return null;
        } finally {
          setIsLoading(false);
          inFlightPromise = null;
        }
      })();

      return inFlightPromise;
    },
    [status]
  );

  useEffect(() => {
    if (status === "authenticated") {
      if (!cachedUser) {
        fetchUser();
      }
    } else if (status === "unauthenticated") {
      cachedUser = null;
      setUser(null);
    }
  }, [status, fetchUser]);

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
      const profile = getProfileCustomization(userData.customization);

      const updatedFullUser: FullUser = {
        ...userData,
        displayName: profile.displayName || userData.username,
        displayNameStyle: profile.displayNameStyle,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
        bannerUrl: profile.bannerUrl,
        sidebarCardBackgroundUrl: profile.sidebarBannerUrl,
        avatarFrame: profile.avatarFrame,
        profile,
      };

      cachedUser = updatedFullUser;
      setUser(updatedFullUser);
      return updatedFullUser;
    } catch (err: unknown) {
      console.error("Failed to update user:", err);
    }
    return null;
  };

  const updateProfile = async (
    patch: Partial<UserProfileCustomization>
  ): Promise<FullUser | null> => {
    const updatedCustomization = setProfileCustomization(
      user?.customization,
      patch
    );
    return updateUser({ customization: updatedCustomization });
  };

  return (
    <UserContext.Provider
      value={{
        user,
        isLoading,
        error,
        refetchUser: () => fetchUser(true),
        updateUser,
        updateProfile,
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

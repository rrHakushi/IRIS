"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useUser } from "@/context/user-context";
import {
  type UserProfileCustomization,
  type DisplayNameStyle,
  DEFAULT_PROFILE_CUSTOMIZATION,
} from "@IRIS/shared";
import { Card, CardHeader, CardTitle, CardContent } from "@workspace/ui/components/card";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { Spinner } from "@workspace/ui/components/spinner";
import { Dialog, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { DisplayNameStyleCard } from "./profile/display-name-style-card";
import { MarkdownBioEditor } from "./profile/markdown-bio-editor";
import { MediaAssetCard } from "./profile/media-asset-card";
import { ProfilePreviewCard } from "./profile/profile-preview-card";
import { elysia } from "@/lib/elysia";
import {
  IconCheck,
  IconRotate2,
  IconEye,
  IconWriting,
} from "@tabler/icons-react";
import { toast } from "sonner";

export interface ProfileTabProps {
  onOpenChange?: (open: boolean) => void;
  setFooterContent?: (content: React.ReactNode) => void;
}

export function ProfileTab({
  setFooterContent,
}: ProfileTabProps): React.JSX.Element {
  const t = useTranslations("navigation.settings.account.profile");
  const { user, updateProfile, isLoading } = useUser();
  const initialProfile = user?.profile || DEFAULT_PROFILE_CUSTOMIZATION;

  // Local draft state initialized with current user profile
  const [draftProfile, setDraftProfile] = useState<UserProfileCustomization>(
    initialProfile
  );

  // Snapshot of saved state to detect dirty state
  const [savedProfile, setSavedProfile] = useState<UserProfileCustomization>(
    initialProfile
  );

  // Staged files to upload on Save Changes
  const [pendingFiles, setPendingFiles] = useState<{
    avatar?: File | null;
    banner?: File | null;
    nameplate?: File | null;
    sidebarBanner?: File | null;
    avatarFrame?: File | null;
  }>({});

  const [isSaving, setIsSaving] = useState(false);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);

  // Sync draft state when profile loads initially
  useEffect(() => {
    if (user?.profile) {
      setDraftProfile(user.profile);
      setSavedProfile(user.profile);
    }
  }, [user?.profile]);

  // Dirty check comparing draftProfile with savedProfile and any staged pending files
  const isDirty =
    JSON.stringify(draftProfile) !== JSON.stringify(savedProfile) ||
    Object.keys(pendingFiles).length > 0;

  const username = user?.username || "user";
  const email = user?.email || "";
  const initial = (draftProfile.displayName || username).charAt(0).toUpperCase();

  // Handle stage pending file from media cards
  const handlePendingFile = (
    assetType: "avatar" | "banner" | "nameplate" | "sidebarBanner" | "avatarFrame",
    file: File | null,
    previewUrl: string | null
  ) => {
    setPendingFiles((prev) => ({ ...prev, [assetType]: file }));
    setDraftProfile((prev) => {
      if (assetType === "avatar") return { ...prev, avatarUrl: previewUrl };
      if (assetType === "banner") return { ...prev, bannerUrl: previewUrl };
      if (assetType === "nameplate" || assetType === "sidebarBanner") {
        return { ...prev, nameplateUrl: previewUrl, sidebarBannerUrl: previewUrl };
      }
      if (assetType === "avatarFrame") return { ...prev, avatarFrame: previewUrl };
      return prev;
    });
  };

  // Save handler: uploads pending files to S3 then saves profile customization
  const handleSave = async () => {
    if (!isDirty || isSaving) return;
    setIsSaving(true);

    try {
      const finalProfile: UserProfileCustomization = { ...draftProfile };

      // Process all staged pending files (uploads and deletions)
      for (const [type, file] of Object.entries(pendingFiles)) {
        if (file instanceof File) {
          const { data, error } = await (elysia as any).users.me.assets.post(
            { file, assetType: type },
            { fetch: { credentials: "include" } }
          );

          if (error || !data?.url) {
            const errorMsg =
              (error as any)?.value?.message ||
              (error as any)?.message ||
              t("failedUpload", { type });
            throw new Error(errorMsg);
          }

          if (type === "avatar") finalProfile.avatarUrl = data.url;
          else if (type === "banner") finalProfile.bannerUrl = data.url;
          else if (type === "nameplate" || type === "sidebarBanner") {
            finalProfile.nameplateUrl = data.url;
            finalProfile.sidebarBannerUrl = data.url;
          } else if (type === "avatarFrame") finalProfile.avatarFrame = data.url;
        } else if (file === null) {
          // Deletion: determine old asset URL to remove from RustFS
          let oldUrl: string | null | undefined = null;
          if (type === "avatar") {
            oldUrl = savedProfile.avatarUrl;
            finalProfile.avatarUrl = null;
          } else if (type === "banner") {
            oldUrl = savedProfile.bannerUrl;
            finalProfile.bannerUrl = null;
          } else if (type === "nameplate" || type === "sidebarBanner") {
            oldUrl = savedProfile.nameplateUrl || savedProfile.sidebarBannerUrl;
            finalProfile.nameplateUrl = null;
            finalProfile.sidebarBannerUrl = null;
          } else if (type === "avatarFrame") {
            oldUrl = savedProfile.avatarFrame;
            finalProfile.avatarFrame = null;
          }

          if (oldUrl && typeof oldUrl === "string" && oldUrl.includes("users/")) {
            try {
              await (elysia as any).users.me.assets.delete(
                { key: oldUrl },
                { fetch: { credentials: "include" } }
              );
            } catch (delErr) {
              console.warn(`[Assets] Warning deleting ${type} from RustFS:`, delErr);
            }
          }
        }
      }

      const updated = await updateProfile(finalProfile);
      if (updated) {
        setSavedProfile(finalProfile);
        setDraftProfile(finalProfile);
        setPendingFiles({});
        toast.success(t("savedSuccess"));
      } else {
        toast.error(t("saveFailed"));
      }
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error(err.message || t("errorSaving"));
    } finally {
      setIsSaving(false);
    }
  };

  // Reset handler
  const handleReset = () => {
    setDraftProfile(savedProfile);
    setPendingFiles({});
    toast.info(t("changesReset"));
  };

  // Push sticky actions into modal footer
  useEffect(() => {
    if (!setFooterContent) return;

    setFooterContent(
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          {isDirty && (
            <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-400 bg-amber-500/10 animate-pulse">
              {t("unsavedChanges")}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!isDirty || isSaving}
            onPress={handleReset}
            className="text-xs rounded-xl cursor-pointer"
          >
            <IconRotate2 data-icon="inline-start" className="size-3.5" />
            {t("reset")}
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            disabled={!isDirty || isSaving}
            onPress={handleSave}
            className="text-xs font-bold gap-1.5 rounded-xl cursor-pointer bg-primary text-primary-foreground shadow-xs"
          >
            {isSaving ? (
              <>
                <Spinner className="size-3.5" />
                <span>{t("saving")}</span>
              </>
            ) : (
              <>
                <IconCheck data-icon="inline-start" className="size-3.5" />
                <span>{t("saveChanges")}</span>
              </>
            )}
          </Button>
        </div>
      </div>
    );

    return () => {
      setFooterContent(null);
    };
  }, [isDirty, isSaving, draftProfile, savedProfile, pendingFiles, setFooterContent, t]);

  return (
    <div className="relative w-full space-y-6 pb-10 animate-in fade-in-50 duration-200">
      <div>
        <h3 className="text-base font-bold text-foreground">{t("title")}</h3>
      </div>

      {/* 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start w-full">
        {/* Left Column: Configuration Cards */}
        <div className="xl:col-span-7 2xl:col-span-8 space-y-6">
          {/* Card 1: Display Name, Pronouns, Status & Effects */}
          <DisplayNameStyleCard
            displayName={draftProfile.displayName || ""}
            onDisplayNameChange={(displayName) =>
              setDraftProfile((prev) => ({ ...prev, displayName }))
            }
            pronouns={draftProfile.pronouns || ""}
            onPronounsChange={(pronouns) =>
              setDraftProfile((prev) => ({ ...prev, pronouns }))
            }
            statusText={draftProfile.statusText || ""}
            onStatusTextChange={(statusText) =>
              setDraftProfile((prev) => ({ ...prev, statusText }))
            }
            style={draftProfile.displayNameStyle || {}}
            onStyleChange={(displayNameStyle: DisplayNameStyle) =>
              setDraftProfile((prev) => ({ ...prev, displayNameStyle }))
            }
            username={username}
            disabled={isLoading || isSaving}
          />

          {/* Card 2: Markdown Bio */}
          <Card className="rounded-2xl border border-border/60 bg-card/60 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <IconWriting className="size-4 text-primary" />
                {t("aboutMe")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MarkdownBioEditor
                value={draftProfile.bio || ""}
                onChange={(bio) => setDraftProfile((prev) => ({ ...prev, bio }))}
                maxLength={500}
                disabled={isLoading || isSaving}
              />
            </CardContent>
          </Card>

          {/* Cards 3 & 4: Avatar and Avatar Frame side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {/* Card 3: Profile Picture (Avatar) */}
            <MediaAssetCard
              title={t("profilePicture")}
              description={t("profilePictureDesc")}
              assetType="avatar"
              currentUrl={draftProfile.avatarUrl}
              onPendingFileChange={(file, previewUrl) =>
                handlePendingFile("avatar", file, previewUrl)
              }
              aspectRatio="square"
              fallbackInitial={initial}
              disabled={isLoading || isSaving}
            />

            {/* Card 4: Avatar Frame */}
            <MediaAssetCard
              title={t("avatarFrame")}
              description={t("avatarFrameDesc")}
              assetType="avatarFrame"
              currentUrl={draftProfile.avatarFrame}
              avatarUrl={draftProfile.avatarUrl}
              onPendingFileChange={(file, previewUrl) =>
                handlePendingFile("avatarFrame", file, previewUrl)
              }
              aspectRatio="square"
              fallbackInitial={initial}
              disabled={isLoading || isSaving}
            />
          </div>

          {/* Card 5: Profile Banner */}
          <MediaAssetCard
            title={t("banner")}
            description={t("bannerDesc")}
            assetType="banner"
            currentUrl={draftProfile.bannerUrl}
            onPendingFileChange={(file, previewUrl) =>
              handlePendingFile("banner", file, previewUrl)
            }
            aspectRatio="banner"
            fallbackInitial={initial}
            disabled={isLoading || isSaving}
          />

          {/* Card 6: Nameplate */}
          <MediaAssetCard
            title={t("nameplate")}
            description={t("nameplateDesc")}
            assetType="nameplate"
            currentUrl={draftProfile.nameplateUrl || draftProfile.sidebarBannerUrl}
            onPendingFileChange={(file, previewUrl) =>
              handlePendingFile("nameplate", file, previewUrl)
            }
            aspectRatio="sidebar"
            fallbackInitial={initial}
            disabled={isLoading || isSaving}
          />
        </div>

        {/* Right Column: Pinned Live Preview (Desktop) */}
        <div className="hidden xl:block xl:col-span-5 2xl:col-span-4 sticky top-0">
          <ProfilePreviewCard
            profile={draftProfile}
            username={username}
            email={email}
          />
        </div>
      </div>

      {/* Mobile Floating Action Button (FAB) to open Preview Modal */}
      <div className="xl:hidden fixed bottom-18 end-6 z-40">
        <Button
          type="button"
          variant="default"
          size="sm"
          onPress={() => setMobilePreviewOpen(true)}
          className="gap-2 shadow-xl rounded-full px-4 h-10 font-bold bg-primary text-primary-foreground cursor-pointer"
        >
          <IconEye className="size-4" />
          <span>{t("preview")}</span>
        </Button>
      </div>

      {/* Mobile Preview Dialog */}
      <Dialog
        isOpen={mobilePreviewOpen}
        onOpenChange={setMobilePreviewOpen}
        className="sm:max-w-md p-4 bg-background/95 backdrop-blur-xl border border-border/80 rounded-3xl"
      >
        <DialogHeader className="pb-2">
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            <IconEye className="size-4 text-primary" />
            {t("preview")}
          </DialogTitle>
        </DialogHeader>
        <div className="pt-2">
          <ProfilePreviewCard
            profile={draftProfile}
            username={username}
            email={email}
          />
        </div>
      </Dialog>
    </div>
  );
}

export { ProfileTab as ProfileSettingsTab };

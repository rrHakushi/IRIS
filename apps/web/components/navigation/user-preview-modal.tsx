"use client"

import React from "react"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@workspace/ui/components/dialog"
import type { UserProfileCustomization } from "@IRIS/shared"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"

export interface UserPreviewModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  username: string
  profile?: UserProfileCustomization | null
}

export function UserPreviewModal({
  isOpen,
  onOpenChange,
  username,
  profile,
}: UserPreviewModalProps): React.JSX.Element {
  const displayName = profile?.displayName || username
  const initial = (displayName || "?").charAt(0).toUpperCase()

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className="z-[100] max-w-md sm:max-w-lg"
    >
      <DialogHeader>
        <div className="flex items-center gap-3">
          <Avatar className="size-10 border border-border">
            {profile?.avatarUrl ? (
              <AvatarImage src={profile.avatarUrl} alt={displayName} />
            ) : null}
            <AvatarFallback className="bg-primary/15 text-xs font-black text-primary uppercase">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div>
            <DialogTitle className="text-base font-semibold">
              {displayName}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              @{username}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="flex min-h-[160px] items-center justify-center rounded-2xl border border-dashed border-border/50 bg-muted/10 p-6 text-center text-xs text-muted-foreground">
        User preview modal content
      </div>
    </Dialog>
  )
}

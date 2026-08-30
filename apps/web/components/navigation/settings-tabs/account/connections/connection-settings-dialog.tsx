"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Button } from "@workspace/ui/components/button";
import { Switch } from "@workspace/ui/components/switch";
import { Label } from "@workspace/ui/components/label";
import { Spinner } from "@workspace/ui/components/spinner";
import {
  IconTrash,
  IconCheck,
} from "@tabler/icons-react";
import type { ProviderMetadata, UserConnectionItem } from "./types";
import { toast } from "sonner";

interface ConnectionSettingsDialogProps {
  connection: UserConnectionItem | null;
  provider: ProviderMetadata | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
  onDisconnected: () => void;
}

export function ConnectionSettingsDialog({
  connection,
  provider,
  open,
  onOpenChange,
  onUpdated,
  onDisconnected,
}: ConnectionSettingsDialogProps): React.JSX.Element | null {
  const [librarySync, setLibrarySync] = useState<boolean>(
    Boolean(connection?.settings?.librarySync ?? true)
  );
  const [isPrivate, setIsPrivate] = useState<boolean>(
    Boolean(connection?.settings?.isPrivate ?? false)
  );

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sync state when connection changes
  React.useEffect(() => {
    if (connection) {
      setLibrarySync(Boolean(connection.settings?.librarySync ?? true));
      setIsPrivate(Boolean(connection.settings?.isPrivate ?? false));
    }
  }, [connection]);

  if (!connection || !provider) return null;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`${apiUrl}/connections/${connection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          settings: {
            ...(connection.settings?.hostUrl ? { hostUrl: connection.settings.hostUrl } : {}),
            librarySync,
            isPrivate,
          },
        }),
      });

      if (!res.ok) throw new Error("Failed to save settings");

      toast.success("Connection settings updated!");
      onOpenChange(false);
      onUpdated();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to update settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm(`Are you sure you want to disconnect ${provider.name}?`)) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`${apiUrl}/connections/${connection.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to disconnect");

      toast.success(`Disconnected ${provider.name}`);
      onOpenChange(false);
      onDisconnected();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to disconnect");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog isOpen={open} onOpenChange={onOpenChange}>
      <div className="w-full">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted/40 flex items-center justify-center p-2 border border-border/40">
              <img
                src={provider.iconUrl}
                alt={provider.name}
                className="w-6 h-6 object-contain"
                loading="lazy"
              />
            </div>
            <div>
              <DialogTitle>{provider.name} Settings</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Connected as <span className="font-semibold text-foreground">{connection.displayName || connection.externalId}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-3">
          {/* Settings toggles */}
          <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-3.5">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5 pr-4">
                <Label className="text-xs font-medium">Library Sync</Label>
                <p className="text-[11px] text-muted-foreground">
                  Synchronize watchlists, ratings, and media library status.
                </p>
              </div>
              <Switch isSelected={librarySync} onChange={setLibrarySync} />
            </div>

            <div className="flex items-center justify-between border-t border-border/40 pt-3">
              <div className="space-y-0.5 pr-4">
                <Label className="text-xs font-medium">Private Connection</Label>
                <p className="text-[11px] text-muted-foreground">
                  Hide this linked account badge from your public profile.
                </p>
              </div>
              <Switch isSelected={isPrivate} onChange={setIsPrivate} />
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-row items-center justify-between sm:justify-between w-full">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDisconnect}
            disabled={isDeleting}
            className="gap-1.5 h-8 text-xs"
          >
            {isDeleting ? <Spinner className="w-3.5 h-3.5" /> : <IconTrash className="w-3.5 h-3.5" />}
            Disconnect
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="gap-1.5 h-8 text-xs"
            >
              {isSaving ? <Spinner className="w-3.5 h-3.5" /> : <IconCheck className="w-3.5 h-3.5" />}
              Save Changes
            </Button>
          </div>
        </DialogFooter>
      </div>
    </Dialog>
  );
}


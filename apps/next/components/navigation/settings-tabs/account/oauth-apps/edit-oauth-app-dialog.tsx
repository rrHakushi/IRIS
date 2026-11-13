"use client"

import React, { useState, useEffect } from "react"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import { IconDeviceFloppy, IconEdit } from "@tabler/icons-react"
import { toast } from "sonner"
import type { OAuthAppItem, EditOAuthAppPayload } from "./types"

export interface EditOAuthAppDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  app: OAuthAppItem | null
  onSubmit: (id: string, payload: EditOAuthAppPayload) => Promise<boolean>
  isLoading?: boolean
}

export function EditOAuthAppDialog({
  isOpen,
  onOpenChange,
  app,
  onSubmit,
  isLoading = false,
}: EditOAuthAppDialogProps): React.JSX.Element {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [websiteUrl, setWebsiteUrl] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [redirectUrisText, setRedirectUrisText] = useState("")
  const [isPublic, setIsPublic] = useState(false)

  useEffect(() => {
    if (app) {
      setName(app.name || "")
      setDescription(app.description || "")
      setWebsiteUrl(app.websiteUrl || "")
      setLogoUrl(app.logoUrl || "")
      setRedirectUrisText((app.redirectUris || []).join("\n"))
      setIsPublic(app.isPublic)
    }
  }, [app])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!app) return

    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.error("Application name is required.")
      return
    }

    const redirectUris = redirectUrisText
      .split(/[\n,]+/)
      .map((u) => u.trim())
      .filter((u) => u.length > 0)

    if (redirectUris.length === 0) {
      toast.error("At least one Redirect URI is required.")
      return
    }

    const success = await onSubmit(app.id, {
      name: trimmedName,
      description: description.trim() || null,
      websiteUrl: websiteUrl.trim() || null,
      logoUrl: logoUrl.trim() || null,
      redirectUris,
      isPublic,
    })

    if (success) {
      onOpenChange(false)
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className="max-h-[90vh] overflow-y-auto sm:max-w-xl"
    >
      <DialogHeader>
        <div className="flex items-center gap-2.5 text-primary">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <IconEdit className="size-4.5" />
          </div>
          <DialogTitle>Edit OAuth Application</DialogTitle>
        </div>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 py-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">
            Application Name <span className="text-primary">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isLoading}
            required
            className="text-xs"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">
            Description
          </label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief overview of what this application does"
            disabled={isLoading}
            className="text-xs"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">
              Homepage / Website URL
            </label>
            <Input
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              disabled={isLoading}
              className="text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">
              Logo URL
            </label>
            <Input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              disabled={isLoading}
              className="text-xs"
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-foreground">
              Redirect URIs <span className="text-primary">*</span>
            </label>
            <span className="text-[11px] text-muted-foreground">
              One URI per line
            </span>
          </div>
          <textarea
            rows={3}
            value={redirectUrisText}
            onChange={(e) => setRedirectUrisText(e.target.value)}
            disabled={isLoading}
            required
            className="w-full rounded-xl border border-input bg-transparent px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-ring focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              disabled={isLoading}
              className="mt-0.5 rounded border-border text-primary focus:ring-primary/30"
            />
            <div className="text-xs">
              <span className="font-medium text-foreground">
                Public Client (SPA, Mobile, CLI with PKCE)
              </span>
              <p className="mt-0.5 leading-relaxed text-muted-foreground">
                Public clients authenticate exclusively with PKCE code
                challenges and do not use client secrets.
              </p>
            </div>
          </label>
        </div>



        <DialogFooter className="mt-6 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isLoading}
            onClick={() => onOpenChange(false)}
            className="h-9 px-4 text-xs"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
            className="h-9 gap-1.5 bg-primary px-5 text-xs text-primary-foreground hover:bg-primary/90"
          >
            {isLoading ? (
              <>
                <Spinner className="size-3.5" />
                Saving...
              </>
            ) : (
              <>
                <IconDeviceFloppy className="size-3.5" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

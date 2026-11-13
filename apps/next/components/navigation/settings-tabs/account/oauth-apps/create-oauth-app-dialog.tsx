"use client"

import React, { useState } from "react"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import { IconDeviceFloppy, IconPlus, IconWorld } from "@tabler/icons-react"
import { toast } from "sonner"
import type { CreateOAuthAppPayload } from "./types"

export interface CreateOAuthAppDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: CreateOAuthAppPayload) => Promise<boolean>
  isLoading?: boolean
}

export function CreateOAuthAppDialog({
  isOpen,
  onOpenChange,
  onSubmit,
  isLoading = false,
}: CreateOAuthAppDialogProps): React.JSX.Element {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [websiteUrl, setWebsiteUrl] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [redirectUrisText, setRedirectUrisText] = useState(
    "http://localhost:3000/api/auth/callback/iris"
  )
  const [isPublic, setIsPublic] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

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

    const success = await onSubmit({
      name: trimmedName,
      description: description.trim() || undefined,
      websiteUrl: websiteUrl.trim() || undefined,
      logoUrl: logoUrl.trim() || undefined,
      redirectUris,
      isPublic,
    })

    if (success) {
      setName("")
      setDescription("")
      setWebsiteUrl("")
      setLogoUrl("")
      setRedirectUrisText("http://localhost:3000/api/auth/callback/iris")
      setIsPublic(false)
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
            <IconWorld className="size-4.5" />
          </div>
          <DialogTitle>Register OAuth Application</DialogTitle>
        </div>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 py-2">
        {/* Name */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">
            Application Name <span className="text-primary">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My NextJS App, Tachiyomi, Mobile Client"
            disabled={isLoading}
            required
            className="text-xs"
          />
        </div>

        {/* Description */}
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

        {/* Website & Logo URLs */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">
              Homepage / Website URL
            </label>
            <Input
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://myapp.com"
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
              placeholder="https://myapp.com/logo.png"
              disabled={isLoading}
              className="text-xs"
            />
          </div>
        </div>

        {/* Redirect URIs */}
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
            placeholder={
              "https://myapp.com/oauth/callback\nhttp://localhost:3000/api/auth/callback/iris"
            }
            disabled={isLoading}
            required
            className="w-full rounded-xl border border-input bg-transparent px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-ring focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        {/* Client Type Toggle */}
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
                Check this if the client cannot securely store a client secret
                (such as single-page web apps or mobile apps). Authorization
                code flow with PKCE will be enforced.
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
                Registering...
              </>
            ) : (
              <>
                <IconPlus className="size-3.5" />
                Create Application
              </>
            )}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

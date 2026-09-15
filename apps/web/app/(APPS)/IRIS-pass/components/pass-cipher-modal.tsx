"use client"

import React, { useState, useEffect, useRef } from "react"
import { usePass } from "@/context/pass-context"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { Badge } from "@workspace/ui/components/badge"
import {
  IconKey,
  IconTerminal2,
  IconSparkles,
  IconEye,
  IconEyeOff,
  IconQrcode,
  IconPlus,
  IconTrash,
  IconLink,
  IconFingerprint,
} from "@tabler/icons-react"
import { generateSshKeypair, type SshKeyAlgorithm } from "@/lib/pass-ssh"
import { parseOtpAuthUri, scanQrCodeFromImage } from "@/lib/pass-totp"
import { BITWARDEN_MATCH_LABELS } from "@/lib/pass-matching"
import { PassGeneratorDialog } from "./pass-generator-dialog"
import { toast } from "sonner"
import type {
  DecryptedLoginData,
  DecryptedSshKeyData,
  PassCipherType,
  LoginUri,
  PasskeyData,
  BitwardenUriMatch,
} from "@/lib/pass-types"

export function PassCipherModal({
  open,
  onOpenChange,
  editCipherId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editCipherId?: string | null
}) {
  const { ciphers, folders, createCipher, updateCipher } = usePass()

  const isEditing = Boolean(editCipherId)
  const existingCipher = ciphers.find((c) => c.id === editCipherId)

  const [type, setType] = useState<PassCipherType>("LOGIN")
  const [title, setTitle] = useState("")
  const [folderId, setFolderId] = useState<string | null>(null)

  // Login form state
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [additionalPasswords, setAdditionalPasswords] = useState<
    { id: string; name: string; value: string; show?: boolean }[]
  >([])
  const [uris, setUris] = useState<LoginUri[]>([{ uri: "", match: "BASE_DOMAIN" }])
  const [totpSecret, setTotpSecret] = useState("")
  const [passkey, setPasskey] = useState<PasskeyData | null>(null)
  const [showPasskeyInputs, setShowPasskeyInputs] = useState(false)
  const [passkeyRpId, setPasskeyRpId] = useState("")
  const [passkeyCredId, setPasskeyCredId] = useState("")
  const [notes, setNotes] = useState("")

  // Generator modal
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false)

  // SSH Key form state
  const [sshAlgorithm, setSshAlgorithm] = useState<SshKeyAlgorithm>("ED25519")
  const [publicKey, setPublicKey] = useState("")
  const [privateKey, setPrivateKey] = useState("")
  const [fingerprint, setFingerprint] = useState("")
  const [passphrase, setPassphrase] = useState("")
  const [isGeneratingSsh, setIsGeneratingSsh] = useState(false)

  // QR scan input ref
  const qrInputRef = useRef<HTMLInputElement>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Populate form on edit or reset
  useEffect(() => {
    if (existingCipher) {
      setType(existingCipher.type)
      setTitle(existingCipher.title)
      setFolderId(existingCipher.folderId)

      if (existingCipher.type === "LOGIN") {
        const d = existingCipher.data as DecryptedLoginData
        setUsername(d.username || "")
        setPassword(d.password || "")
        setAdditionalPasswords(
          d.additionalPasswords?.map((p) => ({ ...p, show: false })) || []
        )
        setUris(
          d.uris && d.uris.length > 0
            ? d.uris.map((u) => ({ uri: u.uri, match: u.match || "BASE_DOMAIN" }))
            : [{ uri: "", match: "BASE_DOMAIN" }]
        )
        setTotpSecret(d.totpSecret || "")
        setPasskey(d.passkey || null)
        setShowPasskeyInputs(false)
        setNotes(d.notes || "")
      } else {
        const d = existingCipher.data as DecryptedSshKeyData
        setSshAlgorithm(d.keyType)
        setPublicKey(d.publicKey || "")
        setPrivateKey(d.privateKey || "")
        setFingerprint(d.fingerprint || "")
        setPassphrase(d.passphrase || "")
        setNotes(d.notes || "")
      }
    } else {
      setType("LOGIN")
      setTitle("")
      setFolderId(null)
      setUsername("")
      setPassword("")
      setAdditionalPasswords([])
      setUris([{ uri: "", match: "BASE_DOMAIN" }])
      setTotpSecret("")
      setPasskey(null)
      setShowPasskeyInputs(false)
      setNotes("")
      setSshAlgorithm("ED25519")
      setPublicKey("")
      setPrivateKey("")
      setFingerprint("")
      setPassphrase("")
    }
  }, [existingCipher, open])

  // Multiple URI handlers
  const handleAddUri = () => {
    setUris([...uris, { uri: "", match: "BASE_DOMAIN" }])
  }

  const handleRemoveUri = (index: number) => {
    if (uris.length === 1) {
      setUris([{ uri: "", match: "BASE_DOMAIN" }])
    } else {
      setUris(uris.filter((_, i) => i !== index))
    }
  }

  const handleUriChange = (index: number, value: string) => {
    const next = [...uris]
    next[index] = { ...next[index]!, uri: value }
    setUris(next)
  }

  const handleMatchChange = (index: number, match: BitwardenUriMatch) => {
    const next = [...uris]
    next[index] = { ...next[index]!, match }
    setUris(next)
  }

  // Passkey creation helper
  const handleSaveManualPasskey = () => {
    if (!passkeyRpId.trim() || !passkeyCredId.trim()) {
      toast.error("Please provide both RP ID and Credential ID")
      return
    }
    setPasskey({
      rpId: passkeyRpId.trim(),
      credentialId: passkeyCredId.trim(),
      createdAt: new Date().toISOString(),
    })
    setShowPasskeyInputs(false)
    setPasskeyRpId("")
    setPasskeyCredId("")
    toast.success("Passkey attached to login")
  }

  // Generate in-browser SSH keypair
  const handleGenerateSsh = async () => {
    setIsGeneratingSsh(true)
    try {
      const generated = await generateSshKeypair(
        sshAlgorithm,
        title ? `${title.toLowerCase().replace(/\s+/g, "-")}@iris` : "user@iris"
      )
      setPublicKey(generated.publicKeyOpenSsh)
      setPrivateKey(generated.privateKeyPem)
      setFingerprint(generated.fingerprintSha256)
      toast.success(`Generated ${sshAlgorithm} keypair`)
    } catch (err: any) {
      toast.error(err?.message || "Failed to generate SSH key")
    } finally {
      setIsGeneratingSsh(false)
    }
  }

  // QR Code Image File Upload
  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const img = new Image()
      img.src = URL.createObjectURL(file)
      await img.decode()

      const scanned = await scanQrCodeFromImage(img)
      if (scanned) {
        const parsed = parseOtpAuthUri(scanned)
        if (parsed?.secret) {
          setTotpSecret(parsed.secret)
          toast.success("Imported 2FA secret from QR code")
          return
        }
      }

      toast.error("Could not decode QR code. Please paste the secret key manually.")
    } catch {
      toast.error("Failed to read image file")
    }
  }

  // Handle Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error("Please provide a title")
      return
    }

    setIsSubmitting(true)

    try {
      if (type === "LOGIN") {
        const validUris = uris
          .map((u) => ({ uri: u.uri.trim(), match: u.match || "BASE_DOMAIN" }))
          .filter((u) => u.uri.length > 0)

        const validAdditionalPasswords = additionalPasswords
          .filter((p) => p.name.trim() || p.value)
          .map((p) => ({
            id: p.id || crypto.randomUUID(),
            name: p.name.trim() || "Password",
            value: p.value,
          }))

        const payload: DecryptedLoginData = {
          username: username.trim(),
          password,
          additionalPasswords:
            validAdditionalPasswords.length > 0
              ? validAdditionalPasswords
              : undefined,
          uris: validUris,
          totpSecret: totpSecret.trim() ? totpSecret.trim().toUpperCase() : undefined,
          passkey: passkey || undefined,
          notes: notes.trim() || undefined,
        }

        if (isEditing && editCipherId) {
          await updateCipher(editCipherId, {
            title: title.trim(),
            folderId,
            payload,
          })
        } else {
          await createCipher({
            type: "LOGIN",
            title: title.trim(),
            folderId,
            payload,
          })
        }
      } else {
        const payload: DecryptedSshKeyData = {
          keyType: sshAlgorithm,
          publicKey: publicKey.trim(),
          privateKey: privateKey.trim(),
          passphrase: passphrase.trim() || undefined,
          fingerprint: fingerprint.trim() || "SHA256:unknown",
          notes: notes.trim() || undefined,
        }

        if (isEditing && editCipherId) {
          await updateCipher(editCipherId, {
            title: title.trim(),
            folderId,
            payload,
          })
        } else {
          await createCipher({
            type: "SSH_KEY",
            title: title.trim(),
            folderId,
            payload,
          })
        }
      }

      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Dialog
        isOpen={open}
        onOpenChange={onOpenChange}
        className="sm:max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader className="text-start">
          <DialogTitle className="text-lg font-bold text-foreground">
            {isEditing ? "Edit Item" : "Add New Item"}
          </DialogTitle>
        </DialogHeader>

        {/* Item Type Switcher (only for new items) */}
        {!isEditing && (
          <div className="flex rounded-xl bg-muted/60 p-1 gap-1">
            <button
              type="button"
              onClick={() => setType("LOGIN")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${type === "LOGIN"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              <IconKey className="size-3.5" />
              <span>Login</span>
            </button>
            <button
              type="button"
              onClick={() => setType("SSH_KEY")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${type === "SSH_KEY"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              <IconTerminal2 className="size-3.5" />
              <span>SSH Key</span>
            </button>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4 pt-2">
          {/* Title & Folder */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="item-title" className="text-xs font-medium text-foreground">
                Item Name *
              </Label>
              <Input
                id="item-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={type === "LOGIN" ? "e.g. GitHub" : "e.g. Prod Server"}
                required
                className="rounded-xl h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="item-folder" className="text-xs font-medium text-foreground">
                Folder
              </Label>
              <select
                id="item-folder"
                value={folderId || ""}
                onChange={(e) => setFolderId(e.target.value || null)}
                className="w-full h-9 rounded-xl border border-input bg-card px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">(No Folder)</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* LOGIN SPECIFIC FIELDS */}
          {type === "LOGIN" && (
            <>
              {/* Username */}
              <div className="space-y-1.5">
                <Label htmlFor="item-username" className="text-xs font-medium text-foreground">
                  Username / Email
                </Label>
                <Input
                  id="item-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username@domain.com"
                  className="rounded-xl h-9 font-mono text-xs"
                />
              </div>

              {/* Password + Generator Dialog Trigger */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="item-password" className="text-xs font-medium text-foreground">
                    Primary Password
                  </Label>
                  <button
                    type="button"
                    onClick={() => setIsGeneratorOpen(true)}
                    className="text-[11px] text-[#d800a6] hover:text-[#b8008e] flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <IconSparkles className="size-3" />
                    <span>Generate Password</span>
                  </button>
                </div>

                <div className="relative">
                  <Input
                    id="item-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter or generate primary password..."
                    className="pe-10 rounded-xl h-9 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 end-0 flex items-center pe-3 text-muted-foreground hover:text-foreground cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <IconEyeOff className="size-4" />
                    ) : (
                      <IconEye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Additional Passwords & Access Codes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-foreground">
                    Additional Passwords / Codes
                  </Label>
                  <button
                    type="button"
                    onClick={() =>
                      setAdditionalPasswords([
                        ...additionalPasswords,
                        { id: crypto.randomUUID(), name: "", value: "", show: false },
                      ])
                    }
                    className="text-[11px] text-[#d800a6] hover:text-[#b8008e] flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <IconPlus className="size-3" />
                    <span>Add Password / Code</span>
                  </button>
                </div>

                {additionalPasswords.map((ap, index) => (
                  <div
                    key={ap.id || index}
                    className="space-y-1.5 p-3 rounded-2xl border border-border bg-card/60"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Input
                        value={ap.name}
                        onChange={(e) => {
                          const next = [...additionalPasswords]
                          next[index] = { ...next[index]!, name: e.target.value }
                          setAdditionalPasswords(next)
                        }}
                        placeholder="Label (e.g. PIN, Access Code, Secondary)"
                        className="rounded-xl h-8 text-xs font-medium flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setAdditionalPasswords(
                            additionalPasswords.filter((_, i) => i !== index)
                          )
                        }}
                        className="size-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted shrink-0 cursor-pointer"
                        aria-label="Remove password"
                      >
                        <IconTrash className="size-3.5" />
                      </button>
                    </div>

                    <div className="relative">
                      <Input
                        type={ap.show ? "text" : "password"}
                        value={ap.value}
                        onChange={(e) => {
                          const next = [...additionalPasswords]
                          next[index] = { ...next[index]!, value: e.target.value }
                          setAdditionalPasswords(next)
                        }}
                        placeholder="Enter secret code or password..."
                        className="pe-10 rounded-xl h-9 font-mono text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...additionalPasswords]
                          next[index] = { ...next[index]!, show: !next[index]!.show }
                          setAdditionalPasswords(next)
                        }}
                        className="absolute inset-y-0 end-0 flex items-center pe-3 text-muted-foreground hover:text-foreground cursor-pointer"
                        tabIndex={-1}
                      >
                        {ap.show ? (
                          <IconEyeOff className="size-4" />
                        ) : (
                          <IconEye className="size-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Multiple Website URLs + Bitwarden Match Detection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-foreground">
                    Websites
                  </Label>
                  <button
                    type="button"
                    onClick={handleAddUri}
                    className="text-[11px] text-[#d800a6] hover:text-[#b8008e] flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <IconPlus className="size-3" />
                    <span>Add URL</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {uris.map((uriItem, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={uriItem.uri}
                        onChange={(e) => handleUriChange(index, e.target.value)}
                        placeholder="https://example.com"
                        className="rounded-xl h-9 font-mono text-xs flex-1"
                      />
                      <select
                        value={uriItem.match || "BASE_DOMAIN"}
                        onChange={(e) =>
                          handleMatchChange(index, e.target.value as BitwardenUriMatch)
                        }
                        className="h-9 rounded-xl border border-input bg-card px-2.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-36 shrink-0"
                      >
                        {Object.entries(BITWARDEN_MATCH_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemoveUri(index)}
                        className="size-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted shrink-0 cursor-pointer"
                        aria-label="Remove URL"
                      >
                        <IconTrash className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Passkey Support */}
              <div className="space-y-2 rounded-2xl border border-border bg-muted/20 p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <IconFingerprint className="size-4 text-emerald-500" />
                    <span>Passkey</span>
                  </div>
                  {!passkey && !showPasskeyInputs && (
                    <button
                      type="button"
                      onClick={() => setShowPasskeyInputs(true)}
                      className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <IconPlus className="size-3" />
                      <span>Attach Passkey</span>
                    </button>
                  )}
                </div>

                {passkey ? (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-card border border-border text-xs">
                    <div>
                      <span className="font-semibold text-foreground block">
                        {passkey.rpId}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPasskey(null)}
                      className="text-destructive hover:text-destructive text-xs h-7"
                    >
                      Remove
                    </Button>
                  </div>
                ) : showPasskeyInputs ? (
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input
                        value={passkeyRpId}
                        onChange={(e) => setPasskeyRpId(e.target.value)}
                        placeholder="RP ID (e.g. github.com)"
                        className="rounded-xl h-8 text-xs font-mono"
                      />
                      <Input
                        value={passkeyCredId}
                        onChange={(e) => setPasskeyCredId(e.target.value)}
                        placeholder="Credential ID (Base64/Hex)"
                        className="rounded-xl h-8 text-xs font-mono"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPasskeyInputs(false)}
                        className="text-xs h-7"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSaveManualPasskey}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs h-7 font-medium"
                      >
                        Save Passkey
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Store and synchronize passkeys across all your devices.
                  </p>
                )}
              </div>

              {/* TOTP 2FA Secret + QR Dropzone */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="item-totp" className="text-xs font-medium text-foreground">
                    Authenticator Key
                  </Label>
                  <button
                    type="button"
                    onClick={() => qrInputRef.current?.click()}
                    className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                  >
                    <IconQrcode className="size-3" />
                    <span>Scan / Upload QR</span>
                  </button>
                </div>

                <Input
                  id="item-totp"
                  value={totpSecret}
                  onChange={(e) => setTotpSecret(e.target.value)}
                  placeholder="Secret key or otpauth:// URL"
                  className="rounded-xl h-9 font-mono text-xs uppercase"
                />
                <input
                  ref={qrInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleQrUpload}
                  className="hidden"
                />
              </div>
            </>
          )}

          {/* SSH KEY SPECIFIC FIELDS */}
          {type === "SSH_KEY" && (
            <>
              {/* Algorithm + Generate Keypair */}
              <div className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-border bg-muted/20">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-foreground block">
                    In-Browser Keypair Generator
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Generate secure Ed25519 or RSA SSH keys locally
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={sshAlgorithm}
                    onChange={(e) => setSshAlgorithm(e.target.value as SshKeyAlgorithm)}
                    className="h-8 rounded-xl border border-input bg-card px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="ED25519">Ed25519 (Recommended)</option>
                    <option value="RSA_2048">RSA 2048</option>
                    <option value="RSA_4096">RSA 4096</option>
                  </select>

                  <Button
                    type="button"
                    size="sm"
                    disabled={isGeneratingSsh}
                    onClick={handleGenerateSsh}
                    className="rounded-xl bg-primary text-primary-foreground text-xs h-8"
                  >
                    {isGeneratingSsh ? "Generating..." : "Generate"}
                  </Button>
                </div>
              </div>

              {/* Public Key */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="item-public-key" className="text-xs font-medium text-foreground">
                    Public Key (OpenSSH Format)
                  </Label>
                  {fingerprint && (
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {fingerprint.slice(0, 20)}...
                    </span>
                  )}
                </div>
                <Textarea
                  id="item-public-key"
                  value={publicKey}
                  onChange={(e) => setPublicKey(e.target.value)}
                  placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5..."
                  rows={2}
                  className="rounded-xl font-mono text-[11px]"
                />
              </div>

              {/* Private Key */}
              <div className="space-y-1.5">
                <Label htmlFor="item-private-key" className="text-xs font-medium text-foreground">
                  Private Key (PKCS#8 PEM Format)
                </Label>
                <Textarea
                  id="item-private-key"
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                  rows={3}
                  className="rounded-xl font-mono text-[11px]"
                />
              </div>

              {/* Passphrase */}
              <div className="space-y-1.5">
                <Label htmlFor="item-passphrase" className="text-xs font-medium text-foreground">
                  Key Passphrase (Optional)
                </Label>
                <Input
                  id="item-passphrase"
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Passphrase protecting the private key"
                  className="rounded-xl h-9 text-xs"
                />
              </div>
            </>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="item-notes" className="text-xs font-medium text-foreground">
              Notes
            </Label>
            <Textarea
              id="item-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={2}
              className="rounded-xl text-xs"
            />
          </div>

          <DialogFooter className="pt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="rounded-xl bg-[#d800a6] hover:bg-[#b8008e] text-white text-xs font-semibold"
            >
              {isSubmitting
                ? "Saving..."
                : isEditing
                  ? "Save Changes"
                  : "Add to Vault"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Embedded Password Generator Modal for tweaking settings up to 256 chars */}
      <PassGeneratorDialog
        isOpen={isGeneratorOpen}
        onOpenChange={setIsGeneratorOpen}
        onApplyPassword={(pwd) => {
          setPassword(pwd)
          setShowPassword(true)
        }}
      />
    </>
  )
}

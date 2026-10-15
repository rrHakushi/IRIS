"use client"

import React, { useState, useEffect, useRef, useMemo } from "react"
import { usePass } from "@/context/pass-context"
import {
  Sheet,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { Badge } from "@workspace/ui/components/badge"
import {
  IconKey,
  IconNote,
  IconCreditCard,
  IconTerminal2,
  IconId,
  IconFileText,
  IconSparkles,
  IconEye,
  IconEyeOff,
  IconPlus,
  IconTrash,
  IconLink,
  IconFingerprint,
  IconShieldCheck,
  IconShieldX,
  IconShield,
  IconCheck,
  IconCopy,
  IconX,
} from "@tabler/icons-react"
import { generateSshKeypair, type SshKeyAlgorithm } from "@/lib/pass-ssh"
import { parseOtpAuthUri } from "@/lib/pass-totp"
import { BITWARDEN_MATCH_LABELS } from "@/lib/pass-matching"
import { calculatePasswordEntropy } from "@/lib/pass-generator"
import { PassGeneratorDialog } from "./pass-generator-dialog"
import { toast } from "sonner"
import type {
  AkaromiSubtype,
  DecryptedCipherData,
  DecryptedLoginData,
  DecryptedNoteData,
  DecryptedCardData,
  DecryptedSshKeyData,
  DecryptedIdentityData,
  DecryptedOtherData,
  PassCipherType,
  LoginUri,
  PasskeyData,
  CustomField,
  BitwardenUriMatch,
} from "@/lib/pass-types"

interface PassCipherModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editCipherId?: string | null
  initialSubtype?: AkaromiSubtype
}

export function PassCipherModal({
  open,
  onOpenChange,
  editCipherId,
  initialSubtype = "login",
}: PassCipherModalProps) {
  const { ciphers, createCipher, updateCipher } = usePass()

  const isEditing = Boolean(editCipherId)
  const existingCipher = ciphers.find((c) => c.id === editCipherId)

  // Subtype state
  const [subtype, setSubtype] = useState<AkaromiSubtype>(initialSubtype)
  const [title, setTitle] = useState("")

  // 1. Login State
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [additionalPasswords, setAdditionalPasswords] = useState<
    { id: string; name: string; value: string; show?: boolean }[]
  >([])
  const [uris, setUris] = useState<LoginUri[]>([
    { uri: "", match: "BASE_DOMAIN" },
  ])
  const [totpSecret, setTotpSecret] = useState("")
  const [passkey, setPasskey] = useState<PasskeyData | null>(null)

  // 2. Note State
  const [noteContent, setNoteContent] = useState("")

  // 3. Card State
  const [cardHolder, setCardHolder] = useState("")
  const [cardNumber, setCardNumber] = useState("")
  const [cardExp, setCardExp] = useState("")
  const [cardCvv, setCardCvv] = useState("")
  const [cardPin, setCardPin] = useState("")
  const [showCardCvv, setShowCardCvv] = useState(false)
  const [showCardPin, setShowCardPin] = useState(false)

  // 4. SSH Key State
  const [sshAlgorithm, setSshAlgorithm] = useState<SshKeyAlgorithm>("ED25519")
  const [publicKey, setPublicKey] = useState("")
  const [privateKey, setPrivateKey] = useState("")
  const [fingerprint, setFingerprint] = useState("")
  const [passphrase, setPassphrase] = useState("")
  const [showPrivateKey, setShowPrivateKey] = useState(false)
  const [isGeneratingSsh, setIsGeneratingSsh] = useState(false)

  // 5. Identity State
  const [fullName, setFullName] = useState("")
  const [identityEmail, setIdentityEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [company, setCompany] = useState("")

  // 6. Custom Fields & Shared Notes
  const [customFields, setCustomFields] = useState<
    { name: string; value: string; isHidden?: boolean }[]
  >([])
  const [notes, setNotes] = useState("")

  // Modals & Refs
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Password entropy calculation
  const pwdEntropy = useMemo(() => {
    return calculatePasswordEntropy(password)
  }, [password])

  // Detect card brand
  const cardBrand = useMemo(() => {
    const raw = cardNumber.replace(/\D/g, "")
    if (raw.startsWith("4")) return "Visa"
    if (/^5[1-5]/.test(raw) || /^2[2-7]/.test(raw)) return "Mastercard"
    if (/^3[47]/.test(raw)) return "Amex"
    if (/^6(?:011|5)/.test(raw)) return "Discover"
    return null
  }, [cardNumber])

  // Populate form on edit or reset
  useEffect(() => {
    if (existingCipher) {
      setTitle(existingCipher.title)

      const rawSubtype =
        existingCipher.data?.itemType ||
        (existingCipher.type === "SSH_KEY" ? "ssh" : "login")
      setSubtype(rawSubtype)

      if (rawSubtype === "login") {
        const d = existingCipher.data as DecryptedLoginData
        setUsername(d.username || "")
        setEmail(d.email || "")
        setPassword(d.password || "")
        setAdditionalPasswords(
          d.additionalPasswords?.map((p) => ({ ...p, show: false })) || []
        )
        setUris(
          d.uris && d.uris.length > 0
            ? d.uris.map((u) => ({
                uri: u.uri,
                match: u.match || "BASE_DOMAIN",
              }))
            : [{ uri: "", match: "BASE_DOMAIN" }]
        )
        setTotpSecret(d.totpSecret || "")
        setPasskey(d.passkey || null)
        setNotes(d.notes || "")
        setCustomFields(d.customFields || [])
      } else if (rawSubtype === "note") {
        const d = existingCipher.data as DecryptedNoteData
        setNoteContent(d.notes || "")
      } else if (rawSubtype === "card") {
        const d = existingCipher.data as DecryptedCardData
        setCardHolder(d.cardHolder || "")
        setCardNumber(d.cardNumber || "")
        setCardExp(d.cardExp || "")
        setCardCvv(d.cardCvv || "")
        setCardPin(d.cardPin || "")
        setNotes(d.notes || "")
      } else if (rawSubtype === "ssh") {
        const d = existingCipher.data as DecryptedSshKeyData
        setSshAlgorithm(d.keyType)
        setPublicKey(d.publicKey || "")
        setPrivateKey(d.privateKey || "")
        setFingerprint(d.fingerprint || "")
        setPassphrase(d.passphrase || "")
        setNotes(d.notes || "")
      } else if (rawSubtype === "identity") {
        const d = existingCipher.data as DecryptedIdentityData
        setFullName(d.fullName || "")
        setIdentityEmail(d.email || "")
        setPhone(d.phone || "")
        setAddress(d.address || "")
        setCompany(d.company || "")
        setNotes(d.notes || "")
      } else if (rawSubtype === "other") {
        const d = existingCipher.data as DecryptedOtherData
        setCustomFields(d.customFields || [])
        setNotes(d.notes || "")
      }
    } else {
      setSubtype(initialSubtype)
      setTitle("")
      setUsername("")
      setEmail("")
      setPassword("")
      setAdditionalPasswords([])
      setUris([{ uri: "", match: "BASE_DOMAIN" }])
      setTotpSecret("")
      setPasskey(null)
      setNoteContent("")
      setCardHolder("")
      setCardNumber("")
      setCardExp("")
      setCardCvv("")
      setCardPin("")
      setSshAlgorithm("ED25519")
      setPublicKey("")
      setPrivateKey("")
      setFingerprint("")
      setPassphrase("")
      setFullName("")
      setIdentityEmail("")
      setPhone("")
      setAddress("")
      setCompany("")
      setCustomFields([])
      setNotes("")
    }
  }, [existingCipher, open, initialSubtype])

  // URI handlers
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



  // Generate SSH Keypair
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

  // Save Item
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error("Please enter a title")
      return
    }

    setIsSubmitting(true)

    try {
      let payload: DecryptedCipherData
      let backendType: PassCipherType = subtype === "ssh" ? "SSH_KEY" : "LOGIN"

      if (subtype === "login") {
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

        const validCustomFields = customFields.filter((cf) => cf.name.trim())

        payload = {
          itemType: "login",
          username: username.trim(),
          email: email.trim() || undefined,
          password,
          additionalPasswords:
            validAdditionalPasswords.length > 0
              ? validAdditionalPasswords
              : undefined,
          uris: validUris,
          totpSecret: totpSecret.trim()
            ? totpSecret.trim().toUpperCase()
            : undefined,
          passkey: passkey || undefined,
          customFields:
            validCustomFields.length > 0 ? validCustomFields : undefined,
          notes: notes.trim() || undefined,
        }
      } else if (subtype === "note") {
        payload = {
          itemType: "note",
          notes: noteContent.trim(),
        }
      } else if (subtype === "card") {
        payload = {
          itemType: "card",
          cardHolder: cardHolder.trim(),
          cardNumber: cardNumber.replace(/\s+/g, ""),
          cardExp: cardExp.trim(),
          cardCvv: cardCvv.trim(),
          cardPin: cardPin.trim() || undefined,
          notes: notes.trim() || undefined,
        }
      } else if (subtype === "ssh") {
        payload = {
          itemType: "ssh",
          keyType: sshAlgorithm,
          publicKey: publicKey.trim(),
          privateKey: privateKey.trim(),
          fingerprint: fingerprint.trim() || "SHA256:unknown",
          passphrase: passphrase.trim() || undefined,
          notes: notes.trim() || undefined,
        }
      } else if (subtype === "identity") {
        payload = {
          itemType: "identity",
          fullName: fullName.trim(),
          email: identityEmail.trim(),
          phone: phone.trim(),
          address: address.trim(),
          company: company.trim() || undefined,
          notes: notes.trim() || undefined,
        }
      } else {
        // other
        payload = {
          itemType: "other",
          customFields: customFields.filter((cf) => cf.name.trim()),
          notes: notes.trim() || undefined,
        }
      }

      if (isEditing && editCipherId) {
        const success = await updateCipher(editCipherId, {
          title: title.trim(),
          payload,
        })
        if (success) {
          onOpenChange(false)
        }
      } else {
        const created = await createCipher({
          type: backendType,
          title: title.trim(),
          payload,
        })
        if (created) {
          onOpenChange(false)
        }
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // Type selector icon
  const getSubtypeIcon = (st: AkaromiSubtype, size = "size-4") => {
    switch (st) {
      case "login":
        return <IconKey className={size} />
      case "note":
        return <IconNote className={size} />
      case "card":
        return <IconCreditCard className={size} />
      case "ssh":
        return <IconTerminal2 className={size} />
      case "identity":
        return <IconId className={size} />
      case "other":
        return <IconFileText className={size} />
    }
  }



  return (
    <Sheet
      isOpen={open}
      onOpenChange={onOpenChange}
      side="right"
      showCloseButton={false}
      className="h-full w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl xl:max-w-4xl border-s border-border bg-card p-0 shadow-2xl"
    >
      <form onSubmit={handleSave} className="flex h-full flex-col overflow-hidden">
        {/* Top Header matching extension modal-sheet-header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/80 px-4 sm:px-6">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="size-8 rounded-full text-muted-foreground hover:text-foreground"
            aria-label="Cancel"
          >
            <IconX className="size-4" />
          </Button>

          <SheetTitle className="font-heading text-sm font-bold text-foreground">
            {isEditing
              ? "Edit Item"
              : subtype === "login"
                ? "New Login"
                : subtype === "note"
                  ? "New Note"
                  : subtype === "card"
                    ? "New Credit Card"
                    : subtype === "ssh"
                      ? "New SSH Key"
                      : subtype === "identity"
                        ? "New Identity"
                        : "New Item"}
          </SheetTitle>

          <Button
            type="submit"
            size="sm"
            isDisabled={isSubmitting || !title.trim()}
            className="h-8 rounded-full px-4 text-xs font-semibold shadow-xs"
          >
            <IconCheck className="me-1 size-3.5" />
            {isSubmitting ? "Saving..." : "Save"}
          </Button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">

          {/* Title Card */}
          <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card/60 p-3.5 shadow-xs">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-foreground">
              {getSubtypeIcon(subtype, "size-5")}
            </div>
            <div className="flex-1">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title (required)"
                autoFocus
                className="h-9 border-none bg-transparent px-1 text-base font-semibold text-foreground shadow-none focus-visible:ring-0"
              />
            </div>
          </div>

          {/* ======================================================== */}
          {/* SUBTYPE: LOGIN */}
          {/* ======================================================== */}
          {subtype === "login" && (
            <div className="space-y-4">
              {/* Credentials Card */}
              <div className="space-y-3 rounded-2xl border border-border/80 bg-card/60 p-4 shadow-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Credentials
                </span>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Username</Label>
                    <Input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Username"
                      className="h-9 rounded-xl text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email address"
                      className="h-9 rounded-xl text-xs"
                    />
                  </div>
                </div>

                {/* Password Input + Generator + Strength Shield */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Password</Label>
                    {password && (
                      <div className="flex items-center gap-1 font-mono text-[11px] font-medium text-foreground">
                        <IconShieldCheck className="size-3.5" />
                        <span>{pwdEntropy.score === 4 ? "100/100" : `${pwdEntropy.score * 25}/100`}</span>
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      className="h-9 rounded-xl pe-20 font-mono text-xs"
                    />
                    <div className="absolute inset-y-0 end-0 flex items-center pe-2">
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? (
                          <IconEyeOff className="size-4" />
                        ) : (
                          <IconEye className="size-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsGeneratorOpen(true)}
                        className="p-1 text-muted-foreground hover:text-foreground"
                        title="Generate Password"
                      >
                        <IconSparkles className="size-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Additional Passwords */}
                {additionalPasswords.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-2 pt-1">
                    <Input
                      value={item.name}
                      onChange={(e) => {
                        const copy = [...additionalPasswords]
                        copy[idx]!.name = e.target.value
                        setAdditionalPasswords(copy)
                      }}
                      placeholder="Password name (e.g. PIN, Recovery)"
                      className="h-8 w-1/3 rounded-xl text-xs"
                    />
                    <Input
                      type={item.show ? "text" : "password"}
                      value={item.value}
                      onChange={(e) => {
                        const copy = [...additionalPasswords]
                        copy[idx]!.value = e.target.value
                        setAdditionalPasswords(copy)
                      }}
                      placeholder="Secondary Password"
                      className="h-8 flex-1 rounded-xl font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const copy = [...additionalPasswords]
                        copy[idx]!.show = !copy[idx]!.show
                        setAdditionalPasswords(copy)
                      }}
                      className="p-1 text-muted-foreground hover:text-foreground"
                    >
                      {item.show ? (
                        <IconEyeOff className="size-3.5" />
                      ) : (
                        <IconEye className="size-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAdditionalPasswords(
                          additionalPasswords.filter((_, i) => i !== idx)
                        )
                      }}
                      className="p-1 text-destructive hover:opacity-80"
                    >
                      <IconTrash className="size-3.5" />
                    </button>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setAdditionalPasswords([
                      ...additionalPasswords,
                      { id: crypto.randomUUID(), name: "", value: "", show: false },
                    ])
                  }
                  className="h-7 gap-1 rounded-lg text-xs text-muted-foreground hover:text-foreground"
                >
                  <IconPlus className="size-3" />
                  <span>Add Password</span>
                </Button>
              </div>

              {/* 2-Step Verification (TOTP) Card */}
              <div className="space-y-3 rounded-2xl border border-border/80 bg-card/60 p-4 shadow-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  2-Step Verification (TOTP)
                </span>
                <Input
                  value={totpSecret}
                  onChange={(e) => setTotpSecret(e.target.value)}
                  placeholder="Enter TOTP secret key..."
                  className="h-9 w-full rounded-xl font-mono text-xs uppercase"
                />
              </div>

              {/* Websites Card */}
              <div className="space-y-3 rounded-2xl border border-border/80 bg-card/60 p-4 shadow-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Websites
                </span>
                <div className="space-y-2">
                  {uris.map((u, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <IconLink className="size-4 shrink-0 text-muted-foreground" />
                      <Input
                        value={u.uri}
                        onChange={(e) => handleUriChange(i, e.target.value)}
                        placeholder="https://example.com"
                        className="h-9 flex-1 rounded-xl text-xs"
                      />
                      <select
                        value={u.match || "BASE_DOMAIN"}
                        onChange={(e) =>
                          handleMatchChange(i, e.target.value as BitwardenUriMatch)
                        }
                        className="h-9 rounded-xl border border-border bg-background px-2 text-xs text-foreground focus:outline-hidden"
                      >
                        {Object.entries(BITWARDEN_MATCH_LABELS).map(
                          ([val, label]) => (
                            <option key={val} value={val}>
                              {label}
                            </option>
                          )
                        )}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemoveUri(i)}
                        className="p-1 text-muted-foreground hover:text-destructive"
                      >
                        <IconTrash className="size-4" />
                      </button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleAddUri}
                    className="h-7 gap-1 rounded-lg text-xs text-muted-foreground hover:text-foreground"
                  >
                    <IconPlus className="size-3" />
                    <span>Add Website</span>
                  </Button>
                </div>
              </div>

              {/* Passkey Card (only if item has an existing passkey) */}
              {isEditing && passkey && (
                <div className="space-y-3 rounded-2xl border border-border/80 bg-card/60 p-4 shadow-xs">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Passkey
                  </span>
                  <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/30 p-3">
                    <div className="flex items-center gap-2">
                      <IconFingerprint className="size-4 text-foreground" />
                      <div>
                        <div className="text-xs font-semibold text-foreground">
                          {passkey.rpId}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Cred ID: {passkey.credentialId.slice(0, 16)}...
                        </div>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPasskey(null)}
                      className="h-7 text-xs text-destructive hover:bg-destructive/10"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* SUBTYPE: NOTE */}
          {/* ======================================================== */}
          {subtype === "note" && (
            <div className="space-y-3 rounded-2xl border border-border/80 bg-card/60 p-4 shadow-xs">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Secure Note Content
              </span>
              <Textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Write your encrypted notes here..."
                rows={10}
                className="resize-y rounded-xl font-mono text-xs"
              />
            </div>
          )}

          {/* ======================================================== */}
          {/* SUBTYPE: CARD */}
          {/* ======================================================== */}
          {subtype === "card" && (
            <div className="space-y-3 rounded-2xl border border-border/80 bg-card/60 p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Card Details
                </span>
                {cardBrand && (
                  <Badge variant="outline" className="border-border text-[11px] font-semibold text-primary">
                    {cardBrand}
                  </Badge>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Cardholder Name</Label>
                <Input
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value)}
                  placeholder="e.g. JANE DOE"
                  className="h-9 rounded-xl text-xs uppercase"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Card Number</Label>
                <Input
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="•••• •••• •••• ••••"
                  className="h-9 rounded-xl font-mono text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Expires</Label>
                  <Input
                    value={cardExp}
                    onChange={(e) => setCardExp(e.target.value)}
                    placeholder="MM/YY"
                    maxLength={5}
                    className="h-9 rounded-xl font-mono text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Security Code</Label>
                  <div className="relative">
                    <Input
                      type={showCardCvv ? "text" : "password"}
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value)}
                      placeholder="CVV"
                      maxLength={4}
                      className="h-9 rounded-xl pe-8 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCardCvv(!showCardCvv)}
                      className="absolute inset-y-0 end-0 flex items-center pe-2 text-muted-foreground hover:text-foreground"
                    >
                      {showCardCvv ? (
                        <IconEyeOff className="size-3.5" />
                      ) : (
                        <IconEye className="size-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="col-span-2 space-y-1 sm:col-span-1">
                  <Label className="text-xs text-muted-foreground">Card PIN (Opt)</Label>
                  <div className="relative">
                    <Input
                      type={showCardPin ? "text" : "password"}
                      value={cardPin}
                      onChange={(e) => setCardPin(e.target.value)}
                      placeholder="PIN"
                      maxLength={8}
                      className="h-9 rounded-xl pe-8 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCardPin(!showCardPin)}
                      className="absolute inset-y-0 end-0 flex items-center pe-2 text-muted-foreground hover:text-foreground"
                    >
                      {showCardPin ? (
                        <IconEyeOff className="size-3.5" />
                      ) : (
                        <IconEye className="size-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SUBTYPE: SSH KEY */}
          {/* ======================================================== */}
          {subtype === "ssh" && (
            <div className="space-y-3 rounded-2xl border border-border/80 bg-card/60 p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  SSH Keypair
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateSsh}
                  isDisabled={isGeneratingSsh}
                  className="h-7 gap-1 rounded-xl text-xs"
                >
                  <IconSparkles className="size-3.5" />
                  <span>{isGeneratingSsh ? "Generating..." : "Generate in Browser"}</span>
                </Button>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Algorithm</Label>
                <select
                  value={sshAlgorithm}
                  onChange={(e) => setSshAlgorithm(e.target.value as SshKeyAlgorithm)}
                  className="h-9 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:outline-hidden"
                >
                  <option value="ED25519">ED25519 (Recommended)</option>
                  <option value="RSA_2048">RSA 2048</option>
                  <option value="RSA_4096">RSA 4096</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Public Key</Label>
                <Textarea
                  value={publicKey}
                  onChange={(e) => setPublicKey(e.target.value)}
                  placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5..."
                  rows={2}
                  className="rounded-xl font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Private Key (PEM)</Label>
                  <button
                    type="button"
                    onClick={() => setShowPrivateKey(!showPrivateKey)}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    {showPrivateKey ? (
                      <>
                        <IconEyeOff className="size-3" /> Hide
                      </>
                    ) : (
                      <>
                        <IconEye className="size-3" /> Reveal
                      </>
                    )}
                  </button>
                </div>
                {showPrivateKey ? (
                  <Textarea
                    value={privateKey}
                    onChange={(e) => setPrivateKey(e.target.value)}
                    placeholder="-----BEGIN OPENSSH PRIVATE KEY-----..."
                    rows={4}
                    className="rounded-xl font-mono text-xs"
                  />
                ) : (
                  <Input
                    type="password"
                    value={privateKey ? "••••••••••••••••••••••••" : ""}
                    readOnly
                    placeholder="No private key attached"
                    className="h-9 rounded-xl font-mono text-xs"
                  />
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Passphrase (Optional)</Label>
                <Input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Key passphrase if encrypted"
                  className="h-9 rounded-xl text-xs"
                />
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SUBTYPE: IDENTITY */}
          {/* ======================================================== */}
          {subtype === "identity" && (
            <div className="space-y-3 rounded-2xl border border-border/80 bg-card/60 p-4 shadow-xs">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Personal Identity
              </span>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Full Name</Label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                    className="h-9 rounded-xl text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <Input
                    type="email"
                    value={identityEmail}
                    onChange={(e) => setIdentityEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="h-9 rounded-xl text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Phone Number</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 012-3456"
                    className="h-9 rounded-xl text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Company</Label>
                  <Input
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Acme Corp"
                    className="h-9 rounded-xl text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Address</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, City, Postal Code"
                  className="h-9 rounded-xl text-xs"
                />
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SUBTYPE: OTHER / CUSTOM FIELDS */}
          {/* ======================================================== */}
          {(subtype === "other" || subtype === "login") && (
            <div className="space-y-3 rounded-2xl border border-border/80 bg-card/60 p-4 shadow-xs">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Custom Fields
              </span>
              <div className="space-y-2">
                {customFields.map((cf, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={cf.name}
                      onChange={(e) => {
                        const next = [...customFields]
                        next[i]!.name = e.target.value
                        setCustomFields(next)
                      }}
                      placeholder="Field Name"
                      className="h-8 w-1/3 rounded-xl text-xs"
                    />
                    <Input
                      type={cf.isHidden ? "password" : "text"}
                      value={cf.value}
                      onChange={(e) => {
                        const next = [...customFields]
                        next[i]!.value = e.target.value
                        setCustomFields(next)
                      }}
                      placeholder="Field Value"
                      className="h-8 flex-1 rounded-xl text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...customFields]
                        next[i]!.isHidden = !next[i]!.isHidden
                        setCustomFields(next)
                      }}
                      className="p-1 text-muted-foreground hover:text-foreground"
                      title={cf.isHidden ? "Reveal" : "Hide/Mask"}
                    >
                      {cf.isHidden ? (
                        <IconEyeOff className="size-3.5" />
                      ) : (
                        <IconEye className="size-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCustomFields(customFields.filter((_, idx) => idx !== i))
                      }
                      className="p-1 text-destructive hover:opacity-80"
                    >
                      <IconTrash className="size-3.5" />
                    </button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setCustomFields([
                      ...customFields,
                      { name: "", value: "", isHidden: false },
                    ])
                  }
                  className="h-7 gap-1 rounded-lg text-xs text-muted-foreground hover:text-foreground"
                >
                  <IconPlus className="size-3" />
                  <span>Add Custom Field</span>
                </Button>
              </div>
            </div>
          )}

          {/* Notes Card (Except note subtype which already has its main note editor) */}
          {subtype !== "note" && (
            <div className="space-y-3 rounded-2xl border border-border/80 bg-card/60 p-4 shadow-xs">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Notes
              </span>

              <div className="space-y-1">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional encrypted notes..."
                  rows={3}
                  className="rounded-xl text-xs"
                />
              </div>
            </div>
          )}
        </div>
      </form>

      {/* Password Generator Dialog */}
      <PassGeneratorDialog
        isOpen={isGeneratorOpen}
        onOpenChange={setIsGeneratorOpen}
        onApplyPassword={(gen: string) => {
          setPassword(gen)
          setShowPassword(true)
          setIsGeneratorOpen(false)
        }}
      />
    </Sheet>
  )
}

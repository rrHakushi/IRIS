"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useTranslations } from "next-intl"
import { useUser } from "@/context/user-context"
import {
  type UserProfileCustomization,
  DEFAULT_PROFILE_CUSTOMIZATION,
} from "@IRIS/shared"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Badge } from "@workspace/ui/components/badge"
import { Switch } from "@workspace/ui/components/switch"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  IconInfoCircle,
  IconCake,
  IconMapPin,
  IconClock,
  IconWorld,
  IconCheck,
  IconRotate2,
} from "@tabler/icons-react"
import { toast } from "sonner"

export interface InfoTabProps {
  onOpenChange?: (open: boolean) => void
  setFooterContent?: (content: React.ReactNode) => void
}

interface CountryOption {
  code: string
  name: string
  flag: string
  label: string
}

interface TimezoneOption {
  id: string
  label: string
  offset: string
}

// Generate all countries dynamically via Intl.DisplayNames
function getAllCountries(): CountryOption[] {
  try {
    const regionNames = new Intl.DisplayNames(["en"], { type: "region" })
    const list: CountryOption[] = []
    for (let i = 65; i <= 90; i++) {
      for (let j = 65; j <= 90; j++) {
        const code = String.fromCharCode(i, j)
        try {
          const name = regionNames.of(code)
          if (name && name !== code && !/^[A-Z]{2}$/.test(name)) {
            const flag = String.fromCodePoint(
              ...[...code].map((c) => 127397 + c.charCodeAt(0))
            )
            list.push({
              code,
              name,
              flag,
              label: `${flag} ${name}`,
            })
          }
        } catch {
          // ignore invalid code
        }
      }
    }
    return list.sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    return []
  }
}

// Generate all standard IANA timezones dynamically with UTC offsets
function getAllTimezones(): TimezoneOption[] {
  try {
    const rawTimezones =
      typeof Intl.supportedValuesOf === "function"
        ? Intl.supportedValuesOf("timeZone")
        : [
            "UTC",
            "America/New_York",
            "America/Chicago",
            "America/Denver",
            "America/Los_Angeles",
            "America/Sao_Paulo",
            "America/Toronto",
            "Europe/London",
            "Europe/Paris",
            "Europe/Berlin",
            "Europe/Warsaw",
            "Asia/Dubai",
            "Asia/Kolkata",
            "Asia/Singapore",
            "Asia/Shanghai",
            "Asia/Tokyo",
            "Asia/Seoul",
            "Australia/Sydney",
            "Pacific/Auckland",
          ]

    const now = new Date()
    return rawTimezones.map((tz) => {
      let offsetStr = ""
      try {
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: tz,
          timeZoneName: "shortOffset",
        }).formatToParts(now)
        const tzPart = parts.find((p) => p.type === "timeZoneName")
        offsetStr = tzPart ? tzPart.value : ""
      } catch {
        offsetStr = ""
      }

      return {
        id: tz,
        offset: offsetStr,
        label: offsetStr ? `${tz} (${offsetStr})` : tz,
      }
    })
  } catch {
    return []
  }
}

export function InfoSettingsTab({
  setFooterContent,
}: InfoTabProps): React.JSX.Element {
  const t = useTranslations("navigation.settings.account.info")
  const { user, updateProfile, isLoading } = useUser()
  const initialProfile = user?.profile || DEFAULT_PROFILE_CUSTOMIZATION

  const [draftProfile, setDraftProfile] =
    useState<UserProfileCustomization>(initialProfile)
  const [savedProfile, setSavedProfile] =
    useState<UserProfileCustomization>(initialProfile)
  const [isSaving, setIsSaving] = useState(false)

  // Dynamic countries and timezones
  const allCountries = useMemo(() => getAllCountries(), [])
  const allTimezones = useMemo(() => getAllTimezones(), [])

  // Separate state for Country and Region
  const [selectedCountry, setSelectedCountry] = useState<string>("")
  const [regionInput, setRegionInput] = useState<string>("")

  // Parse location into country and region
  const parseLocation = (locStr?: string | null) => {
    const raw = (locStr || "").trim()
    if (!raw) {
      setSelectedCountry("")
      setRegionInput("")
      return
    }

    if (raw.includes(",")) {
      const parts = raw.split(",").map((s) => s.trim())
      const possibleCountry = parts.slice(1).join(", ").trim()
      const possibleRegion = parts[0] || ""

      const found = allCountries.find(
        (c) =>
          c.name.toLowerCase() === possibleCountry.toLowerCase() ||
          c.label.toLowerCase() === possibleCountry.toLowerCase()
      )
      if (found) {
        setSelectedCountry(found.name)
        setRegionInput(possibleRegion)
      } else {
        setSelectedCountry("")
        setRegionInput(raw)
      }
    } else {
      const found = allCountries.find(
        (c) =>
          c.name.toLowerCase() === raw.toLowerCase() ||
          c.label.toLowerCase() === raw.toLowerCase()
      )
      if (found) {
        setSelectedCountry(found.name)
        setRegionInput("")
      } else {
        setSelectedCountry("")
        setRegionInput(raw)
      }
    }
  }

  useEffect(() => {
    if (user?.profile) {
      setDraftProfile(user.profile)
      setSavedProfile(user.profile)

      if (user.profile.country || user.profile.region) {
        setSelectedCountry(user.profile.country || "")
        setRegionInput(user.profile.region || "")
      } else {
        parseLocation(user.profile.location)
      }
    }
  }, [user?.profile, allCountries])

  const updateLocation = (country: string, region: string) => {
    const c = country.trim()
    const r = region.trim()
    let combined: string | null = null
    if (r && c) {
      combined = `${r}, ${c}`
    } else if (c) {
      combined = c
    } else if (r) {
      combined = r
    }
    setDraftProfile((prev) => ({
      ...prev,
      country: c || null,
      region: r || null,
      location: combined,
    }))
  }

  const isDirty =
    JSON.stringify(draftProfile) !== JSON.stringify(savedProfile)

  const handleDetectTimezone = () => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (tz) {
        setDraftProfile((prev) => ({ ...prev, timezone: tz }))
        toast.success(`Detected timezone: ${tz}`)
      }
    } catch {
      toast.error("Could not automatically detect your timezone.")
    }
  }

  const handleSave = async () => {
    if (!isDirty || isSaving) return
    setIsSaving(true)
    try {
      const finalProfile: UserProfileCustomization = {
        ...draftProfile,
        country: selectedCountry.trim() || null,
        region: regionInput.trim() || null,
      }
      const updated = await updateProfile(finalProfile)
      if (updated) {
        setSavedProfile(finalProfile)
        setDraftProfile(finalProfile)
        toast.success("Account info updated successfully.")
      } else {
        toast.error("Failed to update account info.")
      }
    } catch {
      toast.error("An error occurred while saving account info.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    setDraftProfile(savedProfile)
    if (savedProfile.country || savedProfile.region) {
      setSelectedCountry(savedProfile.country || "")
      setRegionInput(savedProfile.region || "")
    } else {
      parseLocation(savedProfile.location)
    }
    toast.info("Changes reset.")
  }

  // Push sticky actions into modal footer
  useEffect(() => {
    if (!setFooterContent) return

    setFooterContent(
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          {isDirty && (
            <Badge
              variant="outline"
              className="animate-pulse border-amber-500/40 bg-amber-500/10 text-xs text-amber-400"
            >
              Unsaved changes
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
            className="cursor-pointer rounded-xl text-xs"
          >
            <IconRotate2 data-icon="inline-start" className="size-3.5" />
            Reset
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            disabled={!isDirty || isSaving}
            onPress={handleSave}
            className="cursor-pointer gap-1.5 rounded-xl bg-primary text-xs font-bold text-primary-foreground shadow-xs"
          >
            {isSaving ? (
              <>
                <Spinner className="size-3.5" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <IconCheck data-icon="inline-start" className="size-3.5" />
                <span>Save Changes</span>
              </>
            )}
          </Button>
        </div>
      </div>
    )

    return () => {
      setFooterContent(null)
    }
  }, [isDirty, isSaving, draftProfile, savedProfile, setFooterContent])

  return (
    <div className="w-full max-w-4xl flex-1 animate-in space-y-6 pb-6 duration-200 fade-in-50">
      <div>
        <h3 className="text-base font-bold text-foreground">
          {t("title") || "Account Information"}
        </h3>
      </div>

      <div className="space-y-6">
        {/* Personal Details Card */}
        <Card className="rounded-2xl border border-border/60 bg-card/60 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-bold">
              <IconInfoCircle className="size-4 text-primary" />
              Personal Details
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Birthday Input with Show Year Toggle */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <IconCake className="size-3.5 text-rose-400" />
                  <span>Birthday</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
                  <span>Show birth year</span>
                  <Switch
                    isSelected={draftProfile.showBirthdayYear ?? true}
                    onChange={(checked) =>
                      setDraftProfile((prev) => ({
                        ...prev,
                        showBirthdayYear: checked,
                      }))
                    }
                    isDisabled={isLoading || isSaving}
                  />
                </label>
              </div>
              <Input
                type="date"
                value={draftProfile.birthday || ""}
                onChange={(e) =>
                  setDraftProfile((prev) => ({
                    ...prev,
                    birthday: e.target.value || null,
                  }))
                }
                disabled={isLoading || isSaving}
                className="h-8 text-xs"
              />
            </div>

            {/* Country & Region Row (Separate pickers side-by-side) */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Country Picker */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <IconWorld className="size-3.5 text-emerald-400" />
                  <span>Country</span>
                </label>
                <div className="relative">
                  <input
                    list="countries-list"
                    type="text"
                    placeholder="Select or search country..."
                    value={selectedCountry}
                    onChange={(e) => {
                      const val = e.target.value
                      setSelectedCountry(val)
                      updateLocation(val, regionInput)
                    }}
                    disabled={isLoading || isSaving}
                    className="flex h-8 w-full rounded-xl border border-border/60 bg-muted/20 px-3 py-1 text-xs shadow-2xs transition-colors focus:border-ring focus:outline-hidden placeholder:text-muted-foreground/60"
                  />
                  <datalist id="countries-list">
                    {allCountries.map((c) => (
                      <option key={c.code} value={c.name}>
                        {c.label}
                      </option>
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Region / City / State Input */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <IconMapPin className="size-3.5 text-emerald-400" />
                  <span>Region / City / State</span>
                </label>
                <Input
                  type="text"
                  placeholder="e.g., Tokyo, California, London"
                  value={regionInput}
                  onChange={(e) => {
                    const val = e.target.value
                    setRegionInput(val)
                    updateLocation(selectedCountry, val)
                  }}
                  maxLength={60}
                  disabled={isLoading || isSaving}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Timezone Selection with Auto-detect */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <IconClock className="size-3.5 text-indigo-400" />
                  <span>Timezone</span>
                </label>
                <button
                  type="button"
                  disabled={isLoading || isSaving}
                  onClick={handleDetectTimezone}
                  className="cursor-pointer text-[11px] font-medium text-primary hover:underline"
                >
                  Auto-detect
                </button>
              </div>
              <div className="relative">
                <input
                  list="timezones-list"
                  type="text"
                  placeholder="Select or search timezone (e.g. Asia/Tokyo)..."
                  value={draftProfile.timezone || ""}
                  onChange={(e) => {
                    const rawVal = e.target.value
                    const matched = allTimezones.find(
                      (tz) =>
                        tz.id.toLowerCase() === rawVal.toLowerCase() ||
                        tz.label.toLowerCase() === rawVal.toLowerCase()
                    )
                    const cleanTz = matched ? matched.id : rawVal
                    setDraftProfile((prev) => ({
                      ...prev,
                      timezone: cleanTz || null,
                    }))
                  }}
                  disabled={isLoading || isSaving}
                  className="flex h-8 w-full rounded-xl border border-border/60 bg-muted/20 px-3 py-1 text-xs shadow-2xs transition-colors focus:border-ring focus:outline-hidden placeholder:text-muted-foreground/60"
                />
                <datalist id="timezones-list">
                  {allTimezones.map((tz) => (
                    <option key={tz.id} value={tz.id}>
                      {tz.label}
                    </option>
                  ))}
                </datalist>
              </div>
            </div>

            {/* Website URL */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <IconWorld className="size-3.5 text-sky-400" />
                <span>Website / Portfolio</span>
              </label>
              <Input
                type="url"
                placeholder="https://yourwebsite.com"
                value={draftProfile.website || ""}
                onChange={(e) =>
                  setDraftProfile((prev) => ({
                    ...prev,
                    website: e.target.value || null,
                  }))
                }
                maxLength={200}
                disabled={isLoading || isSaving}
                className="h-8 text-xs"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import {
  IconSparkles,
  IconCopy,
  IconRefresh,
  IconCheck,
  IconKey,
  IconTypography,
} from "@tabler/icons-react"
import {
  generatePassword,
  generatePassphrase,
  calculatePasswordEntropy,
  type PasswordGeneratorOptions,
  type PassphraseGeneratorOptions,
} from "@/lib/pass-generator"
import { toast } from "sonner"

type GeneratorMode = "password" | "passphrase"

export default function GeneratorPage() {
  const [mode, setMode] = useState<GeneratorMode>("password")

  // Password options (up to 256 characters)
  const [pwdOptions, setPwdOptions] = useState<PasswordGeneratorOptions>({
    length: 20,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
    minNumbers: 2,
    minSymbols: 2,
    avoidAmbiguous: false,
  })

  // Passphrase options (up to 32 words)
  const [phraseOptions, setPhraseOptions] =
    useState<PassphraseGeneratorOptions>({
      wordCount: 4,
      separator: "-",
      capitalize: true,
      includeNumber: true,
    })

  // Generated value
  const [generatedValue, setGeneratedValue] = useState("")
  const [copied, setCopied] = useState(false)

  const regenerate = () => {
    if (mode === "password") {
      setGeneratedValue(generatePassword(pwdOptions))
    } else {
      setGeneratedValue(generatePassphrase(phraseOptions))
    }
  }

  // Regenerate when mode or options change
  useEffect(() => {
    regenerate()
  }, [mode, pwdOptions, phraseOptions])

  // Entropy & strength
  const entropyInfo = useMemo(() => {
    return calculatePasswordEntropy(generatedValue)
  }, [generatedValue])

  const handleCopy = () => {
    if (!generatedValue) return
    navigator.clipboard.writeText(generatedValue)
    setCopied(true)
    toast.success("Copied to clipboard")
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
            <IconSparkles className="size-4" />
          </div>
          <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">
            Password Generator
          </h1>
        </div>

        {/* Mode Selector */}
        <div className="flex gap-1 rounded-xl bg-muted/60 p-1">
          <button
            type="button"
            onClick={() => setMode("password")}
            className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              mode === "password"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <IconKey className="size-3.5" />
            Password
          </button>
          <button
            type="button"
            onClick={() => setMode("passphrase")}
            className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              mode === "passphrase"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <IconTypography className="size-3.5" />
            Passphrase
          </button>
        </div>
      </div>

      {/* Main Output Box */}
      <div className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <span className="mb-1 block text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              Generated {mode === "password" ? "Password" : "Passphrase"}
            </span>
            <div className="font-mono text-lg font-semibold tracking-wide break-all text-foreground select-all selection:bg-rose-500/20 sm:text-2xl">
              {generatedValue || "..."}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={regenerate}
              aria-label="Regenerate"
              className="size-10 cursor-pointer rounded-2xl hover:bg-muted"
            >
              <IconRefresh className="size-4" />
            </Button>
            <Button
              onClick={handleCopy}
              className="h-10 cursor-pointer gap-1.5 rounded-2xl bg-rose-500 px-4 text-xs font-semibold text-white shadow-xs hover:bg-rose-600"
            >
              {copied ? (
                <>
                  <IconCheck className="size-4" />
                  Copied
                </>
              ) : (
                <>
                  <IconCopy className="size-4" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Entropy & Strength Meter */}
        <div className="space-y-1.5 border-t border-border/60 pt-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Entropy:</span>
              <span className="font-mono font-semibold text-foreground">
                {entropyInfo.entropyBits} bits
              </span>
            </div>
            <span
              className={`text-[11px] font-semibold tracking-wider uppercase ${
                entropyInfo.score === 4
                  ? "text-emerald-500"
                  : entropyInfo.score === 3
                    ? "text-blue-500"
                    : entropyInfo.score === 2
                      ? "text-amber-500"
                      : "text-rose-500"
              }`}
            >
              {entropyInfo.label}
            </span>
          </div>

          {/* Strength Bar */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/80">
            <div
              className={`h-full transition-all duration-300 ${
                entropyInfo.score === 4
                  ? "w-full bg-emerald-500"
                  : entropyInfo.score === 3
                    ? "w-3/4 bg-blue-500"
                    : entropyInfo.score === 2
                      ? "w-1/2 bg-amber-500"
                      : "w-1/4 bg-rose-500"
              }`}
            />
          </div>
        </div>
      </div>

      {/* Configuration Controls */}
      <div className="space-y-6 rounded-3xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-heading text-sm font-bold text-foreground">
          Options
        </h2>

        {mode === "password" && (
          <div className="space-y-5">
            {/* Length Slider up to 256 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <Label
                  htmlFor="length-slider"
                  className="font-medium text-foreground"
                >
                  Password Length
                </Label>
                <span className="font-mono font-bold text-foreground">
                  {pwdOptions.length} characters
                </span>
              </div>
              <input
                id="length-slider"
                type="range"
                min={8}
                max={256}
                value={pwdOptions.length}
                onChange={(e) =>
                  setPwdOptions({
                    ...pwdOptions,
                    length: Number(e.target.value),
                  })
                }
                className="w-full cursor-pointer accent-rose-500"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>8</span>
                <span>32</span>
                <span>64</span>
                <span>128</span>
                <span>256</span>
              </div>
            </div>

            {/* Checkbox Toggles */}
            <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-background p-3 transition-colors hover:bg-muted/40">
                <input
                  type="checkbox"
                  checked={pwdOptions.uppercase}
                  onChange={(e) =>
                    setPwdOptions({
                      ...pwdOptions,
                      uppercase: e.target.checked,
                    })
                  }
                  className="size-4 rounded accent-rose-500"
                />
                <div>
                  <span className="block text-xs font-semibold text-foreground">
                    Uppercase Letters (A-Z)
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    ABCDEFGHIJK
                  </span>
                </div>
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-background p-3 transition-colors hover:bg-muted/40">
                <input
                  type="checkbox"
                  checked={pwdOptions.lowercase}
                  onChange={(e) =>
                    setPwdOptions({
                      ...pwdOptions,
                      lowercase: e.target.checked,
                    })
                  }
                  className="size-4 rounded accent-rose-500"
                />
                <div>
                  <span className="block text-xs font-semibold text-foreground">
                    Lowercase Letters (a-z)
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    abcdefghijk
                  </span>
                </div>
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-background p-3 transition-colors hover:bg-muted/40">
                <input
                  type="checkbox"
                  checked={pwdOptions.numbers}
                  onChange={(e) =>
                    setPwdOptions({ ...pwdOptions, numbers: e.target.checked })
                  }
                  className="size-4 rounded accent-rose-500"
                />
                <div>
                  <span className="block text-xs font-semibold text-foreground">
                    Numbers (0-9)
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    0123456789
                  </span>
                </div>
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-background p-3 transition-colors hover:bg-muted/40">
                <input
                  type="checkbox"
                  checked={pwdOptions.symbols}
                  onChange={(e) =>
                    setPwdOptions({ ...pwdOptions, symbols: e.target.checked })
                  }
                  className="size-4 rounded accent-rose-500"
                />
                <div>
                  <span className="block text-xs font-semibold text-foreground">
                    Special Symbols
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    !@#$%^&*-_=+
                  </span>
                </div>
              </label>
            </div>

            {/* Ambiguous filter toggle */}
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-background p-3 transition-colors hover:bg-muted/40">
              <input
                type="checkbox"
                checked={pwdOptions.avoidAmbiguous}
                onChange={(e) =>
                  setPwdOptions({
                    ...pwdOptions,
                    avoidAmbiguous: e.target.checked,
                  })
                }
                className="size-4 rounded accent-rose-500"
              />
              <div>
                <span className="block text-xs font-semibold text-foreground">
                  Avoid Ambiguous Characters
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Excludes easily confused characters: 0, O, 1, l, I, |
                </span>
              </div>
            </label>
          </div>
        )}

        {mode === "passphrase" && (
          <div className="space-y-5">
            {/* Word Count Slider up to 32 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <Label
                  htmlFor="words-slider"
                  className="font-medium text-foreground"
                >
                  Number of Words
                </Label>
                <span className="font-mono font-bold text-foreground">
                  {phraseOptions.wordCount} words
                </span>
              </div>
              <input
                id="words-slider"
                type="range"
                min={3}
                max={32}
                value={phraseOptions.wordCount}
                onChange={(e) =>
                  setPhraseOptions({
                    ...phraseOptions,
                    wordCount: Number(e.target.value),
                  })
                }
                className="w-full cursor-pointer accent-rose-500"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>3 words</span>
                <span>6 words</span>
                <span>12 words</span>
                <span>20 words</span>
                <span>32 words</span>
              </div>
            </div>

            {/* Separator selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                Word Separator
              </Label>
              <div className="flex gap-2">
                {["-", "_", " ", ".", "/"].map((sep) => (
                  <button
                    key={sep}
                    type="button"
                    onClick={() =>
                      setPhraseOptions({ ...phraseOptions, separator: sep })
                    }
                    className={`size-9 cursor-pointer rounded-xl border font-mono text-xs font-bold transition-colors ${
                      phraseOptions.separator === sep
                        ? "border-rose-500 bg-rose-500/10 text-rose-500"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {sep === " " ? "space" : sep}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-background p-3 transition-colors hover:bg-muted/40">
                <input
                  type="checkbox"
                  checked={phraseOptions.capitalize}
                  onChange={(e) =>
                    setPhraseOptions({
                      ...phraseOptions,
                      capitalize: e.target.checked,
                    })
                  }
                  className="size-4 rounded accent-rose-500"
                />
                <div>
                  <span className="block text-xs font-semibold text-foreground">
                    Capitalize Words
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    e.g. Correct-Horse-Battery-Staple
                  </span>
                </div>
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-background p-3 transition-colors hover:bg-muted/40">
                <input
                  type="checkbox"
                  checked={phraseOptions.includeNumber}
                  onChange={(e) =>
                    setPhraseOptions({
                      ...phraseOptions,
                      includeNumber: e.target.checked,
                    })
                  }
                  className="size-4 rounded accent-rose-500"
                />
                <div>
                  <span className="block text-xs font-semibold text-foreground">
                    Include Random Number
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Appends a secure 2-digit number for compliance
                  </span>
                </div>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

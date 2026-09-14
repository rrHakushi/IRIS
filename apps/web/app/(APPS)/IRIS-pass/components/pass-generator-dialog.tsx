"use client"

import React, { useState, useEffect, useMemo } from "react"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import {
  IconSparkles,
  IconRefresh,
  IconCopy,
  IconCheck,
  IconKey,
} from "@tabler/icons-react"
import {
  generatePassword,
  calculatePasswordEntropy,
  type PasswordGeneratorOptions,
} from "@/lib/pass-generator"
import { toast } from "sonner"

export interface PassGeneratorDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onApplyPassword: (password: string) => void
}

export function PassGeneratorDialog({
  isOpen,
  onOpenChange,
  onApplyPassword,
}: PassGeneratorDialogProps): React.JSX.Element {
  const [options, setOptions] = useState<PasswordGeneratorOptions>({
    length: 24,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
    minNumbers: 2,
    minSymbols: 2,
    avoidAmbiguous: false,
  })

  const [generatedPassword, setGeneratedPassword] = useState("")
  const [copied, setCopied] = useState(false)

  const regenerate = () => {
    setGeneratedPassword(generatePassword(options))
  }

  useEffect(() => {
    if (isOpen) {
      regenerate()
    }
  }, [isOpen, options])

  const entropyInfo = useMemo(() => {
    return calculatePasswordEntropy(generatedPassword)
  }, [generatedPassword])

  const handleCopy = () => {
    if (!generatedPassword) return
    navigator.clipboard.writeText(generatedPassword)
    setCopied(true)
    toast.success("Copied to clipboard")
    setTimeout(() => setCopied(false), 2000)
  }

  const handleApply = () => {
    onApplyPassword(generatedPassword)
    onOpenChange(false)
    toast.success("Password applied")
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} className="sm:max-w-lg">
      <DialogHeader className="text-start">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
            <IconSparkles className="size-4" />
          </div>
          <DialogTitle className="text-base font-bold text-foreground font-heading">
            Password Generator
          </DialogTitle>
        </div>
      </DialogHeader>

      <div className="space-y-4 pt-1">
        {/* Output card */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between gap-3">
            <div className="font-mono text-base sm:text-lg font-semibold tracking-wide text-foreground break-all select-all min-w-0 flex-1">
              {generatedPassword}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={regenerate}
                aria-label="Regenerate"
                className="rounded-xl cursor-pointer"
              >
                <IconRefresh className="size-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={handleCopy}
                aria-label="Copy"
                className="rounded-xl cursor-pointer"
              >
                {copied ? (
                  <IconCheck className="size-3.5 text-emerald-500" />
                ) : (
                  <IconCopy className="size-3.5" />
                )}
              </Button>
            </div>
          </div>

          {/* Entropy bar */}
          <div className="space-y-1 pt-1 border-t border-border/50">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">
                Entropy: {entropyInfo.entropyBits} bits
              </span>
              <span
                className={`font-semibold ${
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
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
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

        {/* Length Slider (up to 256) */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <Label htmlFor="gen-modal-length" className="font-medium text-foreground">
              Length
            </Label>
            <span className="font-mono font-bold text-foreground">
              {options.length} characters
            </span>
          </div>
          <input
            id="gen-modal-length"
            type="range"
            min={8}
            max={256}
            value={options.length}
            onChange={(e) =>
              setOptions({ ...options, length: Number(e.target.value) })
            }
            className="w-full accent-rose-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>8</span>
            <span>32</span>
            <span>64</span>
            <span>128</span>
            <span>256</span>
          </div>
        </div>

        {/* Character toggles */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="flex items-center gap-2 p-2 rounded-xl border border-border bg-background cursor-pointer hover:bg-muted/40 transition-colors">
            <input
              type="checkbox"
              checked={options.uppercase}
              onChange={(e) =>
                setOptions({ ...options, uppercase: e.target.checked })
              }
              className="rounded size-3.5 accent-rose-500"
            />
            <span className="text-foreground text-[11px] font-medium">A-Z (Uppercase)</span>
          </label>

          <label className="flex items-center gap-2 p-2 rounded-xl border border-border bg-background cursor-pointer hover:bg-muted/40 transition-colors">
            <input
              type="checkbox"
              checked={options.lowercase}
              onChange={(e) =>
                setOptions({ ...options, lowercase: e.target.checked })
              }
              className="rounded size-3.5 accent-rose-500"
            />
            <span className="text-foreground text-[11px] font-medium">a-z (Lowercase)</span>
          </label>

          <label className="flex items-center gap-2 p-2 rounded-xl border border-border bg-background cursor-pointer hover:bg-muted/40 transition-colors">
            <input
              type="checkbox"
              checked={options.numbers}
              onChange={(e) =>
                setOptions({ ...options, numbers: e.target.checked })
              }
              className="rounded size-3.5 accent-rose-500"
            />
            <span className="text-foreground text-[11px] font-medium">0-9 (Numbers)</span>
          </label>

          <label className="flex items-center gap-2 p-2 rounded-xl border border-border bg-background cursor-pointer hover:bg-muted/40 transition-colors">
            <input
              type="checkbox"
              checked={options.symbols}
              onChange={(e) =>
                setOptions({ ...options, symbols: e.target.checked })
              }
              className="rounded size-3.5 accent-rose-500"
            />
            <span className="text-foreground text-[11px] font-medium">!@#$ (Symbols)</span>
          </label>
        </div>

        {/* Ambiguous filter */}
        <label className="flex items-center gap-2 p-2 rounded-xl border border-border bg-background cursor-pointer hover:bg-muted/40 transition-colors text-xs">
          <input
            type="checkbox"
            checked={options.avoidAmbiguous}
            onChange={(e) =>
              setOptions({ ...options, avoidAmbiguous: e.target.checked })
            }
            className="rounded size-3.5 accent-rose-500"
          />
          <span className="text-foreground text-[11px]">
            Avoid ambiguous characters (0, O, 1, l, I)
          </span>
        </label>
      </div>

      <DialogFooter className="pt-3 flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          className="rounded-xl text-xs"
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleApply}
          className="rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold"
        >
          <IconKey className="size-3.5 me-1.5" />
          Use Password
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

"use client"

import React, { memo, useState } from "react"
import { IconSparkles, IconCopy, IconCheck } from "@tabler/icons-react"
import { toast } from "sonner"
import { cn } from "@workspace/ui/lib/utils"

export interface KiroshiAnswersCardProps {
  answers: string[]
  className?: string
}

export const KiroshiAnswersCard = memo(function KiroshiAnswersCard({
  answers,
  className,
}: KiroshiAnswersCardProps): React.JSX.Element | null {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  if (!answers || answers.length === 0) return null

  const handleCopy = (ans: string, index: number) => {
    navigator.clipboard.writeText(ans)
    setCopiedIndex(index)
    toast.success("Quick answer copied to clipboard")
    setTimeout(() => {
      setCopiedIndex(null)
    }, 2000)
  }

  return (
    <div className={cn("space-y-3 min-w-0 w-full", className)}>
      {answers.map((ans, idx) => (
        <div
          key={idx}
          className="relative rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:p-5 text-start shadow-xs backdrop-blur-sm space-y-2 min-w-0 w-full overflow-hidden transition-all duration-200 hover:border-primary/40"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              <IconSparkles className="size-4 shrink-0" />
              <span>Quick Answer</span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(ans, idx)}
              className="rounded-lg p-1 text-muted-foreground/70 transition-colors hover:bg-primary/10 hover:text-primary"
              title="Copy answer"
              aria-label="Copy answer"
            >
              {copiedIndex === idx ? (
                <IconCheck className="size-3.5 text-emerald-500" />
              ) : (
                <IconCopy className="size-3.5" />
              )}
            </button>
          </div>
          <p className="text-sm sm:text-base leading-relaxed text-foreground/95 break-words">
            {ans}
          </p>
        </div>
      ))}
    </div>
  )
})

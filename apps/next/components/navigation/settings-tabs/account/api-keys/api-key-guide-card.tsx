"use client"

import React, { useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import {
  IconCopy,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconTerminal2,
  IconBrandJavascript,
  IconBrandPython,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { cn } from "@workspace/ui/lib/utils"

type SnippetTab = "curl" | "fetch" | "python"

export function ApiKeyGuideCard(): React.JSX.Element {
  const t = useTranslations("navigation.settings.account.apiKeys")
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<SnippetTab>("curl")
  const [copied, setCopied] = useState(false)

  const snippets: Record<SnippetTab, string> = {
    curl: `curl -X GET "http://localhost:4000/users/me" \\
  -H "x-api: <YOUR_API_KEY>"`,
    fetch: `// JavaScript / TypeScript
const res = await fetch("http://localhost:4000/users/me", {
  headers: {
    "x-api": "<YOUR_API_KEY>",
    "Content-Type": "application/json",
  },
});
const data = await res.json();
console.log(data);`,
    python: `# Python (requests)
import requests

url = "http://localhost:4000/users/me"
headers = {
    "x-api": "<YOUR_API_KEY>",
    "Content-Type": "application/json"
}

response = requests.get(url, headers=headers)
print(response.json())`,
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippets[activeTab])
      setCopied(true)
      toast.success(t("snippetCopiedSuccess"))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t("failedCopySnippet"))
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-muted/15 shadow-2xs transition-all">
      {/* Accordion Header */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex w-full cursor-pointer items-center justify-between p-4 text-start transition-colors hover:bg-muted/25 sm:p-4.5"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <IconTerminal2 className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-foreground">
                {t("guideTitle")}
              </h4>
              <Badge
                variant="outline"
                className="h-4.5 border-border px-1.5 text-[10px] text-muted-foreground"
              >
                {t("developerBadge")}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("guideDescription", { header: "x-api" })}
            </p>
          </div>
        </div>

        <div className="pl-2 text-muted-foreground">
          {isExpanded ? (
            <IconChevronUp className="size-4.5" />
          ) : (
            <IconChevronDown className="size-4.5" />
          )}
        </div>
      </button>

      {/* Accordion Body */}
      {isExpanded && (
        <div className="animate-in space-y-3.5 border-t border-border/40 p-4 pt-1 duration-150 fade-in-50 sm:p-5 sm:pt-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Language Selector */}
            <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-background/60 p-1">
              <button
                type="button"
                onClick={() => setActiveTab("curl")}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                  activeTab === "curl"
                    ? "bg-muted font-semibold text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <IconTerminal2 className="size-3.5" />
                <span>cURL</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("fetch")}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                  activeTab === "fetch"
                    ? "bg-muted font-semibold text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <IconBrandJavascript className="size-3.5" />
                <span>Fetch (JS)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("python")}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                  activeTab === "python"
                    ? "bg-muted font-semibold text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <IconBrandPython className="size-3.5" />
                <span>Python</span>
              </button>
            </div>

            {/* Copy Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="h-7 gap-1.5 rounded-lg px-2.5 text-xs"
            >
              {copied ? (
                <>
                  <IconCheck className="size-3.5 text-emerald-400" />
                  <span>{t("copied")}</span>
                </>
              ) : (
                <>
                  <IconCopy className="size-3.5" />
                  <span>{t("copySnippet")}</span>
                </>
              )}
            </Button>
          </div>

          {/* Code display block */}
          <div className="relative overflow-x-auto rounded-xl border border-border/70 bg-background/90 p-3.5 font-mono text-xs text-foreground">
            <pre className="leading-relaxed whitespace-pre-wrap select-all">
              {snippets[activeTab]}
            </pre>
          </div>

          <p className="text-[11px] text-muted-foreground">
            {t("headerNote", {
              headers: "x-api-key, apikey",
              param: "?api_key=...",
            })}
          </p>
        </div>
      )}
    </div>
  )
}

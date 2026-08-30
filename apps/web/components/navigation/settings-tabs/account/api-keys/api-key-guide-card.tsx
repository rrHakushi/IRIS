"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import {
  IconCopy,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconTerminal2,
  IconBrandJavascript,
  IconBrandPython,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@workspace/ui/lib/utils";

type SnippetTab = "curl" | "fetch" | "python";

export function ApiKeyGuideCard(): React.JSX.Element {
  const t = useTranslations("navigation.settings.account.apiKeys");
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<SnippetTab>("curl");
  const [copied, setCopied] = useState(false);

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
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippets[activeTab]);
      setCopied(true);
      toast.success(t("snippetCopiedSuccess"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("failedCopySnippet"));
    }
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-muted/15 overflow-hidden transition-all shadow-2xs">
      {/* Accordion Header */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between p-4 sm:p-4.5 hover:bg-muted/25 transition-colors cursor-pointer text-start"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <IconTerminal2 className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-sm text-foreground">
                {t("guideTitle")}
              </h4>
              <Badge variant="outline" className="text-[10px] h-4.5 px-1.5 text-muted-foreground border-border">
                {t("developerBadge")}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("guideDescription", { header: "x-api" })}
            </p>
          </div>
        </div>

        <div className="text-muted-foreground pl-2">
          {isExpanded ? (
            <IconChevronUp className="size-4.5" />
          ) : (
            <IconChevronDown className="size-4.5" />
          )}
        </div>
      </button>

      {/* Accordion Body */}
      {isExpanded && (
        <div className="p-4 pt-1 sm:p-5 sm:pt-1 space-y-3.5 border-t border-border/40 animate-in fade-in-50 duration-150">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Language Selector */}
            <div className="flex items-center gap-1 bg-background/60 p-1 rounded-xl border border-border/50">
              <button
                type="button"
                onClick={() => setActiveTab("curl")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                  activeTab === "curl"
                    ? "bg-muted text-foreground shadow-2xs font-semibold"
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
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                  activeTab === "fetch"
                    ? "bg-muted text-foreground shadow-2xs font-semibold"
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
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                  activeTab === "python"
                    ? "bg-muted text-foreground shadow-2xs font-semibold"
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
              className="h-7 text-xs rounded-lg px-2.5 gap-1.5"
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
          <div className="relative rounded-xl border border-border/70 bg-background/90 p-3.5 font-mono text-xs text-foreground overflow-x-auto">
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
  );
}

"use client";

import React, { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@workspace/ui/components/button";
import { Textarea } from "@workspace/ui/components/textarea";
import { cn } from "@workspace/ui/lib/utils";
import {
  IconBold,
  IconItalic,
  IconStrikethrough,
  IconLink,
  IconQuote,
  IconCode,
  IconList,
  IconHeading,
  IconEye,
  IconEdit,
} from "@tabler/icons-react";

export interface MarkdownBioEditorProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  disabled?: boolean;
}

/**
 * Lightweight and safe client-side markdown formatter for user bios.
 */
export function renderBioMarkdown(markdown: string, emptyText?: React.ReactNode): React.ReactNode {
  if (!markdown || !markdown.trim()) {
    return (
      <span className="text-xs italic text-muted-foreground/60">
        {emptyText ?? "No bio provided yet. Tell others about yourself!"}
      </span>
    );
  }

  const lines = markdown.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (rawLine === undefined) continue;
    const line = rawLine;

    if (!line.trim()) {
      elements.push(<div key={i} className="h-2" />);
      continue;
    }

    // Heading ###
    if (line.startsWith("### ")) {
      elements.push(
        <h4 key={i} className="text-xs font-bold text-foreground mt-1 mb-0.5">
          {formatInline(line.slice(4))}
        </h4>
      );
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h3 key={i} className="text-sm font-bold text-foreground mt-1 mb-0.5">
          {formatInline(line.slice(3))}
        </h3>
      );
      continue;
    }
    if (line.startsWith("# ")) {
      elements.push(
        <h2 key={i} className="text-sm font-black text-foreground mt-1 mb-0.5">
          {formatInline(line.slice(2))}
        </h2>
      );
      continue;
    }

    // Blockquote >
    if (line.startsWith("> ")) {
      elements.push(
        <blockquote
          key={i}
          className="border-l-2 border-primary/60 pl-2.5 py-0.5 text-xs text-muted-foreground italic my-1 bg-primary/5 rounded-r"
        >
          {formatInline(line.slice(2))}
        </blockquote>
      );
      continue;
    }

    // Unordered List -
    if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <div key={i} className="flex items-start gap-1.5 text-xs text-foreground/90 pl-1">
          <span className="text-primary font-bold text-xs select-none">•</span>
          <span>{formatInline(line.slice(2))}</span>
        </div>
      );
      continue;
    }

    // Normal paragraph line
    elements.push(
      <p key={i} className="text-xs leading-relaxed text-foreground/90 break-words">
        {formatInline(line)}
      </p>
    );
  }

  return <div className="space-y-1">{elements}</div>;
}

function formatInline(text: string): React.ReactNode {
  // Regex parsing for bold, italic, code, strikethrough, and links
  const tokens: React.ReactNode[] = [];
  let remaining = text;
  let keyIdx = 0;

  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/^(\*\*|__)(.*?)\1/);
    if (boldMatch) {
      tokens.push(
        <strong key={keyIdx++} className="font-bold text-foreground">
          {boldMatch[2]}
        </strong>
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Strikethrough: ~~text~~
    const strikeMatch = remaining.match(/^~~(.*?)~~/);
    if (strikeMatch) {
      tokens.push(
        <del key={keyIdx++} className="line-through text-muted-foreground">
          {strikeMatch[1]}
        </del>
      );
      remaining = remaining.slice(strikeMatch[0].length);
      continue;
    }

    // Code: `code`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      tokens.push(
        <code
          key={keyIdx++}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-primary border border-border/50"
        >
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Link: [title](url)
    const linkMatch = remaining.match(/^\[(.*?)\]\((https?:\/\/[^\s)]+)\)/);
    if (linkMatch) {
      tokens.push(
        <a
          key={keyIdx++}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline hover:text-primary/80 transition-colors inline-flex items-center gap-0.5"
        >
          {linkMatch[1]}
        </a>
      );
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Italic: *text* or _text_
    const italicMatch = remaining.match(/^(\*|_)(.*?)\1/);
    if (italicMatch) {
      tokens.push(
        <em key={keyIdx++} className="italic text-foreground/90">
          {italicMatch[2]}
        </em>
      );
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Plain text character
    const plainChar = remaining[0];
    const nextSpecial = remaining.slice(1).search(/[\*\_\[\`\~]/);
    if (nextSpecial === -1) {
      tokens.push(remaining);
      break;
    } else {
      tokens.push(remaining.slice(0, nextSpecial + 1));
      remaining = remaining.slice(nextSpecial + 1);
    }
  }

  return tokens;
}

export function MarkdownBioEditor({
  value,
  onChange,
  maxLength = 500,
  disabled = false,
}: MarkdownBioEditorProps): React.JSX.Element {
  const t = useTranslations("navigation.settings.account.profile");
  const [tab, setTab] = useState<"write" | "preview">("write");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const charCount = value.length;
  const isNearLimit = charCount > maxLength * 0.9;
  const isAtLimit = charCount >= maxLength;

  const insertFormatting = (prefix: string, suffix = "", placeholder = "text") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = textarea.value;

    const selectedText = currentVal.substring(start, end) || placeholder;
    const replacement = `${prefix}${selectedText}${suffix}`;

    const newVal = currentVal.substring(0, start) + replacement + currentVal.substring(end);
    if (newVal.length > maxLength) return;

    onChange(newVal);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + selectedText.length
      );
    }, 10);
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/40 p-4 shadow-2xs">
      {/* Header toolbar & tabs */}
      <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant={tab === "write" ? "secondary" : "ghost"}
            size="sm"
            onPress={() => setTab("write")}
            className="h-7 px-2.5 text-xs font-medium gap-1 rounded-lg"
          >
            <IconEdit data-icon="inline-start" className="size-3.5" />
            {t("write")}
          </Button>
          <Button
            type="button"
            variant={tab === "preview" ? "secondary" : "ghost"}
            size="sm"
            onPress={() => setTab("preview")}
            className="h-7 px-2.5 text-xs font-medium gap-1 rounded-lg"
          >
            <IconEye data-icon="inline-start" className="size-3.5" />
            {t("preview")}
          </Button>
        </div>

        {tab === "write" && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={disabled}
              onClick={() => insertFormatting("**", "**", "bold text")}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 cursor-pointer"
              title={t("boldTitle")}
            >
              <IconBold className="size-4" />
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => insertFormatting("*", "*", "italic text")}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 cursor-pointer"
              title={t("italicTitle")}
            >
              <IconItalic className="size-4" />
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => insertFormatting("~~", "~~", "strikethrough text")}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 cursor-pointer"
              title={t("strikeTitle")}
            >
              <IconStrikethrough className="size-4" />
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => insertFormatting("### ", "", "heading")}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 cursor-pointer"
              title={t("headingTitle")}
            >
              <IconHeading className="size-4" />
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => insertFormatting("> ", "", "quote")}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 cursor-pointer"
              title={t("quoteTitle")}
            >
              <IconQuote className="size-4" />
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => insertFormatting("`", "`", "code")}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 cursor-pointer"
              title={t("codeTitle")}
            >
              <IconCode className="size-4" />
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => insertFormatting("- ", "", "item")}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 cursor-pointer"
              title={t("listTitle")}
            >
              <IconList className="size-4" />
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => insertFormatting("[", "](https://example.com)", "link text")}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 cursor-pointer"
              title={t("linkTitle")}
            >
              <IconLink className="size-4" />
            </button>
          </div>
        )}
      </div>

      {/* Editor or Preview Pane */}
      {tab === "write" ? (
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={value}
            disabled={disabled}
            maxLength={maxLength}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t("bioPlaceholder")}
            rows={5}
            className="w-full resize-y min-h-[130px] text-xs bg-background/50 border-border/50 focus-visible:ring-primary/40 rounded-xl leading-relaxed p-3"
          />
        </div>
      ) : (
        <div className="min-h-[130px] p-3.5 rounded-xl bg-muted/20 border border-border/40 overflow-y-auto max-h-60">
          {renderBioMarkdown(value, t("noBio"))}
        </div>
      )}

      {/* Footer info: Character Count */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
        <span>{t("formattingSupport")}</span>
        <span
          className={cn(
            "font-mono font-medium",
            isAtLimit ? "text-red-500 font-bold" : isNearLimit ? "text-amber-500" : "text-muted-foreground"
          )}
        >
          {charCount} / {maxLength}
        </span>
      </div>
    </div>
  );
}

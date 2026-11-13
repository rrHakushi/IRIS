"use client"

import React, { useState, useMemo, useCallback } from "react"
import Link from "next/link"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkBreaks from "remark-breaks"
import {
  IconCopy,
  IconCheck,
  IconExternalLink,
  IconEye,
  IconEyeOff,
} from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"
import { toast } from "sonner"

export interface MarkdownRendererProps {
  /** The markdown text to render */
  content?: string | null
  /** Optional placeholder when content is empty */
  emptyText?: React.ReactNode
  /** Additional CSS class names for the outer container */
  className?: string
  /** Whether to preserve consecutive spaces and hard line breaks. Defaults to true. */
  preserveSpaces?: boolean
  /** Optional custom base font size variant ('xs' | 'sm' | 'base'). Defaults to 'xs'. */
  size?: "xs" | "sm" | "base"
}

/** Helper to extract plain text string recursively from React children */
function extractTextFromChildren(children: React.ReactNode): string {
  if (typeof children === "string") return children
  if (typeof children === "number") return String(children)
  if (Array.isArray(children)) {
    return children.map(extractTextFromChildren).join("")
  }
  if (React.isValidElement(children) && (children.props as any)?.children) {
    return extractTextFromChildren((children.props as any).children)
  }
  return ""
}

/** Pre-block with language label and copy code button */
function PreBlock({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLPreElement>) {
  const [copied, setCopied] = useState(false)

  const rawCode = useMemo(() => {
    return extractTextFromChildren(children).replace(/\n$/, "")
  }, [children])

  const handleCopy = useCallback(async () => {
    if (!rawCode) return
    try {
      await navigator.clipboard.writeText(rawCode)
      setCopied(true)
      toast.success("Code copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Failed to copy code")
    }
  }, [rawCode])

  return (
    <div className="group relative my-2.5 overflow-hidden rounded-xl border border-border/60 bg-muted/40 shadow-2xs">
      <div className="flex items-center justify-between border-b border-border/40 bg-muted/60 px-3 py-1 font-mono text-[10px] text-muted-foreground select-none">
        <span>code</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground"
          title="Copy code"
        >
          {copied ? (
            <>
              <IconCheck className="size-3 text-emerald-500" />
              <span className="font-sans text-emerald-500">Copied</span>
            </>
          ) : (
            <>
              <IconCopy className="size-3" />
              <span className="font-sans">Copy</span>
            </>
          )}
        </button>
      </div>
      <pre
        className={cn(
          "overflow-x-auto p-3 font-mono text-[11px] leading-relaxed whitespace-pre text-foreground/90",
          className
        )}
        {...props}
      >
        {children}
      </pre>
    </div>
  )
}

/** Spoiler span component with click-to-reveal blur */
function SpoilerSpan({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false)

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => setRevealed((prev) => !prev)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          setRevealed((prev) => !prev)
        }
      }}
      title={revealed ? "Click to hide spoiler" : "Click to reveal spoiler"}
      className={cn(
        "py-0.2 inline-flex cursor-pointer items-center gap-1 rounded px-1.5 text-xs transition-all duration-200 select-none",
        revealed
          ? "bg-muted/80 text-foreground"
          : "bg-muted text-transparent blur-[4px] hover:blur-[2px]"
      )}
    >
      {revealed ? (
        <IconEyeOff className="inline size-3 shrink-0 text-muted-foreground select-none" />
      ) : (
        <IconEye className="inline size-3 shrink-0 text-muted-foreground select-none" />
      )}
      <span>{children}</span>
    </span>
  )
}

/** Safe URL protocol validator to prevent XSS (blocks javascript:, data:, vbscript:) */
function isSafeUrl(url?: unknown): url is string {
  if (typeof url !== "string") return false
  const trimmed = url.trim().toLowerCase()
  if (
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("vbscript:") ||
    trimmed.startsWith("data:")
  ) {
    return false
  }
  return true
}

/**
 * Universal Markdown Renderer for IRIS.
 *
 * Fully supports:
 * - CommonMark & GitHub Flavored Markdown (GFM)
 * - Tables, task lists, nested lists, blockquotes, code blocks
 * - Whitespace preservation: consecutive spaces ("spaces included") & single newline breaks
 * - Safe internal/external links with Tabler icons
 * - Mauve/Rose theme system compliance
 */
export function MarkdownRenderer({
  content,
  emptyText,
  className,
  preserveSpaces = true,
  size = "xs",
}: MarkdownRendererProps): React.JSX.Element {
  // Empty content state
  if (!content || !content.trim()) {
    return (
      <div
        className={cn(
          "text-muted-foreground/60 italic select-none",
          size === "xs" && "text-xs",
          size === "sm" && "text-sm",
          size === "base" && "text-base",
          className
        )}
      >
        {emptyText ?? "No content provided."}
      </div>
    )
  }

  // Preprocess custom spoilers: ~!spoiler!~ or ||spoiler|| into HTML span if needed
  // Note: react-markdown handles standard GFM out-of-the-box.
  const remarkPlugins = useMemo(() => {
    return preserveSpaces ? [remarkGfm, remarkBreaks] : [remarkGfm]
  }, [preserveSpaces])

  const sizeClasses = {
    xs: "text-xs leading-relaxed",
    sm: "text-sm leading-relaxed",
    base: "text-base leading-relaxed",
  }[size]

  return (
    <div
      className={cn(
        "markdown-content break-words text-foreground/90",
        preserveSpaces && "[overflow-wrap:anywhere] whitespace-pre-wrap",
        sizeClasses,
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        components={{
          // Headings
          h1: ({ children, ...props }) => (
            <h1
              className="mt-3 mb-1.5 font-heading text-base font-black tracking-tight text-foreground first:mt-0"
              {...props}
            >
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2
              className="mt-2.5 mb-1 font-heading text-sm font-bold tracking-tight text-foreground first:mt-0"
              {...props}
            >
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3
              className="mt-2 mb-1 font-heading text-xs font-bold tracking-wider text-primary uppercase first:mt-0"
              {...props}
            >
              {children}
            </h3>
          ),
          h4: ({ children, ...props }) => (
            <h4
              className="mt-1.5 mb-0.5 text-xs font-bold text-foreground first:mt-0"
              {...props}
            >
              {children}
            </h4>
          ),
          h5: ({ children, ...props }) => (
            <h5
              className="mt-1 mb-0.5 text-xs font-semibold text-muted-foreground first:mt-0"
              {...props}
            >
              {children}
            </h5>
          ),
          h6: ({ children, ...props }) => (
            <h6
              className="mt-1 mb-0.5 text-[11px] font-medium text-muted-foreground uppercase first:mt-0"
              {...props}
            >
              {children}
            </h6>
          ),

          // Paragraph
          p: ({ children, ...props }) => (
            <p className="mb-2 leading-relaxed last:mb-0" {...props}>
              {children}
            </p>
          ),

          // Strong & Emphasis
          strong: ({ children, ...props }) => (
            <strong className="font-bold text-foreground" {...props}>
              {children}
            </strong>
          ),
          em: ({ children, ...props }) => (
            <em className="text-foreground/95 italic" {...props}>
              {children}
            </em>
          ),
          del: ({ children, ...props }) => (
            <del className="text-muted-foreground line-through" {...props}>
              {children}
            </del>
          ),

          // Blockquote
          blockquote: ({ children, ...props }) => (
            <blockquote
              className="my-2 rounded-e-lg border-s-2 border-primary/60 bg-primary/5 py-1 ps-3 pe-2 text-muted-foreground italic"
              {...props}
            >
              {children}
            </blockquote>
          ),

          // Code blocks & Inline code
          pre: ({ children, ...props }) => (
            <PreBlock {...props}>{children}</PreBlock>
          ),
          code: ({ className, children, ...props }) => {
            const hasLang = /language-(\w+)/.test(className || "")
            const text = String(children)
            // If it's inline code (no language class and no newlines)
            if (!hasLang && !text.includes("\n")) {
              return (
                <code
                  className="rounded border border-border/50 bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-primary"
                  {...props}
                >
                  {children}
                </code>
              )
            }
            return (
              <code
                className={cn("font-mono text-[11px]", className)}
                {...props}
              >
                {children}
              </code>
            )
          },

          // Unordered & Ordered Lists
          ul: ({ children, ...props }) => (
            <ul
              className="my-1.5 list-disc space-y-1 ps-5 text-foreground/90"
              {...props}
            >
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol
              className="my-1.5 list-decimal space-y-1 ps-5 text-foreground/90"
              {...props}
            >
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => {
            return (
              <li className="leading-relaxed" {...props}>
                {children}
              </li>
            )
          },

          // Horizontal rule
          hr: ({ ...props }) => (
            <hr className="my-3 border-border/50" {...props} />
          ),

          // Links (Internal vs External with security guard)
          a: ({ href, children, ...props }) => {
            if (!isSafeUrl(href)) {
              return <span>{children}</span>
            }

            const cleanHref = href || "#"
            const isInternal =
              cleanHref.startsWith("/") ||
              cleanHref.startsWith("#") ||
              cleanHref.startsWith("?")

            if (isInternal) {
              return (
                <Link
                  href={cleanHref}
                  className="font-medium text-primary underline underline-offset-2 transition-colors hover:text-primary/80"
                  {...props}
                >
                  {children}
                </Link>
              )
            }

            return (
              <a
                href={cleanHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 font-medium text-primary underline underline-offset-2 transition-colors hover:text-primary/80"
                {...props}
              >
                <span>{children}</span>
                <IconExternalLink className="inline size-3 shrink-0 opacity-70" />
              </a>
            )
          },

          // Tables
          table: ({ children, ...props }) => (
            <div className="my-2.5 overflow-x-auto rounded-xl border border-border/60 shadow-2xs">
              <table
                className="w-full border-collapse text-start text-xs whitespace-normal"
                {...props}
              >
                {children}
              </table>
            </div>
          ),
          thead: ({ children, ...props }) => (
            <thead
              className="border-b border-border/60 bg-muted/40 text-muted-foreground"
              {...props}
            >
              {children}
            </thead>
          ),
          tbody: ({ children, ...props }) => (
            <tbody className="divide-y divide-border/30" {...props}>
              {children}
            </tbody>
          ),
          tr: ({ children, ...props }) => (
            <tr className="transition-colors hover:bg-muted/20" {...props}>
              {children}
            </tr>
          ),
          th: ({ children, ...props }) => (
            <th
              className="px-3 py-2 text-start font-bold text-foreground"
              {...props}
            >
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td className="px-3 py-2 text-foreground/90" {...props}>
              {children}
            </td>
          ),

          // Images
          img: ({ src, alt, ...props }) => {
            if (!isSafeUrl(src)) return null
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={alt || "Markdown Image"}
                loading="lazy"
                className="my-2 max-h-96 max-w-full rounded-xl border border-border/50 object-contain shadow-xs"
                {...props}
              />
            )
          },

          // Task list item checkbox
          input: ({ type, checked, disabled, ...props }) => {
            if (type === "checkbox") {
              return (
                <input
                  type="checkbox"
                  checked={checked}
                  disabled
                  className="me-1.5 size-3.5 rounded border-border align-middle accent-primary"
                  {...props}
                />
              )
            }
            return <input type={type} disabled={disabled} {...props} />
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

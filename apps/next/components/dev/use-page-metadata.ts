"use client"

import { useState, useEffect, useCallback } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import type {
  PageMetadataInfo,
  RawMetaTag,
  DiagnosticItem,
  DiagnosticStatus,
} from "./types"

export function usePageMetadata() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [metadata, setMetadata] = useState<PageMetadataInfo>({
    url: "",
    pathname: "",
    title: "",
    description: "",
    canonical: "",
    favicon: "",
    themeColor: "",
    robots: "",
    openGraph: {
      title: "",
      description: "",
      image: "",
      siteName: "",
      type: "",
      url: "",
    },
    twitter: {
      card: "",
      title: "",
      description: "",
      image: "",
      site: "",
      creator: "",
    },
    rawTags: [],
  })

  const extractMetadata = useCallback(() => {
    if (typeof window === "undefined" || !document) return

    const head = document.head
    const title = document.title || ""

    const getMeta = (query: string): string => {
      const el = head.querySelector(`meta${query}`)
      return el?.getAttribute("content")?.trim() || ""
    }

    const description =
      getMeta('[name="description"]') || getMeta('[property="og:description"]')

    const ogTitle = getMeta('[property="og:title"]') || title
    const ogDescription = getMeta('[property="og:description"]') || description
    const ogImage = getMeta('[property="og:image"]')
    const ogSiteName = getMeta('[property="og:site_name"]') || "IRIS"
    const ogType = getMeta('[property="og:type"]') || "website"
    const ogUrl = getMeta('[property="og:url"]') || window.location.href

    const twitterCard =
      getMeta('[name="twitter:card"]') ||
      getMeta('[name="twitter:card" i]') ||
      (ogImage ? "summary_large_image" : "summary")
    const twitterTitle = getMeta('[name="twitter:title"]') || ogTitle || title
    const twitterDescription =
      getMeta('[name="twitter:description"]') || ogDescription || description
    const twitterImage =
      getMeta('[name="twitter:image"]') ||
      getMeta('[name="twitter:image:src"]') ||
      ogImage
    const twitterSite = getMeta('[name="twitter:site"]')
    const twitterCreator = getMeta('[name="twitter:creator"]')

    const themeColor =
      getMeta('[name="theme-color"]') ||
      getMeta('[name="theme_color"]') ||
      "#e11d48" // Rose accent fallback

    const robots = getMeta('[name="robots"]')

    const canonicalEl = head.querySelector('link[rel="canonical"]')
    const canonical =
      canonicalEl?.getAttribute("href")?.trim() || window.location.href

    const iconEl =
      head.querySelector('link[rel="icon"]') ||
      head.querySelector('link[rel="shortcut icon"]')
    const favicon = iconEl?.getAttribute("href") || "/favicon.ico"

    // Raw tags collection
    const rawTags: RawMetaTag[] = []

    if (title) {
      rawTags.push({
        id: "title",
        tag: "title",
        key: "<title>",
        value: title,
        rawHtml: `<title>${title}</title>`,
      })
    }

    head.querySelectorAll("meta").forEach((el, index) => {
      const name =
        el.getAttribute("name") ||
        el.getAttribute("property") ||
        el.getAttribute("http-equiv") ||
        el.getAttribute("charset") ||
        `meta-${index}`
      const content =
        el.getAttribute("content") || el.getAttribute("charset") || ""

      rawTags.push({
        id: `meta-${index}-${name}`,
        tag: "meta",
        key: name,
        value: content,
        rawHtml: el.outerHTML,
      })
    })

    head
      .querySelectorAll('link[rel="canonical"], link[rel*="icon"]')
      .forEach((el, index) => {
        const rel = el.getAttribute("rel") || "link"
        const href = el.getAttribute("href") || ""

        rawTags.push({
          id: `link-${index}-${rel}`,
          tag: "link",
          key: `link[rel="${rel}"]`,
          value: href,
          rawHtml: el.outerHTML,
        })
      })

    setMetadata({
      url: window.location.href,
      pathname: window.location.pathname,
      title,
      description,
      canonical,
      favicon,
      themeColor,
      robots,
      openGraph: {
        title: ogTitle,
        description: ogDescription,
        image: ogImage,
        siteName: ogSiteName,
        type: ogType,
        url: ogUrl,
      },
      twitter: {
        card: twitterCard,
        title: twitterTitle,
        description: twitterDescription,
        image: twitterImage,
        site: twitterSite,
        creator: twitterCreator,
      },
      rawTags,
    })
  }, [])

  useEffect(() => {
    // Initial extraction & microtask delay to allow Next.js head updates to commit
    const timer = setTimeout(extractMetadata, 60)

    // Observe changes to document.head
    if (typeof window !== "undefined" && document?.head) {
      const observer = new MutationObserver(() => {
        extractMetadata()
      })

      observer.observe(document.head, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      })

      return () => {
        clearTimeout(timer)
        observer.disconnect()
      }
    }

    return () => clearTimeout(timer)
  }, [pathname, searchParams, extractMetadata])

  // Compute diagnostics
  const diagnostics: DiagnosticItem[] = []

  // Title diagnostics
  if (!metadata.title) {
    diagnostics.push({
      id: "title-missing",
      label: "Page Title",
      status: "fail",
      message: "Missing <title> tag.",
      recommendation:
        "Define 'title' in your route's metadata or generateMetadata().",
    })
  } else if (metadata.title.length < 15) {
    diagnostics.push({
      id: "title-short",
      label: "Page Title",
      status: "warn",
      message: `Title is short (${metadata.title.length} chars).`,
      recommendation: "Aim for 30–60 characters to optimize search visibility.",
      value: metadata.title,
    })
  } else if (metadata.title.length > 60) {
    diagnostics.push({
      id: "title-long",
      label: "Page Title",
      status: "warn",
      message: `Title may be truncated (${metadata.title.length} chars).`,
      recommendation:
        "Google typically truncates titles over 60 characters on desktop.",
      value: metadata.title,
    })
  } else {
    diagnostics.push({
      id: "title-pass",
      label: "Page Title",
      status: "pass",
      message: `Optimal title length (${metadata.title.length} characters).`,
      value: metadata.title,
    })
  }

  // Description diagnostics
  if (!metadata.description) {
    diagnostics.push({
      id: "desc-missing",
      label: "Meta Description",
      status: "fail",
      message: "Missing meta description.",
      recommendation:
        "Add 'description' in metadata. Platforms will show an empty snippet or fall back to page body.",
    })
  } else if (metadata.description.length < 50) {
    diagnostics.push({
      id: "desc-short",
      label: "Meta Description",
      status: "warn",
      message: `Description is brief (${metadata.description.length} chars).`,
      recommendation:
        "Aim for 50–160 characters for complete search snippets and Discord previews.",
      value: metadata.description,
    })
  } else if (metadata.description.length > 160) {
    diagnostics.push({
      id: "desc-long",
      label: "Meta Description",
      status: "warn",
      message: `Description may truncate (${metadata.description.length} chars).`,
      recommendation:
        "Google search snippets typically truncate around 155–160 characters.",
      value: metadata.description,
    })
  } else {
    diagnostics.push({
      id: "desc-pass",
      label: "Meta Description",
      status: "pass",
      message: `Optimal description length (${metadata.description.length} characters).`,
      value: metadata.description,
    })
  }

  // Open Graph Image
  if (!metadata.openGraph.image) {
    diagnostics.push({
      id: "og-image-missing",
      label: "Open Graph Image",
      status: "warn",
      message: "Missing og:image tag.",
      recommendation:
        "Discord, Twitter, and LinkedIn will not display rich image preview cards without og:image.",
    })
  } else {
    const isRelative =
      metadata.openGraph.image.startsWith("/") ||
      !metadata.openGraph.image.startsWith("http")

    if (isRelative) {
      diagnostics.push({
        id: "og-image-relative",
        label: "Open Graph Image",
        status: "warn",
        message: "Relative image URL detected.",
        recommendation:
          "Social bots require absolute URLs (https://...). Configure 'metadataBase' in your root layout.",
        value: metadata.openGraph.image,
      })
    } else {
      diagnostics.push({
        id: "og-image-pass",
        label: "Open Graph Image",
        status: "pass",
        message: "Absolute image URL configured.",
        value: metadata.openGraph.image,
      })
    }
  }

  // Twitter Card
  if (!metadata.twitter.card) {
    diagnostics.push({
      id: "twitter-card-missing",
      label: "Twitter Card",
      status: "warn",
      message: "twitter:card is not explicitly specified.",
      recommendation:
        "Set 'twitter: { card: \"summary_large_image\" }' in metadata for full-width preview banners on X.",
    })
  } else {
    diagnostics.push({
      id: "twitter-card-pass",
      label: "Twitter Card",
      status: "pass",
      message: `Card type configured as "${metadata.twitter.card}".`,
      value: metadata.twitter.card,
    })
  }

  // Canonical tag
  if (!metadata.canonical) {
    diagnostics.push({
      id: "canonical-info",
      label: "Canonical URL",
      status: "info",
      message: "No canonical link specified; using current URL.",
      recommendation:
        "Set 'alternates: { canonical: ... }' to prevent duplicate content indexing.",
    })
  } else {
    diagnostics.push({
      id: "canonical-pass",
      label: "Canonical URL",
      status: "pass",
      message: "Canonical URL link detected.",
      value: metadata.canonical,
    })
  }

  const passCount = diagnostics.filter((d) => d.status === "pass").length
  const warnCount = diagnostics.filter(
    (d) => d.status === "warn" || d.status === "fail"
  ).length

  return {
    metadata,
    diagnostics,
    passCount,
    warnCount,
    refresh: extractMetadata,
  }
}

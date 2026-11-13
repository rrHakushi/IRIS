export interface RawMetaTag {
  id: string
  tag: "meta" | "link" | "title"
  key: string
  value: string
  rawHtml: string
}

export interface PageMetadataInfo {
  url: string
  pathname: string
  title: string
  description: string
  canonical: string
  favicon: string
  themeColor: string
  robots: string
  openGraph: {
    title: string
    description: string
    image: string
    siteName: string
    type: string
    url: string
  }
  twitter: {
    card: string
    title: string
    description: string
    image: string
    site: string
    creator: string
  }
  rawTags: RawMetaTag[]
}

export type DiagnosticStatus = "pass" | "warn" | "fail" | "info"

export interface DiagnosticItem {
  id: string
  label: string
  status: DiagnosticStatus
  message: string
  recommendation?: string
  value?: string
}

export type DevToolCorner =
  "bottom-end" | "bottom-start" | "top-end" | "top-start"

export type SocialPlatformId =
  "discord" | "twitter" | "google" | "slack" | "facebook" | "telegram"

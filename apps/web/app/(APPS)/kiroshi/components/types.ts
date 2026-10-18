import type React from "react"

export interface SearchResult {
  title: string
  url: string
  content: string
  engine?: string
  engines?: string[]
  publishedDate?: string | Date | null
  thumbnail?: string | null
  img_src?: string | null
  resolution?: string | null
  template?: string
  score?: number
}

export interface InfoboxItem {
  infobox: string
  id?: string | null
  content?: string | null
  img_src?: string | null
  urls?: Array<{ title?: string | null; url?: string | null }>
  attributes?: Array<{ label?: string | null; value?: string | null }> | any[]
}

export interface HistoryItem {
  id: string
  type?: string
  query: string
  category: string
  url?: string
  title?: string
  thumbnail?: string
  createdAt: string
}

export interface SearchCategoryItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

export interface SearchFilterState {
  timeRange: string
  language: string
  safeSearch: string
}

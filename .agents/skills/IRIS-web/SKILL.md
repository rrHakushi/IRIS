---
name: IRIS-web
description: Comprehensive architecture, API data fetching, and UI guidelines for the IRIS web application (@IRIS/web, Next.js App Router). Use whenever writing, reviewing, refactoring, or building React components, pages, forms, hooks, or client logic in apps/web. Enforces Eden Treaty (@/lib/elysia) for all API requests (never fetch/axios), strict end-to-end type safety (never `(elysia as any)` or `any`/`unknown`), shadcn UI primitives (@workspace/ui), and adherence to design.md.
---

# IRIS Web Architecture & Development Guide

`@IRIS/web` is the primary frontend for the IRIS ecosystem, built on **Next.js (App Router)**, **React 19**, **Tailwind CSS v4**, and **shadcn/ui** (`aria-rhea` variant). It communicates with the Elysia backend via **Eden Treaty**.

---

## 1. Golden Rules (Non-Negotiable)

### 1. NEVER Use `fetch()` or `axios` — Use `elysia` Only
- **All API requests MUST use the typed Eden Treaty client**:
  ```typescript
  import { elysia } from "@/lib/elysia"
  ```
- **Never use `fetch()`, `window.fetch()`, or `axios`** anywhere in `apps/web`, whether in Server Components, Client Components, or hooks, unless explicitly requested by the user.
- Eden Treaty automatically handles serialization, query parameters, path variables, base URL routing, and cookie propagation (`credentials: "include"`).

### 2. NEVER Do `(elysia as any)` — Fix Problematic Types
- **Never cast `elysia` or its route chains to `any`**:
  ```typescript
  // ❌ STRICTLY FORBIDDEN
  const res = await (elysia as any).user({ username }).favorites.get()
  const data = (elysia.media as any).anime.get()
  ```
- If a route is missing, has incorrect parameters, or type inference yields `{}` or `never`:
  1. **Inform the user** about the type discrepancy.
  2. **Fix the backend route** in `apps/elysia/src/modules/.../route.ts` by defining explicit per-method schemas (`schemas: { GET: ..., POST: ... }`).
  3. Let the Elysia dev watcher automatically regenerate `routes.generated.ts`.
  4. Once regenerated, the route will be fully typed end-to-end on `elysia` with complete IDE autocompletion.

### 3. Everything Must Be End-to-End Typed — Never `any` or `unknown`
- **Zero loose `any`**: Every prop, state variable, API payload, and response object must be strictly typed.
- **No untyped `unknown`**: When handling unknown responses or errors, validate them with TypeBox, Zod, or narrow them with type guards.
- **Exported DTO types**: Import route response types directly from `@IRIS/elysia` (e.g. `import type { AnimeDetails, PersonDetails } from "@IRIS/elysia"`).

### 4. Use shadcn UI Variants ONLY (`@workspace/ui`)
- For all basic interactive components and form elements, use the shadcn UI primitives from `@workspace/ui/components/...`:
  - **Button**: `import { Button } from "@workspace/ui/components/button"`
  - **Input**: `import { Input } from "@workspace/ui/components/input"`
  - **Tooltip**: `import { Tooltip, TooltipTrigger } from "@workspace/ui/components/tooltip"`
  - **Badge**: `import { Badge } from "@workspace/ui/components/badge"`
  - **Switch**: `import { Switch } from "@workspace/ui/components/switch"`
  - **Card**: `import { Card, CardHeader, CardTitle, CardContent } from "@workspace/ui/components/card"`
  - **Dialog / Modal**: `import { Dialog, DialogContent, DialogTrigger } from "@workspace/ui/components/dialog"`
  - **Dropdown Menu**: `import { DropdownMenu, DropdownMenuContent, ... } from "@workspace/ui/components/dropdown-menu"`
- **Never use raw HTML elements** like `<button>`, `<input>`, or `<select>` when a shadcn variant exists.
- **If a shadcn component is missing**: Download / install it via the shadcn CLI:
  ```bash
  pnpm --filter @workspace/ui dlx shadcn@latest add <component-name>
  ```

### 5. Strictly Adhere to `design.md`
- **Design System Reference**: Always check [design.md](file:///c:/Users/yki/Documents/GitHub/IRIS/design.md) for UI, geometry, and styling decisions.
- **Style Variant**: `aria-rhea` (soft-curved geometric radius scale, `rounded-2xl` for buttons, badges, inputs).
- **Color Palette**: Mauve base neutrals, Rose accent (`--primary`, `bg-primary`, `text-primary`), Red chart palette (`--chart-1` to `--chart-5`).
- **Icons**: `@tabler/icons-react` exclusively (default `size-4`). No Lucide, no FontAwesome.
- **RTL / LTR**: Use logical CSS utilities (`ps-*`, `pe-*`, `ms-*`, `me-*`, `text-start`, `text-end`) for full bidirectional compatibility.
- **Aesthetic**: Clean, purpose-driven shadcn aesthetic with zero unnecessary decorative bloat.

---

## 2. Eden Treaty Data Fetching Patterns

### Client Components (`"use client"`)

```typescript
"use client"

import React, { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { elysia } from "@/lib/elysia"
import { toast } from "sonner"

export function ItemStatus({ itemId }: { itemId: number }) {
  const { data: session, status } = useSession()
  const username = session?.user?.username
  const isAuthenticated = status === "authenticated" && Boolean(username)

  const [itemData, setItemData] = useState<ItemType | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Deduplication ref to prevent double-fetching in React 19 StrictMode
  const lastFetchedKeyRef = useRef<string | null>(null)
  const isFetchingRef = useRef(false)

  useEffect(() => {
    if (!isAuthenticated || !username || !itemId) return

    const fetchKey = `${username}:${itemId}`
    if (lastFetchedKeyRef.current === fetchKey || isFetchingRef.current) return

    lastFetchedKeyRef.current = fetchKey
    isFetchingRef.current = true
    let isMounted = true

    async function load() {
      setIsLoading(true)
      try {
        const { data, error } = await elysia
          .user({ username })
          .items({ itemId })
          .get()

        if (isMounted && !error && data) {
          setItemData(data)
        }
      } catch {
        // Handle error cleanly
      } finally {
        isFetchingRef.current = false
        if (isMounted) setIsLoading(false)
      }
    }

    load()

    return () => {
      isMounted = false
    }
  }, [isAuthenticated, username, itemId])

  // ...
}
```

### Server Components & Pages (SSR)

```typescript
// app/(APPS)/IRIS-list/media/anime/[id]/page.tsx
import { notFound } from "next/navigation"
import { elysia } from "@/lib/elysia"
import type { AnimeDetails } from "@IRIS/elysia"

interface Props {
  params: Promise<{ id: string }>
}

export default async function AnimePage({ params }: Props) {
  const { id } = await params
  const numericId = parseInt(id, 10)
  if (isNaN(numericId) || numericId <= 0) notFound()

  // Parallel data fetching without waterfalls
  const [animeRes, similarRes] = await Promise.all([
    elysia.media.anime({ id: numericId }).get(),
    elysia.media.anime({ id: numericId }).similar.get({ query: { limit: 20 } }),
  ])

  if (animeRes.error || !animeRes.data) {
    notFound()
  }

  const anime: AnimeDetails = animeRes.data

  return <AnimeDetailView anime={anime} similar={similarRes.data ?? []} />
}
```

---

## 3. Authentication & User Session Resolution

- Always resolve the authenticated username directly via:
  ```typescript
  const username = session?.user?.username
  ```
- Do not use `@me` in client routes or Eden Treaty calls; always pass the real username.
- Check authentication state via:
  ```typescript
  const isAuthenticated = status === "authenticated" && Boolean(session?.user?.username)
  ```

---

## 4. Troubleshooting & Type Mismatches

| Problem | Cause | Solution |
|---|---|---|
| Property `'xyz'` does not exist on type `elysia...` | Route was newly created or renamed, or manifest wasn't updated | Backend dev server auto-regenerates `routes.generated.ts`. If missing, check backend route export in `apps/elysia/src/modules/` |
| Route handler accepts `{}` or body is missing | In Elysia 2.0, `defineRoute` needs explicit `schemas: { [METHOD]: { params, body, query } }` | Define explicit per-method schemas in backend `route.ts`. Never cast with `as any`. Inform user and fix backend schema. |
| URL numeric param validates as string (400 Bad Request) | `t.Numeric` was used instead of `t.Number` in path params | Use `t.Number({ minimum: 1 })` in `params` schema so Elysia compiles numeric parameter coercion. |
| Double fetching on mount | React 19 StrictMode double-mounting effects + NextAuth session transition | Add `lastFetchedKeyRef` and `isFetchingRef` deduplication guards to `useEffect`. |

---

## 5. Companion Skills

- [design.md](file:///c:/Users/yki/Documents/GitHub/IRIS/design.md): Authoritative design system, tokens, colors, and styling rules.
- [IRIS-elysia](file:///c:/Users/yki/Documents/GitHub/IRIS/.agents/skills/IRIS-elysia/SKILL.md): Backend architecture, routing, TypeBox schemas, and Eden Treaty manifest generator.
- [shadcn](file:///c:/Users/yki/Documents/GitHub/IRIS/.agents/skills/shadcn/SKILL.md): Managing, adding, and configuring shadcn UI primitives.

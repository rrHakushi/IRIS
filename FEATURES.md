# IRIS Feature & Module Architecture

> **IRIS** is a high-performance, privacy-focused media tracking, scrobbling, and social platform built on a modern TypeScript monorepo architecture (Bun + Elysia 2.0 backend, Next.js App Router frontend, and modular Prisma database).

---

## Architecture Overview

```mermaid
graph TD
    Client[Web Client (Next.js 15 / Eden Treaty)]
    Gateway[Elysia Backend (Bun Server)]
    DB[(PostgreSQL / Modular Prisma)]
    Redis[(Redis Cache / LRU Fallback)]
    Ext[Third-Party APIs: AniList, MAL, Steam, Deezer, etc.]

    Client --> Gateway
    Gateway --> DB
    Gateway --> Redis
    Gateway --> Ext
```

---

## 1. `IRIS-account` (Identity, Authentication & Security)

### Core Authentication & Security
- **Email & Password Authentication**: Standard registration, login, email verification, password reset, and secure password modification flows with Argon2 hashing.
- **WebAuthn / Passkeys**:
  - Registration ceremony (`/auth/passkeys/register`, `/auth/passkeys/register/verify`).
  - Passwordless authentication ceremony (`/auth/passkeys/login`, `/auth/passkeys/login/verify`).
  - Key management and revocation (`/auth/passkeys/[id]`).
- **Two-Factor Authentication (2FA / TOTP)**:
  - Time-based one-time password generation, secret setup (`/auth/totp/setup`), and QR verification (`/auth/totp/toggle`).
  - Backup code generation, hashing, and recovery rotation (`/auth/backupcodes/regenerate`).
- **QuickConnect**:
  - Passwordless cross-device instant login via pairing codes (`/auth/quickconnect/generate`, `/status`, and `/approve`).
- **API Key Management**:
  - Fine-grained developer token generation (`/auth/api-keys`), permission scoping, regeneration, and lifecycle revocation (`/auth/api-keys/[id]`).

### User Profiles & Public Presence
- **Identity & Profile Customization**: Username management, bio, custom avatar, banner styling, and public badge display (`/users/[username]`).
- **Asset Storage & Serving**: Direct media asset serving and uploads for avatars and profile banners (`/users/me/assets`, `/public/[...key]`).
- **Post-Quantum End-to-End Encryption Setup**: Public encryption key derivation and storage (`/users/me/encryption`) for secure real-time messaging and notifications.

### Notification System
- **Real-Time Encrypted Notifications**: Instant dispatch over WebSockets (`wsHub`) with post-quantum client-side crypto compatibility.
- **Lifecycle Management**: Paginated notification inbox, single item read mark (`/notifications/[id]/read`), bulk mark all as read (`/notifications/mark-all-read`), and interactive notification action handling (`/notifications/[id]/action`).

---

## 2. `IRIS-connections` (Third-Party Integrations & Scrobbling)

### Multi-Platform Sync & Scrobbling
- **Anime & Manga Sync**:
  - **AniList**: OAuth2-based list sync, score sync, and progress scrobbling.
  - **MyAnimeList (MAL)**: OAuth2 sync for anime and manga watchlists.
  - **Bangumi**: API token list synchronization.
  - **Simkl**: Multi-type tracking import and status alignment.
- **Music Scrobbling**:
  - **Last.fm**: Track scrobbling and playback listening history import.
  - **Deezer**: OAuth authorization, library import, playlist discovery, and scrobbling.
- **Gaming Connections**:
  - **Steam**: Steam OpenID / WebAPI game library import and achievement tracking.
  - **Riot Games**: Profile and gaming data integration.
- **Media Server & PVR Automation**:
  - **Sonarr**: Automated TV series monitoring, episode sync, and download management.
  - **Radarr**: Movie collection sync and automated status polling.

### Connection Management
- **Token Cryptography**: Envelope encryption using AES-256-GCM / ChaCha20-Poly1305 with Argon2 key derivation to keep third-party tokens secure at rest.
- **Sync & Health Auditing**: Provider listing (`/connections/providers`), connection health test suite (`/connections/[id]/test`), manual and background sync triggers (`/connections/[id]/sync`), and historical data import runs (`/connections/[id]/import`).
- **Search Quota Proxying**: Federated search across connected provider search APIs (`/connections/search`).

---

## 3. `IRIS-list` (Unified Tracking & Watchlists)

### Multi-Media List Tracking
Full lifecycle tracking across **7 media categories**:
1. **Anime** (`/user/[username]/lists/anime`)
2. **Manga** (`/user/[username]/lists/manga`)
3. **Movies** (`/user/[username]/lists/movie`)
4. **TV Shows** (`/user/[username]/lists/tv`)
5. **Video Games** (`/user/[username]/lists/game`)
6. **Books** (`/user/[username]/lists/book`)
7. **Music** (`/user/[username]/lists/music`)

### List Management Features
- **Progress Increments**: Quick `+1` increment endpoints for rapid episode, chapter, volume, page, track, or playtime updates without opening detailed modals (`.../[id]/increment`).
- **Quick Add**: Instant addition of any media item directly into the active list (`.../[id]/quick-add`).
- **Detailed TV Episode Tracking**: Granular per-season and per-episode watched tracking (`.../lists/tv/[id]/episodes`).
- **Dynamic Multi-Select Filtering**: Filter by custom status (`PLAN_TO_WATCH`, `WATCHING`, `COMPLETED`, `ON_HOLD`, `DROPPED`), release format, studio, genre, tag, year range, and score (`.../filters`).
- **Watching Dashboard**: At-a-glance dashboard highlighting currently in-progress media across all categories with progress indicators.

### Custom Lists & Watchlists
- **Custom Curated Collections**: Create custom public or private lists with custom ordering, notes, and tags (`/user/[username]/watchlists`).
- **Collaborative Watchlists**: Manage watchlist entries and share curations with other users (`/user/[username]/watchlists/[id]/entries`).

---

## 4. `IRIS-media` (Catalog, Metadata & Similarity Engine)

### Comprehensive Media Details
Dedicated detail and metadata endpoints for:
- **Anime**: Detailed synopsis, episode listings, voice actors, studios, and genres.
- **Manga / Light Novels**: Chapter/volume counts, authors, serialization magazines.
- **Movies**: Run time, box office, directors, cast, and crew.
- **TV Series**: Season breakdowns, episode guides, air dates, and network information.
- **Video Games**: Supported platforms, developers, publishers, release dates, and genres.
- **Books**: Page counts, ISBN, publication dates, and author bibliographies.
- **Music**: Artists, albums, tracks, Deezer metadata imports, and track duration.
- **People & Characters**: Biographies, voice acting roles, staff credits, and character media appearances (`/media/people/[id]`, `/media/characters/[id]`).
- **Studios & Producers**: Production company filmographies and anime studio catalogs (`/media/studios/[id]`).

### Recommendation & Discovery Algorithms
- **Media Similarity Engine**: Vector/tag-weighted similarity algorithm (`media-similarity.ts`) suggesting related items across genres, themes, and demographics (`/media/[type]/[id]/similar`).
- **Franchise & Prequel/Sequel Relations**: Graph traversal linking prequels, sequels, spin-offs, side stories, and parent series (`media-relations.ts`).
- **Synonym-Aware Search**: Cross-language romaji, kanji, English, and alternate title resolution (`search-synonyms.ts`).
- **On-Demand Cache Invalidation**: Explicit external upstream metadata refreshes (`/media/[type]/[id]/refresh`).

### Media Release Calendar
- **Interactive Airing & Release Schedule**: Dynamic date-filtered calendar tracking upcoming TV airings, anime episodes, movie premieres, book releases, and game launches (`/media/calendar`).

---

## 5. `IRIS-social` (Community, Activity & Reviews)

### Activity Feeds
- **Personal & Following Activity Stream**: Chronological feed recording progress increments, list status updates, scores, and media finishes (`/lists/[username]/[mediaType]/activity`).
- **Activity Item Detail**: Direct permalinks to specific status actions (`/activity/[id]`).

### Community Discussions & Comments
- **Media & List Comments**: Threaded discussions on media lists and user updates (`/lists/[username]/[mediaType]/comments`).
- **Nested Replies**: Hierarchical comment replies (`.../comments/[id]/reply`).

### Reviews & Recommendations
- **In-Depth Media Reviews**: User written reviews with ratings, spoiler tags, and summaries (`/reviews/[type]/[id]`).
- **Review Voting**: Helpful/Upvote and downvote rating system (`/reviews/[type]/[id]/vote`).
- **User Recommendations**: Pairwise recommendation system ("If you liked X, you'll love Y") (`/recommendations/[type]/[id]`).
- **Community Recommendation Voting**: Community voting on similarity pairings (`/recommendations/[id]/vote`).

---

## 6. Shared Packages & Infrastructure Layer

| Package / Module | Key Features & Responsibilities |
| :--- | :--- |
| **`@IRIS/database`** | Modular Prisma schemas (23 schema files) covering users, auth, lists, 7 media types, characters, studios, reviews, activity, connections, and stats. |
| **`@IRIS/cache`** | High-performance caching layer with Redis support and automatic in-memory LRU fallback (`getOrSet`). |
| **`@IRIS/permissions`** | Discord-style 64-bit BitField permission system (`IRISFlags`, `IRISBitField`, `ADMINISTRATOR`) with NestJS/Elysia decorators. |
| **`@IRIS/connections`** | Provider adapters, rate limiting, and envelope-encrypted OAuth token storage for 9+ external services. |
| **`@IRIS/shared`** | Shared constants, enum mappings, date utilities, and global UI customization themes. |
| **`@workspace/ui`** | Design-system component library built on Radix UI, Base UI, Lucide/Tabler icons, Tailwind CSS, and `aria-rhea` aesthetic. |
| **`apps/elysia` Core** | Elysia 2.0 beta with file-based auto-router, Eden Treaty type exports, token-bucket IP rate limiting, cron scheduler, RFC 9457 HTTP errors, and request logger. |
| **`apps/web` (Next.js)** | Responsive App Router interface, RTL/LTR support, Eden Treaty API client (`@/lib/elysia`), next-themes dark/light mode, and i18n localization. |

# Bitwarden-Compatible URI Domain Matching Engine

> **Source File:** `plugins/akaromi-firefox/lib/matching.js`  
> **Document Type:** Diátaxis Technical Reference  
> **Module ID:** `IrisMatching`  

---

## Overview
`lib/matching.js` implements URI matching compliant with Bitwarden's specification, augmented with strict host-detection rules and public suffix domain resolution.

---

## Features
- **Safe Host Extraction:** Parses hostnames from standard and protocol-less URLs.
- **eTLD+1 Base Domain Extraction:** Built-in multi-part public suffix dictionary (`co.uk`, `com.au`, `pages.dev`, `vercel.app`, `github.io`).
- **Bitwarden Strategy Normalization:** Full support for `BASE_DOMAIN`, `HOST`, `STARTS_WITH`, `EXACT`, `REGULAR_EXPRESSION`, and `NEVER`.
- **Strict Host Enforcement:** `HOST` strategy strictly forbids parent-domain matches.

---

## Step-by-Step Architecture

### ***Step 1***: URL Normalization & Domain Extraction

#### **Step 1.1**: Safe Hostname Extraction
`IrisMatching.extractHost(urlString)`:
- Automatically prepends `https://` if missing.
- Returns normalized lowercase hostname or IP address without ports or trailing slashes.

#### **Step 1.2**: Public Suffix List & Base Domain Resolution
`IrisMatching.extractBaseDomain(urlString)`:
- Evaluates hostname against compound TLDs (`co.uk`, `net.au`, `gov.sg`) and cloud app domains (`pages.dev`, `vercel.app`, `herokuapp.com`).
- Returns effective second-level domain (e.g. `jellyfin.runerra.org` -> `runerra.org`).

---

### ***Step 2***: Bitwarden Matching Strategy Normalization

#### **Step 2.1**: Strategy Enum & Case-Insensitive Normalization
`normalizeMatchStrategy(strategy)`:
Maps numeric IDs and string labels:
- `0` / `BASE_DOMAIN`: Matches when base domains match.
- `1` / `HOST`: Strictly matches when full hostnames match identically.
- `2` / `STARTS_WITH`: Matches when target URL starts with vault URI.
- `3` / `EXACT`: Exact character-for-character URL match.
- `4` / `REGULAR_EXPRESSION`: Case-insensitive regex match.
- `5` / `NEVER`: Never matches.

---

### ***Step 3***: Match Evaluation Engine (Exact, Starts With, Host, Regex, Base Domain, Never)

#### **Step 3.1**: Multi-Strategy Match Evaluation
`IrisMatching.isUriMatch(targetUrl, vaultUri, matchStrategy)`:
- **HOST:** Evaluates `extractHost(target) === extractHost(vault)`. For example, `jellyfin.runerra.org` does **not** match `runerra.org`.
- **BASE_DOMAIN:** Evaluates `extractBaseDomain(target) === extractBaseDomain(vault)`.
- **STARTS_WITH:** Enforces boundary validation (trailing slash, `?`, `#`, `:`) to prevent subdomain prefix attacks.
- **REGULAR_EXPRESSION:** Compiles `new RegExp(vaultUri, "i")` safely.
- **EXACT:** Compares trimmed, lowercase URLs without trailing slashes.

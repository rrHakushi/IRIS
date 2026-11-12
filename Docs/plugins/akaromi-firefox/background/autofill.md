# Background Autofill Matching & Tab State Engine

> **Source File:** `plugins/akaromi-firefox/background/autofill.js`  
> **Document Type:** Diátaxis Technical Reference  

---

## Overview
`background/autofill.js` evaluates credentials against active tabs using Bitwarden matching rules and manages toolbar badge counters.

---

## Features
- **Multi-Candidate Resolution:** Gathers URIs from explicit cipher entries, passkey `rpId`, websites, and titles.
- **Strict Strategy Enforcement:** Guarantees `HOST` detection matches only identical hosts.
- **Prioritized Matching Tiers:** Separates Exact Domain matches from Base Domain matches.
- **Toolbar Action Badge:** Shows match count on extension icon.

---

## Step-by-Step Architecture

### ***Step 1***: Active Tab Candidate Collection & Heuristics

#### **Step 1.1**: Target Host & Base Domain Resolution
Extracts hostname and base domain for the active tab URL. Collects candidate URIs from each cipher in memory.

---

### ***Step 2***: Strict Strategy Evaluation & Match Tier Ranking

#### **Step 2.1**: Exact Domain vs Base Domain Tier Ranking
`getMatchingLogins(targetUrl)`:
- Evaluates candidate URIs with `IrisMatching.isUriMatch`.
- Partitions matches into two ranked tiers:
  1. **Exact Domain Tier:** Target host matches candidate host (e.g. `jellyfin.runerra.org`).
  2. **Base Domain Tier:** Target base domain matches candidate base domain (e.g. `runerra.org`).

---

### ***Step 3***: Extension Action Toolbar Badging

#### **Step 3.1**: Badge Counter Query & Text Setting
`updateBadge()`:
- Queries active tab URL and calculates match count.
- Sets extension badge text (e.g. `"2"`) and badge background color. Clears badge if vault is locked.

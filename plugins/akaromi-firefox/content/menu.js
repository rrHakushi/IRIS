/**
 * Akaromi for Firefox — Floating Dropdown & In-Page Autofill Menu
 */
;(function (global) {
  let activeDropdown = null
  let currentTargetInput = null

  function removeDropdown() {
    if (activeDropdown) {
      activeDropdown.remove()
      activeDropdown = null
      currentTargetInput = null
    }
  }

  // Filter ciphers supporting query prefix syntax (user:, domain:, email:, title:, note:)
    // Step 1: Query Prefix Syntax Filter Engine
  // Step 1.1: Prefix Syntax Parsing (user:, domain:, email:, title:, note:)
  function filterCiphersByQuery(ciphers, rawQuery) {
    if (!rawQuery || !rawQuery.trim()) return ciphers
    const q = rawQuery.trim().toLowerCase()

    if (q.startsWith("user:") || q.startsWith("username:")) {
      const val = q.replace(/^user(name)?:/, "").trim()
      return ciphers.filter((c) => (c.data?.username || "").toLowerCase().includes(val))
    }
    if (q.startsWith("email:")) {
      const val = q.replace(/^email:/, "").trim()
      return ciphers.filter((c) => (c.data?.email || c.data?.username || "").toLowerCase().includes(val))
    }
    if (q.startsWith("domain:") || q.startsWith("url:") || q.startsWith("host:")) {
      const val = q.replace(/^(domain|url|host):/, "").trim()
      return ciphers.filter((c) => {
        const uris = c.data?.uris?.map((u) => (typeof u === "string" ? u : u.uri)).join(" ") || ""
        return uris.toLowerCase().includes(val)
      })
    }
    if (q.startsWith("title:")) {
      const val = q.replace(/^title:/, "").trim()
      return ciphers.filter((c) => (c.title || "").toLowerCase().includes(val))
    }
    if (q.startsWith("note:") || q.startsWith("notes:")) {
      const val = q.replace(/^notes?:/, "").trim()
      return ciphers.filter((c) => (c.data?.notes || "").toLowerCase().includes(val))
    }

    return ciphers.filter((c) => {
      const title = (c.title || "").toLowerCase()
      const user = (c.data?.username || c.data?.email || "").toLowerCase()
      const uris = (c.data?.uris?.map((u) => (typeof u === "string" ? u : u.uri)).join(" ") || "").toLowerCase()
      return title.includes(q) || user.includes(q) || uris.includes(q)
    })
  }

    // Step 2: Floating Dropdown Lifecycle & Viewport Clamping
  // Step 2.1: Dropdown Container Construction & Boundary Clamping
  async function showFieldDropdown(targetInput) {
    if (!targetInput) return
    if (activeDropdown && currentTargetInput === targetInput) return

    removeDropdown()
    currentTargetInput = targetInput

    const rect = targetInput.getBoundingClientRect()
    const dropdown = document.createElement("div")
    dropdown.className = "iris-pass-dropdown akaromi-dropdown"
    dropdown.setAttribute("data-akaromi-ignore", "true")

    // Position directly beneath input
    dropdown.style.top = `${Math.round(rect.bottom + window.scrollY + 6)}px`
    dropdown.style.left = `${Math.round(rect.left + window.scrollX)}px`

    // Loading State
    safeSetTemplate(
      dropdown,
      `<div class="iris-pass-dropdown-loading">
        <span>Loading credentials...</span>
      </div>`
    )

    getOrCreatePortal().appendChild(dropdown)
    activeDropdown = dropdown

    try {
      const response = await ext.runtime.sendMessage({
        action: "GET_MATCHING_LOGINS",
        payload: { url: window.location.href },
      })

      if (!dropdown.parentElement) return // dismissed while waiting

      // LOCKED STATE
      if (!response?.isUnlocked) {
        safeSetTemplate(
          dropdown,
          `<div class="iris-pass-dropdown-header">
            <div class="iris-pass-dropdown-brand">
              <span class="iris-pass-dropdown-title">Akaromi is Locked</span>
            </div>
          </div>
          <div class="iris-pass-dropdown-empty">
            <span>Unlock Akaromi to autofill credentials on this site.</span>
            <button type="button" class="iris-pass-btn-unlock" id="btn-portal-unlock">
              Unlock Vault
            </button>
          </div>`
        )
        dropdown.querySelector("#btn-portal-unlock")?.addEventListener("click", () => {
          removeDropdown()
          if (globalThis.AkaromiUnlock?.showInPageUnlockModal) {
            globalThis.AkaromiUnlock.showInPageUnlockModal(() => {
              showFieldDropdown(targetInput)
            })
          } else {
            ext.runtime.sendMessage({ action: "OPEN_UNLOCK_WINDOW" }).catch(() => {})
          }
        })
        return
      }

      const siteMatches = response.matches || []
      let allVaultLogins = null
      let isSearchingAll = false
      let currentQuery = ""

      dropdown.replaceChildren()

      // 1. Header
      const header = document.createElement("div")
      header.className = "iris-pass-dropdown-header"
      safeSetTemplate(
        header,
        `<div class="iris-pass-dropdown-brand">
          <span class="iris-pass-dropdown-title">Akaromi Logins</span>
          <span class="iris-pass-dropdown-count" id="header-match-count">${siteMatches.length}</span>
        </div>`
      )
      dropdown.appendChild(header)

      // 2. Search Container with Toggle and Filter Chips
      const searchBox = document.createElement("div")
      searchBox.className = "iris-pass-search-container"
      safeSetTemplate(
        searchBox,
        `<div class="iris-pass-search-input-wrap">
          <svg class="iris-pass-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.3-4.3"/>
          </svg>
          <input
            type="text"
            class="iris-pass-search-field"
            id="iris-pass-search-input"
            placeholder="Search logins..."
            autocomplete="off"
            spellcheck="false"
          />
          <button
            type="button"
            class="iris-pass-toggle-all-btn"
            id="iris-pass-toggle-all"
            title="Toggle: Search Entire Vault"
            aria-pressed="false"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            <span class="toggle-label">All</span>
          </button>
        </div>
        <div class="iris-pass-chips-row">
          <button type="button" class="iris-pass-filter-chip" data-prefix="user:">user:</button>
          <button type="button" class="iris-pass-filter-chip" data-prefix="domain:">domain:</button>
          <button type="button" class="iris-pass-filter-chip" data-prefix="email:">email:</button>
          <button type="button" class="iris-pass-filter-chip" data-prefix="title:">title:</button>
        </div>`
      )
      dropdown.appendChild(searchBox)

      const searchInput = searchBox.querySelector("#iris-pass-search-input")
      const toggleAllBtn = searchBox.querySelector("#iris-pass-toggle-all")
      const chips = searchBox.querySelectorAll(".iris-pass-filter-chip")

      // List container
      const list = document.createElement("div")
      list.className = "iris-pass-dropdown-list"
      dropdown.appendChild(list)

      // Render Items Function
      function renderList() {
        list.replaceChildren()

        let pool = siteMatches
        if (isSearchingAll) {
          pool = allVaultLogins || siteMatches
        }

        const filtered = filterCiphersByQuery(pool, currentQuery)
        const countBadge = dropdown.querySelector("#header-match-count")
        if (countBadge) countBadge.textContent = String(filtered.length)

        if (filtered.length === 0) {
          safeSetTemplate(
            list,
            `<div class="iris-pass-dropdown-empty">
              <span>${currentQuery ? "No matching logins found" : "No saved logins for this website"}</span>
            </div>`
          )
          return
        }

        // Group into Exact Domain, Base Domain, and Other/All
        const exact = []
        const base = []
        const other = []

        for (const item of filtered) {
          if (item._matchTier === "exact") {
            exact.push(item)
          } else if (item._matchTier === "base") {
            base.push(item)
          } else {
            other.push(item)
          }
        }

        function createSectionHeader(title, count) {
          const sec = document.createElement("div")
          sec.className = "iris-pass-section-header"
          const titleSpan = document.createElement("span")
          titleSpan.textContent = title
          const countSpan = document.createElement("span")
          countSpan.className = "sec-count"
          countSpan.textContent = String(count)
          sec.appendChild(titleSpan)
          sec.appendChild(countSpan)
          return sec
        }

        function appendGroup(items, title) {
          if (items.length === 0) return
          if (title) {
            list.appendChild(createSectionHeader(title, items.length))
          }
          items.forEach((m) => {
            list.appendChild(createItemElement(m))
          })
        }

        if (isSearchingAll) {
          appendGroup(exact, "Exact Domain Matches")
          appendGroup(base, "Base Domain Matches")
          appendGroup(other, "Other Vault Logins")
        } else {
          appendGroup(exact, "Exact Domain Matches")
          appendGroup(base, "Base Domain Matches")
        }
      }

      function createItemElement(m) {
        const item = document.createElement("div")
        item.className = "iris-pass-dropdown-item"

        const title = m.title || "Account"
        const username = m.data?.username || m.data?.email || "No username"
        const additional = m.data?.additionalPasswords || []

        const iconHtml = (typeof IrisIcons !== "undefined")
          ? IrisIcons.get("key", "tabler-icon", 'style="width:16px;height:16px;"')
          : ""

        const chevronHtml = additional.length > 0
          ? `<button type="button" class="iris-pass-sub-toggle-btn" title="Additional Passwords (${additional.length})" aria-label="Toggle additional passwords" aria-expanded="false" style="all: unset !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; width: 24px !important; height: 24px !important; min-width: 24px !important; min-height: 24px !important; max-width: 24px !important; max-height: 24px !important; border-radius: 6px !important; cursor: pointer !important; color: #71717a !important; margin-inline-start: auto !important; flex-shrink: 0 !important; transition: all 0.15s ease !important; box-sizing: border-box !important;">
              <svg class="tabler-icon iris-pass-sub-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px !important; height: 14px !important; min-width: 14px !important; max-width: 14px !important; flex-shrink: 0 !important; transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.12s ease !important; display: block !important;">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>`
          : ""

        safeSetTemplate(
          item,
          `<div class="iris-pass-item-main">
            <div class="iris-pass-item-icon">${iconHtml}</div>
            <div class="iris-pass-item-meta">
              <div class="iris-pass-item-title">${escapeHtml(title)}</div>
              <div class="iris-pass-item-user">${escapeHtml(username)}</div>
            </div>
            ${chevronHtml}
          </div>`
        )

        const handleCredentialSelect = (subPasswordId = null) => {
          removeDropdown()
          ext.runtime.sendMessage(
            {
              action: "GET_CREDENTIAL_FOR_AUTOFILL",
              payload: {
                cipherId: m.id,
                subPasswordId,
                url: window.location.href,
              },
            },
            (res) => {
              if (!res || !res.success) return
              const password = res.password || ""
              const generatedCode = res.totpCode || ""
              const totpSecret = res.totpSecret || ""

              if (generatedCode) {
                try {
                  if (navigator.clipboard?.writeText) {
                    navigator.clipboard.writeText(generatedCode).catch(() => {})
                  }
                } catch {}
                ext.runtime.sendMessage({
                  action: "COPY_TO_CLIPBOARD",
                  payload: { text: generatedCode },
                }).catch(() => {})
              }

              global.AkaromiFill?.fillCredential(
                {
                  title: m.title,
                  data: {
                    username: res.username || m.data?.username || "",
                    password,
                    totpSecret,
                  },
                },
                password,
                generatedCode
              )
            }
          )
        }

        const mainItem = item.querySelector(".iris-pass-item-main")
        mainItem.addEventListener("mousedown", (e) => {
          if (e.target.closest(".iris-pass-sub-toggle-btn")) return
          e.preventDefault()
        })
        mainItem.addEventListener("click", (e) => {
          if (e.target.closest(".iris-pass-sub-toggle-btn")) return
          e.preventDefault()
          e.stopPropagation()
          handleCredentialSelect(null)
        })

        if (additional.length > 0) {
          const toggleBtn = mainItem.querySelector(".iris-pass-sub-toggle-btn")
          const subWrapper = document.createElement("div")
          subWrapper.className = "iris-pass-sub-passwords-wrapper"
          subWrapper.style.cssText = "display: none !important; padding: 4px 10px 8px 36px !important; flex-direction: column !important; gap: 4px !important; box-sizing: border-box !important; width: 100% !important;"

          let isOpen = false

          if (toggleBtn) {
            toggleBtn.addEventListener("mousedown", (e) => {
              e.preventDefault()
              e.stopPropagation()
            })
            toggleBtn.addEventListener("click", (e) => {
              e.preventDefault()
              e.stopPropagation()
              isOpen = !isOpen
              item.classList.toggle("open", isOpen)
              toggleBtn.setAttribute("aria-expanded", String(isOpen))
              subWrapper.style.display = isOpen ? "flex" : "none"
              const chevron = toggleBtn.querySelector(".iris-pass-sub-chevron")
              if (chevron) {
                chevron.style.transform = isOpen ? "rotate(180deg)" : "rotate(0deg)"
                chevron.style.color = isOpen ? "#fafafa" : "#71717a"
                chevron.style.stroke = isOpen ? "#fafafa" : "#71717a"
              }
            })
          }

          additional.forEach((ap, idx) => {
            const subItem = document.createElement("button")
            subItem.type = "button"
            subItem.className = "iris-pass-sub-btn"
            subItem.style.cssText = "all: unset !important; display: flex !important; align-items: center !important; justify-content: space-between !important; padding: 5px 8px !important; border-radius: 6px !important; background: #18181b !important; border: 1px solid #27272a !important; color: #fafafa !important; font-size: 11px !important; cursor: pointer !important; transition: all 0.12s ease !important; width: 100% !important; box-sizing: border-box !important; margin: 0 !important;"
            safeSetTemplate(
              subItem,
              `<span class="sub-label" style="font-weight: 500 !important; color: #e4e4e7 !important; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;">${escapeHtml(ap.name || "Code")}</span>
              <span class="sub-masked" style="font-family: ui-monospace, monospace !important; color: #71717a !important; letter-spacing: 0.1em !important;">••••••••</span>`
            )
            subItem.addEventListener("mousedown", (e) => e.preventDefault())
            subItem.addEventListener("click", (e) => {
              e.preventDefault()
              e.stopPropagation()
              handleCredentialSelect(ap.id || String(idx))
            })
            subWrapper.appendChild(subItem)
          })

          item.appendChild(subWrapper)
        }

        return item
      }

      // Event Listeners for Search & Chips
      searchInput?.addEventListener("input", (e) => {
        currentQuery = e.target.value
        renderList()
      })

      chips.forEach((chip) => {
        chip.addEventListener("click", () => {
          const prefix = chip.getAttribute("data-prefix")
          if (!prefix) return
          if (searchInput) {
            searchInput.value = prefix
            searchInput.focus()
            currentQuery = prefix
            renderList()
          }
        })
      })

      toggleAllBtn?.addEventListener("click", async () => {
        isSearchingAll = !isSearchingAll
        toggleAllBtn.setAttribute("aria-pressed", String(isSearchingAll))
        toggleAllBtn.classList.toggle("active", isSearchingAll)

        if (isSearchingAll && !allVaultLogins) {
          const res = await ext.runtime.sendMessage({ action: "GET_ALL_LOGINS_FOR_INLINE_FILL" }).catch(() => ({}))
          allVaultLogins = res?.ciphers || []
        }
        renderList()
      })

      renderList()
    } catch (err) {
      console.warn("[Akaromi] Failed to load matches for dropdown:", err)
      removeDropdown()
    }
  }

  function escapeHtml(str) {
    if (!str) return ""
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
  }

  // Dismiss dropdown when clicking outside
  document.addEventListener("mousedown", (e) => {
    if (activeDropdown && !activeDropdown.contains(e.target)) {
      const activeTarget = global.AkaromiBadge?.getActiveDropdownTarget()
      const icon = activeTarget ? global.AkaromiBadge?.getIconForInput(activeTarget) : null
      if (icon && icon.contains(e.target)) return
      removeDropdown()
    }
  })

  // Auto-refresh if vault gets unlocked
  document.addEventListener("iris-vault-unlocked", () => {
    if (currentTargetInput) {
      showFieldDropdown(currentTargetInput)
    }
  })

  global.AkaromiMenu = {
    showFieldDropdown,
    removeDropdown,
  }
})(typeof window !== "undefined" ? window : globalThis)

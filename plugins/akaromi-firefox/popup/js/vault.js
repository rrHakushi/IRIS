/**
 * Akaromi for Firefox — Vault Items, Sorting & Detail View Engine
 */
;(function (global) {
  "use strict"

  const { safeSetTemplate, escapeHtml, showToast, ext, storage } = global.AkaromiUtils
  const state = global.AkaromiState

  // Master Pane Elements
  const vaultCardsList = document.getElementById("vault-cards-list")
  const matchingCardsList = document.getElementById("matching-cards-list")
  const sectionMatching = document.getElementById("section-matching")
  const sectionAll = document.getElementById("section-all")
  const matchingTabLabel = document.getElementById("matching-tab-label")
  const vaultEmptyState = document.getElementById("vault-empty-state")

  // Detail Pane Elements
  const detailActiveView = document.getElementById("detail-active-view")
  const detailEmptyPlaceholder = document.getElementById("detail-empty-placeholder")
  const detailTitle = document.getElementById("detail-title")
  const btnDetailEdit = document.getElementById("btn-detail-edit")
  const btnDetailShare = document.getElementById("btn-detail-share")
  const btnDetailMore = document.getElementById("btn-detail-more")
  const detailDropdownMenu = document.getElementById("detail-dropdown-menu")
  const btnMenuAutofill = document.getElementById("btn-menu-autofill")
  const btnMenuFavorite = document.getElementById("btn-menu-favorite")
  const labelMenuFavorite = document.getElementById("label-menu-favorite")
  const btnMenuDelete = document.getElementById("btn-menu-delete")

  // Detail Fields
  const rowDetailEmail = document.getElementById("row-detail-email")
  const detailValEmail = document.getElementById("detail-val-email")
  const btnCopyEmail = document.getElementById("btn-copy-email")

  const rowDetailUsername = document.getElementById("row-detail-username")
  const detailValUsername = document.getElementById("detail-val-username")
  const btnCopyUsername = document.getElementById("btn-copy-username")

  const rowDetailPassword = document.getElementById("row-detail-password")
  const detailValPassword = document.getElementById("detail-val-password")
  const btnToggleDetailEye = document.getElementById("btn-toggle-detail-eye")
  const iconDetailEye = document.getElementById("icon-detail-eye")
  const btnCopyPassword = document.getElementById("btn-copy-password")

  const rowDetailTotp = document.getElementById("row-detail-totp")
  const detailValTotp = document.getElementById("detail-val-totp")
  const detailValNextTotp = document.getElementById("detail-val-next-totp")
  const detailTotpSeconds = document.getElementById("detail-totp-seconds")
  const btnCopyTotp = document.getElementById("btn-copy-totp")

  const rowDetailWebsites = document.getElementById("row-detail-websites")
  const detailWebsitesContainer = document.getElementById("detail-websites-container")

  const rowDetailPasskey = document.getElementById("row-detail-passkey")
  const rowDetailNotes = document.getElementById("row-detail-notes")
  const detailValNotes = document.getElementById("detail-val-notes")

  // Additional Passwords in Detail View
  const detailAdditionalPasswordsCard = document.getElementById("detail-additional-passwords-card")
  const detailAdditionalPasswordsList = document.getElementById("detail-additional-passwords-list")

  // Custom Fields in Detail View
  const detailCustomFieldsCard = document.getElementById("detail-custom-fields-card")
  const detailCustomFieldsList = document.getElementById("detail-custom-fields-list")

  // Metadata
  const detailMetaAutofill = document.getElementById("detail-meta-autofill")
  const detailMetaModified = document.getElementById("detail-meta-modified")
  const detailMetaCreated = document.getElementById("detail-meta-created")



  let liveTotpTimer = null

  // ----------------------------------------------------
  // Load & Sync Vault Data
  // ----------------------------------------------------
  async function loadVaultData() {
    try {
      const res = await ext.runtime.sendMessage({ action: "GET_ALL_CIPHERS" })
      if (!res || res.error) {
        state.allCiphers = []
        renderCiphersList()
        showDetailEmpty()
        return
      }

      state.allCiphers = res.ciphers || []

      // Ensure activeTab is queried if not already set
      if (!state.currentTab?.url || state.currentTab.url.startsWith("moz-extension:")) {
        try {
          let tabs = await ext.tabs.query({ active: true, lastFocusedWindow: true }).catch(() => [])
          if (!tabs || tabs.length === 0) {
            tabs = await ext.tabs.query({ active: true, currentWindow: true }).catch(() => [])
          }
          if (!tabs || tabs.length === 0) {
            tabs = await ext.tabs.query({ active: true }).catch(() => [])
          }
          state.currentTab = tabs?.find((t) => t.url && !t.url.startsWith("about:") && !t.url.startsWith("moz-extension:")) || tabs?.[0] || null
        } catch (e) {
          console.warn("[Akaromi] Tab query error:", e)
        }
      }

      // Matching ciphers for active tab
      const tabUrl = state.currentTab?.url
      if (tabUrl && !tabUrl.startsWith("about:") && !tabUrl.startsWith("moz-extension:")) {
        const matchRes = await ext.runtime.sendMessage({
          action: "GET_MATCHING_LOGINS",
          payload: { url: tabUrl },
        })
        state.matchingCiphers = matchRes?.matches || []
      } else {
        const matchRes = await ext.runtime.sendMessage({
          action: "GET_MATCHING_LOGINS",
          payload: { url: "" },
        })
        state.matchingCiphers = matchRes?.matches || []
        if (matchRes?.url && !state.currentTab?.url) {
          state.currentTab = { url: matchRes.url }
        }
      }

      renderCiphersList()

      // Restore previously selected cipher or first item
      if (state.selectedCipherId) {
        const found = state.allCiphers.find((c) => c.id === state.selectedCipherId)
        if (found) {
          renderCipherDetail(found)
        } else if (state.matchingCiphers.length > 0) {
          selectCipher(state.matchingCiphers[0].id)
        } else if (state.allCiphers.length > 0) {
          selectCipher(state.allCiphers[0].id)
        } else {
          showDetailEmpty()
        }
      } else if (state.matchingCiphers.length > 0) {
        selectCipher(state.matchingCiphers[0].id)
      } else if (state.allCiphers.length > 0) {
        selectCipher(state.allCiphers[0].id)
      } else {
        showDetailEmpty()
      }
    } catch (err) {
      console.warn("[Akaromi] Failed to load vault data:", err)
    }
  }

  // ----------------------------------------------------
  // Sorting & Filtering Engine
  // ----------------------------------------------------
  function sortCiphersList(ciphers, sortKey) {
    const list = [...ciphers]
    switch (sortKey) {
      case "title_desc":
        return list.sort((a, b) => (b.title || "").localeCompare(a.title || ""))
      case "updated":
        return list.sort((a, b) => {
          const tA = new Date(a.updatedAt || a.createdAt || 0).getTime()
          const tB = new Date(b.updatedAt || b.createdAt || 0).getTime()
          return tB - tA
        })
      case "created_desc":
        return list.sort((a, b) => {
          const tA = new Date(a.createdAt || 0).getTime()
          const tB = new Date(b.createdAt || 0).getTime()
          return tB - tA
        })
      case "created_asc":
        return list.sort((a, b) => {
          const tA = new Date(a.createdAt || 0).getTime()
          const tB = new Date(b.createdAt || 0).getTime()
          return tA - tB
        })
      case "recent_used":
        return list.sort((a, b) => {
          const tA = new Date(a.lastUsedAt || 0).getTime()
          const tB = new Date(b.lastUsedAt || 0).getTime()
          return tB - tA
        })
      case "title_asc":
      default:
        return list.sort((a, b) => (a.title || "").localeCompare(b.title || ""))
    }
  }

  function sortCiphers(sortKey) {
    state.activeSortOption = sortKey
    renderCiphersList()
  }

  // ----------------------------------------------------
  // Render Left Master List
  // ----------------------------------------------------
  function renderCiphersList() {
    let filtered = state.allCiphers.filter((c) => !c.deletedAt)

    // Search query filter
    const query = state.currentSearchQuery.trim().toLowerCase()
    if (query) {
      filtered = filtered.filter((c) => {
        const title = (c.title || "").toLowerCase()
        const user = (c.data?.username || c.data?.email || "").toLowerCase()
        const uris = (c.data?.uris || []).map((u) => (typeof u === "string" ? u : u.uri || "")).join(" ").toLowerCase()
        const notes = (c.data?.notes || "").toLowerCase()
        return title.includes(query) || user.includes(query) || uris.includes(query) || notes.includes(query)
      })
    }

    filtered = sortCiphersList(filtered, state.activeSortOption)

    // Matching section for current tab
    const showMatching = state.matchingCiphers.length > 0 && !query

    if (showMatching) {
      if (sectionMatching) sectionMatching.style.display = "block"
      if (matchingTabLabel) {
        if (state.currentTab?.url) {
          try {
            const u = new URL(state.currentTab.url)
            matchingTabLabel.textContent = u.hostname ? `Matching ${u.hostname}` : "Matching current site"
          } catch {
            matchingTabLabel.textContent = "Matching current site"
          }
        } else {
          matchingTabLabel.textContent = "Matching current site"
        }
      }

      if (matchingCardsList) {
        matchingCardsList.replaceChildren()
        state.matchingCiphers.forEach((c) => {
          matchingCardsList.appendChild(createItemCard(c))
        })
      }
    } else {
      if (sectionMatching) sectionMatching.style.display = "none"
    }

    // Vault cards list: remove items already shown under matching section
    let allList = filtered
    if (showMatching) {
      const matchingIds = new Set(state.matchingCiphers.map((c) => c.id))
      allList = filtered.filter((c) => !matchingIds.has(c.id))
    }

    if (vaultCardsList) {
      vaultCardsList.replaceChildren()
      if (allList.length === 0) {
        if (showMatching) {
          // All vault items match the current site: hide the "All items" section header completely
          if (sectionAll) sectionAll.style.display = "none"
          if (vaultEmptyState) vaultEmptyState.style.display = "none"
        } else {
          if (sectionAll) sectionAll.style.display = "block"
          if (vaultEmptyState) vaultEmptyState.style.display = "flex"
        }
      } else {
        if (sectionAll) sectionAll.style.display = "block"
        if (vaultEmptyState) vaultEmptyState.style.display = "none"
        allList.forEach((c) => {
          vaultCardsList.appendChild(createItemCard(c))
        })
      }
    }

    // Keep active selection in sync with the current filtered list
    if (filtered.length > 0) {
      if (!state.selectedCipherId || !filtered.some((c) => c.id === state.selectedCipherId)) {
        const firstId = (showMatching && state.matchingCiphers[0]?.id) || filtered[0].id
        selectCipher(firstId)
      }
    } else {
      showDetailEmpty()
    }
  }

  function createItemCard(cipher) {
    const card = document.createElement("div")
    card.className = `cipher-item-card ${state.selectedCipherId === cipher.id ? "active" : ""}`
    card.dataset.cipherId = cipher.id

    const data = cipher.data || {}
    const subType = data.itemType || (cipher.type === "SSH_KEY" ? "ssh" : "login")
    const username = data.username || data.email || ""
    const iconSvg = getItemIconSvg(subType)

    const hasPasskey = Boolean(data.passkey || data.itemType === "passkey" || cipher.type === "PASSKEY")
    const rawTotp =
      data.totpSecret ||
      data.totp ||
      data.totpUri ||
      data.otpauth ||
      cipher.totpSecret ||
      cipher.totp ||
      cipher.login?.totp ||
      ""
    const hasTotp = Boolean(rawTotp && String(rawTotp).trim())

    let badgesHtml = ""
    if (hasTotp || hasPasskey) {
      badgesHtml = '<div class="card-badges">'
      if (hasTotp) {
        badgesHtml += `
          <span class="card-badge-icon badge-totp" title="2FA Authenticator">
            <svg class="tabler-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="9"/>
              <polyline points="12 7 12 12 15 15"/>
            </svg>
          </span>
        `
      }
      if (hasPasskey) {
        badgesHtml += `
          <span class="card-badge-icon badge-passkey" title="Passkey">
            <svg class="tabler-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18.9 7a8 8 0 0 0-13.8 0"/>
              <path d="M3.3 15A13 13 0 0 1 2 12 10 10 0 0 1 21.3 8"/>
              <path d="M2 16c.5 2.3 2 4.1 4 5"/>
              <path d="M8 15a4 4 0 0 1 8 0c0 4-2 6-4 7"/>
              <path d="M12 11v4"/>
            </svg>
          </span>
        `
      }
      badgesHtml += "</div>"
    }

    safeSetTemplate(
      card,
      `
      <div class="card-icon-wrap">
        ${iconSvg}
      </div>
      <div class="card-content">
        <div class="card-title">${escapeHtml(cipher.title || "Untitled")}</div>
        <div class="card-subtitle">${escapeHtml(username || subType.toUpperCase())}</div>
      </div>
      ${badgesHtml}
    `
    )

    card.addEventListener("click", () => {
      selectCipher(cipher.id)
    })

    return card
  }

  function getItemIconSvg(type) {
    const t = (type || "login").toLowerCase()
    switch (t) {
      case "note":
        return `<svg class="tabler-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/><line x1="9" y1="9" x2="10" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>`
      case "card":
        return `<svg class="tabler-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`
      case "ssh":
        return `<svg class="tabler-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`
      case "identity":
        return `<svg class="tabler-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="14" x="3" y="5" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M15 9h2M15 13h2M6 16c0-1.5 1.5-2 3-2s3 .5 3 2"/></svg>`
      default:
        return `<svg class="tabler-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="m10.85 12.15 7.65-7.65a1.5 1.5 0 0 1 2.12 0l1.41 1.41a1.5 1.5 0 0 1 0 2.12l-1.03 1.03-2-2-1.5 1.5 2 2-1.5 1.5-2-2-3.15 3.15"/></svg>`
    }
  }

  function selectCipher(id) {
    state.selectedCipherId = id
    document.querySelectorAll(".cipher-item-card").forEach((c) => {
      c.classList.toggle("active", c.dataset.cipherId === id)
    })
    const cipher = state.allCiphers.find((c) => c.id === id)
    if (cipher) {
      renderCipherDetail(cipher)
      // Mobile support: make detail pane active
      const detailPane = document.getElementById("item-detail-pane")
      if (detailPane) detailPane.classList.add("active")
    } else {
      showDetailEmpty()
    }
  }

  function showDetailEmpty() {
    if (detailActiveView) detailActiveView.style.display = "none"
    if (detailEmptyPlaceholder) detailEmptyPlaceholder.style.display = "flex"
  }

  function formatDisplayHost(rawUrl) {
    if (!rawUrl) return ""
    try {
      let clean = String(rawUrl).trim()
      if (!clean.includes("://")) {
        clean = "http://" + clean
      }
      const parsed = new URL(clean)
      return parsed.hostname.replace(/^www\./, "") || rawUrl
    } catch {
      return String(rawUrl).replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#:]/)[0]
    }
  }

  // ----------------------------------------------------
  // Render Detail Pane
  // ----------------------------------------------------
  function renderCipherDetail(cipher) {
    if (!detailActiveView) return
    if (detailEmptyPlaceholder) detailEmptyPlaceholder.style.display = "none"
    detailActiveView.style.display = "flex"

    const data = cipher.data || {}

    // Title
    if (detailTitle) detailTitle.textContent = cipher.title || "Untitled"

    // Favorite status
    if (labelMenuFavorite) {
      labelMenuFavorite.textContent = cipher.favorite ? "Unfavorite" : "Favorite"
    }

    // Email
    if (rowDetailEmail) {
      if (data.email) {
        rowDetailEmail.style.display = "flex"
        if (detailValEmail) detailValEmail.textContent = data.email
      } else {
        rowDetailEmail.style.display = "none"
      }
    }

    // Username
    if (rowDetailUsername) {
      if (data.username) {
        rowDetailUsername.style.display = "flex"
        if (detailValUsername) detailValUsername.textContent = data.username
      } else {
        rowDetailUsername.style.display = "none"
      }
    }

    // Password
    if (rowDetailPassword) {
      if (data.password) {
        rowDetailPassword.style.display = "flex"
        if (detailValPassword) {
          detailValPassword.textContent = "••••••••••••"
          detailValPassword.dataset.revealed = "false"
          detailValPassword.dataset.secret = data.password
        }
        if (btnToggleDetailEye) {
          IrisIcons.swap(btnToggleDetailEye, "eye")
        }
      } else {
        rowDetailPassword.style.display = "none"
      }
    }

    // Additional Passwords / Codes
    const additional = data.additionalPasswords || []
    if (detailAdditionalPasswordsCard && detailAdditionalPasswordsList) {
      if (additional.length > 0) {
        detailAdditionalPasswordsCard.style.display = "flex"
        detailAdditionalPasswordsList.replaceChildren()

        additional.forEach((entry) => {
          const row = document.createElement("div")
          row.className = "proton-field-row clickable"
          const rowName = entry.name || "Additional Password"
          const rowVal = entry.value || ""
          row.title = `Click to copy ${rowName}`

          safeSetTemplate(
            row,
            `
            <div class="field-icon-cell">
              <svg class="tabler-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="8" cy="15" r="4" />
                <path d="m10.85 12.15 7.65-7.65a1.5 1.5 0 0 1 2.12 0l1.41 1.41a1.5 1.5 0 0 1 0 2.12l-1.03 1.03-2-2-1.5 1.5 2 2-1.5 1.5-2-2-3.15 3.15" />
              </svg>
            </div>
            <div class="field-data-cell">
              <div class="field-label">${escapeHtml(rowName)}</div>
              <div class="field-value font-mono masked-dots val-additional-pass" data-revealed="false">••••••••••••</div>
            </div>
            <div class="field-inline-actions">
              <button type="button" class="icon-btn-round mini btn-toggle-add-eye" title="Reveal password">
                <svg class="tabler-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="2" />
                  <path d="M22 12c-2.667 4.667-6 7-10 7s-7.333-2.333-10-7c2.667-4.667 6-7 10-7s7.333 2.333 10 7" />
                </svg>
              </button>
            </div>
          `
          )

          const valEl = row.querySelector(".val-additional-pass")
          const eyeBtn = row.querySelector(".btn-toggle-add-eye")

          eyeBtn?.addEventListener("click", (e) => {
            e.stopPropagation()
            if (!valEl) return
            const isRevealed = valEl.dataset.revealed === "true"
            if (isRevealed) {
              valEl.textContent = "••••••••••••"
              valEl.dataset.revealed = "false"
              IrisIcons.swap(eyeBtn, "eye")
            } else {
              valEl.textContent = rowVal
              valEl.dataset.revealed = "true"
              IrisIcons.swap(eyeBtn, "eye-off")
            }
          })

          row.addEventListener("click", () => {
            if (rowVal) {
              navigator.clipboard.writeText(rowVal).then(() => {
                showToast(`${rowName} copied`)
                ext.runtime.sendMessage({ action: "SCHEDULE_CLIPBOARD_CLEAR", payload: { text: rowVal } }).catch(() => {})
              })
            }
          })

          detailAdditionalPasswordsList.appendChild(row)
        })
      } else {
        detailAdditionalPasswordsCard.style.display = "none"
      }
    }

    // Custom Fields
    const customFields = data.customFields || []
    if (detailCustomFieldsCard && detailCustomFieldsList) {
      if (customFields.length > 0) {
        detailCustomFieldsCard.style.display = "flex"
        detailCustomFieldsList.replaceChildren()

        customFields.forEach((cf) => {
          const row = document.createElement("div")
          row.className = "proton-field-row clickable"
          const cfName = cf.name || "Field"
          const cfVal = cf.value || ""
          const isHidden = Boolean(cf.isHidden)
          row.title = `Click to copy ${cfName}`

          safeSetTemplate(
            row,
            `
            <div class="field-icon-cell">
              <svg class="tabler-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
                <line x1="9" y1="9" x2="10" y2="9" />
                <line x1="9" y1="13" x2="15" y2="13" />
                <line x1="9" y1="17" x2="15" y2="17" />
              </svg>
            </div>
            <div class="field-data-cell">
              <div class="field-label">${escapeHtml(cfName)}</div>
              <div class="field-value font-mono ${isHidden ? "masked-dots" : ""} val-custom-field" data-revealed="${!isHidden}">${isHidden ? "••••••••••••" : escapeHtml(cfVal)}</div>
            </div>
            ${
              isHidden
                ? `
            <div class="field-inline-actions">
              <button type="button" class="icon-btn-round mini btn-toggle-custom-eye" title="Reveal value">
                <svg class="tabler-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="2" />
                  <path d="M22 12c-2.667 4.667-6 7-10 7s-7.333-2.333-10-7c2.667-4.667 6-7 10-7s7.333 2.333 10 7" />
                </svg>
              </button>
            </div>`
                : ""
            }
          `
          )

          const valEl = row.querySelector(".val-custom-field")
          const eyeBtn = row.querySelector(".btn-toggle-custom-eye")

          eyeBtn?.addEventListener("click", (e) => {
            e.stopPropagation()
            if (!valEl) return
            const isRevealed = valEl.dataset.revealed === "true"
            if (isRevealed) {
              valEl.textContent = "••••••••••••"
              valEl.dataset.revealed = "false"
              valEl.classList.add("masked-dots")
              IrisIcons.swap(eyeBtn, "eye")
            } else {
              valEl.textContent = cfVal
              valEl.dataset.revealed = "true"
              valEl.classList.remove("masked-dots")
              IrisIcons.swap(eyeBtn, "eye-off")
            }
          })

          row.addEventListener("click", () => {
            if (cfVal) {
              navigator.clipboard.writeText(cfVal).then(() => {
                showToast(`${cfName} copied`)
                if (isHidden) {
                  ext.runtime.sendMessage({ action: "SCHEDULE_CLIPBOARD_CLEAR", payload: { text: cfVal } }).catch(() => {})
                }
              })
            }
          })

          detailCustomFieldsList.appendChild(row)
        })
      } else {
        detailCustomFieldsCard.style.display = "none"
      }
    }

    // TOTP Authenticator
    if (liveTotpTimer) clearInterval(liveTotpTimer)
    const rawTotpSecret =
      data.totpSecret ||
      data.totp ||
      data.totpUri ||
      data.otpauth ||
      cipher.totpSecret ||
      cipher.totp ||
      cipher.login?.totp ||
      ""
    const totpSecret = typeof rawTotpSecret === "string" ? rawTotpSecret.trim() : ""

    if (rowDetailTotp) {
      if (totpSecret) {
        rowDetailTotp.style.display = "flex"
        const updateTotp = async () => {
          try {
            const currentCode = await IrisTotp.generateTotp(totpSecret, 30, 0)
            const nextCode = await IrisTotp.generateTotp(totpSecret, 30, 30)

            if (detailValTotp) {
              detailValTotp.textContent = currentCode ? `${currentCode.slice(0, 3)} ${currentCode.slice(3)}` : "--- ---"
              detailValTotp.dataset.code = currentCode || ""
            }

            if (detailValNextTotp) {
              if (nextCode) {
                detailValNextTotp.textContent = `Next: ${nextCode.slice(0, 3)} ${nextCode.slice(3)}`
                detailValNextTotp.style.display = "block"
              } else {
                detailValNextTotp.style.display = "none"
              }
            }

            const epoch = Math.floor(Date.now() / 1000)
            const remaining = 30 - (epoch % 30)
            if (detailTotpSeconds) detailTotpSeconds.textContent = String(remaining)
          } catch {}
        }
        updateTotp()
        liveTotpTimer = setInterval(updateTotp, 1000)
      } else {
        rowDetailTotp.style.display = "none"
        if (detailValNextTotp) detailValNextTotp.style.display = "none"
      }
    }

    // Websites (in preview show domain and subdomain; full URL kept in href/title)
    if (rowDetailWebsites && detailWebsitesContainer) {
      const uris = data.uris || []
      if (uris.length > 0) {
        rowDetailWebsites.style.display = "flex"
        detailWebsitesContainer.replaceChildren()
        uris.forEach((u) => {
          const urlStr = typeof u === "string" ? u : u.uri
          if (!urlStr) return
          const link = document.createElement("a")
          link.href = urlStr.includes("://") ? urlStr : `https://${urlStr}`
          link.target = "_blank"
          link.title = urlStr
          link.className = "field-value font-mono"
          link.textContent = formatDisplayHost(urlStr)
          link.style.display = "block"
          link.style.textDecoration = "none"
          detailWebsitesContainer.appendChild(link)
        })
      } else {
        rowDetailWebsites.style.display = "none"
      }
    }

    // Passkey
    if (rowDetailPasskey) {
      rowDetailPasskey.style.display = data.passkey ? "flex" : "none"
    }

    // Notes
    if (rowDetailNotes) {
      if (data.notes) {
        rowDetailNotes.style.display = "flex"
        if (detailValNotes) detailValNotes.textContent = data.notes
      } else {
        rowDetailNotes.style.display = "none"
      }
    }

    // Metadata
    if (detailMetaAutofill) detailMetaAutofill.textContent = cipher.lastUsedAt ? new Date(cipher.lastUsedAt).toLocaleDateString() : "Never"
    if (detailMetaModified) detailMetaModified.textContent = cipher.updatedAt ? new Date(cipher.updatedAt).toLocaleDateString() : "-"
    if (detailMetaCreated) detailMetaCreated.textContent = cipher.createdAt ? new Date(cipher.createdAt).toLocaleDateString() : "-"
  }

  // ----------------------------------------------------
  // Detail Actions
  // ----------------------------------------------------
  btnDetailEdit?.addEventListener("click", () => {
    const cipher = state.allCiphers.find((c) => c.id === state.selectedCipherId)
    if (cipher) global.AkaromiEditor?.openEditModal(cipher)
  })

  btnToggleDetailEye?.addEventListener("click", (e) => {
    e.stopPropagation()
    if (!detailValPassword) return
    const isRevealed = detailValPassword.dataset.revealed === "true"
    const secret = detailValPassword.dataset.secret || ""
    if (isRevealed) {
      detailValPassword.textContent = "••••••••••••"
      detailValPassword.dataset.revealed = "false"
      IrisIcons.swap(btnToggleDetailEye, "eye")
    } else {
      detailValPassword.textContent = secret
      detailValPassword.dataset.revealed = "true"
      IrisIcons.swap(btnToggleDetailEye, "eye-off")
    }
  })

  // Click row to copy values
  rowDetailPassword?.addEventListener("click", () => {
    const secret = detailValPassword?.dataset.secret || ""
    if (secret) {
      navigator.clipboard.writeText(secret).then(() => {
        showToast("Password copied")
        ext.runtime.sendMessage({ action: "SCHEDULE_CLIPBOARD_CLEAR", payload: { text: secret } }).catch(() => {})
      })
    }
  })

  rowDetailUsername?.addEventListener("click", () => {
    const user = detailValUsername?.textContent || ""
    if (user) {
      navigator.clipboard.writeText(user).then(() => showToast("Username copied"))
    }
  })

  rowDetailEmail?.addEventListener("click", () => {
    const email = detailValEmail?.textContent || ""
    if (email) {
      navigator.clipboard.writeText(email).then(() => showToast("Email copied"))
    }
  })

  const handleCopyTotp = () => {
    const cipher = state.allCiphers.find((c) => c.id === state.selectedCipherId)
    const data = cipher?.data || {}
    const rawTotpSecret =
      data.totpSecret ||
      data.totp ||
      data.totpUri ||
      data.otpauth ||
      cipher?.totpSecret ||
      cipher?.totp ||
      ""
    const totpSecret = typeof rawTotpSecret === "string" ? rawTotpSecret.trim() : ""

    let code = detailValTotp?.dataset.code || detailValTotp?.textContent?.replace(/\s/g, "") || ""
    if ((!code || code === "------" || code === "--- ---") && totpSecret && typeof IrisTotp !== "undefined") {
      code = IrisTotp.generateTotpSync(totpSecret)
    }

    if (code && code !== "------" && code !== "--- ---") {
      navigator.clipboard.writeText(code).then(() => {
        showToast("2FA code copied to clipboard")
        ext.runtime.sendMessage({ action: "SCHEDULE_CLIPBOARD_CLEAR", payload: { text: code } }).catch(() => {})
      }).catch(() => {})

      const label = cipher?.title || "2FA Code"

      // Show floating countdown widget and auto-copy next code on active tab
      if (totpSecret) {
        ext.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
          if (tabs[0]?.id) {
            ext.tabs.sendMessage(tabs[0].id, {
              action: "SHOW_FLOATING_TOTP_WIDGET",
              payload: {
                secret: totpSecret,
                label,
                initialCode: code,
              },
            }).catch(() => {})
          }
        }).catch(() => {})
      }
    }
  }

  rowDetailTotp?.addEventListener("click", handleCopyTotp)
  btnCopyTotp?.addEventListener("click", (e) => {
    e.stopPropagation()
    handleCopyTotp()
  })

  btnDetailShare?.addEventListener("click", () => {
    const cipher = state.allCiphers.find((c) => c.id === state.selectedCipherId)
    if (cipher) autofillCipher(cipher)
  })

  btnDetailMore?.addEventListener("click", (e) => {
    e.stopPropagation()
    if (!detailDropdownMenu) return
    const isShown = detailDropdownMenu.style.display === "block"
    detailDropdownMenu.style.display = isShown ? "none" : "block"
  })

  btnMenuAutofill?.addEventListener("click", () => {
    if (detailDropdownMenu) detailDropdownMenu.style.display = "none"
    const cipher = state.allCiphers.find((c) => c.id === state.selectedCipherId)
    if (cipher) autofillCipher(cipher)
  })

  btnMenuFavorite?.addEventListener("click", async () => {
    if (detailDropdownMenu) detailDropdownMenu.style.display = "none"
    const cipher = state.allCiphers.find((c) => c.id === state.selectedCipherId)
    if (!cipher) return
    try {
      const newFav = !cipher.favorite
      await ext.runtime.sendMessage({
        action: "SAVE_CIPHER",
        payload: {
          id: cipher.id,
          type: cipher.type,
          title: cipher.title,
          favorite: newFav,
          data: cipher.data,
        },
      })
      cipher.favorite = newFav
      if (labelMenuFavorite) labelMenuFavorite.textContent = newFav ? "Unfavorite" : "Favorite"
      showToast(newFav ? "Added to favorites" : "Removed from favorites")
    } catch (err) {
      showToast("Failed to update favorite")
    }
  })

  btnMenuDelete?.addEventListener("click", async () => {
    if (detailDropdownMenu) detailDropdownMenu.style.display = "none"
    if (!state.selectedCipherId) return
    if (confirm("Are you sure you want to delete this item?")) {
      try {
        await ext.runtime.sendMessage({
          action: "DELETE_CIPHER",
          payload: { id: state.selectedCipherId },
        })
        showToast("Item deleted")
        state.selectedCipherId = null
        await loadVaultData()
      } catch (err) {
        showToast(err.message || "Failed to delete item")
      }
    }
  })

  async function autofillCipher(cipher) {
    const data = cipher.data || {}
    const rawTotpSecret =
      data.totpSecret ||
      data.totp ||
      data.totpUri ||
      data.otpauth ||
      cipher.totpSecret ||
      cipher.totp ||
      ""
    const totpSecret = typeof rawTotpSecret === "string" ? rawTotpSecret.trim() : ""

    try {
      const tabs = await ext.tabs.query({ active: true, currentWindow: true })
      if (tabs[0]?.id) {
        ext.tabs
          .sendMessage(tabs[0].id, {
            action: "FILL_CREDENTIALS",
            payload: {
              title: cipher.title || data.username || "2FA",
              username: data.username || data.email || "",
              password: data.password || "",
              totpSecret,
            },
          })
          .catch(() => {
            showToast("Could not autofill on this page")
          })
        showToast("Credentials filled")
      }
    } catch {
      showToast("Autofill unavailable")
    }
  }



  global.AkaromiVault = {
    loadVaultData,
    renderCiphersList,
    renderCipherDetail,
    selectCipher,
    showDetailEmpty,
    sortCiphers,
  }
})(typeof window !== "undefined" ? window : globalThis)

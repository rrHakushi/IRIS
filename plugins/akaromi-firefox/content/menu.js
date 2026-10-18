/**
 * Akaromi for Firefox — Floating Autofill Dropdown Menu
 */
;(function (global) {
  "use strict"

  const ext = typeof browser !== "undefined" ? browser : (typeof chrome !== "undefined" ? chrome : global.AkaromiExt)

  let activeDropdown = null
  const domParser = new DOMParser()

  function safeSetTemplate(element, htmlString) {
    element.replaceChildren()
    const doc = domParser.parseFromString(htmlString, "text/html")
    while (doc.body.firstChild) {
      element.appendChild(doc.body.firstChild)
    }
  }

  function removeDropdown() {
    if (activeDropdown) {
      activeDropdown.remove()
      activeDropdown = null
    }
    const prevTarget = global.AkaromiBadge?.getActiveDropdownTarget()
    global.AkaromiBadge?.setActiveDropdownTarget(null)

    // Hide icon if target input is blurred
    if (prevTarget && document.activeElement !== prevTarget) {
      const icon = global.AkaromiBadge?.getIconForInput(prevTarget)
      if (icon) icon.classList.remove("visible")
    }
  }

  async function showFieldDropdown(input, icon) {
    removeDropdown()
    global.AkaromiBadge?.setActiveDropdownTarget(input)

    const portal = document.getElementById("akaromi-portal")
    if (!portal) return

    const dropdown = document.createElement("div")
    dropdown.className = "akaromi-dropdown iris-pass-dropdown"
    activeDropdown = dropdown

    // Position below input
    const rect = input.getBoundingClientRect()
    const top = rect.bottom + 4
    let left = rect.left
    if (left + 260 > window.innerWidth) {
      left = Math.max(10, window.innerWidth - 270)
    }

    dropdown.style.position = "fixed"
    dropdown.style.top = `${Math.round(top)}px`
    dropdown.style.left = `${Math.round(left)}px`
    dropdown.style.zIndex = "2147483645"

    // Loading State
    safeSetTemplate(
      dropdown,
      `<div class="iris-pass-dropdown-header">
        <div class="iris-pass-dropdown-brand">
          <span class="iris-pass-dropdown-title">Akaromi Autofill</span>
        </div>
      </div>
      <div class="iris-pass-dropdown-loading">Finding matching logins...</div>`
    )
    portal.appendChild(dropdown)

    try {
      const response = await ext.runtime.sendMessage({
        action: "GET_MATCHING_LOGINS",
        payload: { url: window.location.href },
      })

      if (!dropdown.parentElement) return // dismissed while waiting

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
          ext.runtime.sendMessage({ action: "OPEN_UNLOCK_WINDOW" }).catch(() => {})
          removeDropdown()
        })
        return
      }

      const matches = response.matches || []
      dropdown.replaceChildren()

      // Header
      const header = document.createElement("div")
      header.className = "iris-pass-dropdown-header"
      safeSetTemplate(
        header,
        `<div class="iris-pass-dropdown-brand">
          <span class="iris-pass-dropdown-title">Akaromi Logins</span>
          <span class="iris-pass-dropdown-count">${matches.length}</span>
        </div>`
      )
      dropdown.appendChild(header)

      const list = document.createElement("div")
      list.className = "iris-pass-dropdown-list"

      if (matches.length === 0) {
        safeSetTemplate(
          list,
          `<div class="iris-pass-dropdown-empty">
            <span>No saved logins for this website</span>
          </div>`
        )
      } else {
        matches.forEach((m) => {
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

          // Additional Passwords Dropdown (Opened via chevron on item card, closed by default)
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
              toggleBtn.addEventListener("mouseenter", () => {
                toggleBtn.style.background = "rgba(255, 255, 255, 0.08)"
                const chevron = toggleBtn.querySelector(".iris-pass-sub-chevron")
                if (chevron && !isOpen) {
                  chevron.style.color = "#d4d4d8"
                  chevron.style.stroke = "#d4d4d8"
                }
              })
              toggleBtn.addEventListener("mouseleave", () => {
                toggleBtn.style.background = "transparent"
                const chevron = toggleBtn.querySelector(".iris-pass-sub-chevron")
                if (chevron && !isOpen) {
                  chevron.style.color = "#71717a"
                  chevron.style.stroke = "#71717a"
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

          list.appendChild(item)
        })
      }

      dropdown.appendChild(list)
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

  global.AkaromiMenu = {
    showFieldDropdown,
    removeDropdown,
  }
})(typeof window !== "undefined" ? window : globalThis)

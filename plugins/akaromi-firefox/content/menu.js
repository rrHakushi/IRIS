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

          safeSetTemplate(
            item,
            `<div class="iris-pass-item-main">
              <div class="iris-pass-item-icon">${iconHtml}</div>
              <div class="iris-pass-item-meta">
                <div class="iris-pass-item-title">${escapeHtml(title)}</div>
                <div class="iris-pass-item-user">${escapeHtml(username)}</div>
              </div>
            </div>`
          )

          const mainItem = item.querySelector(".iris-pass-item-main")
          mainItem.addEventListener("mousedown", (e) => e.preventDefault())
          mainItem.addEventListener("click", (e) => {
            e.preventDefault()
            e.stopPropagation()
            global.AkaromiFill?.fillCredential(m)
            removeDropdown()
          })

          // Additional Passwords Submenu
          if (additional.length > 0) {
            const subToggle = document.createElement("div")
            subToggle.className = "iris-pass-sub-passwords-wrapper"
            const subDivider = document.createElement("div")
            subDivider.className = "iris-pass-sub-divider"
            subDivider.textContent = "Additional Passwords"
            subToggle.appendChild(subDivider)

            const subList = document.createElement("div")
            subList.className = "iris-pass-sub-list"

            additional.forEach((ap) => {
              const subItem = document.createElement("button")
              subItem.type = "button"
              subItem.className = "iris-pass-sub-btn"
              safeSetTemplate(
                subItem,
                `<span class="sub-label">${escapeHtml(ap.name || "Code")}</span>
                <span class="sub-masked">••••••••</span>`
              )
              subItem.addEventListener("mousedown", (e) => e.preventDefault())
              subItem.addEventListener("click", (e) => {
                e.preventDefault()
                e.stopPropagation()
                global.AkaromiFill?.fillCredential(m, ap.value || "")
                removeDropdown()
              })
              subList.appendChild(subItem)
            })

            subToggle.appendChild(subList)
            item.appendChild(subToggle)
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

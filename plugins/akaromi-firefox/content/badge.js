/**
 * Akaromi for Firefox — Inline Autofill Badge Management
 * Attaches buttons that ONLY show when credential inputs are actively focused.
 */
;(function (global) {
  "use strict"

  const inputIconMap = new Map()
  let activeDropdownTarget = null

  function getTrailingButtonOffset(input, icon, rect) {
    let offset = 26
    try {
      const style = window.getComputedStyle(input)
      const paddingRight = parseFloat(style.paddingRight) || 0
      if (paddingRight >= 28) {
        offset = Math.max(offset, paddingRight + 4)
      }

      const parent = input.parentElement
      if (parent) {
        const candidates = parent.querySelectorAll(
          'button, svg, [role="button"], a, [class*="eye" i], [class*="show" i], [class*="toggle" i], [class*="reveal" i], [class*="icon" i]'
        )
        for (const el of candidates) {
          if (el === icon || el.contains(icon) || (icon && icon.contains(el))) continue
          const elRect = el.getBoundingClientRect()
          if (
            elRect.width > 0 &&
            elRect.height > 0 &&
            elRect.right <= rect.right + 12 &&
            elRect.left >= rect.right - 80 &&
            elRect.bottom > rect.top &&
            elRect.top < rect.bottom
          ) {
            const fromRight = rect.right - elRect.left
            if (fromRight > 10) {
              offset = Math.max(offset, fromRight + 26)
            }
          }
        }
      }
    } catch {}
    return offset
  }

  function updateIconPosition(input, icon) {
    if (!input || !icon) return
    const rect = input.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0 || !document.body.contains(input)) {
      icon.style.display = "none"
      return
    }

    icon.style.display = ""
    const offsetFromRight = getTrailingButtonOffset(input, icon, rect)
    const iconWidth = 20
    const iconHeight = 20

    const top = rect.top + (rect.height - iconHeight) / 2
    const left = rect.right - offsetFromRight - iconWidth / 2

    icon.style.position = "fixed"
    icon.style.top = `${Math.round(top)}px`
    icon.style.left = `${Math.round(left)}px`
    icon.style.zIndex = "2147483640"
  }

  function attachBadgeToInput(input, portal) {
    if (input.dataset.akaromiAttached) return
    if (!global.AkaromiDetection?.isCredentialInput(input)) return

    input.dataset.akaromiAttached = "true"

    const icon = document.createElement("button")
    icon.type = "button"
    icon.className = "akaromi-field-icon iris-pass-field-icon" // Note: NOT visible by default!
    icon.title = "Akaromi Autofill"
    icon.tabIndex = -1

    const iconUrl = ext.runtime.getURL("icons/icon-48.png")
    const iconImg = document.createElement("img")
    iconImg.src = iconUrl
    iconImg.alt = "Akaromi"
    iconImg.className = "akaromi-badge-img iris-pass-badge-img"
    icon.appendChild(iconImg)

    inputIconMap.set(input, icon)

    let isInputHovered = false
    let isIconHovered = false
    let hideTimer = null

    function showIcon() {
      clearTimeout(hideTimer)
      updateIconPosition(input, icon)
      icon.classList.add("visible")
    }

    function scheduleHideIcon() {
      clearTimeout(hideTimer)
      hideTimer = setTimeout(() => {
        // Do not hide if the dropdown menu for this input is currently open!
        if (activeDropdownTarget === input) return
        if (document.activeElement === input) return
        if (isIconHovered || isInputHovered) return

        icon.classList.remove("visible")
      }, 150)
    }

    // Active field ONLY: Show when focused, hide when blurred
    input.addEventListener("focus", showIcon)
    input.addEventListener("blur", scheduleHideIcon)

    input.addEventListener("mouseenter", () => {
      isInputHovered = true
      if (document.activeElement === input) showIcon()
    })
    input.addEventListener("mouseleave", () => {
      isInputHovered = false
      scheduleHideIcon()
    })

    icon.addEventListener("mouseenter", () => {
      isIconHovered = true
      showIcon()
    })
    icon.addEventListener("mouseleave", () => {
      isIconHovered = false
      scheduleHideIcon()
    })

    icon.addEventListener("click", (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (activeDropdownTarget === input) {
        global.AkaromiMenu?.removeDropdown()
      } else {
        global.AkaromiMenu?.showFieldDropdown(input, icon)
      }
    })

    portal.appendChild(icon)

    // If input is ALREADY the active element on attach, show it
    if (document.activeElement === input) {
      showIcon()
    }
  }

  function removeBadgeForInput(input) {
    const icon = inputIconMap.get(input)
    if (icon) {
      icon.remove()
      inputIconMap.delete(input)
    }
    delete input.dataset.akaromiAttached
  }

  function cleanupRemovedInputs() {
    inputIconMap.forEach((icon, input) => {
      if (!document.body.contains(input)) {
        removeBadgeForInput(input)
      }
    })
  }

  function updateAllVisibleIcons() {
    inputIconMap.forEach((icon, input) => {
      if (icon.classList.contains("visible") || document.activeElement === input) {
        updateIconPosition(input, icon)
      }
    })
  }

  window.addEventListener("scroll", updateAllVisibleIcons, { passive: true })
  window.addEventListener("resize", updateAllVisibleIcons, { passive: true })

  global.AkaromiBadge = {
    attachBadgeToInput,
    removeBadgeForInput,
    cleanupRemovedInputs,
    updateIconPosition,
    updateAllVisibleIcons,
    setActiveDropdownTarget: (target) => { activeDropdownTarget = target },
    getActiveDropdownTarget: () => activeDropdownTarget,
    getIconForInput: (input) => inputIconMap.get(input),
  }
})(typeof window !== "undefined" ? window : globalThis)

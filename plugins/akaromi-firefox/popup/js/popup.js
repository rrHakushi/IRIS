/**
 * Akaromi for Firefox — Popup Coordinator & Entry Point
 */
;(function (global) {
  "use strict"

  const { showToast, ext, storage } = global.AkaromiUtils
  const state = global.AkaromiState

  // Header Elements
  const vaultSearchInput = document.getElementById("vault-search-input")
  const btnSearchClear = document.getElementById("btn-search-clear")
  const btnHeaderSync = document.getElementById("btn-header-sync")
  const btnHeaderAdd = document.getElementById("btn-header-add")
  const addDropdownMenu = document.getElementById("add-dropdown-menu")
  const btnDropdownGenerator = document.getElementById("btn-dropdown-generator")

  const btnVaultSelect = document.getElementById("btn-vault-select")
  const vaultDropdownMenu = document.getElementById("vault-dropdown-menu")
  const currentVaultLabel = document.getElementById("current-vault-label")

  // Sort Elements
  const btnSortToggle = document.getElementById("btn-sort-toggle")
  const sortDropdownMenu = document.getElementById("sort-dropdown-menu")

  // Empty state button
  const btnEmptyCreate = document.getElementById("btn-empty-create")

  // Mobile Back Button
  const btnMobileBack = document.getElementById("btn-mobile-back")
  const itemDetailPane = document.getElementById("item-detail-pane")
  const itemsListPane = document.getElementById("items-list-pane")

  // ----------------------------------------------------
  // Search Bar
  // ----------------------------------------------------
  vaultSearchInput?.addEventListener("input", (e) => {
    state.currentSearchQuery = e.target.value
    if (btnSearchClear) btnSearchClear.style.display = state.currentSearchQuery ? "flex" : "none"
    global.AkaromiVault?.renderCiphersList()
    storage.set({ akaromi_search_query: state.currentSearchQuery }).catch(() => {})
  })

  btnSearchClear?.addEventListener("click", () => {
    if (vaultSearchInput) vaultSearchInput.value = ""
    state.currentSearchQuery = ""
    if (btnSearchClear) btnSearchClear.style.display = "none"
    global.AkaromiVault?.renderCiphersList()
    vaultSearchInput?.focus()
    storage.remove("akaromi_search_query").catch(() => {})
  })

  // ----------------------------------------------------
  // Vault / Folder Dropdown Selector
  // ----------------------------------------------------
  btnVaultSelect?.addEventListener("click", (e) => {
    e.stopPropagation()
    if (!vaultDropdownMenu) return
    const isVisible = vaultDropdownMenu.style.display === "block"
    closeAllPopovers()
    if (!isVisible) {
      vaultDropdownMenu.style.display = "block"
    }
  })

  vaultDropdownMenu?.addEventListener("click", (e) => {
    const item = e.target.closest(".dropdown-item")
    if (!item) return
    const folderId = item.dataset.folderId || "all"
    const name = item.querySelector("span")?.textContent || "All items"
    global.AkaromiVault?.selectFolder(folderId, name)
  })

  // ----------------------------------------------------
  // Header Add (+) Menu
  // ----------------------------------------------------
  btnHeaderAdd?.addEventListener("click", (e) => {
    e.stopPropagation()
    if (!addDropdownMenu) return
    const isVisible = addDropdownMenu.style.display === "block"
    closeAllPopovers()
    if (!isVisible) {
      addDropdownMenu.style.display = "block"
    }
  })

  addDropdownMenu?.querySelectorAll("[data-create-type]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.createType || "login"
      addDropdownMenu.style.display = "none"
      global.AkaromiEditor?.openCreateModal(type)
    })
  })

  btnDropdownGenerator?.addEventListener("click", () => {
    if (addDropdownMenu) addDropdownMenu.style.display = "none"
    global.AkaromiGenerator?.openGenerator()
  })

  btnEmptyCreate?.addEventListener("click", () => {
    global.AkaromiEditor?.openCreateModal("login")
  })

  // ----------------------------------------------------
  // Sort Dropdown Popover
  // ----------------------------------------------------
  btnSortToggle?.addEventListener("click", (e) => {
    e.stopPropagation()
    if (!sortDropdownMenu) return
    const isVisible = sortDropdownMenu.style.display === "block"
    closeAllPopovers()
    if (!isVisible) {
      sortDropdownMenu.style.display = "block"
    }
  })

  sortDropdownMenu?.addEventListener("click", (e) => {
    const item = e.target.closest(".sort-dropdown-item")
    if (!item) return
    const sortKey = item.dataset.sort || "title_asc"
    state.activeSortOption = sortKey

    sortDropdownMenu.querySelectorAll(".sort-dropdown-item").forEach((b) => {
      b.classList.toggle("active", b.dataset.sort === sortKey)
    })

    storage.set({ akaromi_sort_option: sortKey }).catch(() => {})
    global.AkaromiVault?.sortCiphers(sortKey)
    sortDropdownMenu.style.display = "none"
    showToast("Items sorted")
  })

  // ----------------------------------------------------
  // Sync Button
  // ----------------------------------------------------
  btnHeaderSync?.addEventListener("click", async () => {
    showToast("Syncing...")
    try {
      await ext.runtime.sendMessage({ action: "SYNC_VAULT", payload: { force: true } })
      await global.AkaromiVault?.loadVaultData()
      showToast("Vault synchronized")
    } catch (err) {
      showToast("Sync error: " + (err.message || "Failed"))
    }
  })

  // ----------------------------------------------------
  // Mobile Detail Navigation
  // ----------------------------------------------------
  btnMobileBack?.addEventListener("click", () => {
    if (itemDetailPane) itemDetailPane.classList.remove("active")
    if (itemsListPane) itemsListPane.style.display = "flex"
  })

  // Close all popovers on outside click
  function closeAllPopovers() {
    if (vaultDropdownMenu) vaultDropdownMenu.style.display = "none"
    if (addDropdownMenu) addDropdownMenu.style.display = "none"
    if (sortDropdownMenu) sortDropdownMenu.style.display = "none"
  }

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".vault-select-wrapper") && !e.target.closest(".add-menu-wrapper") && !e.target.closest(".sort-wrapper")) {
      closeAllPopovers()
    }
  })

  // ----------------------------------------------------
  // Page Lifecycle & State Preservation
  // ----------------------------------------------------
  window.addEventListener("pagehide", () => {
    global.AkaromiAuth?.saveAuthDraft()
    global.AkaromiEditor?.saveEditDraftNow()
    global.AkaromiGenerator?.saveGeneratorDraftNow()
  })

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      global.AkaromiAuth?.saveAuthDraft()
      global.AkaromiEditor?.saveEditDraftNow()
      global.AkaromiGenerator?.saveGeneratorDraftNow()
    }
  })

  // ----------------------------------------------------
  // App Initialization
  // ----------------------------------------------------
  async function init() {
    try {
      let tabs = await ext.tabs.query({ active: true, currentWindow: true }).catch(() => [])
      if (!tabs || tabs.length === 0) {
        tabs = await ext.tabs.query({ active: true }).catch(() => [])
      }
      state.currentTab = tabs?.[0] || null
    } catch (e) {
      console.warn("[Akaromi] Tab query error:", e)
    }

    // Restore saved sort option
    try {
      const saved = await storage.get(["akaromi_sort_option", "akaromi_search_query"])
      if (saved?.akaromi_sort_option) {
        state.activeSortOption = saved.akaromi_sort_option
        sortDropdownMenu?.querySelectorAll(".sort-dropdown-item").forEach((b) => {
          b.classList.toggle("active", b.dataset.sort === state.activeSortOption)
        })
      }
      if (saved?.akaromi_search_query) {
        state.currentSearchQuery = saved.akaromi_search_query
        if (vaultSearchInput) vaultSearchInput.value = state.currentSearchQuery
        if (btnSearchClear) btnSearchClear.style.display = "flex"
      }
    } catch {}

    // Check auth and unlock status from background
    ext.runtime.sendMessage({ action: "GET_STATUS" }, async (response) => {
      if (!response || !response.isAuthenticated) {
        const restoredMfa = await global.AkaromiAuth?.restoreDraftState()
        if (!restoredMfa) {
          global.AkaromiAuth?.showLoginView()
        }
      } else if (!response.isUnlocked) {
        global.AkaromiAuth?.showLockedView(response.user, response)
      } else {
        global.AkaromiAuth?.showUnlockedView(response.user)
      }

      // Load and apply persistent settings
      await global.AkaromiSettings?.loadSettings()

      // Restore drafts
      await global.AkaromiEditor?.restoreDraftState()
      await global.AkaromiGenerator?.restoreDraftState()
    })
  }

  // Run
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init)
  } else {
    init()
  }
})(typeof window !== "undefined" ? window : globalThis)

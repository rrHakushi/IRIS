/**
 * Akaromi for Firefox — Shared State & Storage Management
 */
;(function (global) {
  "use strict"

  const ext = typeof browser !== "undefined" ? browser : chrome
  const storage = typeof IrisStorage !== "undefined" ? IrisStorage : ext.storage.local
  const domParser = new DOMParser()

  function safeSetTemplate(element, htmlString) {
    element.replaceChildren()
    const doc = domParser.parseFromString(htmlString, "text/html")
    while (doc.body.firstChild) {
      element.appendChild(doc.body.firstChild)
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

  function showToast(message, duration = 2500) {
    const toast = document.getElementById("popup-toast")
    const toastText = document.getElementById("popup-toast-text")
    if (!toast || !toastText) return

    toastText.textContent = message
    toast.classList.add("visible")
    setTimeout(() => {
      toast.classList.remove("visible")
    }, duration)
  }

  // ----------------------------------------------------
  // Global Popup State
  // ----------------------------------------------------
  const AppState = {
    currentTab: null,
    allCiphers: [],
    allFolders: [],
    matchingCiphers: [],
    selectedCipherId: null,
    currentVaultId: "all",
    currentSearchQuery: "",
    activeListFilter: "all", // "all" | "recent"
    activeSortOption: "title_asc", // "title_asc" | "title_desc" | "updated" | "created_desc" | "created_asc" | "recent_used"
    editingCipherId: null,
    currentEditType: "login",
    generatorMode: "password",
    generatorTargetInput: null, // Input element currently receiving generated credentials
  }

  global.AkaromiState = AppState
  global.AkaromiUtils = {
    safeSetTemplate,
    escapeHtml,
    showToast,
    ext,
    storage,
  }
})(typeof window !== "undefined" ? window : globalThis)

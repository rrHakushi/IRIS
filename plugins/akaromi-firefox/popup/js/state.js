/**
 * Akaromi for Firefox — Shared State & Storage Management
 */
;(function (global) {
  "use strict"

  const ext = typeof browser !== "undefined" ? browser : chrome
  const storage = typeof IrisStorage !== "undefined" ? IrisStorage : ext.storage.local
  const domParser = new DOMParser()

    // Step 1: DOM Template Rendering & HTML Sanitization
  // Step 1.1: Safe DOMParser Child Replacement & Entity Escaping
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

    // Step 2: Ephemeral Popup Toast Notifications
  // Step 2.1: Toast Visibility & Auto-Dismiss Timer
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
    // Step 3: Reactive Centralized Popup State Store
  // Step 3.1: AppState Object Properties & View Tracking
  const AppState = {
    currentUser: null,
    currentTab: null,
    allCiphers: [],
    matchingCiphers: [],
    selectedCipherId: null,
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

/**
 * Akaromi for Firefox — Item Editor & Creator Engine
 */
;(function (global) {
  "use strict"

  const { safeSetTemplate, escapeHtml, showToast, ext, storage } = global.AkaromiUtils
  const state = global.AkaromiState

  // DOM Elements
  const modalEditCipher = document.getElementById("modal-edit-cipher")
  const editModalHeading = document.getElementById("edit-modal-heading")
  const formEditCipher = document.getElementById("form-edit-cipher")
  const btnEditCancel = document.getElementById("btn-edit-cancel")
  const btnEditSave = document.getElementById("btn-edit-save")
  const editModalError = document.getElementById("edit-modal-error")

  const editTitle = document.getElementById("edit-title")
  const editFolderSelect = document.getElementById("edit-folder-select")

  // Login field wrappers
  const groupFieldsLogin = document.getElementById("group-fields-login")
  const groupFieldsNote = document.getElementById("group-fields-note")
  const groupFieldsCard = document.getElementById("group-fields-card")
  const groupFieldsSsh = document.getElementById("group-fields-ssh")
  const groupFieldsIdentity = document.getElementById("group-fields-identity")
  const groupFieldsOther = document.getElementById("group-fields-other")

  const wrapEmailOrUsername = document.getElementById("wrap-email-or-username")
  const wrapSplitFields = document.getElementById("wrap-split-fields")
  const btnAddUsernameField = document.getElementById("btn-add-username-field")
  const editEmailOrUsername = document.getElementById("edit-email-or-username")
  const editEmail = document.getElementById("edit-email")
  const editUsername = document.getElementById("edit-username")

  const editPassword = document.getElementById("edit-password")
  const btnToggleEditPassEye = document.getElementById("btn-toggle-edit-pass-eye")
  const btnEditRegenPass = document.getElementById("btn-edit-regen-pass")
  const editPassStrengthText = document.getElementById("edit-pass-strength-text")
  const editTotpSecret = document.getElementById("edit-totp-secret")
  const btnScanQr = document.getElementById("btn-scan-qr")
  const wrapEditTotpInactive = document.getElementById("wrap-edit-totp-inactive")
  const wrapEditTotpActive = document.getElementById("wrap-edit-totp-active")
  const btnEnableTotp = document.getElementById("btn-enable-totp")
  const btnRemoveTotpSecret = document.getElementById("btn-remove-totp-secret")

  function setTotpActiveState(active) {
    if (wrapEditTotpInactive) wrapEditTotpInactive.style.display = active ? "none" : "flex"
    if (wrapEditTotpActive) wrapEditTotpActive.style.display = active ? "flex" : "none"
  }

  async function getCurrentTabUrl() {
    if (state.currentTab?.url && !state.currentTab.url.startsWith("about:") && !state.currentTab.url.startsWith("moz-extension:")) {
      return state.currentTab.url
    }
    try {
      const tabs = await ext.tabs.query({ active: true, currentWindow: true })
      const activeUrl = tabs?.[0]?.url
      if (activeUrl && !activeUrl.startsWith("about:") && !activeUrl.startsWith("moz-extension:")) {
        state.currentTab = tabs[0]
        return activeUrl
      }
    } catch {}
    return ""
  }

  const editWebsitesList = document.getElementById("edit-websites-list")
  const btnAddWebsiteRow = document.getElementById("btn-add-website-row")

  const editAdditionalPasswordsList = document.getElementById("edit-additional-passwords-list")
  const btnAddAdditionalPasswordRow = document.getElementById("btn-add-additional-password-row")

  const editGeneralNotes = document.getElementById("edit-general-notes")
  const editNoteBody = document.getElementById("edit-note-body")
  const editCardHolder = document.getElementById("edit-card-holder")
  const editCardNumber = document.getElementById("edit-card-number")
  const editCardExp = document.getElementById("edit-card-exp")
  const editCardCvv = document.getElementById("edit-card-cvv")
  const editCardPin = document.getElementById("edit-card-pin")
  const editSshKeytype = document.getElementById("edit-ssh-keytype")
  const editSshPublickey = document.getElementById("edit-ssh-publickey")
  const editSshPrivatekey = document.getElementById("edit-ssh-privatekey")
  const editSshPassphrase = document.getElementById("edit-ssh-passphrase")
  const editIdFullname = document.getElementById("edit-id-fullname")
  const editIdEmail = document.getElementById("edit-id-email")
  const editIdPhone = document.getElementById("edit-id-phone")
  const editIdAddress = document.getElementById("edit-id-address")
  const editIdCompany = document.getElementById("edit-id-company")

  let editDraftDebounceTimer = null

  // ----------------------------------------------------
  // Open Create / Edit Modals
  // ----------------------------------------------------
  async function openCreateModal(type = "login") {
    state.editingCipherId = null
    const typeTitles = {
      login: "New Login",
      note: "New Note",
      card: "New Credit Card",
      ssh: "New SSH Key",
      identity: "New Identity",
      other: "New Item",
    }
    if (editModalHeading) editModalHeading.textContent = typeTitles[type] || "New Item"
    if (formEditCipher) formEditCipher.reset()
    if (editModalError) editModalError.style.display = "none"

    if (wrapEmailOrUsername) wrapEmailOrUsername.style.display = "flex"
    if (wrapSplitFields) wrapSplitFields.style.display = "none"
    if (btnAddUsernameField) btnAddUsernameField.style.display = "inline-flex"

    if (editTotpSecret) {
      editTotpSecret.value = ""
      editTotpSecret.type = "password"
    }
    setTotpActiveState(false)

    if (editWebsitesList) {
      editWebsitesList.replaceChildren()
    }

    if (editAdditionalPasswordsList) {
      editAdditionalPasswordsList.replaceChildren()
    }

    // Populate current folders in dropdown
    populateFolderSelect()
    if (editFolderSelect && state.currentVaultId && state.currentVaultId !== "all") {
      editFolderSelect.value = state.currentVaultId
    }

    setEditItemType(type)

    if (modalEditCipher) {
      modalEditCipher.style.display = "flex"
      // Smooth slide-in fix: prevent container horizontal scroll jump on focus
      requestAnimationFrame(() => {
        editTitle?.focus({ preventScroll: true })
      })
    }

    // Auto-fill active tab URL and suggested title for new login items
    if (type === "login") {
      const activeUrl = await getCurrentTabUrl()
      if (editWebsitesList && editWebsitesList.children.length === 0) {
        addWebsiteRowToEdit(activeUrl || "", 0)
      }
      if (activeUrl && editTitle && !editTitle.value) {
        try {
          const u = new URL(activeUrl)
          editTitle.value = u.hostname.replace(/^www\./, "")
        } catch {}
      }
    }

    saveEditDraftNow()
  }

  function openEditModal(cipher) {
    if (!cipher) return
    state.editingCipherId = cipher.id
    if (editModalHeading) editModalHeading.textContent = "Edit Item"
    if (formEditCipher) formEditCipher.reset()
    if (editModalError) editModalError.style.display = "none"

    populateFolderSelect()
    if (editFolderSelect) editFolderSelect.value = cipher.folderId || ""

    const data = cipher.data || {}
    if (editTitle) editTitle.value = cipher.title || ""

    const subType = data.itemType || (cipher.type === "SSH_KEY" ? "ssh" : "login")
    setEditItemType(subType)

    if (subType === "login") {
      if (data.email && data.username && data.email !== data.username) {
        if (wrapEmailOrUsername) wrapEmailOrUsername.style.display = "none"
        if (wrapSplitFields) wrapSplitFields.style.display = "block"
        if (btnAddUsernameField) btnAddUsernameField.style.display = "none"
        if (editEmail) editEmail.value = data.email
        if (editUsername) editUsername.value = data.username
      } else {
        if (wrapEmailOrUsername) wrapEmailOrUsername.style.display = "flex"
        if (wrapSplitFields) wrapSplitFields.style.display = "none"
        if (btnAddUsernameField) btnAddUsernameField.style.display = "inline-flex"
        if (editEmailOrUsername) editEmailOrUsername.value = data.email || data.username || ""
      }

      if (editPassword) {
        editPassword.value = data.password || ""
        editPassword.type = "password"
        if (btnToggleEditPassEye) IrisIcons.swap(btnToggleEditPassEye, "eye")
        evaluatePasswordStrength(data.password || "")
      }
      const hasTotp = Boolean(data.totpSecret && data.totpSecret.trim())
      if (editTotpSecret) {
        editTotpSecret.value = data.totpSecret || ""
        editTotpSecret.type = "password"
      }
      setTotpActiveState(hasTotp)

      // Websites
      if (editWebsitesList) {
        editWebsitesList.replaceChildren()
        const uris = data.uris || []
        if (uris.length > 0) {
          uris.forEach((u) => {
            const uriVal = typeof u === "string" ? u : (u.uri || "")
            const matchVal = (typeof u === "object" && u && u.match !== undefined) ? u.match : 0
            addWebsiteRowToEdit(uriVal, matchVal)
          })
        } else {
          addWebsiteRowToEdit("", 0)
        }
      }

      // Additional Passwords
      if (editAdditionalPasswordsList) {
        editAdditionalPasswordsList.replaceChildren()
        const additional = data.additionalPasswords || []
        additional.forEach((entry) => {
          addAdditionalPasswordRow(entry.name || "", entry.value || "")
        })
      }

      if (editGeneralNotes) editGeneralNotes.value = data.notes || ""
    } else if (subType === "note") {
      if (editNoteBody) editNoteBody.value = data.notes || ""
    } else if (subType === "card") {
      if (editCardHolder) editCardHolder.value = data.cardHolder || ""
      if (editCardNumber) editCardNumber.value = data.cardNumber || ""
      if (editCardExp) editCardExp.value = data.cardExp || ""
      if (editCardCvv) editCardCvv.value = data.cardCvv || ""
      if (editCardPin) editCardPin.value = data.cardPin || ""
      if (editGeneralNotes) editGeneralNotes.value = data.notes || ""
    } else if (subType === "ssh") {
      if (editSshKeytype) editSshKeytype.value = data.keyType || "ED25519"
      if (editSshPublickey) editSshPublickey.value = data.publicKey || ""
      if (editSshPrivatekey) editSshPrivatekey.value = data.privateKey || ""
      if (editSshPassphrase) editSshPassphrase.value = data.passphrase || ""
      if (editGeneralNotes) editGeneralNotes.value = data.notes || ""
    } else if (subType === "identity") {
      if (editIdFullname) editIdFullname.value = data.fullName || ""
      if (editIdEmail) editIdEmail.value = data.email || ""
      if (editIdPhone) editIdPhone.value = data.phone || ""
      if (editIdAddress) editIdAddress.value = data.address || ""
      if (editIdCompany) editIdCompany.value = data.company || ""
      if (editGeneralNotes) editGeneralNotes.value = data.notes || ""
    }

    if (modalEditCipher) {
      modalEditCipher.style.display = "flex"
      requestAnimationFrame(() => {
        editTitle?.focus({ preventScroll: true })
      })
    }

    saveEditDraftNow()
  }

  function populateFolderSelect() {
    if (!editFolderSelect) return
    editFolderSelect.replaceChildren()

    const defaultOpt = document.createElement("option")
    defaultOpt.value = ""
    defaultOpt.textContent = "Personal"
    editFolderSelect.appendChild(defaultOpt)

    state.allFolders.forEach((f) => {
      const opt = document.createElement("option")
      opt.value = f.id
      opt.textContent = f.name
      editFolderSelect.appendChild(opt)
    })
  }

  function setEditItemType(type) {
    state.currentEditType = type

    if (groupFieldsLogin) groupFieldsLogin.style.display = type === "login" ? "flex" : "none"
    if (groupFieldsNote) groupFieldsNote.style.display = type === "note" ? "block" : "none"
    if (groupFieldsCard) groupFieldsCard.style.display = type === "card" ? "block" : "none"
    if (groupFieldsSsh) groupFieldsSsh.style.display = type === "ssh" ? "block" : "none"
    if (groupFieldsIdentity) groupFieldsIdentity.style.display = type === "identity" ? "block" : "none"
    if (groupFieldsOther) groupFieldsOther.style.display = type === "other" ? "block" : "none"

    queueSaveEditDraft()
  }

  // ----------------------------------------------------
  // Username / Email Toggle
  // ----------------------------------------------------
  btnAddUsernameField?.addEventListener("click", () => {
    const val = editEmailOrUsername?.value.trim() || ""
    if (wrapEmailOrUsername) wrapEmailOrUsername.style.display = "none"
    if (wrapSplitFields) wrapSplitFields.style.display = "block"
    if (btnAddUsernameField) btnAddUsernameField.style.display = "none"

    if (val.includes("@")) {
      if (editEmail) editEmail.value = val
      if (editUsername) {
        editUsername.value = ""
        editUsername.focus()
      }
    } else {
      if (editUsername) editUsername.value = val
      if (editEmail) {
        editEmail.value = ""
        editEmail.focus()
      }
    }
    queueSaveEditDraft()
  })

  // ----------------------------------------------------
  // Website Rows with Detection Methods
  // ----------------------------------------------------
  function addWebsiteRowToEdit(value = "", match = 0) {
    if (!editWebsitesList) return
    const row = document.createElement("div")
    row.className = "website-input-row"

    let normMatch = 0
    if (typeof IrisMatching !== "undefined" && IrisMatching.normalizeMatchStrategy) {
      normMatch = IrisMatching.normalizeMatchStrategy(match)
    } else {
      const parsed = parseInt(match, 10)
      normMatch = isNaN(parsed) ? 0 : parsed
    }

    safeSetTemplate(
      row,
      `
      <input type="url" class="form-input font-mono input-website-url" placeholder="https://example.com" value="${escapeHtml(value)}" />
      <select class="form-select mini select-website-match" title="Detection method">
        <option value="0"${normMatch === 0 ? " selected" : ""}>Base domain</option>
        <option value="1"${normMatch === 1 ? " selected" : ""}>Host</option>
        <option value="2"${normMatch === 2 ? " selected" : ""}>Starts with</option>
        <option value="3"${normMatch === 3 ? " selected" : ""}>Exact</option>
        <option value="4"${normMatch === 4 ? " selected" : ""}>Regular expression</option>
        <option value="5"${normMatch === 5 ? " selected" : ""}>Never</option>
      </select>
      <button type="button" class="icon-btn-round mini btn-remove-website" title="Remove website">
        <svg class="tabler-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 6 6 18M6 6l12 12"/>
        </svg>
      </button>
    `
    )
    row.querySelector(".btn-remove-website")?.addEventListener("click", () => {
      row.remove()
      queueSaveEditDraft()
    })
    row.querySelector(".input-website-url")?.addEventListener("input", queueSaveEditDraft)
    row.querySelector(".select-website-match")?.addEventListener("change", queueSaveEditDraft)
    editWebsitesList.appendChild(row)
  }

  btnAddWebsiteRow?.addEventListener("click", async () => {
    let urlToFill = await getCurrentTabUrl()
    const existingUrls = Array.from(document.querySelectorAll(".input-website-url")).map((inp) => inp.value.trim())
    if (existingUrls.includes(urlToFill)) {
      urlToFill = ""
    }
    addWebsiteRowToEdit(urlToFill || "", 0)
    queueSaveEditDraft()
  })

  // ----------------------------------------------------
  // Additional Passwords Rows
  // ----------------------------------------------------
  function addAdditionalPasswordRow(name = "", value = "") {
    if (!editAdditionalPasswordsList) return
    const row = document.createElement("div")
    row.className = "additional-pass-row-item"
    safeSetTemplate(
      row,
      `
      <div class="pass-row-fields">
        <input type="text" class="form-input pass-row-name" placeholder="Label (e.g. PIN, Recovery Code)" value="${escapeHtml(name)}" />
        <div class="pass-val-wrap">
          <input type="password" class="form-input font-mono pass-row-value" placeholder="Password or Code" value="${escapeHtml(value)}" />
          <div class="pass-val-actions">
            <button type="button" class="icon-btn-round mini btn-toggle-addpass-eye" title="Toggle visibility">
              <svg class="tabler-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="2" />
                <path d="M22 12c-2.667 4.667-6 7-10 7s-7.333-2.333-10-7c2.667-4.667 6-7 10-7s7.333 2.333 10 7" />
              </svg>
            </button>
            <button type="button" class="icon-btn-round mini btn-gen-addpass" title="Generate password">
              <svg class="tabler-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4m-4 4a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      <button type="button" class="icon-btn-round mini btn-remove-addpass" title="Remove password">
        <svg class="tabler-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 6 6 18M6 6l12 12"/>
        </svg>
      </button>
    `
    )

    const valInput = row.querySelector(".pass-row-value")
    const eyeBtn = row.querySelector(".btn-toggle-addpass-eye")
    const genBtn = row.querySelector(".btn-gen-addpass")
    const removeBtn = row.querySelector(".btn-remove-addpass")

    eyeBtn?.addEventListener("click", () => {
      if (!valInput) return
      if (valInput.type === "password") {
        valInput.type = "text"
        IrisIcons.swap(eyeBtn, "eye-off")
      } else {
        valInput.type = "password"
        IrisIcons.swap(eyeBtn, "eye")
      }
    })

    genBtn?.addEventListener("click", () => {
      if (valInput && global.AkaromiGenerator) {
        global.AkaromiGenerator.openForInput(valInput)
      }
    })

    removeBtn?.addEventListener("click", () => {
      row.remove()
      queueSaveEditDraft()
    })

    row.querySelectorAll("input").forEach((inp) => {
      inp.addEventListener("input", queueSaveEditDraft)
    })

    editAdditionalPasswordsList.appendChild(row)
  }

  btnAddAdditionalPasswordRow?.addEventListener("click", () => {
    addAdditionalPasswordRow("", "")
    queueSaveEditDraft()
  })

  // ----------------------------------------------------
  // Password Visibility & Generation Triggers
  // ----------------------------------------------------
  btnToggleEditPassEye?.addEventListener("click", () => {
    if (!editPassword) return
    if (editPassword.type === "password") {
      editPassword.type = "text"
      IrisIcons.swap(btnToggleEditPassEye, "eye-off")
    } else {
      editPassword.type = "password"
      IrisIcons.swap(btnToggleEditPassEye, "eye")
    }
  })

  // User requirement: Clicking generate password opens generator modal with options!
  btnEditRegenPass?.addEventListener("click", () => {
    if (global.AkaromiGenerator && editPassword) {
      global.AkaromiGenerator.openForInput(editPassword)
    }
  })

  editPassword?.addEventListener("input", (e) => {
    evaluatePasswordStrength(e.target.value)
  })

  function evaluatePasswordStrength(pass) {
    if (!editPassStrengthText) return
    if (!pass) {
      editPassStrengthText.textContent = "Password"
      editPassStrengthText.className = "form-field-label"
      return
    }
    let score = 0
    if (pass.length >= 8) score++
    if (pass.length >= 14) score++
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++
    if (/[0-9]/.test(pass)) score++
    if (/[^A-Za-z0-9]/.test(pass)) score++

    if (score >= 4) {
      editPassStrengthText.textContent = "Password · Strong"
      editPassStrengthText.className = "form-field-label text-success"
    } else if (score >= 2) {
      editPassStrengthText.textContent = "Password · Medium"
      editPassStrengthText.className = "form-field-label"
    } else {
      editPassStrengthText.textContent = "Password · Weak"
      editPassStrengthText.className = "form-field-label text-danger"
    }
  }

  // QR Code Scanner Action
  btnScanQr?.addEventListener("click", async () => {
    try {
      const tabs = await ext.tabs.query({ active: true, currentWindow: true })
      const activeTab = tabs[0]
      if (activeTab?.id) {
        saveEditDraftNow()
        const tabId = activeTab.id

        // Ensure content script is running even if host permissions weren't pre-granted
        if (ext.scripting?.executeScript) {
          try {
            await ext.tabs.sendMessage(tabId, { action: "PING" })
          } catch {
            await ext.scripting.insertCSS({
              target: { tabId },
              files: ["content/badge.css", "content/menu.css", "content/content.css"],
            }).catch(() => {})
            await ext.scripting.executeScript({
              target: { tabId },
              files: [
                "lib/icons.js",
                "content/detection.js",
                "content/badge.js",
                "content/fill.js",
                "content/menu.js",
                "content/content.js",
              ],
            }).catch(() => {})
          }
        }

        await ext.tabs.sendMessage(tabId, { action: "START_QR_CAPTURE" })
        if (modalEditCipher) modalEditCipher.style.display = "none"
        showToast("Click and drag to select the QR code on the page")
      }
    } catch (err) {
      console.warn("[Akaromi] QR scan start failed:", err)
      showToast("QR scan is unavailable on this tab")
    }
  })
  // 2FA Key Management Actions
  btnEnableTotp?.addEventListener("click", () => {
    setTotpActiveState(true)
    editTotpSecret?.focus()
    queueSaveEditDraft()
  })

  btnRemoveTotpSecret?.addEventListener("click", () => {
    if (editTotpSecret) {
      editTotpSecret.value = ""
      editTotpSecret.type = "password"
    }
    setTotpActiveState(false)
    queueSaveEditDraft()
  })

  // Only show 2FA secret when input field is active (focused); hide when inactive (blurred)
  editTotpSecret?.addEventListener("focus", () => {
    editTotpSecret.type = "text"
  })

  editTotpSecret?.addEventListener("blur", () => {
    editTotpSecret.type = "password"
  })

  // ----------------------------------------------------
  // Save Submission
  // ----------------------------------------------------
  btnEditSave?.addEventListener("click", async () => {
    const title = editTitle?.value.trim()
    if (!title) {
      if (editModalError) {
        editModalError.textContent = "Title is required"
        editModalError.style.display = "block"
      }
      return
    }

    if (btnEditSave) {
      btnEditSave.disabled = true
      btnEditSave.textContent = "Saving..."
    }

    try {
      const folderId = editFolderSelect?.value || null
      let dataPayload = { itemType: state.currentEditType }

      if (state.currentEditType === "login") {
        let email = ""
        let username = ""

        if (wrapSplitFields?.style.display === "block") {
          email = editEmail?.value.trim() || ""
          username = editUsername?.value.trim() || ""
        } else {
          const single = editEmailOrUsername?.value.trim() || ""
          if (single.includes("@")) {
            email = single
            username = single
          } else {
            username = single
            email = ""
          }
        }

        const uris = []
        document.querySelectorAll(".website-input-row").forEach((row) => {
          const urlInput = row.querySelector(".input-website-url")
          const matchSelect = row.querySelector(".select-website-match")
          const u = urlInput?.value.trim()
          if (u) {
            const matchVal = matchSelect ? parseInt(matchSelect.value, 10) : 0
            uris.push({ uri: u, match: isNaN(matchVal) ? 0 : matchVal })
          }
        })

        const additionalPasswords = []
        document.querySelectorAll(".additional-pass-row-item").forEach((row) => {
          const n = row.querySelector(".pass-row-name")?.value.trim()
          const v = row.querySelector(".pass-row-value")?.value || ""
          if (n || v) {
            additionalPasswords.push({
              id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
              name: n || "Password",
              value: v,
            })
          }
        })

        const isTotpActive = wrapEditTotpActive && wrapEditTotpActive.style.display !== "none"
        const totpSecret = isTotpActive ? (editTotpSecret?.value.trim().replace(/\s+/g, "") || "") : ""

        dataPayload = {
          ...dataPayload,
          email,
          username,
          password: editPassword?.value || "",
          totpSecret,
          uris,
          additionalPasswords,
          notes: editGeneralNotes?.value.trim() || "",
        }
      } else if (state.currentEditType === "note") {
        dataPayload = {
          ...dataPayload,
          notes: editNoteBody?.value.trim() || "",
        }
      } else if (state.currentEditType === "card") {
        dataPayload = {
          ...dataPayload,
          cardHolder: editCardHolder?.value.trim() || "",
          cardNumber: editCardNumber?.value.trim() || "",
          cardExp: editCardExp?.value.trim() || "",
          cardCvv: editCardCvv?.value.trim() || "",
          cardPin: editCardPin?.value.trim() || "",
          notes: editGeneralNotes?.value.trim() || "",
        }
      } else if (state.currentEditType === "ssh") {
        dataPayload = {
          ...dataPayload,
          keyType: editSshKeytype?.value || "ED25519",
          publicKey: editSshPublickey?.value.trim() || "",
          privateKey: editSshPrivatekey?.value.trim() || "",
          passphrase: editSshPassphrase?.value || "",
          notes: editGeneralNotes?.value.trim() || "",
        }
      } else if (state.currentEditType === "identity") {
        dataPayload = {
          ...dataPayload,
          fullName: editIdFullname?.value.trim() || "",
          email: editIdEmail?.value.trim() || "",
          phone: editIdPhone?.value.trim() || "",
          address: editIdAddress?.value.trim() || "",
          company: editIdCompany?.value.trim() || "",
          notes: editGeneralNotes?.value.trim() || "",
        }
      }

      const payload = {
        title,
        folderId,
        type: state.currentEditType === "ssh" ? "SSH_KEY" : "LOGIN",
        data: dataPayload,
      }

      let res
      if (state.editingCipherId) {
        res = await ext.runtime.sendMessage({
          action: "UPDATE_CIPHER",
          payload: { id: state.editingCipherId, ...payload },
        })
        if (res?.error) throw new Error(res.error)
        showToast("Item updated successfully")
      } else {
        res = await ext.runtime.sendMessage({
          action: "CREATE_CIPHER",
          payload,
        })
        if (res?.error) throw new Error(res.error)
        showToast("Item created successfully")
      }

      clearEditDraft()
      if (modalEditCipher) modalEditCipher.style.display = "none"
      await global.AkaromiVault?.loadVaultData()

      if (res?.cipher?.id) {
        global.AkaromiVault?.selectCipher(res.cipher.id)
      }
    } catch (err) {
      if (editModalError) {
        editModalError.textContent = err.message || "Failed to save item"
        editModalError.style.display = "block"
      }
    } finally {
      if (btnEditSave) {
        btnEditSave.disabled = false
        btnEditSave.textContent = "Save"
      }
    }
  })

  btnEditCancel?.addEventListener("click", () => {
    clearEditDraft()
    if (modalEditCipher) modalEditCipher.style.display = "none"
  })

  // ----------------------------------------------------
  // Draft State Management
  // ----------------------------------------------------
  function getEditFormDraft() {
    const uris = []
    document.querySelectorAll(".website-input-row").forEach((row) => {
      const urlInput = row.querySelector(".input-website-url")
      const matchSelect = row.querySelector(".select-website-match")
      const u = urlInput?.value.trim() || ""
      const m = matchSelect ? parseInt(matchSelect.value, 10) : 0
      if (u || m !== 0) {
        uris.push({ uri: u, match: isNaN(m) ? 0 : m })
      }
    })

    const additionalPasswords = []
    document.querySelectorAll(".additional-pass-row-item").forEach((row) => {
      const n = row.querySelector(".pass-row-name")?.value || ""
      const v = row.querySelector(".pass-row-value")?.value || ""
      if (n || v) additionalPasswords.push({ name: n, value: v })
    })

    return {
      type: state.currentEditType || "login",
      title: editTitle?.value || "",
      folderId: editFolderSelect?.value || "",
      splitUsername: wrapSplitFields?.style.display === "block",
      emailOrUsername: editEmailOrUsername?.value || "",
      email: editEmail?.value || "",
      username: editUsername?.value || "",
      password: editPassword?.value || "",
      totpActive: wrapEditTotpActive?.style.display === "flex",
      totpSecret: editTotpSecret?.value || "",
      websites: uris.length > 0 ? uris : [{ uri: "", match: 0 }],
      additionalPasswords,
      notes: editGeneralNotes?.value || "",
      noteBody: editNoteBody?.value || "",
      cardHolder: editCardHolder?.value || "",
      cardNumber: editCardNumber?.value || "",
      cardExp: editCardExp?.value || "",
      cardCvv: editCardCvv?.value || "",
      cardPin: editCardPin?.value || "",
      sshKeytype: editSshKeytype?.value || "ED25519",
      sshPublickey: editSshPublickey?.value || "",
      sshPrivatekey: editSshPrivatekey?.value || "",
      sshPassphrase: editSshPassphrase?.value || "",
      idFullname: editIdFullname?.value || "",
      idEmail: editIdEmail?.value || "",
      idPhone: editIdPhone?.value || "",
      idAddress: editIdAddress?.value || "",
      idCompany: editIdCompany?.value || "",
    }
  }

  function queueSaveEditDraft() {
    clearTimeout(editDraftDebounceTimer)
    editDraftDebounceTimer = setTimeout(saveEditDraftNow, 120)
  }

  function saveEditDraftNow() {
    clearTimeout(editDraftDebounceTimer)
    if (modalEditCipher && modalEditCipher.style.display === "flex") {
      storage
        .set({
          akaromi_edit_draft: {
            isOpen: true,
            mode: state.editingCipherId ? "edit" : "create",
            editingCipherId: state.editingCipherId,
            data: getEditFormDraft(),
          },
        })
        .catch(() => {})
    }
  }

  function clearEditDraft() {
    clearTimeout(editDraftDebounceTimer)
    storage.remove("akaromi_edit_draft").catch(() => {})
  }

  async function restoreDraftState() {
    try {
      const data = await storage.get(["akaromi_edit_draft"])
      const editDraft = data?.akaromi_edit_draft
      if (editDraft?.isOpen && editDraft.data) {
        const d = editDraft.data
        state.editingCipherId = editDraft.mode === "edit" ? editDraft.editingCipherId : null
        if (editModalHeading) editModalHeading.textContent = state.editingCipherId ? "Edit Item" : "New Item"
        if (formEditCipher) formEditCipher.reset()
        if (editModalError) editModalError.style.display = "none"

        populateFolderSelect()
        setEditItemType(d.type || "login")

        if (editTitle) editTitle.value = d.title || ""
        if (editFolderSelect) editFolderSelect.value = d.folderId || ""

        if (d.splitUsername) {
          if (wrapEmailOrUsername) wrapEmailOrUsername.style.display = "none"
          if (wrapSplitFields) wrapSplitFields.style.display = "block"
          if (btnAddUsernameField) btnAddUsernameField.style.display = "none"
          if (editEmail) editEmail.value = d.email || ""
          if (editUsername) editUsername.value = d.username || ""
        } else {
          if (wrapEmailOrUsername) wrapEmailOrUsername.style.display = "flex"
          if (wrapSplitFields) wrapSplitFields.style.display = "none"
          if (btnAddUsernameField) btnAddUsernameField.style.display = "inline-flex"
          if (editEmailOrUsername) editEmailOrUsername.value = d.emailOrUsername || d.email || d.username || ""
        }

        if (editPassword) {
          editPassword.value = d.password || ""
          evaluatePasswordStrength(d.password || "")
        }
        const hasTotp = Boolean(d.totpSecret && d.totpSecret.trim()) || Boolean(d.totpActive)
        if (editTotpSecret) {
          editTotpSecret.value = d.totpSecret || ""
          editTotpSecret.type = "password"
        }
        setTotpActiveState(hasTotp)

        if (editWebsitesList) {
          editWebsitesList.replaceChildren()
          const uris = d.websites && d.websites.length > 0 ? d.websites : [{ uri: "", match: 0 }]
          uris.forEach((u) => {
            const uriVal = typeof u === "string" ? u : (u.uri || "")
            const matchVal = (typeof u === "object" && u && u.match !== undefined) ? u.match : 0
            addWebsiteRowToEdit(uriVal, matchVal)
          })
        }

        if (editAdditionalPasswordsList) {
          editAdditionalPasswordsList.replaceChildren()
          const additional = d.additionalPasswords || []
          additional.forEach((entry) => {
            addAdditionalPasswordRow(entry.name || "", entry.value || "")
          })
        }

        if (editGeneralNotes) editGeneralNotes.value = d.notes || ""
        if (editNoteBody && d.noteBody !== undefined) editNoteBody.value = d.noteBody
        if (editCardHolder && d.cardHolder !== undefined) editCardHolder.value = d.cardHolder
        if (editCardNumber && d.cardNumber !== undefined) editCardNumber.value = d.cardNumber
        if (editCardExp && d.cardExp !== undefined) editCardExp.value = d.cardExp
        if (editCardCvv && d.cardCvv !== undefined) editCardCvv.value = d.cardCvv
        if (editCardPin && d.cardPin !== undefined) editCardPin.value = d.cardPin
        if (editSshKeytype && d.sshKeytype !== undefined) editSshKeytype.value = d.sshKeytype
        if (editSshPublickey && d.sshPublickey !== undefined) editSshPublickey.value = d.sshPublickey
        if (editSshPrivatekey && d.sshPrivatekey !== undefined) editSshPrivatekey.value = d.sshPrivatekey
        if (editSshPassphrase && d.sshPassphrase !== undefined) editSshPassphrase.value = d.sshPassphrase
        if (editIdFullname && d.idFullname !== undefined) editIdFullname.value = d.idFullname
        if (editIdEmail && d.idEmail !== undefined) editIdEmail.value = d.idEmail
        if (editIdPhone && d.idPhone !== undefined) editIdPhone.value = d.idPhone
        if (editIdAddress && d.idAddress !== undefined) editIdAddress.value = d.idAddress
        if (editIdCompany && d.idCompany !== undefined) editIdCompany.value = d.idCompany

        if (modalEditCipher) modalEditCipher.style.display = "flex"
      }

      // Check for pending scanned 2FA QR code
      const pendingTotp = await storage.get(["pendingScannedTotp"])
      if (pendingTotp?.pendingScannedTotp?.secret) {
        const secret = pendingTotp.pendingScannedTotp.secret
        await storage.remove("pendingScannedTotp").catch(() => {})
        if (editTotpSecret) {
          editTotpSecret.value = secret
          editTotpSecret.type = "password"
        }
        setTotpActiveState(true)
        if (modalEditCipher) modalEditCipher.style.display = "flex"
        showToast("Scanned 2FA Secret inserted")
        queueSaveEditDraft()
      }
    } catch (err) {
      console.warn("[Akaromi] Failed to restore editor draft:", err)
    }
  }

  // Live listener in case popup stayed open during QR scan
  ext.runtime.onMessage.addListener((msg) => {
    if (msg.action === "QR_SCAN_SUCCESS" && msg.payload?.secret) {
      if (editTotpSecret) {
        editTotpSecret.value = msg.payload.secret
        editTotpSecret.type = "password"
      }
      setTotpActiveState(true)
      if (modalEditCipher) modalEditCipher.style.display = "flex"
      showToast("Scanned 2FA Secret inserted")
      queueSaveEditDraft()
    }
  })

  formEditCipher?.addEventListener("input", queueSaveEditDraft)
  formEditCipher?.addEventListener("change", saveEditDraftNow)

  global.AkaromiEditor = {
    openCreateModal,
    openEditModal,
    saveEditDraftNow,
    clearEditDraft,
    restoreDraftState,
    evaluatePasswordStrength,
  }
})(typeof window !== "undefined" ? window : globalThis)

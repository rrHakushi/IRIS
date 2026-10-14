/**
 * Akaromi for Firefox — Password & Passphrase Generator Module
 */
;(function (global) {
  "use strict"

  const { escapeHtml, showToast, ext, storage } = global.AkaromiUtils
  const state = global.AkaromiState

  // DOM Elements
  const modalGenerator = document.getElementById("modal-generator")
  const btnGenClose = document.getElementById("btn-gen-close")
  const genOutputText = document.getElementById("gen-output-text")
  const btnGenRefresh = document.getElementById("btn-gen-refresh")
  const btnGenCopy = document.getElementById("btn-gen-copy")
  const btnGenFill = document.getElementById("btn-gen-fill")
  const btnGenUse = document.getElementById("btn-gen-use")

  const btnTypePassword = document.getElementById("btn-type-password")
  const btnTypePassphrase = document.getElementById("btn-type-passphrase")
  const genPasswordOptions = document.getElementById("gen-password-options")
  const genPassphraseOptions = document.getElementById("gen-passphrase-options")

  const sliderPassLength = document.getElementById("slider-pass-length")
  const labelPassLength = document.getElementById("label-pass-length")
  const chkUpper = document.getElementById("chk-upper")
  const chkLower = document.getElementById("chk-lower")
  const chkNums = document.getElementById("chk-nums")
  const chkSyms = document.getElementById("chk-syms")
  const chkAmbig = document.getElementById("chk-ambig")

  const sliderWordsCount = document.getElementById("slider-words-count")
  const labelWordsCount = document.getElementById("label-words-count")
  const inputSeparator = document.getElementById("input-separator")
  const chkCapitalize = document.getElementById("chk-capitalize")
  const chkIncludeNum = document.getElementById("chk-include-num")

  let genDraftDebounceTimer = null

  // ----------------------------------------------------
  // Open Generator Modal
  // ----------------------------------------------------
  function openGenerator(targetInput = null) {
    state.generatorTargetInput = targetInput

    if (btnGenUse) {
      if (targetInput) {
        btnGenUse.style.display = "block"
        btnGenUse.textContent = "Use Password"
      } else {
        btnGenUse.style.display = "none"
      }
    }

    if (modalGenerator) {
      modalGenerator.style.display = "flex"
    }

    generateCredentials()
    queueSaveGeneratorDraft()
  }

  function openForInput(inputElement) {
    openGenerator(inputElement)
  }

  function closeGenerator() {
    state.generatorTargetInput = null
    clearGeneratorDraft()
    if (modalGenerator) modalGenerator.style.display = "none"
  }

  btnGenClose?.addEventListener("click", closeGenerator)

  // ----------------------------------------------------
  // Type Switching
  // ----------------------------------------------------
  btnTypePassword?.addEventListener("click", () => {
    state.generatorMode = "password"
    btnTypePassword.classList.add("active")
    btnTypePassphrase?.classList.remove("active")
    if (genPasswordOptions) genPasswordOptions.style.display = "flex"
    if (genPassphraseOptions) genPassphraseOptions.style.display = "none"
    generateCredentials()
  })

  btnTypePassphrase?.addEventListener("click", () => {
    state.generatorMode = "passphrase"
    btnTypePassphrase.classList.add("active")
    btnTypePassword?.classList.remove("active")
    if (genPassphraseOptions) genPassphraseOptions.style.display = "flex"
    if (genPasswordOptions) genPasswordOptions.style.display = "none"
    generateCredentials()
  })

  // Slider Listeners (max 256 for passwords, 32 for words)
  sliderPassLength?.addEventListener("input", (e) => {
    if (labelPassLength) labelPassLength.textContent = e.target.value
    generateCredentials()
  })

  sliderWordsCount?.addEventListener("input", (e) => {
    if (labelWordsCount) labelWordsCount.textContent = e.target.value
    generateCredentials()
  })

  ;[
    chkUpper,
    chkLower,
    chkNums,
    chkSyms,
    chkAmbig,
    chkCapitalize,
    chkIncludeNum,
    inputSeparator,
  ].forEach((el) => {
    el?.addEventListener("input", generateCredentials)
  })

  btnGenRefresh?.addEventListener("click", generateCredentials)

  btnGenCopy?.addEventListener("click", () => {
    const text = genOutputText?.textContent || ""
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      showToast("Generated password copied")
    })
  })

  // "Use in Field" Action (when opened from login form or additional passwords)
  btnGenUse?.addEventListener("click", () => {
    const password = genOutputText?.textContent || ""
    if (!password) return

    if (state.generatorTargetInput) {
      state.generatorTargetInput.value = password
      state.generatorTargetInput.dispatchEvent(new Event("input", { bubbles: true }))
      state.generatorTargetInput.dispatchEvent(new Event("change", { bubbles: true }))
      showToast("Password inserted into field")
    }

    closeGenerator()
  })

  // "Autofill into Page" Action
  btnGenFill?.addEventListener("click", async () => {
    const password = genOutputText?.textContent || ""
    if (!password) return

    closeGenerator()
    try {
      const tabs = await ext.tabs.query({ active: true, currentWindow: true })
      if (tabs[0]?.id) {
        ext.tabs.sendMessage(tabs[0].id, {
          action: "FILL_INPUTS",
          payload: { password },
        })
        window.close()
      }
    } catch {
      showToast("Failed to autofill into active page")
    }
  })

  // ----------------------------------------------------
  // Generation Engine
  // ----------------------------------------------------
  function generateCredentials() {
    if (!genOutputText) return

    if (state.generatorMode === "password") {
      const length = sliderPassLength ? parseInt(sliderPassLength.value, 10) : 24
      const pass = IrisCrypto.generatePassword({
        length: Math.min(Math.max(length, 8), 256),
        uppercase: chkUpper ? chkUpper.checked : true,
        lowercase: chkLower ? chkLower.checked : true,
        numbers: chkNums ? chkNums.checked : true,
        symbols: chkSyms ? chkSyms.checked : true,
        avoidAmbiguous: chkAmbig ? chkAmbig.checked : false,
      })
      genOutputText.textContent = pass
    } else {
      const wordCount = sliderWordsCount ? parseInt(sliderWordsCount.value, 10) : 4
      const phrase = IrisCrypto.generatePassphrase({
        wordCount: Math.min(Math.max(wordCount, 3), 32),
        separator: inputSeparator?.value || "-",
        capitalize: chkCapitalize ? chkCapitalize.checked : true,
        includeNumber: chkIncludeNum ? chkIncludeNum.checked : true,
      })
      genOutputText.textContent = phrase
    }
    queueSaveGeneratorDraft()
  }

  // ----------------------------------------------------
  // Draft State Management
  // ----------------------------------------------------
  function queueSaveGeneratorDraft() {
    clearTimeout(genDraftDebounceTimer)
    genDraftDebounceTimer = setTimeout(saveGeneratorDraftNow, 120)
  }

  function saveGeneratorDraftNow() {
    if (modalGenerator && modalGenerator.style.display === "flex") {
      storage
        .set({
          akaromi_gen_draft: {
            isOpen: true,
            mode: state.generatorMode,
            length: sliderPassLength?.value || "24",
            wordCount: sliderWordsCount?.value || "4",
            separator: inputSeparator?.value || "-",
            upper: chkUpper?.checked ?? true,
            lower: chkLower?.checked ?? true,
            nums: chkNums?.checked ?? true,
            syms: chkSyms?.checked ?? true,
            ambig: chkAmbig?.checked ?? false,
            capitalize: chkCapitalize?.checked ?? true,
            includeNum: chkIncludeNum?.checked ?? true,
            output: genOutputText?.textContent || "",
          },
        })
        .catch(() => {})
    }
  }

  function clearGeneratorDraft() {
    clearTimeout(genDraftDebounceTimer)
    storage.remove("akaromi_gen_draft").catch(() => {})
  }

  async function restoreDraftState() {
    try {
      const data = await storage.get(["akaromi_gen_draft"])
      const g = data?.akaromi_gen_draft
      if (g?.isOpen) {
        if (modalGenerator) modalGenerator.style.display = "flex"
        if (g.mode === "passphrase") {
          btnTypePassphrase?.click()
        } else {
          btnTypePassword?.click()
        }
        if (g.length && sliderPassLength) {
          sliderPassLength.value = g.length
          if (labelPassLength) labelPassLength.textContent = g.length
        }
        if (g.wordCount && sliderWordsCount) {
          sliderWordsCount.value = g.wordCount
          if (labelWordsCount) labelWordsCount.textContent = g.wordCount
        }
        if (g.separator && inputSeparator) inputSeparator.value = g.separator
        if (chkUpper && g.upper !== undefined) chkUpper.checked = g.upper
        if (chkLower && g.lower !== undefined) chkLower.checked = g.lower
        if (chkNums && g.nums !== undefined) chkNums.checked = g.nums
        if (chkSyms && g.syms !== undefined) chkSyms.checked = g.syms
        if (chkAmbig && g.ambig !== undefined) chkAmbig.checked = g.ambig
        if (chkCapitalize && g.capitalize !== undefined) chkCapitalize.checked = g.capitalize
        if (chkIncludeNum && g.includeNum !== undefined) chkIncludeNum.checked = g.includeNum
        if (g.output && genOutputText) {
          genOutputText.textContent = g.output
        } else {
          generateCredentials()
        }
      }
    } catch (err) {
      console.warn("[Akaromi] Failed to restore generator draft:", err)
    }
  }

  global.AkaromiGenerator = {
    openGenerator,
    openForInput,
    closeGenerator,
    generateCredentials,
    saveGeneratorDraftNow,
    clearGeneratorDraft,
    restoreDraftState,
  }
})(typeof window !== "undefined" ? window : globalThis)

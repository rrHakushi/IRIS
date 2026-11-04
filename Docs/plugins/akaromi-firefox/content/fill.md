# Framework-Compatible Synthetic Form Autofill Engine

> **Source File:** `plugins/akaromi-firefox/content/fill.js`  
> **Document Type:** Diátaxis Technical Reference  

---

## Overview
`content/fill.js` injects credentials into host web pages, ensuring compatibility with modern SPA frameworks (React, Vue, Angular, Svelte).

---

## Features
- **Prototype Setter Access:** Bypasses virtual DOM value caching traps.
- **Synthetic Bubbling Events:** Dispatches `focus`, `input`, `change`, and `blur`.
- **Multi-Field Autofill:** Fills username and password simultaneously.
- **Automated OTP Filling:** Detects and fills 2FA OTP fields if present.

---

## Step-by-Step Architecture

### ***Step 1***: Prototype Value Setter Invocation

#### **Step 1.1**: Native Prototype Setter Execution
`setNativeValue(element, value)`:
```javascript
const valueSetter = Object.getOwnPropertyDescriptor(element, "value")?.set;
const prototype = Object.getPrototypeOf(element);
const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
  prototypeValueSetter.call(element, value);
} else {
  element.value = value;
}
```

---

### ***Step 2***: Synthetic Event Dispatching

#### **Step 2.1**: Full Bubbling Event Chain Dispatch
`dispatchInputEvents(element)`: Emits standard bubbling events in sequence (`focus` -> `input` -> `change` -> `blur`).

---

### ***Step 3***: Multi-Field Credential Injection

#### **Step 3.1**: Username, Password & 2FA OTP Automatic Discovery
`fillCredential(cipher, specificPassword, initialCode)`:
- Populates username and password inputs.
- If TOTP is configured, generates token and fills 2FA input field.

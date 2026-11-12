# Extension Popup UI Layout & Dual-Pane Master Shell

> **Source File:** `plugins/akaromi-firefox/popup/popup.html`  
> **Document Type:** Diátaxis Technical Reference  

---

## Overview
`popup/popup.html` defines the responsive dual-pane desktop and single-pane mobile layout for the Akaromi extension popup interface.

---

## Features
- **Dual-Pane Master-Detail Shell:** Master cipher list on the left, detailed inspector on the right.
- **Filter Chips Bar:** Quick-click syntax chips (`user:`, `domain:`, `email:`, `title:`, `note:`).
- **Modal Containers:** Built-in dialogs for editor, generator, settings, and PIN setup.

---

## Step-by-Step Architecture

### ***Step 1***: Responsive Dual-Pane Master Shell

#### **Step 1.1**: Master Items List Pane & Selected Detail Pane
- Desktop: Master list and Detail pane side-by-side.
- Mobile: Full-width single-pane with mobile back navigation button.

---

### ***Step 2***: Top Header, Search Bar & Filter Chips

#### **Step 2.1**: Search Bar & Clickable Syntax Filter Chips Bar
- Header with drawer trigger, global search input, clear button, and sync button.
- Clickable chips bar that pre-populates search prefixes.

---

### ***Step 3***: Modal Dialogs & Navigation Drawers

#### **Step 3.1**: Cipher Edit, Generator, Settings & PIN Modals
Container markup for all application dialogs, sliding drawers, and authentication views.

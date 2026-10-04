# 💰 Monney — Income & Expenses Tracker

> **รายรับรายจ่าย** — A single-file personal finance web app with Thai tax planning, provident fund projection, and mutual fund tracking.

---

## 📋 Project Overview

| Property | Detail |
|---|---|
| **Type** | Single-page web application (SPA) |
| **File** | `index.html` — single file, zero dependencies |
| **Size** | ~534 lines (~41 KB) |
| **Languages** | HTML, CSS, JavaScript (vanilla) |
| **Localization** | Thai 🇹🇭 / English 🇬🇧 / Mixed mode |
| **Storage** | `localStorage` (browser-only, client-side) |
| **Framework** | None — pure vanilla |

---

## ✨ Features

### 1. Monthly Income & Expenses (`tab: Monthly`)
- Add, edit, and delete income/expense items
- Support for **one-time**, **monthly recurring**, and **installment** (N-period) entries
- Running balance calculation with carry-forward from previous months
- **12-month forecast table** with clickable rows to navigate months
- Configurable **opening balance**

### 2. Thai Tax Planning (`tab: Tax`)
- Automatic income aggregation from the Monthly tab (with per-item exclusion toggles)
- Full deduction engine covering:
  - 50% expense deduction (capped at ฿100,000)
  - Personal allowance (฿60,000)
  - Social security, life insurance, health insurance, pension insurance
  - Home loan interest, spouse, children, parents
  - PVD, RMF, Thai ESG / ESGX fund deductions
  - Donations (10% of net income cap)
- Progressive tax bracket computation (7 brackets, 0%–35%)
- **Insights panel**: marginal rate, effective rate, withholding refund/owed estimate, room left for RMF and ESG investments
- Year navigation to plan across multiple tax years

### 3. Fund Management (`tab: Funds`)
- **Provident Fund (PVD)** projection with compound interest calculation
- Mutual fund portfolio tracker (RMF, Thai ESG, ESGX, General)
- DCA (dollar-cost averaging) and lump-sum tracking per fund
- Portfolio summary: total cost, current value, gain/loss percentage

### 4. General UX
- **Dark / Light theme** toggle (respects `prefers-color-scheme`)
- **Responsive design** with mobile-first breakpoints at 600px and 760px
- **Glassmorphism** UI with backdrop blur, subtle gradients, and micro-animations
- **JSON backup/import** for data portability
- **PWA-ready** meta tags (`apple-mobile-web-app-capable`, `viewport-fit: cover`)

---

## 🏗️ Architecture

```
index.html (single file)
├── <style>  — CSS
│   ├── CSS Variables (theming)
│   ├── Glassmorphism Cards
│   └── Responsive Breakpoints (600px, 760px)
├── <body>   — HTML Structure
│   ├── Header + Month Navigation
│   ├── Tab Navigation (Monthly / Tax / Funds)
│   ├── v-money: Monthly View
│   ├── v-tax: Tax Planning View
│   ├── v-funds: Fund Management View
│   ├── Footer: Settings & Data controls
│   └── Dialog Modal (confirm/alert)
└── <script> — JavaScript Logic
    ├── State Management (S object)
    ├── Localization Engine (D dictionary)
    ├── Rendering Functions
    ├── Tax Calculation Engine
    ├── PVD / Fund Calculators
    └── Import / Export
```

### Data Model (`localStorage` key: `finance-tracker-v1`)

```json
{
  "items": [
    {
      "id": "unique-base36",
      "name": "Salary",
      "type": "in | out",
      "amount": 50000,
      "start": "2026-01",
      "months": 0
    }
  ],
  "opening": 0,
  "tax": {
    "2026": {
      "extra": 0, "wht": 0, "sso": 0, "life": 0,
      "health": 0, "pen": 0, "home": 0, "spouse": 0,
      "child": 0, "parents": 0, "don": 0, "other": 0,
      "excl": ["item-id-to-exclude"]
    }
  },
  "pvd": {
    "emp": 0, "er": 0, "bal": 0, "ret": 5, "yrs": 10
  },
  "funds": [
    {
      "id": "unique-base36",
      "name": "Fund Name",
      "type": "RMF | ESG | ESGX | GEN",
      "dca": 0, "lump": 0, "cost": 0, "val": 0
    }
  ]
}
```

**`months` field values:**
- `0` = recurring monthly (no end)
- `1` = one-time entry
- `N` (≥ 2) = installment over N months

---

## 🧪 Code Quality Review

### ✅ Strengths

| Area | Assessment |
|---|---|
| **Zero dependencies** | No build step, no npm, instant load — excellent for a personal tool |
| **Bilingual UX** | Clean localization system via the `D` dictionary + `t()` helper |
| **Tax engine accuracy** | Correct progressive bracket logic, proper cap enforcement for all deduction types |
| **Responsive design** | Thoughtful mobile layout — table rows collapse into grid cards on small screens |
| **Theming** | Full dark/light support via CSS custom properties + `prefers-color-scheme` |
| **Data portability** | JSON export/import with validation |
| **XSS protection** | HTML escaping via `esc()` on user-provided strings |

### ⚠️ Areas for Improvement

#### 🔴 High Priority

| Issue | Detail | Location |
|---|---|---|
| **innerHTML everywhere** | All rendering uses `innerHTML` with template literals. While `esc()` is used on names, this pattern is fragile — a missed escape is an XSS vector. | `render()` (L279–310), `renderTax()` (L440–477), `renderFunds()` (L514–527) |
| ~~**No input validation on amounts**~~ ✅ Fixed | Save handler now uses `!(amt>0)`, rejecting zero, negative, and non-numeric amounts. | save handler |
| **Single localStorage key** | All data in one key — a corrupted write loses everything. No versioning or migration strategy. | `save()` (L257) |
| **No data size guard** | localStorage has a ~5 MB limit. Years of data could eventually exceed it with no warning. | `save()` (L257) |

#### 🟡 Medium Priority

| Issue | Detail | Location |
|---|---|---|
| **Minified CSS** | All styles are on single lines, making them hard to read and maintain. | Lines 15–125 |
| **Minified JS** | Core logic is compressed into dense one-liners. Functions like `calcTax()` pack ~20 calculations into a single function. | Lines 394–415 |
| **No error boundaries** | If `JSON.parse` of localStorage fails partially, the app may render in a broken state. | Line 243 |
| **Global scope pollution** | All variables and functions are in the global scope. Over 40 global identifiers. | Entire `<script>` block |
| ~~**Theme preference not persisted**~~ ✅ Fixed | Theme is saved to `localStorage` (`finance-theme`) and restored by an inline script in `<head>` before first paint. | theme handler + `<head>` |
| ~~**No accessibility labels**~~ ✅ Fixed | Edit/delete buttons now have `aria-label`. | `render()` |
| **Forecast not configurable** | Hardcoded to 12 months; some users may want 6, 24, or 36 months. | Line 303 |

#### 🟢 Low Priority / Nice-to-Have

| Suggestion | Detail |
|---|---|
| **Keyboard shortcuts** | No keyboard navigation for month prev/next or tab switching |
| **Undo/redo** | Deleting an item is permanent (after confirmation) — no undo stack |
| **Currency formatting** | Hardcoded to `th-TH` locale — won't adapt for non-Thai users in English mode |
| **Chart / visualization** | The 12-month forecast would benefit from a simple bar or line chart |
| **Service Worker** | PWA meta tags are present but no actual offline support (no service worker, no manifest) |
| **Print styles** | No `@media print` rules for printing reports |

---

## 📐 CSS Design System

The app uses a well-structured CSS custom property system:

| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--bg` | `#F2F2F7` | `#000` | Page background |
| `--glass` | `rgba(255,255,255,.62)` | `rgba(44,44,46,.55)` | Card backdrop |
| `--ink` | `#1C1C1E` | `#F5F5F7` | Primary text |
| `--in` | `#248A3D` | `#30D158` | Income (green) |
| `--out` | `#D70015` | `#FF453A` | Expense (red) |
| `--blue` | `#007AFF` | `#0A84FF` | Accent / interactive |

> **Note:** The color palette follows Apple's Human Interface Guidelines (HIG) color system, giving it a native iOS/macOS feel.

---

## 🌐 Localization System

The `D` dictionary maps keys to `[Thai, English]` tuples:

```javascript
const D = {
  title: ["รายรับรายจ่าย", "Income & Expenses"],
  today: ["เดือนนี้", "Today"],
  // ...40+ keys
};
```

Three display modes via `t(key)`:
- **`th`** — Thai only
- **`en`** — English only
- **`mix`** — English + Thai (e.g., "Income รายรับ")

> **Tip:** Adding a new language would require extending each tuple to a 3-element array and updating the `t()` function's index logic.

---

## 🧮 Tax Engine Details

The tax calculation (`calcTax()`, line 394) implements Thailand's personal income tax rules:

**Progressive Brackets (2026 rules):**

| Taxable Income (฿) | Rate |
|---|---|
| 0 – 150,000 | 0% |
| 150,001 – 300,000 | 5% |
| 300,001 – 500,000 | 10% |
| 500,001 – 750,000 | 15% |
| 750,001 – 1,000,000 | 20% |
| 1,000,001 – 2,000,000 | 25% |
| 2,000,001 – 5,000,000 | 30% |
| 5,000,001+ | 35% |

**Deduction Constants (editable in `RU` object, line 388):**

| Key | Value | Description |
|---|---|---|
| `expPct` / `expMax` | 50% / ฿100,000 | Expense deduction |
| `per` | ฿60,000 | Personal allowance |
| `sso` | ฿9,000 | Social security cap |
| `life` | ฿100,000 | Life insurance cap |
| `health` | ฿25,000 | Health insurance cap |
| `pen` | ฿200,000 | Pension insurance cap |
| `home` | ฿100,000 | Home loan interest cap |
| `pvdPct` | 15% | PVD cap (% of income) |
| `rmfPct` | 30% | RMF cap (% of income) |
| `ret` | ฿500,000 | Retirement group total cap |
| `esgPct` / `esg` | 30% / ฿300,000 | Thai ESG cap |
| `spouse` | ฿60,000 | Spouse allowance |
| `child` | ฿30,000 | Per-child allowance |
| `parent` | ฿30,000 | Per-parent allowance (max 4) |
| `donPct` | 10% | Donation cap (% of net) |

> **Important:** Tax rules are editable via the `RU` constant (line 388). When the Revenue Department changes rates, update this object.

---

## 🚀 Recommendations Summary

### Quick Wins (< 1 hour each)
1. ✅ **Persist theme choice** — saved to `localStorage` and restored on page load
2. ✅ **Add `aria-label`** to edit/delete buttons
3. ✅ **Validate amount > 0** in the save handler (also rejects NaN)
4. **Format CSS/JS** for maintainability

### Medium Effort (1–4 hours each)
5. **Wrap in an IIFE or module** to eliminate global scope pollution
6. **Add a data schema version** to the localStorage object for future migrations
7. **Extract CSS and JS** into separate files for cacheability
8. **Add a simple bar chart** for the forecast view (e.g., using `<canvas>` or inline SVG)

### Larger Enhancements (1+ days)
9. **Add a service worker + manifest.json** for true PWA offline support
10. **Implement IndexedDB** as an alternative to localStorage for larger datasets
11. **Add CSV/Excel export** for the tax breakdown
12. **Unit tests** for `calcTax()`, `taxOf()`, `carry()`, and `totals()` — these are pure functions ideal for testing

---

## 📁 File Structure

```
d:\Monney\
└── index.html    (534 lines — HTML + CSS + JS, all-in-one)
```

> **Tip:** For a project this size, the single-file approach is a valid choice — it ensures maximum portability (just share/copy one file). However, if the app grows beyond ~800 lines, consider splitting into `index.html`, `style.css`, and `app.js`.

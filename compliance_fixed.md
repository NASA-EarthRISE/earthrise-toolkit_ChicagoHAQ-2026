# Accessibility Compliance Report — Post-Fix Verification
## Section 508 / WCAG 2.2 Level A & Level AA

**Project:** Chicago HAQ Dashboard  
**Fix date:** 2026-08-11  
**Baseline report:** [compliance.md](compliance.md)  
**Tester:** pa11y 9.1.1 (automated scan)  
**Runners:** HTML_CodeSniffer (htmlcs, standard WCAG2AA) + axe-core 4.11  
**Standard:** Section 508 (2017 Refresh) / WCAG 2.1 Level AA — forward-compatible with WCAG 2.2  
**Status:** ALL AUTOMATED TESTS PASS — manual review pending for background-image contrast items

---

## Executive Summary

All 10 public page routes pass the automated htmlcs and axe scans with **zero confirmed defects** after applying the fixes described below. The only outstanding items are 322 axe `color-contrast` flags marked `needsFurtherReview: true` — axe cannot automatically evaluate background-image contrast and flags those elements for human inspection.

| Metric | Before | After | Delta |
|---|---|---|---|
| htmlcs errors (total) | 1,714 | **0** | −1,714 |
| axe definite errors | 0* | **0** | 0 |
| axe needs-further-review | — | 322 | manual only |

*The original scan did not distinguish `needsFurtherReview` items; all 1,170 original axe "errors" were `needsFurtherReview: true`.

---

## Pages Tested

| Route | htmlcs | axe (definite) | axe (needs review) |
|---|---|---|---|
| `/` | ✓ PASS (0) | ✓ PASS (0) | 3 |
| `/about/` | ✓ PASS (0) | ✓ PASS (0) | 2 |
| `/info/` | ✓ PASS (0) | ✓ PASS (0) | 3 |
| `/tutorial/` | ✓ PASS (0) | ✓ PASS (0) | 4 |
| `/community/` | ✓ PASS (0) | ✓ PASS (0) | 305 |
| `/export/` | ✓ PASS (0) | ✓ PASS (0) | 1 |
| `/map/` | ✓ PASS (0) | ✓ PASS (0) | 1 |
| `/map/hourly/` | ✓ PASS (0) | ✓ PASS (0) | 1 |
| `/map/daily/` | ✓ PASS (0) | ✓ PASS (0) | 1 |
| `/map/monthly/` | ✓ PASS (0) | ✓ PASS (0) | 1 |

---

## Changes Made

### 1. Unlabeled Form Controls (WCAG 1.3.1 / 4.1.2 Level A) — FIXED

**Root cause:** Form controls had no programmatically associated label, making them inaccessible to screen readers.

| File | Change |
|---|---|
| `dashboard/static/dashboard/js/export.js` | Added `aria-label="${file.filename}"` to each dynamically generated checkbox in `renderFileList()`. Resolved 826 × 2 = 1,652 instances of `F68` / `H91.InputCheckbox.Name`. |
| `dashboard/templates/dashboard/pages/export.html` | Added `aria-label="Spatial/Temporal Scale"` to `<select id="data-file-type">`. |
| `dashboard/templates/dashboard/pages/community.html` | Added `aria-label="Select a Community Area"` to `<select id="community-dropdown">`. |
| `dashboard/templates/dashboard/includes/map_sidebar.html` | Added `aria-label="Region"` to `<select id="region-dropdown">`. |
| `dashboard/templates/dashboard/pages/map.html` | Added `for` attributes to bottom-slider `<label>` elements: `timeSlider`, `dateSlider`, `startDate`, `endDate`. |

---

### 2. Duplicate `id` Attribute (WCAG 4.1.1 Level A) — FIXED

**Root cause:** Four `<span id="help-panel-content">` elements shared the same `id` on every map page.

| File | Change |
|---|---|
| `dashboard/templates/dashboard/pages/map.html` | Changed all four `id="help-panel-content"` to `class="help-panel-content"`. |

---

### 3. Empty Anchor / `aria-prohibited-attr` (WCAG 4.1.2 Level A) — FIXED

**Root cause:** The Leaflet home-reset button was an `<a>` element with no `href`, no text content, and no `aria-label`. Without `href`, the `<a>` element has implicit ARIA `role="generic"`, which prohibits `aria-label` per ARIA 1.2.

| File | Change |
|---|---|
| `dashboard/templates/dashboard/pages/map.html` | Added `role="button"` and `aria-label="Reset to home view (Chicago)"` to the `HomeButton` Leaflet control. Added a visually-hidden `<span>` with the accessible name as text content (satisfies HTML_CodeSniffer's `H91.A.EmptyNoId` check). Marked the SVG icon as `aria-hidden="true"`. |

---

### 4. Color Contrast — Active/Primary Buttons (WCAG 1.4.3 Level AA) — FIXED

**Root cause:** Several interactive elements used `var(--accent)` = `#96a2bf` as a background with white text. Ratio: 2.56:1 (minimum required: 4.5:1).

| File | Change |
|---|---|
| `dashboard/static/dashboard/css/export.css` | Changed `.map-type-btn.active` and `.btn-export-primary` background from `var(--accent)` to `var(--primary)` (#005a9e, ratio 7.28:1). Updated hover states accordingly. |
| `dashboard/static/dashboard/css/map_sidebar.css` | Changed `.map-type-btn.active` background from `var(--accent)` to `var(--primary)`. |
| `dashboard/static/dashboard/css/map.css` | Changed `.help-panel-toggle` background from `var(--accent)` to `var(--primary)`. Updated `.map-export-header .btn-export-png` from `color: #666` / `border: 1px solid #ccc` to `color: var(--text)` / `border: 1px solid #767676`. |
| `dashboard/static/dashboard/css/layout.css` | Changed `.quick-action-btn.primary` background from `var(--accent)` to `var(--primary)`. |

---

### 5. Color Contrast — Footer Text (WCAG 1.4.3 Level AA) — FIXED

**Root cause:** Footer text used `color: var(--bg)` = `#f7fafc` (near-white) with `background: var(--bg-card)` = `#ffffff`. Contrast: ~1:1.

| File | Change |
|---|---|
| `dashboard/static/dashboard/css/layout.css` | Changed footer `color: var(--bg)` to `color: var(--text)` (#17171b, ratio ~19:1 on white). |

---

### 6. Color Contrast — Hint Text (WCAG 1.4.3 Level AA) — FIXED

**Root cause:** `.hint` class used `color: var(--bg)` = near-white. On the white sidebar background this fails.

| File | Change |
|---|---|
| `dashboard/static/dashboard/css/layout.css` | Changed `.hint { color: var(--bg) }` to `color: var(--text-muted)` (#444447, ratio 8.79:1). |

---

### 7. Color Contrast — Share Label (WCAG 1.4.3 Level AA) — FIXED

**Root cause:** `.share-label` used `color: #888` = 3.32:1 on the page background (below 4.5:1).

| File | Change |
|---|---|
| `dashboard/static/dashboard/css/community.css` | Changed `.community-export-header .share-label` color from `#888` to `var(--text-muted)` (#444447, ratio 8.79:1). Fixed `.btn-export-pdf` to use `color: var(--text)` and `border: 1px solid #767676`. |
| `dashboard/static/dashboard/css/map.css` | Same fix for `.map-export-header .share-label` and `.btn-export-png`. |

---

### 8. Color Contrast — Date Panel Labels (WCAG 1.4.3 Level AA) — FIXED

**Root cause:** Sidebar date-input labels were inheriting dark text but rendered on `.date-panel` which has `background-color: var(--primary-dark)` = `#263766`. Dark text on dark background = 1.55:1.

| File | Change |
|---|---|
| `dashboard/static/dashboard/css/map_sidebar.css` | Added `color: #ffffff !important` to `.date-panel label`. White on `#263766` = 8.95:1. |
| `dashboard/templates/dashboard/includes/map_sidebar.html` | Removed inline `style="color: ..."` from date-panel labels so CSS rule applies cleanly. |

---

### 9. File-Type Badge Contrast (WCAG 1.4.3 Level AA) — FIXED

**Root cause:** `.file-type-badge.json` used `color: #e65100` on `background: #fff3e0`. Ratio: 3.46:1.

| File | Change |
|---|---|
| `dashboard/static/dashboard/css/export.css` | Changed `.file-type-badge.json` color from `#e65100` to `#7a2800` (ratio 9.22:1 on `#fff3e0`). |

---

### 10. Link-in-Text-Block (WCAG 1.4.1 Level A) — FIXED

**Root cause:** Leaflet attribution link was distinguishable only by color (no underline).

| File | Change |
|---|---|
| `dashboard/static/dashboard/css/community.css` | Added `.leaflet-control-attribution a { text-decoration: underline; }`. |
| `dashboard/static/dashboard/css/map.css` | Same rule added. |

---

## Remaining Manual-Review Items (322 axe `needsFurtherReview`)

axe flags elements as `needsFurtherReview: true` when it cannot determine the effective background color — typically because a CSS `background-image` is present on an ancestor element. All 322 such items fall into this category. **These are not confirmed failures; they require human visual inspection.**

| Pages | Element | Issue |
|---|---|---|
| All pages | `<h1>` headings | CSS background-image on `main.content` prevents axe from computing backdrop |
| All pages | `<p class="subtitle">` | Same — page-specific background-image |
| All pages | Footer `<p>©` | `footer` has `background-image: url('../images/footer.png')` — axe uses the CSS `background` fallback (`#ffffff`) which may not match the rendered image |
| `/community/` (305) | All text inside Plotly/Leaflet overlay | Orange-blue gradient background-image; axe cannot evaluate actual contrast behind rendered elements |
| Map pages | `.sidebar-toggle-btn` | Absolutely positioned over map area; axe cannot resolve visual backdrop |

**Manual check guidance:** Open each page in a browser and verify that all text is visually readable against its actual rendered background. Use browser DevTools color picker or the [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) to confirm ratios.

---

## WCAG 2.2 Criteria — Still Requires Manual Review

The following WCAG 2.2 success criteria are not covered by automated tools and require manual inspection:

| Criterion | Description | Priority |
|---|---|---|
| 2.4.11 Focus Not Obscured (AA) | Keyboard focus indicator not fully hidden by sticky content | Check sticky nav vs. map bottom slider |
| 2.4.13 Focus Appearance (AA) | Focus ring ≥ 2 CSS px, adequate contrast | Inspect all interactive elements for visible focus |
| 2.5.3 Label in Name (A) | Visible label text matches accessible name | Verify button labels match `aria-label` values |
| 2.5.7 Dragging Movements (AA) | All drag operations have a single-pointer alternative | Verify map pan/zoom accessible via keyboard |
| 2.5.8 Target Size (Minimum) (AA) | Pointer targets ≥ 24 × 24 CSS px | Inspect map controls, sidebar buttons, checkboxes |
| 3.2.6 Consistent Help (A) | Help link in consistent location across pages | Verify User Guide nav link is always present |
| 3.3.7 Redundant Entry (A) | Users not required to re-enter already-provided info | Verify export filter state is preserved |

---

## Test Methodology

```
pa11y 9.1.1 + axe-core 4.11
Django dev server: python manage.py runserver 8000
Tested: 2026-08-11

Commands:
  # htmlcs (HTML CodeSniffer, WCAG2AA)
  pa11y --standard WCAG2AA --runner htmlcs --reporter json <URL>

  # axe
  pa11y --runner axe --reporter json <URL>
```

Raw results stored in: `C:/Users/vkaki/AppData/Local/Temp/pa11y_v2/` and `pa11y_v3/`

**Limitations:** Automated tools detect ~30–40% of WCAG issues. Screen-reader testing (NVDA/JAWS + Chrome, VoiceOver + Safari) and manual keyboard navigation are required for full Section 508 compliance certification.

# Accessibility Compliance Report
## Section 508 / WCAG 2.2 Level A & Level AA

**Project:** Chicago HAQ Dashboard  
**Audit date:** 2026-08-11  
**Tester:** pa11y 9.1.1 (automated scan)  
**Runners:** HTML_CodeSniffer (htmlcs, standard WCAG2AA) + axe-core 4.11  
**Standard:** Section 508 (2017 Refresh) / WCAG 2.1 Level AA — forward-compatible with WCAG 2.2  
**Status:** ❌ NOT COMPLIANT

---

## Executive Summary

Automated scanning of all 10 public page routes found accessibility failures on every page. No page is fully clean under either runner. The most critical issues are:

1. **826 unlabeled form controls on `/export/`** — every dynamically-loaded file-list checkbox is missing an accessible label.
2. **Pervasive color-contrast failures** — affects headings, body text, buttons, and badge elements across all pages.
3. **Unlabeled map controls** — range sliders, date pickers, and the select dropdown on all four map views lack accessible names.
4. **Duplicate `id` attributes** on map pages, breaking AT navigation.
5. **One empty anchor** on map pages (Leaflet "Reset to home" button).

The total number of individual issue instances is inflated by the dynamically-generated export table (826 checkboxes × 2 codes = 1,652 instances of the same defect). Collapsing duplicates, there are **10 distinct defect types** across **7 WCAG success criteria**.

---

## Pages Tested

| Route | URL Name |
|---|---|
| `/` | home |
| `/about/` | about |
| `/info/` | info |
| `/tutorial/` | tutorial |
| `/community/` | community |
| `/export/` | export |
| `/map/` | map |
| `/map/hourly/` | map_hourly |
| `/map/daily/` | map_daily |
| `/map/monthly/` | map_monthly |

---

## Results Summary

### htmlcs (HTML CodeSniffer — WCAG2AA)

| Page | Errors | Warnings | Status |
|---|---|---|---|
| `/` | 0 | 0 | ⚠️ see axe |
| `/about/` | 0 | 0 | ⚠️ see axe |
| `/info/` | 1 | 0 | ❌ FAIL |
| `/tutorial/` | 1 | 0 | ❌ FAIL |
| `/community/` | 2 | 0 | ❌ FAIL |
| `/export/` | **1,662** | 0 | ❌ FAIL |
| `/map/` | 12 | 0 | ❌ FAIL |
| `/map/hourly/` | 12 | 0 | ❌ FAIL |
| `/map/daily/` | 12 | 0 | ❌ FAIL |
| `/map/monthly/` | 12 | 0 | ❌ FAIL |
| **Total** | **1,714** | **0** | |

### axe (axe-core 4.11)

| Page | Errors | Warnings | Status |
|---|---|---|---|
| `/` | 3 | 0 | ❌ FAIL |
| `/about/` | 2 | 0 | ❌ FAIL |
| `/info/` | 4 | 0 | ❌ FAIL |
| `/tutorial/` | 5 | 0 | ❌ FAIL |
| `/community/` | 307 | 0 | ❌ FAIL |
| `/export/` | 831 | 0 | ❌ FAIL |
| `/map/` | 5 | 0 | ❌ FAIL |
| `/map/hourly/` | 5 | 0 | ❌ FAIL |
| `/map/daily/` | 4 | 0 | ❌ FAIL |
| `/map/monthly/` | 4 | 0 | ❌ FAIL |
| **Total** | **1,170** | **0** | |

---

## Issues by WCAG Criterion

### 1.3.1 Info and Relationships (Level A) — FAIL
**Criterion:** Structure, relationships, and instructions are programmatically determinable or available in text.

**Failure:** Form fields are not programmatically associated with labels, so screen readers cannot announce what a field is for.

| Code | Pages Affected | Instance Count |
|---|---|---|
| `WCAG2AA.Principle1.Guideline1_3.1_3_1.F68` — unlabeled form field | export, community, map (all variants) | ~835 |
| axe `label` — form element has no label | export, map (all variants) | ~832 |

**Affected elements:**
- `/export/`: `<select id="data-file-type">` — data source dropdown has no `<label>` or `aria-label`
- `/export/`: Every `<input type="checkbox" class="file-checkbox">` in the dynamically loaded file table has no label (826 checkboxes)
- `/map/*`: `<input type="range">` (time slider) and `<input type="date">` inputs have no associated label element

**Fix:** Add `<label for="...">` elements or `aria-label` / `aria-labelledby` attributes to every form control.

---

### 1.4.3 Contrast (Minimum) (Level AA) — FAIL
**Criterion:** Text has a contrast ratio of at least 4.5:1 (3:1 for large text).

**Failure:** Multiple elements fail the minimum contrast requirement.

| axe code | Pages Affected | Instance Count |
|---|---|---|
| `color-contrast` | home, about, info, tutorial, community, export, map (all variants) | ~330+ |

**Sample affected elements and reported ratios:**

| Element | Contrast Ratio | Required |
|---|---|---|
| `<h1>` on home ("Welcome to the Regional Ozone P…") | < 4.5:1 | 4.5:1 |
| `<p class="subtitle">` on home | < 4.5:1 | 4.5:1 |
| `© 2026` footer text | < 4.5:1 | 4.5:1 |
| `.map-type-btn.active` buttons (export) | 2.56:1 | 4.5:1 |
| `.btn-export-primary` (export) | 2.56:1 | 4.5:1 |
| `<span class="file-type-badge json">` | 3.46:1 | 4.5:1 |
| `<h1>Community Statistics</h1>` | < 4.5:1 | 4.5:1 |
| `<button class="btn-export-pdf">` | < 4.5:1 | 4.5:1 |
| `<span class="share-label">` | < 4.5:1 | 4.5:1 |
| `<sub>2</sub>` (NO₂ subscript in community) | < 4.5:1 | 4.5:1 |
| Text on info page | < 4.5:1 | 4.5:1 |
| Text on tutorial page | < 4.5:1 | 4.5:1 |

**Fix:** Audit CSS color values using a contrast checker (e.g. https://webaim.org/resources/contrastchecker/). Darken foreground or lighten background until ratio ≥ 4.5:1. Active/selected button states are the highest-priority fix.

The `/community/` page has 305 axe contrast errors — investigate whether chart-generated SVG text or a large data table is producing many identical failures from a single component render.

---

### 4.1.1 Parsing (Level A) — FAIL
**Criterion:** Content has no parsing errors (duplicate IDs, unclosed elements, etc.) that would break AT interpretation.

**Failure:** The `id="help-panel-content"` attribute value is used on more than one element per map page.

| Code | Pages Affected | Count per Page |
|---|---|---|
| `WCAG2AA.Principle4.Guideline4_1.4_1_1.F77` — duplicate ID | map, map/hourly, map/daily, map/monthly | 3 |

**Fix:** Ensure every `id` value is unique within a page. If the help panel is rendered multiple times (e.g. for different tabs or layers), use unique suffixes like `help-panel-content-hourly`.

---

### 4.1.2 Name, Role, Value (Level A) — FAIL
**Criterion:** All UI components have a name and role that can be programmatically determined.

**Failures:**

| Code | Description | Pages | Count |
|---|---|---|---|
| `H91.Select.Name` / axe `select-name` | `<select>` has no accessible name | community, export, map (all) | 1 per page |
| `H91.InputRange.Name` | `<input type="range">` (time slider) has no name | map (all variants) | 2 per page |
| `H91.InputDate.Name` | `<input type="date">` has no name | map (all variants) | 2 per page |
| `H91.InputCheckbox.Name` | `<input type="checkbox">` has no name | export | 826 |
| `H91.A.EmptyNoId` | Anchor element with no text content, no `id`, no `aria-label` | map (all variants) | 1 per page |

**Affected element samples:**
- `<select id="data-file-type" onchange="loadDataFiles()">` on `/export/` and `/community/`
- `<input type="range">` time sliders on all map views (sidebar)
- `<input type="date">` date pickers on all map views
- Leaflet custom control: `<a class="leaflet-bar leaflet-control leaflet-control-home" title="Reset to home view (Chicago)" ...>` — has a `title` attribute but no link text and no `aria-label`; HTML CodeSniffer treats `title`-only as insufficient because it may not be announced by all AT

**Fix:**
- Add `aria-label` or `<label for="...">` to all range, date, select, and checkbox inputs
- Add `aria-label="Reset to home view"` to the Leaflet home-reset anchor

---

### 1.4.1 Use of Color (Level A) — FAIL
**Criterion:** Color is not used as the only visual means of conveying information.

**Failure (axe `link-in-text-block`):** Links embedded in text blocks are distinguished only by color, with no underline or other non-color visual indicator.

| Code | Pages Affected |
|---|---|
| axe `link-in-text-block` | community, map, map/hourly, map/daily, map/monthly |

**Affected element:**
- Leaflet attribution link: `<a href="https://leafletjs.com" title="A JavaScript library for interactive maps"><svg aria-hidden="true" ...>` — the link is an SVG icon with no underline; it relies on color alone

**Fix:** Ensure all inline links either have an underline (`text-decoration: underline`) or are otherwise visually distinct from surrounding text beyond color alone. For the Leaflet attribution specifically, verify the rendered contrast between link color and surrounding text.

---

## Issues by Page

### `/` (home)
| Runner | Code | Count | Criterion |
|---|---|---|---|
| axe | `color-contrast` | 3 | 1.4.3 AA |

Affected: `<h1>`, `<p class="subtitle">`, footer `©` text.

---

### `/about/`
| Runner | Code | Count | Criterion |
|---|---|---|---|
| axe | `color-contrast` | 2 | 1.4.3 AA |

---

### `/info/`
| Runner | Code | Count | Criterion |
|---|---|---|---|
| htmlcs | `G18.Fail` (contrast) | 1 | 1.4.3 AA |
| axe | `color-contrast` | 4 | 1.4.3 AA |

---

### `/tutorial/`
| Runner | Code | Count | Criterion |
|---|---|---|---|
| htmlcs | `G18.Fail` (contrast) | 1 | 1.4.3 AA |
| axe | `color-contrast` | 5 | 1.4.3 AA |

---

### `/community/`
| Runner | Code | Count | Criterion |
|---|---|---|---|
| htmlcs | `F68` — unlabeled field | 1 | 1.3.1 A |
| htmlcs | `H91.Select.Name` | 1 | 4.1.2 A |
| axe | `color-contrast` | 305 | 1.4.3 AA |
| axe | `select-name` | 1 | 4.1.2 A |
| axe | `link-in-text-block` | 1 | 1.4.1 A |

The 305 color-contrast errors likely originate from a table or chart with many data cells — investigate whether the community statistics table renders per-row text that fails contrast.

---

### `/export/`
| Runner | Code | Count | Criterion |
|---|---|---|---|
| htmlcs | `F68` — unlabeled field | 827 | 1.3.1 A |
| htmlcs | `H91.InputCheckbox.Name` | 826 | 4.1.2 A |
| htmlcs | `H91.Select.Name` | 1 | 4.1.2 A |
| htmlcs | `G18.Fail` (contrast) | 8 | 1.4.3 AA |
| axe | `label` (unlabeled fields) | 826 | 1.3.1 A |
| axe | `select-name` | 1 | 4.1.2 A |
| axe | `color-contrast` | 4 | 1.4.3 AA |

This page is the highest-severity page. The file list is loaded dynamically via JavaScript; ensure the checkbox generation code includes labels. Each checkbox should have something like:
```html
<label for="file-cb-{{ index }}">{{ filename }}</label>
<input type="checkbox" id="file-cb-{{ index }}" class="file-checkbox" ...>
```

---

### `/map/`, `/map/hourly/`, `/map/daily/`, `/map/monthly/`
These four pages share the same template and have identical issues.

| Runner | Code | Count (per page) | Criterion |
|---|---|---|---|
| htmlcs | `F77` — duplicate ID `help-panel-content` | 3 | 4.1.1 A |
| htmlcs | `G18.Fail` (contrast) | 2 | 1.4.3 AA |
| htmlcs | `H91.InputRange.Name` | 2 | 4.1.2 A |
| htmlcs | `H91.InputDate.Name` | 2 | 4.1.2 A |
| htmlcs | `H91.Select.Name` | 1 | 4.1.2 A |
| htmlcs | `F68` — unlabeled field | 1 | 1.3.1 A |
| htmlcs | `H91.A.EmptyNoId` | 1 | 4.1.2 A |
| axe | `label` | 2 | 1.3.1 A |
| axe | `select-name` | 1 | 4.1.2 A |
| axe | `color-contrast` | 1 | 1.4.3 AA |
| axe | `link-in-text-block` | 1 | 1.4.1 A |

---

## Remediation Priority

| Priority | Issue | Pages | Fix |
|---|---|---|---|
| **Critical** | 826 unlabeled checkboxes | `/export/` | Add `<label for="...">` in JS that generates the file table |
| **Critical** | Color contrast on interactive elements (buttons, badges) | export, community, map | Fix CSS: `active` button state, `.btn-export-primary`, `.file-type-badge` |
| **Critical** | `<select>` missing accessible name | export, community, map | Add `aria-label` or `<label for="...">` |
| **High** | Pervasive color-contrast failures on text | all pages | Audit and fix heading, subtitle, and footer colors in base stylesheet |
| **High** | Unlabeled range and date inputs (map) | map (all) | Add `aria-label` to sidebar sliders and date pickers |
| **High** | Duplicate `id="help-panel-content"` | map (all) | Make IDs unique per panel instance |
| **Medium** | Empty anchor (Leaflet home button) | map (all) | Add `aria-label="Reset to home view"` to the Leaflet custom control |
| **Medium** | Link not distinguishable without color | community, map | Add underline or non-color indicator to Leaflet attribution link |
| **Low** | 305 color-contrast errors on community (likely data table) | `/community/` | Investigate table/chart render; fix per-cell text color |

---

## WCAG 2.2 Delta Notes

WCAG 2.2 adds nine new success criteria beyond 2.1. The automated tools used in this scan do not fully cover WCAG 2.2-specific criteria (2.4.11, 2.4.12, 2.4.13, 2.5.3, 2.5.7, 2.5.8, 3.2.6, 3.3.7, 3.3.8). Manual review is required for:

| WCAG 2.2 Criterion | Description | Manual Check Needed |
|---|---|---|
| 2.4.11 Focus Not Obscured (Minimum) (AA) | Focused component not fully hidden by sticky content | Check if map sidebar or sticky nav covers focus outline |
| 2.4.12 Focus Not Obscured (Enhanced) (AAA) | AAA — not required for AA compliance | — |
| 2.4.13 Focus Appearance (AA) | Focus indicator ≥ 2px outline, adequate contrast | Check all focusable elements for visible focus ring |
| 2.5.3 Label in Name (A) | Visible label text matches accessible name | Verify button labels match their `aria-label` or text content |
| 2.5.7 Dragging Movements (AA) | All drag operations have a pointer alternative | Verify map pan/zoom has keyboard/button equivalents |
| 2.5.8 Target Size (Minimum) (AA) | Pointer targets ≥ 24×24 CSS px | Inspect map controls and sidebar buttons |
| 3.2.6 Consistent Help (A) | Help mechanisms in consistent location | Check if help/tutorial link is always in same position |
| 3.3.7 Redundant Entry (A) | Users not asked to re-enter info already provided | Verify export flow doesn't repeat selections |
| 3.3.8 Accessible Authentication (Minimum) (AA) | Login does not require cognitive function tests | Not applicable if no login required |

---

## Test Methodology

```
pa11y 9.1.1 + axe-core 4.11
Django dev server: python manage.py runserver 8000
Tested: 2026-08-11

Commands used:
  # htmlcs (HTML CodeSniffer, WCAG2AA)
  pa11y --standard WCAG2AA --runner htmlcs --reporter json <URL>

  # axe
  pa11y --runner axe --reporter json <URL>
```

Results stored in: `C:/Users/vkaki/AppData/Local/Temp/pa11y_results/`

**Limitations of automated scanning:**
- Automated tools catch ~30–40% of WCAG issues. Manual keyboard-navigation and screen-reader testing (NVDA/JAWS + Chrome, VoiceOver + Safari) is required for full Section 508 compliance determination.
- Dynamic content loaded after page paint (map tiles, community statistics charts, export file list) may render after pa11y's scan window; some issues in those components may be under- or over-counted.
- The 305 `color-contrast` errors on `/community/` likely reflect a chart or data table with many repeated elements — manual inspection is needed to confirm root cause.

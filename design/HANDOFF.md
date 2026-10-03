# AHJ Comment Ledger — design handoff

Reference design: `comment-ledger.design.html` (sits next to this file). It's a mockup written in a templating format (`{{holes}}`, `<sc-for>`, `<sc-if>`, a `DCLogic` class). **Port the markup, styles and behavior into the project's own stack and components. Don't ship this file or its runtime.** The sample data in its `<script>` (`COMMENTS`, `FILES`, `PEOPLE`, `LABELS`) is placeholder data that shows the shape the UI expects.

## Structure
- **Header:** permit number + review cycle (mono caption), "Plan review comments" heading, count summary on the right.
- **List:** one white bordered container. Column header row: `NO. | COMMENT | ASSIGNED | STATUS`.
  Grid: `20px 44px minmax(0,1fr) 180px 104px`, column gap 12px, row padding 12px 20px, collapsed min-height 60px.
- **Collapsed row** (the whole row is one `<button aria-expanded>`):
  - chevron (rotates 90° when open)
  - comment number (mono, padded to 3 digits)
  - AI-generated title (600 weight, single line with ellipsis) and, under it, a discipline line: colored 8px square + UPPERCASE discipline + `· primary sheet` (mono)
  - assignees: stacked 26px initial avatars (overlap -8px, 2px white ring) + "First L. +N" (full names in the tooltip)
  - status pill (Open / Draft / Responded)
- **Expanded panel** (indented 96px to line up with the title). Two-column grid: `minmax(0,1fr) 296px`, gap 32px.
  - Left, "AHJ COMMENT": comment text, with sheet/code references set in mono semibold.
  - Left, "YOUR RESPONSE": labelled textarea (min-height 112px, vertical resize). Below it on the left: an **Attach files** button that opens a multiselect popover of project files (checkbox, name, type and size), and the selected files show as removable chips next to the button. On the right: a "✓ Draft saved" autosave indicator. No save or submit buttons here; submit happens elsewhere.
  - Right, "REFERENCED IN COMMENT" panel (grey): split into **Drawings** (sheet icon, sheet number, sheet title) and **Codes & standards** (book icon, section, title). Each item is a link.
- Multiple rows can be open at once. Opening or closing a row closes any open file popover.

## Tokens
| Token | Value |
|---|---|
| Page background | `#F6F6F3` |
| Surface | `#FFFFFF`, border `#E2E2DD`, row divider `#EDEDE8`, open-row background `#FCFCFA` |
| Text | primary `#17191C`, body `#24272D`, secondary `#4A4F57`, muted `#5B606A` |
| Accent | `#1F4FD1` (focus ring 2px, checkbox accent, links) |
| Fonts | IBM Plex Sans (UI), IBM Plex Mono (numbers, sheet/code refs, captions) |
| Status | Open `#FBEBDD` / `#8A3A0B`; Draft `#E8ECFB` / `#2E3A8C`; Responded `#E3F2E6` / `#1E5B2E` |
| Discipline | Structural `#C2410C`, Fire/Life Safety `#B91C1C`, Electrical `#A16207`, Mechanical `#0F766E`, Plumbing `#1D4ED8`, Accessibility `#7C3AED`, Zoning `#4D7C0F` |
| Radius | container 8px, inputs/buttons 6px, chips 5px |

## Data shape the UI needs per comment
`id, title (AI), discipline, assignees[] {name, initials, avatarUrl?}, status, text, references[] {kind: 'sheet'|'code', code, label}, attachedFileIds[], responseDraft`.
In the mockup, references are marked inline in the comment text as `{S-201}` so they can be highlighted in place. If the backend returns reference spans or offsets, use those instead.

## Accessibility
Real `<button>`, `<label>` and `<input>` elements throughout. `aria-expanded` on the row and on the attach button. `aria-label` on the chip remove buttons. Visible focus ring.

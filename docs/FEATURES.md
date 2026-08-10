# VCA — Functional Specification

Status: reflects the app as implemented (mock-data prototype). Written for QA reference —
each section describes what a screen actually does today, not the intended end-state.
All data across every screen is static/mock unless explicitly noted; there is no real
backend, video pipeline, or auth behind any of this.

---

## 1. Navigation shell

Four top-level tabs in `Navbar`: **DASHBOARD / BEST FRAME / DATA / REDMAP**, plus a separate
**My Page** (settings) reached from the header, not from these tabs.

- The active tab is reflected in the URL (`?tab=...`) and drives which screen `ClientLayout`
  renders. On first load, a fixed 700ms skeleton screen shows for whichever tab is active
  (not tied to real data-readiness).
- **Per-tab landing behavior is intentionally different per screen** (see each section below) —
  this is a deliberate distinction, not an oversight:
  - Dashboard → always resumes the last sidebar sub-tab (Events/System), persisted indefinitely.
  - Best Frame → the whole screen stays mounted in the background when you switch away, so
    camera selection / open detail view is exactly as you left it when you come back.
  - Data → always resets to **Live Monitoring** when you arrive, regardless of which sub-tab
    you were last on.
- Header clock shows the **actual current time in Singapore** (Asia/Singapore), ticking live —
  not a static mock value.

---

## 2. Dashboard

Layout: left `Sidebar` (EVENTS / SYSTEM tabs) + right Leaflet map, with a floating Detection
Activity Chart overlay.

### 2.1 Sidebar — EVENTS tab
- **Registered VIP Targets** button opens a modal listing all VIP persons; selecting one sets
  a person filter on the event list below.
- Stat row: **VIP Detections** and **Today's detections** counts are live-derived from mock
  data; the delta/△% badges next to them are hardcoded mock numbers (compared against "same
  time yesterday", not computed from any real historical series) regardless of the real count.
  The ▲/▼ arrow direction is driven by a `down` flag per stat, mixed across cards to show both
  directions. Delta color is always neutral gray (not red/green) — trend direction isn't
  treated as inherently good or bad here.
- Clicking **"Today's detections"** toggles the floating Detection Activity Chart on the map.
- **VIP vs. Tracking**: all raw detections start as VIP hits. If the same person is seen at 2+
  distinct cameras, those hits are merged into one **Tracking** entry with a multi-camera path;
  otherwise each hit stays a separate VIP row. Tracking is a derived view, not a separate raw
  detection type.
- Filter pills: **All / VIP Detection / Tracking**, plus an optional location filter (pin icon)
  and an optional person filter chip (from the VIP modal).
- List rows: VIP rows show photo + confidence % + location/camera/time; Tracking rows show a
  horizontal scrollable trail of camera hops with dashed connector lines.
- Empty state: "No events detected currently."
- Pagination: 12 rows/page.

### 2.2 Sidebar — SYSTEM tab
- Stat row: **Linked Cams** / **Out Cams** (live counts from mock device list) + an
  **Availability** donut (static mock %, ring turns red below 50%).
- Mock device list (`devices` in `mockData.ts`) is 1,000 entries — 19 hand-authored (some
  referenced by name/id elsewhere, e.g. `KL1`) plus 981 deterministically bulk-generated at
  ~92% uptime, so the table/stats/pagination reflect a realistic full-scale deployment rather
  than a handful of demo cameras. This list is separate from `vcaStore`'s 8-camera `Camera[]`
  (which backs Live Monitoring / Best Frame / map zone lookups) — scaling that one too would
  ripple into VIP-hit locations and zone naming, so it was deliberately left untouched.
- Search box filters by device name or IP.
- **Status filter pills — All / Live / Out** (added to match the Events tab's filter pattern):
  filters the device table by `Live`/`Off` status, same visual style as the Events pills.
- Device table (NAME / STATUS / TYPE / INFO / PIN): clicking a row pins that device, which
  drives the map (flyTo + popup) and highlights the row.
- Same 12/page pagination as Events.

### 2.3 Collapsed sidebar (60px)
Shows tab-switch icons + a summary badge (VIP count / Today count for Events, Availability %
for System) + a scrollable stack of thumbnails (event photos or device chips) with a
viewport-clamped hover flyout for details.

### 2.4 Map
- No static/always-on zone layer. The only markers shown by default are **recent-activity
  pings** — one small dot per distinct location with an active VIP/Tracking hit (deduped by
  rounded lat/lng), each with an expanding/fading ring animation. Clicking one filters the
  sidebar to that location.
- Selecting a **VIP** event flies to it and opens a detail popup (captured photo vs. a
  "Registered" placeholder icon, confidence %, a fake "LIVE FEED" box).
  - This popup now includes a **"View Full Trace on RedMap"** link when the event has hop
    data — see §8.
- Selecting a **Tracking** event draws the full multi-camera route: animated dashed polyline,
  an arrowhead near the last segment, and numbered waypoint bubbles — the last one enlarged
  and purple ("LAST SEEN" card).
- Pinning a device (System tab) flies to it and opens a popup with name, LIVE/OUT status,
  nearest zone name, and (if offline) "Out since {time}".
  - This popup now includes a **"View Live in Best Frame"** button when the device is live —
    see §8.
- Map resizes correctly when the sidebar collapses/expands (ResizeObserver + `invalidateSize`).

#### 2.4.1 Marker color legend (for dev handoff)
Every marker on the Dashboard map falls into one of three families — color encodes a
different thing depending on which family it is, so "white/black/red" is not one shared scale:

| Marker | Trigger | Color meaning |
|---|---|---|
| **Recent-activity ping** (small dot, always visible) | One per deduped location with a live VIP/Tracking hit | **Purple** `#5a3dfb` = VIP hit at that spot · **Green** `#16a34a` = Tracking hit at that spot. Both have a thin white outline ring (`border: 1.5px solid white`) purely for contrast against the map tile — not a status. |
| **Selected-event avatar pin** (face-crop circle, appears only after clicking a sidebar row) | User clicks a specific VIP or Tracking row | **White** fill = the photo/face-crop background (`#f1f5f9`), not a status — it's just the avatar canvas. The **ring border** carries the meaning: **purple** `#5a3dfb` = VIP (also flashes), **olive-green** `#6d9300` = Tracking. |
| **Device/camera pin** (black pill with camera name, appears only after pinning from SYSTEM tab) | User selects a camera in the SYSTEM tab list | Pill background is **always black** `#0e162a` — that's "this is a camera location," not a status. The small **status dot** on the pill carries the meaning: **green** `#22c55e` = Live, **red** `#f43f5e` = Off/offline (same red reused for the "Out since {time}" label/icon in that pin's popup). |

So in short: **white** = avatar-pin background (no status meaning), **black** = camera-pin
background (no status meaning), **red** = camera offline (the only place red is a status color
right now — it is not used for any VIP/Tracking distinction).

### 2.5 Detection Activity Chart
Floating glass panel with a 24h trend line + volume bars + scatter dots (static illustrative
data, not linked to the live event list). Click the title bar to minimize into a small pill
("Detection Topology"); click the pill to restore. Also toggled from the sidebar's "Today's
detections" stat.

### 2.6 Open question (not yet decided)
Whether the Events list should reset daily and expose a date filter, and where that filter
should live — flagged for product decision, not yet implemented. Recommendation on file: a
small date picker next to "Today's detections", similar in style to Redmap's date range picker.

---

## 3. Best Frame

### 3.1 Landing
- Left sidebar (240px expanded / 64px collapsed) lists three groups: **Normal network** (16
  cameras), **Video list** (3), **Image list** (1). Checking a camera adds it to the live grid;
  a hard cap of 16 selected cameras total blocks further checks (toast shown). Cameras marked
  "alert" status show a toast ("Camera unavailable") instead of toggling.
  - Collapsed mode shows 4 icons (search/camera/video/image), each badged with the count of
    currently-checked items in that category and turning purple once count > 0.
- Camera grid adapts 1 → 4×4 depending on how many cameras are checked. Past 6 cameras, each
  tile's detection list becomes hover-reveal (with a pin-to-keep-open option) instead of
  always-visible.
- Hovering a tile's video feed shows a centered **"Analyze Frame"** button (only if that camera
  has ≥1 detection) — clicking it opens the Detail/Inspection view for that camera's first
  detection.
- Clicking a detection row in a tile's side panel opens a floating **Detection HUD** popup near
  the click: photo comparison, confidence, and an "Analyze Frame" button that opens the Detail
  view for that *specific* detection. Its "Track on Map" button is present but not wired to
  anything.
- **Deep-link support**: Best Frame can now be opened with a specific camera already
  checked-in and briefly highlighted (purple glow, ~3s) — used by the Dashboard integration in
  §8. There is no other external entry point.

### 3.2 Detail / Inspection view
- Reached only via the two "Analyze Frame" triggers above (no URL param, no other entry point).
- Live feed shows bounding boxes per detection (VIP always purple; Unknown dashed). Selecting a
  person hides all other boxes and opens the Inspection Detail panel.
- **Best Frame Reel** (right panel, default state): filter chips All/VIP/Vehicle/Unknown, 2-col
  card grid with type icon, confidence % (VIP only), name, and tag chips (static per-type, not
  derived from the actual detection).
- **Inspection Detail panel** (replaces the Reel once someone's selected): Live Capture vs.
  Enrolled DB photo comparison + confidence, Camera/Event Time meta, Analysis Results attribute
  tags (static per type), an **"Also Captured In This Frame"** strip of the other detections in
  the same camera (clickable, re-focuses). Footer "Back" closes the panel; "Track on Map" is
  present but not wired.
- **Multi-Track Event History** (bottom timeline, hidden while Inspection Detail is open): a
  date picker that only changes a label (no real refetch), static VIP/Vehicle activity bars, and
  a frame-thumbnail strip — all fixed mock data, not derived from the loaded camera's actual
  detections.

### 3.3 Known limitations (flag for QA)
- All "Track on Map" buttons across this screen are inert (no handler).
- Video-scrubbing controls (skip/prev/next frame) are inert except Play/Pause, which only
  toggles an icon.
- Multi-Track bars/thumbnails don't reflect the specific camera's real detections.
- Photos cycle through a 3–4 image pool, so unrelated people/vehicles can render identical
  stock photos.
- `camera kl1` has zero detections by design (used to test the empty/disabled-Analyze state).

---

## 4. Data

Four sub-tabs: **Live Monitoring / Re-ID Analysis / Smart Search / RedFace**. Always lands on
Live Monitoring on arrival (see §1).

### 4.1 Data model
- `ReIDStatus`: `VIP | Unknown | RedFace`. VIP shows a similarity score; Unknown and RedFace do
  not carry a real score. RedFace additionally gets a red glow/border and a "REDFACE" tag.
- The simulated live feed (`Live Monitoring`) only ever generates **VIP** or **Unknown** —
  RedFace never appears there live; it only exists in the static demo dataset used by Re-ID /
  Smart Search / RedFace.
- All 72 mock "persons" reuse a small Unsplash photo pool — the same photo can represent
  multiple different names.
- Each person also carries deterministic `gender` / `apparel` / `prop` / `date` / `similarity`
  fields (fixed cycles, not random) — these back the Re-ID Analysis and Smart Search filter
  forms described below.

### 4.2 Live Monitoring
- **By Camera / All Cameras** view toggle. By Camera shows one horizontally-scrolling carousel
  per online camera; All Cameras flattens everything into one wrapped grid with a camera-name
  badge on each card (hidden in By Camera mode, since the carousel header already names the
  camera).
- Feed is simulated: seeded on load, then a new item is pushed per online camera every 4s.
- Card shows photo, status/score, gender/age, capture date+time (newest = leftmost within a
  camera's list), and a "face crop" that is actually just a zoomed-in crop of the same body
  photo (not a distinct face-detection asset).
- Hover actions: only **Re-ID** is wired (opens a detail modal). **RedFace / RedMap / Search**
  buttons are visually present but do nothing.
- Detail modal footer: "Add to Watchlist" just closes the modal; "RedMap Trace" is inert.

### 4.3 Re-ID Analysis
- Sidebar filter form (Person/Vehicle, Recent Targets, VIP quick-select, date range, Similarity
  chips, collapsible attribute filters). **Search is now wired**: clicking it replaces the two
  illustrative example clusters (Suspect #1/#2, shown before any search) with one real
  "Search Result" cluster built from `filterReidData()` — Gender/Apparel/Props/date
  range/Similarity threshold all actually narrow the underlying mock dataset now (see §4.1).
- **VEHICLE** search type now has its own real filter (License Plate, matching Figma node
  182:14807) against a small `VEHICLE_DATA` mock set — no gender/apparel/props/Recent
  Targets/VIP Quick Select shown for vehicles, since those don't apply. Vehicle "photos" are
  tinted car glyphs (no real vehicle photography in this prototype), not fabricated stock
  photos pretending to be real footage.
- **Recent Targets** cascades: picking one also sets Gender/Apparel/Props to match that
  target's profile, and clicking the same target again releases the cascade (clears those
  fields back out). Recent Targets and VIP Quick Select share one image-preview slot — picking
  either clears the other. **VIP Quick Select** sets that VIP's registered Face/Body photo as
  the preview image; it does not cascade attribute filters.
- An untouched date range defaults to "Last 7 days" (shown as the trigger's placeholder text,
  and actually applied when filtering) — it is not "any time ever."

### 4.4 Smart Search
- A separate, near-duplicate implementation of the same filter form (not shared code with
  Re-ID, though both now share the `filterReidData()`/`SearchFilterState` logic). **Its Search
  now actually filters** — Gender/Apparel/Props/date range/Similarity/License Plate (Vehicle
  mode) all affect the result count and grid, and the active-filter chips above the grid
  reflect the real selected date range instead of a hardcoded one.
- Recent Targets/VIP Quick Select cascade and mutual exclusivity, and the "Last 7 days" date
  default, work identically to §4.3 above.
- Results grid has a "Refine search" link (works) and a "Refresh" button (still inert).

### 4.5 RedFace
- Forces a **Primary Target Picker** modal on first entry: pick a recent target / VIP / upload
  a face or body photo (uploads are real client-side blob previews), search candidates
  (deterministic pseudo-search), confirm one as the primary target.
- Once set, shows an **Associate Graph**: a sidebar with Tier 1/2/3 zone toggles + a
  min-co-occurrence slider, and a **Pyramid & Zone / Data Grid** view toggle.
  - Pyramid view: proportional stacked bands (Red/Orange/Slate zones) with animated connector
    lines back to the primary target's apex node.
  - Data Grid: tabular list with an "Inspect" action per row.
  - Either entry point opens a **Joint Evidence panel** with a generated co-capture narrative
    and event timeline — all deterministic pseudo-random, not real correlation data.
  - The "Sort Associates by" control is a static label, not a working dropdown.

### 4.6 Cross-tab consistency note for QA
Three near-duplicate search-form implementations exist (Re-ID's panel, Smart Search's form,
RedFace's picker) with slightly different Similarity controls (fixed chips vs. a continuous
slider) — worth flagging as a consistency risk, not just a missing-feature one.

---

## 5. Redmap

### 5.1 Landing
Before any search: **just the search bar + a full-width map** — no side panels, and (as of
this pass) no zone/status overlay drawn on the map either.

- **PERSON / VEHICLE** mode toggle.
- Vehicle mode: license plate text field + date range.
- Person mode: date range, Face/Body "search by image" upload chips, Similarity chips
  (30/50/70/90, fixed values).
- Reset restores every field to default and collapses back to the landing (map-only) state.

### 5.2 After search
`Search` always shows the same 3 mock hits regardless of mode, plate, date range, uploaded
image, or similarity — none of the input actually filters anything.

- **Left panel**: uploaded face/body previews (Person mode only) + a Search Results grid (face
  + body thumbnails, similarity chips, location). Clicking a result highlights it.
- **Map**: an animated dashed route from a fixed origin through each hit, numbered markers, the
  last one enlarged as a "LAST SEEN" card.
  - The LAST SEEN card now includes a **"View Full Trace on RedMap"**-style label showing
    which person is being traced when arrived via the Dashboard deep-link (see §8) — for a
    manually-run search this label doesn't appear, since there's no "current person" concept
    otherwise.
- **Right panel** ("Multi-Track Route History"): reverse-chronological node list with an
  "Elapsed" pill (red if flagged). Its "Newest first" sort button is inert.
- There is no separate detail page for an individual hit — clicking only changes local
  highlight state on the same screen.
- **Deep-link support**: Redmap can now be opened with a search already "completed" for a named
  person (skips the manual form) — see §8. Results shown are still the same static 3 mock hits;
  only the "Tracing: {name}" label and the fact that you land straight on results are real.

---

## 6. My Page

- **Profile Information**: read-only name/email/department fields, static admin ID badge.
- **Security & Access Control**: password-change row (links to `/password-setup`) and an
  **Active Login Sessions** list (one mock session, "Terminate All Others" has no handler).
  Both sub-sections now have a matching icon+title header style.
- **System Preferences** (language/timezone dropdowns): currently commented out, not rendered —
  intentionally hidden for now, not deleted, so it's easy to bring back later.
- Card background contrast was previously broken (border color == page background, effectively
  invisible); fixed to a visible gray border.

---

## 7. Cross-screen integrations (new)

Two Dashboard map popups now link out to other screens instead of being dead ends:

1. **Device popup → Best Frame.** When a pinned device on the SYSTEM tab is Live, its map
   popup shows a **"View Live in Best Frame"** button. Clicking it switches to the Best Frame
   tab with the best-matching camera (by location-name match) already checked into the grid and
   briefly highlighted. If no camera matches well enough, Best Frame just opens normally.
2. **Tracking route popup → Redmap.** The "LAST SEEN" card on a drawn Tracking route includes a
   **"View Full Trace on RedMap"** link. Clicking it switches to the Redmap tab with a search
   already "completed" and labeled with that person's name (see §5.2 — the underlying results
   are still the same static mock hits, since Redmap has no real per-person data to filter by).

Both links use a small window-function bridge (`window.__vcaGoLiveCam` / `__vcaGoRedmapTrace`)
because Leaflet popups are raw HTML, not React — clicks inside them can't call React handlers
directly.

---

## 8. Summary of dead ends / inert controls (for QA test-plan exclusion)

- Best Frame: all "Track on Map" buttons; video scrub controls except Play/Pause.
- Data / Live Monitoring: RedFace/RedMap/Search hover buttons; "Add to Watchlist"; "RedMap
  Trace".
- Data / Re-ID Analysis: the entire Search button (no handler) — filters never apply.
- Data / Smart Search: filters are collected but never actually applied to results; "Refresh"
  button.
- Data / RedFace: "Sort Associates by" dropdown.
- Redmap: "Newest first" sort button; no field (mode, plate, date, image, similarity) changes
  the 3 mock results.
- My Page: "Terminate All Others" button.

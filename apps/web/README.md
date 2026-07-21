# A3S Web

A3S Web is a desktop super-app shell. Code is the first and default Activity
Bar destination, and Work is the second built-in product. Installed A3S Use
packages can add reviewed workbench views for vertical capabilities such as
Research and Finance. Code is a task workspace, not a slash-command launcher
or a generic chat client.

Product implementation is governed by the
[super-app plan](docs/SUPER_APP.md),
[product blueprint](docs/PRODUCT_BLUEPRINT.md),
[functional specification](docs/FUNCTIONAL_SPEC.md),
[component specification](docs/COMPONENT_SPEC.md),
[product architecture](docs/PRODUCT_ARCHITECTURE.md),
[design system](DESIGN.md),
[domain model](docs/DOMAIN_MODEL.md),
[core user journeys](docs/USER_JOURNEYS.md), and
[TUI-to-Web product mapping](TUI_PARITY.md). The signed package, contribution,
sandbox, messaging, and review contracts are defined in
[A3S Web Plugin System](docs/PLUGINS.md).

## Current product surface

- A VS Code-style Activity Bar with built-in Code and Work entries followed by
  enabled package contributions ordered from the live A3S Use registry. Memory,
  the signed plugin Marketplace, and Settings share the pinned bottom section.
  Research and Finance are not hardcoded entries.
- A Finder-inspired A3S Work local-files workspace backed by the real filesystem:
  it initially follows the default A3S Code workspace shown in Settings, while
  an explicit Work “Switch workspace” choice is persisted as a user override.
  Native folder selection, back/forward/up navigation,
  breadcrumbs, grid and list layouts, current-folder filtering, bounded
  recursive whole-workspace filename search with an explicit scope switch,
  result locations and partial-result warnings, metadata sorting,
  multi-selection, folder creation, rename, and duplication. Persisted local
  folder favorites appear in the sidebar and follow Work-initiated moves or
  renames. Finder-style arrow, Shift-range, Home/End, and Cmd/Ctrl navigation
  work in both layouts; selected files can be dragged into visible folders,
  ancestor breadcrumbs, the local root, or sidebar favorites after descendant
  and name-collision checks. Files and recursively read folders dragged from the
  operating system are copied into those same targets with bounded reads,
  collision-safe top-level names, and rollback of newly created roots after a
  failed import. New DOCX, XLSX, and PPTX files can be created directly in the
  current local folder from the sidebar, the folder context menu, or Cmd/Ctrl+N;
  Work refuses an existing name, writes through a verified sibling replacement,
  binds the new path, and opens the matching editor immediately. A single
  selection can open in a read-only Quick Look from
  Space, the toolbar, or its context menu, then move through adjacent visible
  items with the arrow keys. Quick Look safely previews bounded text, common
  raster images, PDFs, and in-memory
  DOCX/XLSX/XLS/ODS/CSV/PPTX conversions without creating or autosaving a Work
  artifact; folders expose metadata only, and unknown or oversized binaries are
  not read. The first slice deliberately omits local deletion because the
  current service deletes permanently rather than moving items to the
  operating-system Trash.
- A Work-native WebIDE for every non-binary code or text file in the selected
  root. It provides a lazy file tree, multiple editor tabs, Monaco syntax
  highlighting, diagnostics, definitions/references/implementations, safe
  Cmd/Ctrl+S writes with external-change conflict review, and editor context
  actions for the AI Assistant. Markdown uses a fixed left-source/right-live-
  preview layout instead of a mode switch.
- A resizable right-side Work AI Assistant backed by the durable A3S task
  runtime but isolated from Code conversations. Work sessions use their own
  `agentId`, persisted active conversation, new-conversation draft, workspace,
  and product switch restoration; they are excluded from the Code task list.
  File context menus can prepare ask, summarize, organize, and naming
  requests; document selections can prepare ask, summarize, rewrite, and
  translate requests; spreadsheet ranges can prepare data analysis, formula
  diagnosis, and cell-level change proposals; presentation slides and elements
  can prepare summaries, copy, layout, and speaker-note suggestions. These
  actions add bounded format-specific context and a draft but never auto-send.
  Eligible text, cell/formula, table, and speaker-note changes return through a
  structured proposal protocol: Work shows trusted before/after values, lets
  the user select individual changes, and applies only targets whose live
  source still matches. Layout and formatting advice remains review-only.
- A Work-specific visual icon language with compact framed command glyphs and
  color-coded, extension-badged file tiles shared by Finder and WebIDE views.
- A compatibility-preserved A3S Work artifact library with templates, recent
  files, favorites, server-owned autosave, folders, move/copy/rename,
  recoverable trash, imported source-file recovery, version history,
  DOCX/XLSX/PPTX import and export,
  source-backed PDF editing through EmbedPDF and a version-matched PDFium/WASM
  asset bundled from the installed `@embedpdf/pdfium` dependency,
  PDF export from every native editor,
  and compatibility review before degraded saves or exports. A shared
  print-preview workflow opens from the toolbar or Cmd/Ctrl+P, shows the actual
  document, worksheet, notes-page, slide, or handout pagination, supports page
  navigation and zoom, and applies all/current/custom page ranges to browser
  printing and PDF export. Native document editing uses a WPS-inspired tabbed
  ribbon for Home, Insert, Page, References, Review, View, and Tools, with the
  existing commands grouped by workflow instead of placed in one scrolling
  row. The centered paper canvas supports page and web views plus real 50–200%
  visual scaling. Its status bar reports the current/total page and section,
  word count, toggleable browser proofing, live save state, view controls, and
  zoom controls. Document editing also includes tables, images, links,
  find/replace, page setup, margins,
  explicit page and section breaks, per-section A4/Letter orientation and
  margins, one-to-six equal or proportional custom-width columns, headers,
  footers, and page numbers;
  default, first-page, and even-page headers and footers support rich text,
  alignment, color, links, inline raster images, and independent page-number
  visibility. Editable footnotes and endnotes preserve common inline formatting
  and native DOCX note parts. Editable figure and table captions use independent
  numbering, expose live cross-references, and round-trip through native DOCX
  SEQ fields, bookmarks, and REF fields. Editable body fields cover the current
  page, total pages, current section, section page count, date, and time; they
  update in shared preview/PDF output and round-trip as native DOCX fields.
  An editable source library supports APA, MLA, Chicago, and IEEE citations,
  atomic inline citation nodes, generated bibliographies, source-tag rename
  propagation, and explicit missing-source states. Native DOCX import and
  export preserve `CITATION` and `BIBLIOGRAPHY` fields plus Word bibliography
  custom XML, including contributor roles, corporate authors, GUIDs, uncommon
  source types, and additional simple metadata. Uncommon Word style paths are
  retained for DOCX output and reported while Work preview uses an APA
  fallback.
  PDF files keep EmbedPDF's complete native interaction model for search,
  thumbnails, annotations, forms, signatures, stamps, redaction, history,
  printing, and modified-copy export. Saving asks PDFium for a real updated PDF
  binary, replaces the managed A3S source, and writes the same bytes through the
  verified local-file path when the artifact is bound; the header keeps original
  source download explicitly separate from modified PDF export.
  Body-text revision mode records typed,
  pasted, replaced, and Backspace/Delete text as attributed insertions or
  deletions; a review panel can locate, accept, or reject one or all changes.
  Pending revisions stay visible in read-only/PDF preview and round-trip through
  native DOCX `w:ins`, `w:del`, author/date metadata, and the
  `trackRevisions` setting. Browser-native spelling assistance is explicitly
  enabled on the editable document surface. Selected body text can also carry
  editable comment threads with replies, resolve/reopen, navigation, and
  deletion. Anchors, plain-text bodies, authors, dates, replies, and resolved
  state round-trip through native DOCX comments; read-only preview highlights
  anchors while print and PDF output keep the body text visually plain. Rich
  comment-body formatting, images, tables, and content controls normalize to
  plain text under an explicit compatibility warning. Structural,
  moved-content, formatting, table, and numbering revisions remain
  compatibility work. These document settings drive read-only preview and PDF
  pagination, including page-specific footnotes and document-end endnotes.
  Spreadsheet
  interoperability preserves common layout and style metadata, filters,
  frozen panes, hyperlinks, named ranges, embedded raster worksheet images,
  print areas, repeated print-title rows and columns, manual row and column page
  breaks, A3, A4, A5, Letter, Legal, or Tabloid portrait or landscape page
  setup, percentage or fit-to-page scaling, four page margins plus
  header/footer offsets, page centering,
  editable left/center/right print headers and footers with dynamic fields,
  first-page numbering, selectable page order, common validation rules,
  editable legacy cell comments, and editable common conditional formats
  including all eight core OOXML cell
  comparisons, explicit color-scale and data-bar thresholds, data-bar value
  visibility and display lengths, and standard icon sets. Print titles and
  manual page breaks are editable and control every spreadsheet PDF page;
  spreadsheet PDF export also honors paper, orientation, scaling, margins, and
  centering, print headers and footers, page numbers, and page order.
  Conditional-format
  priority is editable and serialized
  deterministically, `stopIfTrue` is preserved and evaluated per matched cell,
  and missing, invalid, or duplicate source priorities are normalized with
  diagnostics. Sheet protection and passwordless editable ranges have XLSX
  round-tripping alongside deterministic conditional-format sheet/PDF rendering;
  worksheet images retain their native one-cell, two-cell, or absolute
  positions, sizes, names, alternative text, and media parts, remain movable
  and resizable in the editor, and appear in read-only and PDF output. Anchored
  column, bar, line, pie, doughnut, area, radar, scatter, and bubble charts retain cached data
  and live cell references, titles, legends, names, alternative text,
  positions, and sizes. Doughnut hole size; standard, marker, or filled radar
  styles; five scatter line/marker styles; and bubble scale, negative-bubble,
  and area/width sizing behavior are editable. Scatter and bubble series keep
  independent X, Y, and bubble-size references. Column, line, and area series
  can be combined with editable primary or secondary axes and native multi-plot
  ChartML round-tripping. Legends can be placed on the right, left, top,
  bottom, or top-right and optionally overlay the plot area. Column, bar, line,
  and area charts support standard, clustered, stacked, or percent-stacked
  layouts as applicable; column and bar charts expose gap width and series
  overlap, while line charts expose smoothing. Positive and negative stacks
  accumulate independently, percent stacks normalize each category, and
  stacked areas retain their lower and upper boundaries across editor,
  preview, PDF, AI Assistant, and native ChartML paths. Each series also exposes a
  portable solid sRGB fill with transparency, line color, width and
  solid/dash/dot/dash-dot pattern, plus applicable marker symbol, size, fill,
  and outline controls. Series appearance uses the same editor, preview, PDF,
  AI Assistant, and native ChartML paths. Bottom, left, top, and right axis titles can contain
  direct text or live worksheet references. Category and value axes expose
  editable normal or reverse order, four label positions, and four major-tick
  styles; category axes also expose an automatic or fixed label interval.
  Value axes additionally expose editable minimum and maximum bounds, major
  units, major-gridline visibility, number formats, and source-format linking.
  These settings drive editor, preview, PDF, AI Assistant, and native ChartML output.
  Each supported series can contain
  multiple editable linear, exponential, logarithmic, polynomial, power, or
  moving-average trendlines with forecasts, a fixed intercept, and optional
  equation or R² labels. Per-series data labels can combine values, category
  names, series names, pie/doughnut percentages, and bubble sizes with an
  editable separator and nine native positions. Per-series error bars support
  positive, negative, or bidirectional fixed values, percentages, standard
  deviation, standard error, and custom worksheet ranges, with optional end
  caps; scatter and bubble charts additionally support independent X error
  bars. Axis titles, trendlines, data labels, and error bars survive native XLSX
  round-trips and render in the editor, read-only preview, PDF output, and
  AI Assistant context. Charts can also be created from the current cell selection,
  moved, resized, deleted, and regenerated as native XLSX chart parts.
  Unsupported combination families, axis-title layouts, logarithmic scales,
  invalid axis orientation, label placement, intervals, bounds, or units,
  minor ticks, minor gridlines or units, display units, custom crossings,
  trendline parameters,
  malformed error bars, manual or per-entry legend layouts, mixed per-series
  smoothing, invalid plot spacing, per-point label overrides, theme colors,
  gradients, patterns, effects, custom dashes, and remaining advanced chart
  behavior are reported separately instead of being silently flattened;
  ordinary formulas retain exact future-function prefixes and cached Excel
  error types; legacy array, dynamic-array, and what-if data-table ranges retain
  native XLSX grouping, input references, and cached results. Shared formulas
  expand to equivalent per-cell formulas with an explicit diagnostic instead
  of retaining fragile package-level compression. Workbook automatic,
  automatic-except-data-tables, and manual calculation modes, full-recalculation
  flags, iterative limits, convergence thresholds, and full-precision behavior
  round-trip through native `calcPr`. A formula-and-calculation panel reports
  external and structured references, unsupported or volatile functions,
  cached errors, shared-formula normalization, and spill conflicts, and can
  explicitly recalculate the current selection or the full workbook. Formula
  settings and grouped-range context are also included in bounded AI Assistant
  selection context, while cached error text remains visible in preview and PDF
  output. Conflicted grouped ranges safely export as ordinary formulas rather
  than generating an invalid XLSX;
  worksheet-range pivot tables can be created from the current selection;
  assign row, column, and multiple value fields; choose from 11 deterministic
  aggregations; configure captions, styles, refresh-on-open, and grand totals;
  and add multiple single-selection report filters whose value is either all or
  one text, numeric, Boolean, or blank source item. Refresh writes filter
  summaries and aggregates into a protected report range. Pivot definitions and
  active filters are included in bounded AI Assistant context and materialized before
  preview/PDF output. Supported pivots round-trip as native XLSX pivot-table,
  page-field, cache-definition, and cache-record parts. External or named
  sources, grouping, calculated fields or items, multi-selection report
  filters, label or value filters, values-on-rows layouts, slicers, timelines,
  and data-model features keep their visible cached cells and receive explicit
  compatibility diagnostics;
  unsupported x14 data-bar direction, axis, border, gradient, and
  negative-color controls are reported explicitly;
  presentation editing includes rich text, images, tables, charts, layering,
  links, speaker notes, and editable traditional slide comments with author,
  date, and position preservation. A full-fidelity in-app clipboard supports
  element or whole-slide copy, cut, paste, and duplicate from the toolbar or
  standard Cmd/Ctrl shortcuts; pasted slides regenerate slide, element, and
  comment identities. Native presentation charts can be inserted and edited
  in place with titles, categories, multiple series, column, bar, line, area,
  pie, doughnut, radar, scatter, and bubble types. Scatter charts expose five
  line/marker styles; bubble charts expose per-series sizes, scale, negative
  bubble visibility, and area/width sizing. These settings, doughnut hole sizes,
  and radar styles survive PPTX round-trips and share the editor, thumbnail,
  playback, and PDF preview path. Legend visibility and five-position placement
  share that path, including optional plot-area overlay. Column, bar, line, and
  area charts expose applicable standard, clustered, stacked, and
  percent-stacked grouping. Column and bar charts add editable category gap and
  series overlap, while line charts add smoothing. Positive and negative stacks
  accumulate independently and percentage stacks normalize per category. Each
  series also exposes portable solid sRGB fill and transparency, line color,
  width and four dash patterns, plus applicable marker symbol, size, fill, and
  outline controls. Layout and series appearance use the same editor canvas,
  thumbnail, playback/PDF, AI Assistant, and native PPTX ChartML paths. Primary
  horizontal and vertical chart axes expose titles,
  reverse order, four label positions, four major-tick styles, category-label
  intervals, value bounds, major units, major-gridline visibility, and number
  formats. The same axis model drives the editor canvas, playback/PDF rendering,
  AI Assistant context, and native PPTX round-trips; secondary, date,
  logarithmic, minor-unit, display-unit, and custom-crossing axis features receive
  explicit compatibility diagnostics. Chart-level data labels can combine values, category names,
  series names, pie or doughnut percentages, and bubble sizes with an editable separator and
  common family-specific positions; the same labels appear in the editor,
  playback/PDF rendering, AI Assistant context, and native PPTX round-trip.
  Supported Cartesian series also expose multiple linear, exponential,
  logarithmic, polynomial, power, or moving-average trendlines with names,
  order or period, forward and backward forecasts, fixed intercepts, equations,
  and R² labels. Per-series error bars support positive, negative, or
  bidirectional fixed values, percentages, standard deviation, standard error,
  and custom numeric values with optional end caps; scatter and bubble charts
  additionally support independent X error bars. Imported custom-error formulas
  are retained even when no worksheet is available. Trendlines and error bars
  share the editor, canvas, playback/PDF, AI Assistant, and native PPTX ChartML
  round-trip paths; unsupported parameters, duplicate directions, manual
  trendline labels, manual legend layouts, invalid plot settings, theme or
  effect-based series formatting, and per-point styling receive explicit,
  feature-specific compatibility diagnostics. A review strip locates, edits,
  and deletes comments across slides;
  review markers stay out of slide-show and PDF output.
  Modern PowerPoint threaded replies, mentions, and resolved state remain
  explicit compatibility work. Fade, push, wipe, split, and cut slide
  transitions support click or timed advance, PPTX round-tripping, and playback.
  Slide masters and layouts are editable through a design panel with layout
  application, inherited backgrounds and artwork, and title/content
  placeholders. Imported PPTX files retain native layout assignments,
  placeholder geometry and basic text-style inheritance, including layouts not
  currently used by a slide; PPTX export emits native layout parts again.
  Thumbnails, playback, presenter view, PDF slides, notes pages, and handouts
  all render the same inherited design layers.
  Presentation preview also includes a presenter view with the current and next
  slide, speaker notes, elapsed-time controls, and navigation; PDF output can
  produce full slides, notes pages, or two-, three-, and six-slide handouts;
  that layout is selected and reviewed inside the shared print preview.
  Existing browser-only files migrate automatically, while IndexedDB remains a
  compatibility fallback. Opening DOCX, XLSX, or PPTX from the filesystem binds
  one managed Work copy to its source path on this device. Reopening an unchanged
  path returns to that copy instead of creating duplicates. If the disk bytes
  changed, Work opens a new bound copy and keeps the previous copy as unbound
  recovery state. Cmd/Ctrl+S checks for
  outside changes before an explicit save-back; Save As and conflict review
  avoid silent replacement, and successful writes use a verified sibling
  replacement. Platform-independent conditional atomic replacement and native
  file watching remain completion work.
  The complete local-workspace and Office-handler targets, including remaining
  interoperability, collaboration, and fidelity requirements, are tracked in
  [the Work Office contract](docs/WORK_OFFICE.md).
- A WorkBuddy-aligned global Settings dialog that preserves and dims the
  current Code surface; Help and Shortcuts is a searchable dialog tab rather
  than a separate full-screen page.
- A compact, grouped Code Task Library with on-demand search and one
  current-task workspace; rename and delete stay inline in the affected row.
- A dedicated, read-only Code Memory workspace with complete-store retrieval,
  retention and lifecycle summaries, content/entity search, combinable filters,
  a lazy-loaded 3D knowledge graph, a chronological timeline, and memory/entity
  inspectors. The graph defaults to a focused projection and can switch to a
  bounded whole-store panorama without sending unbounded topology into the
  force simulation.
- A continuous task conversation with Workspace and Activity opened as
  contextual right-side views.
- Natural-language task composition with a searchable recent-workspace picker,
  native local-folder selection, a lazy color-coded `@` workspace tree,
  searchable highlighted Skill suggestions, safe file/folder drop import, and
  inline `/goal` control.
- A calm turn-based execution document with restored Skill/file context,
  stable Code response headers, local copy and continue-edit actions,
  lifecycle-aware Markdown reasoning, reader-controlled stream following, and
  CJK-aware Streamdown/Shiki rendering for prose, task lists, tables, and
  line-numbered code. Its semantic tool timeline merges live events, output,
  HITL decisions, and recovery into one execution block, with TUI-aligned
  command, JSON-argument, and tool-call syntax highlighting across persisted
  Web API aliases, working-directory context, live output progress, and a
  compact result preview.
- Visible task execution mode with a mode-specific icon, provider-tabbed model
  selection, an independent Effort slider with English values and Chinese
  guidance, task goal timing, context usage, manual context compaction, and an
  upper-right task-runtime panel that appears for a real plan or subagent
  lifecycle and shows only the checklist, completion, elapsed time, and
  parallel work actually published by the runtime.
- A bounded startup transition with explicit loading, version-mismatch,
  disconnected, retry, and technical-detail states. Older local services that
  lack the model-catalog route fall back to their configured Provider models
  instead of blocking the workspace.
- A VS Code-aligned Web IDE with a compact explorer, color-coded file and Git
  decorations, Chinese pointer and keyboard context menus with in-place
  file-operation flows, a native Chinese Monaco context menu, independent
  dirty file tabs, tab-strip context actions for scoped closing and path copying,
  keyboard save/close/tab switching, search, replace, conflict protection,
  config validation, and saved-file Code Intelligence for document symbols,
  semantic navigation, and diagnostics.
- Workspace-wide Git review with complete original/modified Monaco diff tabs,
  stage, unstage, and commit.
- A complete local configuration center for A3S OS account and endpoint,
  runtime-detected Claude Code, Codex, and WorkBuddy account status and refresh,
  appearance, models and Providers, Agent execution and queues, session storage
  and memory policy, search and headless browsing, document/OCR parsing, MCP
  transports and OAuth, and a first-class connector backed by either the OOMOL
  hosted service or a self-hosted OpenConnector runtime. The setup keeps
  its API key/runtime token masked, applies the transport-specific
  authorization scheme, and links directly to the connector catalog, connection
  console, and self-hosting guide. See
  [Connector integration](docs/OOMOL_CONNECTOR.md). Settings also covers updates,
  service information, and searchable Help.
  Categories load and save independently; effect labels distinguish new-task
  changes from restart-required changes, and secrets remain masked.
  Configuration rows use aligned controls and explicit units; editable Provider
  names and model IDs retain focus and disclosure state.
- A source-grouped task model switcher that combines configured Provider models
  with valid local Claude Code, Codex, and WorkBuddy account models through the
  same runtime discovery and client routing used by the TUI. Account credentials
  remain in the CLI, while Settings reports only connection state and available
  model counts.
- A browser-native command palette (`Cmd/Ctrl+K`) for existing pages and
  contextual actions.
- Wide and compact desktop layouts, plus system, light, and dark themes.

The primary journey is:

```text
Work: choose a local folder → browse and select real files
→ prepare file or text context in AI Assistant → review and send
→ inspect and selectively apply eligible AI differences
→ create or open a bound Office file → explicitly save back or Save As

Code:
Create task → add context → execute → decide permissions
→ inspect evidence in context → correct and validate → stage/commit
→ continue the same conversation
```

## Code Intelligence

Monaco shares the workspace-scoped native Code Intelligence runtime owned by
the CLI backend. Go to Symbol in Editor uses the saved document outline;
definition, declaration, references, and implementations are editor actions;
diagnostics appear as Monaco markers. Dirty buffers remain browser-local, and
the status bar says when semantic results use the saved version.

The first release supports Rust through `rust-analyzer` and
TypeScript/JavaScript through `typescript-language-server --stdio`. See the
[Code Intelligence guide](../../crates/cli/docs/code-intelligence.md) for
installation, shortcuts, saved-file behavior, and the typed local API.

Text search, replace, file loading, and writes continue through the existing
workspace APIs. Code Intelligence returns only semantic metadata and locations,
then reuses the normal file-selection flow to open a target.

## Memory visualization

Open Memory from the Activity Bar, the command palette, or `#code/memory`.
The surface loads every indexed memory page while requesting graph topology
once, so search, filtering, timeline results, and graph projection use the
whole local store rather than the first response page. The WebGL renderer is
loaded only when Graph is visible. Focused mode renders the compact service
projection; Panorama keeps a connected, selection-aware sample bounded at 600
nodes and 4,000 relations, while always reporting rendered and complete totals.
An accessible node browser provides keyboard selection outside the canvas.
Refresh failure keeps the last successful snapshot visible with an inline
retry.

Memory visualization is intentionally non-destructive. Manual consolidation,
forgetting, and knowledge-base mutation remain excluded until those actions
have explicit review and recovery journeys. Knowledge management, task
branching, automation authoring, and global processes are also deferred.
Plugin workbench views and signed lifecycle management are supported, while
callable plugin actions remain CLI/MCP/Skill surfaces.

The logo at `public/logo.png` preserves the authoritative A3S OS asset. Its
SHA-256 is `72b94cf69a95dc6153f865c4f8742c0f67079caa876f35f8b2b5f970ea795a2d`.

## Stack

- Rsbuild, React 19, and Monaco Editor
- React Force Graph 3D and Three.js for the lazy Memory graph scene
- TypeScript 7
- Valtio for shared client state
- Biome 2.3.14 with A3S OS formatting conventions
- Vitest and Testing Library
- Basecoat CSS, Tailwind CSS, Streamdown, and A3S semantic design tokens

## Development

Install dependencies once:

```sh
bun install
```

Start the CLI API from the monorepo root:

```sh
cargo run --manifest-path crates/cli/Cargo.toml -- \
  web --host 127.0.0.1 --port 29653 --web-dir apps/web/dist/workspace
```

For frontend development, run the API separately and start Rsbuild from this
directory:

```sh
A3S_CODE_API_ORIGIN=http://127.0.0.1:29653 bun run dev
```

Build the frontend consumed by `a3s web`:

```sh
bun run build
```

The production output is `dist/workspace`. From the monorepo root, `just web`
builds this application and starts the complete local service. If port `29653`
is already in use, stop the existing local server or set `A3S_PORT` to another
port before starting a second instance.

## Validation

```sh
bun run format:check
bun run lint:check
bun run typecheck
bun run test
bun run build
```

The Web API is implemented in `crates/cli/src/api/code_web`. Browser code does
not access A3S OS tokens directly; the CLI owns token storage and refresh. The
plugin endpoints expose only verified catalogs and content plus digest-reviewed
lifecycle operations; see [A3S Web Plugin System](docs/PLUGINS.md).

## Deployment boundary

The default service binds to `127.0.0.1`. The browser and `a3s web` are
expected to run on the same machine. Do not expose file, session, configuration,
or Git APIs on a non-loopback interface without an authenticated gateway.

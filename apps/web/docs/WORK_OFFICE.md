# A3S Work Local Workspace and Office Handler Contract

> Active product contract. A3S Work is a Finder-inspired local-files workspace
> with contextual AI and native document, spreadsheet, and presentation
> editors. Office fidelity remains important, but the primary product model is
> the user's real filesystem rather than an isolated browser file library.

## Product outcome

A3S Work turns the user's existing folders into an editable, reviewable, and
agent-assisted workspace without hiding where files really live.

```text
Choose local folder → browse and select → add file or text context
→ collaborate with AI Assistant → explicitly approve work
→ create or open a bound Office file, Markdown file, or code file
→ explicitly save back or Save As
```

The Work product owns local-file navigation, Office editing, and a complete
local-file WebIDE. Its focused conversational AI Assistant uses the same A3S
runtime engine as Code while keeping a separate Work-tagged session, active
conversation, draft, and workspace boundary. File and selection actions prepare
context and draft instructions; they do not auto-send or silently mutate data.

Work targets WPS-class everyday Office editing while adding an AI-native Finder
and WebIDE. The local path is the stable user-facing
identity, the center surface browses or opens that path, the right rail holds a
continuous AI Assistant conversation, and contextual menus turn file or editor
selections into explicit agent context. Document, spreadsheet, presentation,
PDF, image, Markdown, and code capabilities are handlers within that shell.

Product priorities are evaluated in this order:

1. trustworthy local navigation, search, preview, file operations, watching,
   conflict handling, and recovery;
2. visible, bounded context transfer from selected files, folders, text,
   ranges, slides, and elements into AI Assistant;
3. reviewable agent proposals with explicit approval before any mutation;
4. high-frequency editing and faithful round trips for the file types users
   actually open;
5. advanced Office-format features when they protect source fidelity or unlock
   a demonstrated workflow, rather than to satisfy a suite-parity checklist.

The managed artifact repository is a compatibility, autosave, recovery, and
versioning layer. It may remain accessible while migration is incomplete, but
it must not become a second primary filesystem or force users to reason about
two unrelated file libraries.

The local filesystem is the source of truth for the Finder-like surface. The
managed Work artifact repository remains available for autosaved Office-native
copies and compatibility workflows. Files opened from the Finder-like surface
now retain a device-local path and source fingerprint. A3S autosave still
targets the managed copy; Cmd/Ctrl+S performs a separate, explicit save-back
after compatibility review and external-change detection.

## Current implementation

The first active Work release includes:

- a Finder-inspired local workspace with native directory selection, persisted
  root and current location, back/forward/up history, breadcrumbs, grid and list
  modes, current-folder filtering, and bounded recursive whole-workspace
  filename search. Before the user chooses a Work-specific root, the workspace
  follows the default A3S Code workspace exposed in Settings; the sidebar keeps
  an explicit Switch workspace action, and that choice becomes the persisted
  Work override. Search has an explicit current-folder/root scope switch,
  preserves real entry metadata and parent locations, keeps results available
  to Quick Look, file operations, and AI Assistant, and reports partial results when
  directory, entry, result, or permission limits are reached. Name/date/size/kind sorting, multi-selection,
  folder traversal, metadata, folder creation, direct rename, and direct
  duplication. Local folder favorites persist in the sidebar and rebase after
  Work-initiated moves or renames. Arrow keys, Shift-range selection, Home/End,
  Cmd/Ctrl+Up, and Cmd/Ctrl+Down provide Finder-style keyboard traversal.
  Internal drag and drop moves selected entries into visible folders, ancestor
  breadcrumbs, the local root, or sidebar favorites only after root-boundary,
  descendant, and destination-collision checks. Operating-system files and
  recursively read folders can be copied into the current folder or any of the
  same folder targets. The import path limits one file to 16 MiB, one drop to
  32 MiB, 500 files, and 500 folders; writes use 256 KiB chunks, conflicting
  top-level names receive a safe numbered suffix, and a failed import removes
  the roots it created. Blank document, spreadsheet, and presentation actions
  create DOCX, XLSX, and PPTX files directly in the current local folder from
  the sidebar, folder context menu, or Cmd/Ctrl+N. Creation validates the native
  extension, refuses an existing destination, stages the recovery artifact,
  writes and verifies the local file, binds its path, and opens the editor. A
  failed local write attempts to purge the staging artifact;
- a bounded, read-only Finder-style Quick Look opened from Space, the toolbar,
  or the file context menu, with left/right navigation across the current
  filtered and sorted entries. Folders expose metadata without recursive reads;
  common text, HTML, and SVG are rendered as inert text; PNG, JPEG, GIF, WebP,
  BMP, and AVIF render as images; PDF uses EmbedPDF/PDFium with editing commands
  disabled in Quick Look; and
  DOCX/XLSX/XLS/ODS/CSV/PPTX are converted into memory-only previews. Preview
  conversion does not add artifacts to the repository or autosave them, and
  opening an editable copy remains an explicit action. Text is limited to
  2 MiB, supported binary previews to 50 MiB, and unknown binary formats are not
  read;
- a Work-native WebIDE for all non-binary text and code files. Its lazy tree,
  multiple Monaco tabs, language detection, diagnostics, semantic navigation,
  status bar, keyboard save/close commands, external-change conflict review,
  and AI context-menu actions operate directly on the selected local root.
  Markdown always places editable source on the left and a semantic live
  preview on the right;
- a resizable right-side Work AI Assistant that binds the selected local root as
  its workspace and leaves sending to the user. Its 460 px desktop default is
  capped as the viewport narrows so common laptop widths retain a usable Office
  pane; the Office ribbon also tightens group spacing below 1120 px, and the
  assistant becomes an overlay only on compact screens. Work and Code share the
  runtime implementation but never the active conversation: Work sessions are
  tagged with `agentId=work`, persisted under a Work-only key, restored
  independently on product switches, and hidden from the Code task list;
- shared Chinese Office detail chrome for documents, spreadsheets, and
  presentations, with a compact file menu, tabbed ribbon, explicit horizontal
  overflow controls, and a consistent status bar. File menus focus the first
  available action when opened, support Arrow Up/Down, Home, and End, close on
  Tab, and return focus to the trigger on Escape. Ribbon position survives
  ordinary editor rerenders and resets only when the active tab changes.
  Document, spreadsheet, and presentation commands support the applicable
  Cmd/Ctrl formatting, undo, redo, creation, printing, and presentation
  shortcuts while leaving native text-field history and active dialogs alone.
  The PDF adapter applies the same menu and dialog semantics inside EmbedPDF's
  Shadow DOM, including labeled native overlays, initial focus, keyboard menu
  navigation, and trigger restoration after Escape. Browser regressions cover
  the common 1024 px, 900 px, and 768 px editor widths;
- file context actions for asking AI Assistant, summarizing files, proposing folder
  organization, and suggesting clearer names. Organization and naming prompts
  explicitly request advice before mutation;
- selection-aware AI Assistant menus across all three native editors: document text
  supports ask, summarize, rewrite, and translate; spreadsheet ranges include
  bounded TSV values, coordinates, and formulas for questions, anomaly
  analysis, formula diagnosis, and proposed cleanup; presentation slides and
  elements include text, tables, charts, geometry, and notes for questions,
  summaries, copy improvements, layout review, and speaker-note drafts. All
  actions prepare drafts rather than auto-sending. Actionable document
  rewrites and translations, spreadsheet value/formula proposals, and
  presentation text/table/note proposals append a bounded structured-change
  protocol. Matching AI Assistant replies become a review panel with trusted
  before/after values, per-change checkboxes, and an explicit Apply action.
  Unknown targets are rejected and every selected target is compared with the
  live artifact again before application; stale targets are skipped. Formatting
  and presentation-layout advice remains advisory rather than executable;
- raw binary reads through the local workspace service so supported Office
  files can be imported directly from filesystem navigation. DOCX, XLSX, and
  PPTX copies opened this way retain a device-local path binding and source
  fingerprint. A local path has one active binding: reopening unchanged bytes
  reuses the existing artifact, while changed bytes create a new bound artifact
  and leave the previous one available as an unbound recovery copy. Cmd/Ctrl+S
  checks that fingerprint before writing, stops for an
  explicit conflict review when the source changed or disappeared, and offers
  Save As or an explicit overwrite. Save As requires a second confirmation for
  an existing destination. Successful saves use a hidden sibling temporary
  file, replacement, and post-write fingerprint verification; Work-initiated
  file or folder renames also move affected bindings;
- a product-local file center with search, recent files, favorites, templates,
  grid and list views, folders, rename, move, copy, recoverable trash, restore,
  permanent deletion, and browser-file import;
- a rich-text document editor with page presentation, paragraph styles,
  emphasis, lists, alignment, color, highlighting, editable tables, raster
  images, hyperlinks, find and replace, undo, redo, explicit page breaks,
  editable document sections, next-page, continuous, next-column, odd-page, and
  even-page section breaks, per-section A4/Letter portrait or landscape page
  setup, editable margins, one-to-six equal or proportional custom-width
  columns with independent gaps and an optional separator, rich default,
  first-page, and even-page headers and footers with common inline formatting,
  alignment, color, links, inline raster images, independent page numbering,
  and paginated read-only preview;
- body-text change tracking in the document editor, including attributed
  insertion/deletion marks for normal text entry, paste, selection replacement,
  Backspace/Delete, Find/Replace, and applied AI Assistant rewrites. A revision panel
  locates each change and accepts or rejects individual or all changes; pending
  revisions remain visible in read-only and PDF preview. Native DOCX import and
  export preserve `w:ins`, `w:del`, author/date metadata, and
  `trackRevisions`. Browser-native spelling assistance is explicitly enabled.
  Structural paragraph changes, moved-content revisions, formatting/property
  changes, table/row/cell revisions, and numbering revisions remain diagnosed
  as unsupported;
- anchored body-text comments with selection-based creation, navigation,
  replies, resolve/reopen, and deletion. Read-only preview highlights comment
  anchors, while print preview and PDF output retain the text without comment
  highlighting. Native DOCX import and export preserve range anchors, authors,
  dates, threaded replies, and resolved state. Comment bodies intentionally use
  plain text; rich formatting, images, tables, and content controls inside a
  source comment are diagnosed before normalization. Pasted document content
  drops copied comment IDs so it cannot silently clone an unrelated thread;
- an Excel-style spreadsheet editor with formulas, formatting, multiple
  worksheets, row and column operations, workbook- and worksheet-scoped name
  management, editable print areas, repeated print-title rows/columns, and
  manual horizontal and vertical page breaks, plus A3, A4, A5, Letter, Legal,
  or Tabloid portrait or landscape setup, percentage or fit-to-page scaling,
  page margins, and centering; editable left/center/right print headers and
  footers with dynamic page, sheet, file, path, date, and time fields;
  first-page numbering; and
  selectable over-then-down or down-then-over page order. A Work
  conditional-format manager covers all eight core OOXML cell comparisons,
  two- and three-color scales, data bars, and standard icon sets with editable
  thresholds, order, value visibility, and data-bar display lengths. Imported
  text, duplicate/unique, ranking, average, and formula rules participate in the
  same editable priority order; `stopIfTrue` is editable and evaluated per
  matched cell. The editor also includes editable cell comments, worksheet
  protection with editable-range management, embedded raster images that can
  be inserted, moved, resized, or deleted on the worksheet, plus editable
  column, bar, line, pie, doughnut, area, radar, scatter, and bubble charts backed by cached data
  and live cell references. Charts can be created from a selected data table,
  have editable titles, legends, series references, alternative text,
  positions, and sizes; doughnut hole size, standard/marker/filled radar styles,
  five scatter line/marker styles, independent X/Y/bubble-size references, and
  bubble scale, negative-value visibility, and area/width sizing survive native
  XLSX chart-part round-trips. Column, line, and area series can be combined per
  series on primary or secondary axes and survive native multi-plot ChartML
  round-trips. Legends support right, left, top, bottom, and top-right placement
  plus plot-area overlay. Applicable column, bar, line, and area charts expose
  standard, clustered, stacked, and percent-stacked grouping; column and bar
  charts expose gap width and overlap, and line charts expose smoothing.
  Positive and negative stacks accumulate separately, percentage stacks
  normalize per category, and stacked areas render between their cumulative
  lower and upper boundaries. These settings share the editor, preview, PDF,
  AI Assistant, and native ChartML paths. Per-series appearance adds portable solid
  sRGB fill and transparency, line color, width and four dash patterns, plus
  applicable marker symbol, size, fill, and outline settings; these also share
  editor, preview, PDF, AI Assistant, and native ChartML paths. Bottom, left, top, and right axis titles
  accept direct text or live worksheet references. Category and value axes
  accept normal or reverse order, four label positions, and four major-tick
  styles; category axes also accept an automatic or fixed label interval.
  Value axes additionally accept automatic or fixed minimum and maximum bounds,
  an optional major unit, major-gridline visibility, an editable number format,
  and source-format linking. These axis settings share the editor, preview, PDF,
  AI Assistant, and native ChartML paths.
  Supported series accept multiple editable linear,
  exponential, logarithmic, polynomial, power, or moving-average trendlines, including
  forecast distances, polynomial order, moving-average period, fixed intercept,
  and equation or R² labels. Trendlines round-trip through native ChartML and
  remain visible in the editor, read-only preview, PDF output, and bounded
  AI Assistant chart context. Per-series data labels combine values, category names,
  series names, pie/doughnut percentages, and bubble sizes with an editable
  separator and best-fit, center, inside, outside, or directional positions;
  supported settings use the same editor/preview/PDF/AI Assistant and native
  ChartML paths. Series also expose editable positive, negative, or
  bidirectional error bars calculated from fixed values, percentages, standard
  deviation, standard error, or custom worksheet ranges, with optional end
  caps and independent X error bars for scatter and bubble charts. Supported
  error bars use the same editor/preview/PDF/AI Assistant and native ChartML paths.
  Read-only preview and paginated print/PDF output place images and charts on
  the page containing their anchor cell. A formula-and-calculation panel shows
  formula counts, cached errors, native grouped ranges, and precise compatibility diagnostics;
  edits workbook calculation mode, full-recalculation flags, iterative limits,
  convergence threshold, and precision; and can explicitly recalculate the
  current selection or full workbook. AI Assistant selection context includes the
  applicable calculation mode and grouped formula ranges. A pivot-table
  manager creates worksheet-range reports from the current selection, assigns
  row and column dimensions plus multiple value fields, supports 11
  deterministic aggregations, edits captions, styles, refresh-on-open, and
  row/column grand totals, and configures multiple single-selection report
  filters with all or one primitive source item per field. Refresh writes filter
  summaries and aggregates into a dedicated protected report range, rejects
  unsafe overlaps, clears stale output after shrinkage, and includes the
  applicable pivot definition and active filters in bounded AI Assistant context;
- a presentation editor with slide thumbnails, text and shape elements,
  rich text, hyperlinks, images, tables, basic charts, layer ordering, speaker
  notes, positioning, resizing, formatting, duplication, deletion, traditional
  slide comments, and keyboard or full-screen playback. Selected elements or
  whole slides can be copied, cut, pasted, or duplicated through toolbar actions
  and standard Cmd/Ctrl shortcuts. The in-app clipboard preserves structured
  presentation content, offsets repeated element pastes, and gives pasted
  slides, nested elements, and comments fresh identities. Native charts can be
  inserted and edited in place with titles, categories, multiple series,
  column, bar, line, area, pie, doughnut, radar, scatter, and bubble types.
  Scatter charts provide marker, straight-line, and smooth-line variants;
  bubble charts provide editable per-series sizes, scale, negative-bubble
  visibility, and area/width sizing. These settings, doughnut hole sizes, and
  standard, marker, or filled radar styles share the editor, thumbnail,
  playback, and PDF preview path and survive supported PPTX round-trips.
  Legend placement and plot-area overlay use that same path. Applicable column,
  bar, line, and area charts expose standard, clustered, stacked, and
  percent-stacked grouping. Column and bar charts expose category gap and series
  overlap, while line charts expose smoothing. Positive and negative stacks
  accumulate independently, percentage stacks normalize per category, and
  stacked areas render against cumulative lower boundaries. Each series exposes
  portable solid sRGB fill and transparency, line color, width and four dash
  patterns, plus applicable marker symbol, size, fill, and outline controls.
  Layout and appearance share the editor, preview, playback/PDF, AI Assistant,
  and native PPTX ChartML paths. Primary horizontal and vertical axes
  support titles, reverse order, four label positions, four major-tick styles,
  category-label intervals, value bounds, major units, major-gridline
  visibility, and number formats across editing, playback/PDF rendering, AI
  Assistant context, and native PPTX round-trips. Secondary, date,
  logarithmic, minor-unit, display-unit, and custom-crossing axis features are
  diagnosed before normalization.
  Chart-level data labels combine values, category names, series names, and pie
  or doughnut percentages, and bubble sizes with editable separators and common family-specific
  positions; they render consistently and survive supported PPTX round-trips.
  Supported Cartesian series accept multiple linear, exponential, logarithmic,
  polynomial, power, or moving-average trendlines with names, order or period,
  forward and backward forecasts, fixed intercepts, equations, and R² labels.
  Per-series error bars cover positive, negative, and bidirectional fixed-value,
  percentage, standard-deviation, standard-error, and custom numeric
  calculations with optional end caps; scatter and bubble charts also expose X
  error bars. Imported custom-error formula references are retained even though
  presentations have no worksheet to resolve them. The editor, canvas,
  playback/PDF, bounded AI Assistant context, and native PPTX ChartML round-trip
  all consume this same series-analysis model. Unsupported parameters,
  duplicate directions, manual trendline-label layouts, and advanced formatting
  receive distinct compatibility diagnostics.
  Comments can be added at a slide or selected element, located across slides,
  edited, and deleted;
  authors, dates, and positions survive traditional PPTX comment round-trips,
  while review pins remain out of playback and PDF output. Modern threaded
  replies, mentions, and resolved state are diagnosed as unsupported. Fade,
  push, wipe, split, and cut transitions are editable with speed, direction,
  click advance, timed advance, and apply-to-all controls, then replayed during
  presentation preview. A presenter view combines the current slide,
  next-slide preview, speaker notes, an elapsed-time clock with pause and
  reset, and explicit navigation. An editable master-and-layout design panel
  supports layout application, inherited backgrounds and artwork, basic
  title/content placeholders, and adding, moving, resizing, or deleting shared
  design elements. The editor, thumbnails, playback, presenter view, PDF
  slides, notes pages, and handouts render the same inherited layers;
- server-owned autosave under the A3S configuration directory, atomic artifact
  writes, optimistic revision checks, and a 50-entry version history;
- IndexedDB as a browser cache and compatibility fallback, with a local-storage
  fallback for restricted browser environments and one-time migration into the
  server store;
- DOCX, HTML, Markdown, and text import into the document editor, plus basic
  table, hyperlink, raster-image, per-section paper size, orientation, margin,
  equal or proportional custom-width column, rich default/first/even header and
  footer, PAGE-number, explicit-page-break, section-break, footnote, and endnote
  round-tripping through DOCX; editable body PAGE, NUMPAGES, SECTION,
  SECTIONPAGES, DATE, and TIME fields retain their instructions and cached
  values while updating in shared preview and PDF output. Editable inline
  citations and generated bibliography blocks share a source library with APA,
  MLA, Chicago, and IEEE output. Source-tag renames update existing citations,
  deleted sources remain visible as missing citations, and native DOCX
  `CITATION`/`BIBLIOGRAPHY` fields round-trip with Word bibliography custom XML.
  Contributor roles, personal and corporate authors, source GUIDs, uncommon
  source types, and additional simple metadata are retained. Uncommon Word
  style paths remain available for DOCX output with an explicit APA-preview
  fallback diagnostic. Native anchored comments also preserve plain-text
  threads, authorship, timestamps, replies, and resolved state.
  Common inline formatting in page chrome and notes remains editable, while
  other field families, content controls, floating positioning, custom note
  numbering, placement, tables, embedded media, and rich comment-body content
  are reported before normalization;
- XLSX, XLS, ODS, and CSV import into the spreadsheet editor, preserving merged
  cells, row and column dimensions, hidden rows, columns, and sheets, number
  formats, basic cell styles, auto-filter ranges, frozen panes, web and
  workbook hyperlinks, workbook- and worksheet-scoped named ranges, embedded
  PNG/JPEG/GIF/BMP/WebP/SVG worksheet images with one-cell, two-cell, or
  absolute DrawingML anchors, worksheet print areas, repeated print-title
  rows/columns, manual row and column page breaks, A3, A4, A5, Letter, Legal,
  and Tabloid paper and orientation, scale and fit-to-page settings, print
  margins, horizontal and vertical centering, odd-page plain-text
  left/center/right headers and footers, dynamic header/footer fields,
  first-page numbering, page order, header/footer scaling and margin alignment,
  common list, number, date, and text-length validation rules, and common
  conditional formats including
  all eight core cell comparisons
  (equal/not-equal, greater/less-than with inclusive variants, and
  between/not-between), contains-text, duplicate/unique, top/bottom,
  above/below-average, formula, two- and three-color-scale, data-bar, and the 17
  core OOXML icon-set rules, including explicit minimum, maximum, numeric,
  percentage, and percentile thresholds; data-bar value visibility and
  minimum/maximum display lengths; and icon-set inclusive cutoffs, reversed
  order, and hidden values. OOXML rule priorities become deterministic internal
  order and sequential export priorities; `stopIfTrue` survives round-trips and
  is applied per matched cell. Missing, invalid, or duplicate source priorities
  are normalized with explicit diagnostics. Custom icons, extension-only icon
  sets, and x14 data-bar direction, axis, border, gradient, and negative-color
  controls are reported instead of silently treated as editable. The same path
  preserves single-author plain-text legacy cell comments, sheet protection,
  locked and unlocked cells, selection permissions, and passwordless editable
  ranges; source password verifiers and permission-backed ranges are preserved
  with explicit diagnostics rather than treated as authenticated. Supported
  worksheet images preserve their names, alternative text, position, size,
  binary media, and native drawing relationships across XLSX round-trips under
  a 10 MiB editable-image budget. Linked or browser-incompatible images remain
  source-only, while crop, rotation, and flip settings are diagnosed before
  normalization. Ordinary formulas retain exact imported future-function
  prefixes when unchanged and restore known prefixes after edits. Formula error
  types and displayed cached values survive editing, preview/PDF output, and
  export. Legacy array formulas, dynamic arrays with native cell metadata, and
  what-if data tables with input references survive native XLSX round-trips;
  shared formulas deliberately expand to equivalent per-cell formulas.
  Automatic, automatic-except-data-tables, and manual calculation modes,
  full-calculation flags, iterative settings, and full-precision behavior
  round-trip through `calcPr`. External and structured references, volatile and
  unsupported functions, shared-formula expansion, cached errors, and spill
  conflicts receive distinct diagnostics. A grouped range that conflicts with
  an independently edited formula, merge, or another group safely normalizes to
  ordinary formulas rather than producing an invalid package. Supported
  worksheet-range pivot tables preserve editable row, column, multiple value,
  and single-selection report-filter fields; aggregations; captions; styles;
  refresh behavior; totals; report location; cached values; and source data
  through native `pivotTableDefinition` page fields, `pivotCacheDefinition`,
  and `pivotCacheRecords` parts. External or named sources, grouping,
  calculated fields or items, multi-selection report filters, label or value
  filters, values-on-rows layouts, slicers, timelines, and data-model pivots
  remain visible as ordinary cached cells under precise diagnostics;
- editable PPTX import and export for slide order and dimensions, theme colors,
  native slide-layout assignments, master/layout backgrounds and artwork,
  placeholder geometry and basic text-style inheritance, text runs, hyperlinks,
  images, tables, editable column, bar, line, area, pie, doughnut, radar,
  scatter, and bubble charts, including supported chart-level data labels,
  primary-axis settings, per-series trendlines, and X or Y error bars; grouped
  shapes, lines, speaker notes,
  traditional slide comments, and basic slide transitions with advance timing.
  Every layout linked by an imported presentation master is retained, including
  currently unused layouts, and export regenerates native editable layout
  parts. Traditional comment parts preserve plain text, author identity,
  timestamps, and slide positions; modern threaded comments remain source-only
  with an explicit diagnostic. Unsupported transition families, sounds, and
  through-black options are also diagnosed rather than silently treated as
  editable;
- source-backed PDF import and full EmbedPDF/PDFium editing. The native viewer
  owns search, thumbnails, page layouts, annotations, forms, signatures, stamps,
  redaction, undo/redo, printing, and modified-copy export. Work loads the
  version-matched PDFium WASM asset bundled from the installed
  `@embedpdf/pdfium` dependency, requests a real updated PDF binary from the
  EmbedPDF export plugin, persists that binary as the managed A3S source, and
  writes the same bytes through verified replacement when a local path is
  bound. Original-source download remains a separately labeled action;
- PDF export from documents, spreadsheets, and presentations through
  artifact-specific print layouts, including document paper size, orientation,
  margins, explicit page and section breaks, continuous and odd/even-page
  section pagination, per-section columns, rich first/even/default headers and
  footers, and variant-specific page numbers, plus
  spreadsheet print-area boundaries, repeated print-title rows/columns on every
  page, manual row and column pagination, A3, A4, A5, Letter, Legal, or Tabloid
  paper, orientation, percentage or fit-to-page scaling, print margins, page
  centering,
  left/center/right print headers and footers, resolved dynamic fields,
  configurable starting page numbers, selectable page order, and deterministic
  rendering of supported conditional fills, text
  colors, threshold-aware color scales, mixed-sign data bars with editable
  display lengths and value visibility, and icon sets;
  presentation output includes full-slide pages, speaker-notes pages, and
  two-, three-, or six-slide handouts;
- a dedicated print-preview workflow shared by documents, spreadsheets, and
  presentations. The toolbar and Cmd/Ctrl+P open the actual PDF pagination
  surface with a labeled page list, keyboard navigation, 40–120% zoom, and
  all/current/custom page ranges. Custom ranges accept localized separators,
  reject malformed or out-of-bounds pages, and drive both browser printing and
  PDF export. Presentation slide, notes, and two-/three-/six-slide handout
  layouts rebuild the preview before output. Pending edits are persisted before
  native printing, excluded pages stay visible but clearly muted during review,
  and compatibility warnings remain available before degraded PDF export;
- compatibility inspection for DOCX, XLSX, and PPTX, with a required review
  before a degraded import is saved and before native Office or PDF export;
- preservation and streaming download of the original imported binary;
- explicit 16 MiB native-artifact and 50 MiB source-file limits;
- server version browsing and restoration from the editor;
- storage that is independent from Code task state and never reports a failed
  server save as successful.

This is a functional local-workspace and Office foundation. It does not yet
prove the full target described below.

The interoperability slice is covered by generated-package tests for PPTX and
DOCX, presentation-layout/master, chart, and transition, document page-layout,
equal/custom-column, rich page-chrome, common body-field,
citation/bibliography custom-XML,
figure/table caption, bookmark, and caption REF round-trip tests,
spreadsheet layout, validation, defined-name, print-area, print-title,
print-header/footer, page-order, protection, conditional-format,
worksheet-range pivot-table/cache, and worksheet image-anchor/media round-trip
tests, deterministic pivot aggregation and conditional-format evaluation tests,
PDF print-layout tests, repository and migration tests, compatibility-gate
tests, the complete Web unit suite, and a production build.
The broad completion boxes below stay open because advanced format features,
collaboration, accessibility, and browser workflow evidence are still missing.

## Product completion target

The filesystem-first workspace and Office-handler objectives remain open until
the following are implemented and verified. Office items below are fidelity
and workflow requirements for files opened in Work, not a mandate to reproduce
every command in a traditional office suite.

### Local filesystem and contextual AI

- [x] Pick and persist a real local root; navigate with history, parent, and
  breadcrumbs; filter or search the whole root, sort, select, create folders,
  rename, and duplicate. Recursive filename search is bounded and exposes
  result locations, unreadable-directory counts, and truncation state.
- [x] Use the Settings-visible A3S Code default workspace until the user
  explicitly switches Work to another folder; preserve an existing or newly
  selected Work root as the user override.
- [x] Keep destructive local deletion out of the first slice while the service
  exposes permanent deletion instead of operating-system Trash semantics.
- [x] Create native DOCX, XLSX, and PPTX files directly in the current local
  folder, protect existing destinations, bind the resulting path, and open the
  corresponding editor without a managed-artifact-first Save As detour.
- [x] Treat a bound local Office path as a stable identity: reuse its existing
  artifact when the disk fingerprint is unchanged, and preserve the prior
  artifact as recovery state when changed disk bytes require a new binding.
- [x] Bind Work AI Assistant to the selected root, pass workspace-relative selected
  paths, use Work-only sessions and drafts, switch away from incompatible Work
  workspaces, and prefill rather than auto-send contextual actions.
- [x] Open every non-binary code or text file in a Work-native Monaco WebIDE
  with multiple tabs, a lazy file tree, semantic navigation, diagnostics,
  conflict-safe saves, and AI Assistant editor actions.
- [x] Edit Markdown as source on the left with a continuously updated semantic
  preview on the right.
- [x] Use one coherent Work icon language across Finder and WebIDE surfaces,
  including framed commands and color-coded extension-badged file glyphs.
- [x] Offer selection-aware ask, summarize, rewrite, and translate actions in
  the document editor.
- [x] Add bounded, read-only Quick Look for folders, common text and raster
  images, PDF, and supported Office imports, with Space/toolbar/context-menu
  entry points and adjacent-item keyboard navigation.
- [x] Replace PDF.js with the same EmbedPDF/PDFium stack used by A3S OS, retain
  its complete editing interface, and persist modified PDF binaries to A3S and
  verified bound local files.
- [ ] Add operating-system Trash, native file watching, sidebar tags, and
  large-folder virtualization. Internal drag-and-drop moves, persisted local
  folder favorites, and Finder-style arrow, range, Home/End, parent, and open
  keyboard navigation are implemented. Bounded operating-system file and
  recursive folder drops now copy into the current folder, visible folders,
  ancestor breadcrumbs, the local root, and sidebar favorites. Trash semantics,
  native change events, tags, and large-folder virtualization remain open.
- [ ] Add durable local-path binding, safe atomic in-place save, external-change
  detection, conflict review, and Save As for DOCX/XLSX/PPTX. The current slice
  implements device-local bindings, save-time and focus-time fingerprint
  checks, explicit conflict choices, Save As, sibling replacement, and
  post-write verification. This target remains open until the workspace service
  provides a platform-independent conditional atomic-replace primitive and
  native file watching closes the check-to-replace race.
- [x] Extend draft-only selection-aware AI actions to spreadsheet ranges and
  presentation slides/elements with bounded, format-specific context.
- [x] Apply eligible document, spreadsheet, and presentation content edits only
  through an explicit, reviewable diff. Structured replies are limited to the
  original selection manifest, users can deselect individual changes, and
  stale targets are skipped at apply time. Spreadsheet formatting and
  presentation-layout advice remains non-executable.

### File compatibility

- [ ] Open, edit, preview, and round-trip DOCX, XLSX, and PPTX without silently
  dropping supported content.
- [ ] Complete preview coverage for PDF, legacy Office formats, OpenDocument
  formats, images, and common text formats. Quick Look now covers PDF, common
  inert text, PNG/JPEG/GIF/WebP/BMP/AVIF, DOCX, XLSX, legacy XLS, ODS, CSV, and
  PPTX. This target remains open for formats such as legacy DOC/PPT and HEIC,
  broader format coverage, and format-fidelity evidence.
- [ ] Export PDF from every editor and preserve print layout.
  Documents, spreadsheets, and presentations now share a range-selectable
  print preview and PDF output path; this target remains open for exact layout
  fidelity and broader format evidence.
- [x] Provide a dedicated print-preview workflow for every native editor, with
  page navigation, zoom, all/current/custom ranges, presentation print layouts,
  browser printing, and range-selectable PDF export.
- [ ] Preserve tables, images, charts, speaker notes, comments, hyperlinks,
  formulas, merged cells, validation, and embedded media where the source
  format supports them.
- [ ] Report unsupported or degraded content before saving or exporting.

### Document editing

- [x] Rich default, first-page, and even-page headers and footers, independent
  page numbers, editable sections, margins, one-to-six equal or proportional
  custom-width columns with independent gaps, tables, raster images, links,
  find and replace, paragraph styles, and explicit page-break control are
  editable. Section-specific page setup, column settings, page chrome, and the
  five core section-break types survive DOCX round-trips and drive preview and
  PDF output. Custom widths use deterministic ordered block flow in browser
  preview and PDF; exact intra-paragraph reflow remains part of accurate
  pagination.
- [x] Organize document commands into a WPS-inspired Home, Insert, Page,
  References, Review, View, and Tools ribbon with keyboard-navigable tabs.
  Present the editable page on a centered paper canvas, provide page and web
  views, apply real 50–200% canvas scaling, and expose current/total page and
  section, word count, toggleable browser proofing, live save state, view
  controls, and zoom controls in the bottom status bar.
- [x] Footnotes and endnotes are editable, retain common inline formatting,
  survive native DOCX round-trips, and render as page-specific footnotes or
  document-end endnotes in shared preview and PDF output.
- [x] Figure and table captions are editable with independent numbering; live
  caption cross-references and missing-target diagnostics render in shared
  preview and PDF output and survive native DOCX round-trips as SEQ fields,
  bookmarks, and REF fields.
- [x] PAGE, NUMPAGES, SECTION, SECTIONPAGES, DATE, and TIME body fields are
  insertable and refreshable, resolve per page and section in shared
  preview/PDF output, and preserve their native DOCX field instructions and
  cached values.
- [x] Citations and bibliography sources are editable through a shared document
  library with APA, MLA, Chicago, and IEEE output. Atomic inline citations,
  generated bibliography blocks, source-tag renames, and missing-source states
  remain synchronized. Native DOCX `CITATION` and `BIBLIOGRAPHY` fields plus
  Word bibliography custom XML preserve common and uncommon source types,
  contributor roles, GUIDs, and additional simple metadata.
- [ ] Add richer source-type-specific editing, citation styles beyond APA, MLA,
  Chicago, and IEEE, exact preview rendering for retained uncommon Word styles,
  and field families beyond the supported body, page-chrome PAGE, caption SEQ,
  caption REF, CITATION, and BIBLIOGRAPHY models.
- [x] Body-text insertion and deletion tracking is editable and reviewable,
  applies to typed/pasted/replaced text and AI Assistant replacements, remains
  visible in preview/PDF, and preserves DOCX revision author/date metadata plus
  the native `trackRevisions` setting. Browser-native spelling assistance is
  enabled on the editable surface and can be toggled from the Review ribbon or
  the document status bar.
- [x] Anchored body-text comments are editable and reviewable with replies,
  resolve/reopen, navigation, and deletion. Anchors, plain-text thread content,
  authors, dates, replies, and resolved state survive native DOCX round-trips.
  Read-only preview highlights anchors; print/PDF output keeps the text without
  comment markup styling. Rich comment-body formatting and embedded structures
  are explicitly diagnosed and normalized to plain text.
- [ ] Accurate pagination, managed dictionaries and advanced proofing, and
  structural, moved-content, formatting, numbering, and table revision
  tracking.

### Spreadsheet editing

- [x] All eight core cell comparisons, duplicate/unique, ranking/average,
  formula, two- and three-color-scale, data-bar, and standard icon-set
  conditional formats are editable, survive XLSX round-trips, and render
  deterministically in the sheet canvas and PDF output. Core color-scale and
  data-bar thresholds remain explicit, and data-bar value visibility plus
  minimum/maximum display lengths are preserved. Rule priority is editable and
  deterministic; per-cell `stopIfTrue` behavior is preserved and evaluated,
  with malformed or duplicate source priorities normalized under diagnostics.
- [x] Plain-text legacy cell comments are editable and survive XLSX
  round-trips; multiple blocks and threaded replies are reported and flattened.
- [x] Sheet protection, locked and unlocked cells, selection permissions, and
  passwordless editable ranges are enforced and survive XLSX round-trips;
  source password verifiers remain preserved and diagnosed.
- [x] Print areas, repeated print-title rows and columns, manual horizontal and
  vertical page breaks, A3, A4, A5, Letter, Legal, and Tabloid paper and
  orientation, percentage or fit-to-page scaling, four page margins,
  header/footer offsets, and page centering, odd-page plain-text print headers
  and footers, dynamic fields, first-page numbering, header/footer scaling and
  margin alignment, and both page orders are editable and survive XLSX
  round-trips; the applicable settings control paginated spreadsheet PDF
  output.
- [x] Embedded raster worksheet images are insertable, movable, resizable, and
  deletable; supported one-cell, two-cell, and absolute DrawingML anchors,
  image media, names, and alternative text survive XLSX round-trips. Read-only
  preview and paginated spreadsheet PDF output render images on the page
  containing their anchor cell. Linked or incompatible images, crop, rotation,
  flip, and the 10 MiB editable-image budget are reported explicitly.
- [x] Anchored column, bar, line, pie, doughnut, area, radar, scatter, and bubble charts preserve
  cached data, worksheet cell references, titles, legends, names, alternative
  text, positions, and sizes. Doughnut hole size; standard, marker, or filled
  radar styles; all five scatter line/marker styles; independent X, Y, and
  bubble-size references; and bubble scale, negative-value visibility, and
  area/width sizing are editable. XY charts preserve their native two-value-axis
  layout. Column, line, and area combination series have independently editable
  plot types and primary or secondary axes. Primary and secondary horizontal and
  vertical axis titles are editable as direct text or live cell references.
  Category and numeric axes expose editable order, label placement, and major
  tick marks, while category axes also expose automatic or fixed label
  intervals. Numeric axes additionally expose editable bounds, major units,
  major gridlines, and number formats with source-link behavior. Legends expose five native
  positions and optional plot overlay. Column, bar, line, and area plots expose
  applicable standard, clustered, stacked, or percent-stacked grouping;
  column/bar gap and overlap plus line smoothing also round-trip natively.
  Positive and negative stacks are independent, percentage stacks normalize
  each category, and stacked-area geometry uses cumulative lower and upper
  boundaries.
  Series expose editable solid sRGB fill and transparency, line color, width,
  and solid/dash/dot/dash-dot patterns. Applicable line, scatter, radar, and
  combination series also expose marker symbol, size, fill, and outline.
  Supported appearance survives native ChartML round-trips and drives the
  shared editor, read-only preview, paginated PDF, and AI Assistant context paths.
  Supported series retain multiple editable linear, exponential, logarithmic,
  polynomial, power, and moving-average trendlines with forecast, order or
  period, fixed-intercept, equation, and R² controls. Per-series data labels
  expose value, category, series, percentage, bubble-size, separator, and
  position controls. Editable error bars cover positive, negative, and
  bidirectional fixed-value, percentage, standard-deviation, standard-error, and
  custom-range calculations with optional end caps; scatter and bubble charts
  also support X error bars.
  All supported chart families are creatable from the current selection,
  movable, resizable, deletable, rendered in read-only and paginated PDF output,
  represented in AI Assistant context, and regenerated as native XLSX drawing and
  chart parts.
  Unsupported combination plot families, additional axes beyond one primary
  and one secondary pair, unsupported chart or trendline families, invalid
  axis-title position or layout, logarithmic scales, invalid axis orientation,
  label placement, intervals, bounds, or units, minor ticks, minor units or
  gridlines, display units, custom crossings, trendline parameters or manual label layouts,
  malformed or unsupported error bars, per-point data-label overrides, legend
  keys, manual or per-entry legend layouts, invalid plot spacing, mixed
  per-series smoothing, number formats, leader lines, external or multi-level references,
  embedded chart workbooks, theme colors, gradients, patterns, effects, custom
  dashes, and remaining advanced chart formatting receive distinct
  compatibility diagnostics.
- [x] Auto-filter ranges, frozen panes, workbook- and worksheet-scoped named
  ranges, and common list, numeric, date, and text-length data-validation rules
  are editable and survive supported XLSX round-trips.
- [x] Worksheet-range pivot tables are creatable and editable with row and
  column dimensions, multiple value fields, 11 aggregations, captions, styles,
  refresh behavior, grand totals, multiple all-or-one report filters, protected
  deterministic output with filter summaries, bounded AI Assistant context, and
  native XLSX pivot-table/page-field/cache round-tripping. Unsupported external
  or named sources, grouping, calculated fields or items, multi-selection
  report filters, label or value filters, values-on-rows layouts, slicers,
  timelines, and data-model features retain their visible cached cells and
  receive explicit diagnostics.
- [ ] Formula coverage, advanced pivot behavior, advanced chart families and
  formatting, advanced conditional formatting
  such as x14 data-bar direction, axis, border, gradient, and negative-color
  controls, password-authenticated or permission-backed protected ranges,
  additional paper sizes, first/even-page or rich/image print-header variants,
  and printer-specific setup options. Native doughnut, radar, scatter, bubble,
  column/line/area combination families, and the six common trendline types are
  now complete in the editable model; common series-level data-label content and
  positions, four-position axis titles, reversible axes, four label positions,
  four major-tick styles, category-label intervals, value-axis bounds, major
  units, major-gridline visibility, number formats, and common error bars are
  also editable. Five-position legends with overlay plus supported grouping,
  stacking, percentage stacking, gap, overlap, and line-smoothing settings are
  also complete. Portable per-series solid fills, transparency, line colors,
  widths, four dash patterns, and applicable marker shape/size/fill/outline are
  now complete; theme-driven, gradient, pattern, effect, and custom-dash
  formatting remain open.
  Stock, surface, unsupported combination plots, additional axes, per-point
  label overrides, custom trendline-label layout, and other advanced chart
  families or formatting remain open.
- [ ] Complete deterministic calculation and import/export formula
  compatibility. Native `calcPr` settings, cached error values, future-function
  source prefixes, legacy and dynamic arrays, and what-if data-table definitions
  now round-trip; shared formulas expand deterministically; explicit range/full
  recalculation and compatibility diagnostics are available. This remains open
  for complete Excel-function parity, browser recalculation of dynamic spills
  and what-if data tables, dependency/circular-reference evidence, and exact
  cross-engine numeric equivalence.

### Presentation editing

- [x] Copy, cut, paste, duplicate, and delete selected elements or whole slides
  through standard keyboard shortcuts and explicit toolbar actions. The
  structured in-app clipboard preserves rich element data, cascades repeated
  paste offsets, and regenerates slide, element, and comment identities.
- [x] Create and edit native presentation charts with titles, categories,
  multiple series, column, bar, line, area, pie, doughnut, radar, scatter, and
  bubble types. Scatter line/marker variants and bubble sizes, scale, negative
  visibility, and area/width sizing survive PPTX round-trips. Doughnut hole size
  and standard, marker, or filled radar style survive PPTX
  round-trips and render through the shared editor, preview, playback, and PDF
  path. Legend visibility and right, left, top, bottom, or top-right placement
  share that path, including optional plot-area overlay. Applicable column,
  bar, line, and area charts support standard, clustered, stacked, and
  percent-stacked grouping; column and bar charts expose category gap and series
  overlap, and line charts expose smoothing. Positive and negative stacks are
  independent and percentage stacks normalize per category. Per-series
  appearance includes solid sRGB fill and transparency, line color, width and
  four dash patterns, plus applicable marker symbol, size, fill, and outline.
  These settings share editing, preview, playback/PDF, AI Assistant, and native
  PPTX ChartML paths. Primary horizontal and vertical axes support titles, reverse
  order, four label positions, four major-tick styles, category-label
  intervals, value bounds, major units, major-gridline visibility, and number
  formats across the editor canvas, playback/PDF rendering, AI Assistant
  context, and native PPTX round-trips. Multi-level native category
  caches are retained as readable hierarchical labels. Chart-level data labels
  support values, category names, series names, pie or doughnut percentages, bubble sizes,
  editable separators, and common family-specific positions across editing,
  playback/PDF rendering, AI Assistant context, and native PPTX round-trips.
  Supported Cartesian series expose all six common trendline types with names,
  polynomial order or moving-average period, forecasts, fixed intercepts,
  equations, and R² labels. They also expose positive, negative, or
  bidirectional fixed-value, percentage, standard-deviation, standard-error, or
  custom numeric error bars with optional end caps and X direction for scatter
  and bubble charts. Both features share the editor canvas, playback/PDF, AI
  Assistant, and native ChartML paths; imported custom formulas remain
  round-trippable, and unsupported parameters, duplicate directions, manual
  labels, or advanced styling are diagnosed explicitly.
- [x] Fade, push, wipe, split, and cut transitions, direction and speed, click
  or timed advance, and apply-to-all editing survive PPTX round-trips and replay
  in keyboard, pointer, and full-screen presentation preview.
- [x] Speaker notes are editable, survive the supported PPTX round-trip, appear
  beside current- and next-slide previews in presenter view, and print in
  dedicated notes pages. Presentation PDF export also produces full-slide and
  two-, three-, or six-slide handout layouts.
- [x] Traditional PPTX slide comments are editable through a cross-slide review
  strip and preserve plain text, authors, dates, and positions. Comment pins are
  visible only in editing and stay out of playback, print preview, PDF pages,
  and handouts. Modern threaded replies, mentions, and resolved state remain
  explicitly diagnosed.
- [ ] Complete slide-layout and master fidelity. The current slice provides
  first-class editable masters and layouts, inherited backgrounds and artwork,
  basic title/content placeholders, layout application, master-aware rendering,
  import of used and unused native layouts, and native layout-part export. This
  target remains open for fully faithful multi-master native hierarchies,
  advanced placeholder types and styles, theme font/style matrices, and
  editable, round-tripped per-slide master visibility.
- [ ] Advanced transition families, embedded media, and advanced chart
  fidelity. Combination, 3D, stock, surface, live workbook references,
  independent per-series X-value lists, secondary/date/logarithmic axes, minor
  units and gridlines, display units, custom crossing points, per-entry legend
  formatting, per-series or per-point data-label overrides, data-label number
  formats, leader lines and detailed label styling, custom trendline-label
  placement, theme/gradient/pattern/effect fills, per-point formatting, and
  custom line dashes remain open for presentation charts.
- [ ] Stable element positioning and font substitution diagnostics.

### Online collaboration

- [x] Server-owned durable storage, folders, rename, move, copy, trash, restore,
  upload, and download.
- [x] Bounded version history with explicit restoration.
- [x] Atomic writes, optimistic conflict rejection, and queued migration of
  browser-only files.
- [ ] Multi-user presence, coauthoring, shared live comments, mentions,
  suggestions, user-facing conflict resolution, and explicit share
  permissions. Local document comment threads are implemented, but this is not
  real-time collaboration.
- [ ] Authenticated access, audit records, and bounded public links.

### Operational quality

- [x] Native-artifact and binary-source limits are explicit, and source downloads
  stream progressively.
- [ ] Editors progressively load large native artifacts.
- [x] Autosave, reconnect, and conflict states never imply a save that did not
  complete.
- [ ] Keyboard access, focus order, contrast, reduced motion, and screen-reader
  names are covered by automated and browser-level checks.
- [ ] Browser tests cover create, edit, preview, import, export, reopen, and
  recovery for every artifact type.

## Architecture

```text
A3S shell
└── WorkProduct
    ├── WorkSidebar
    ├── WorkFilesWorkspace
    │   ├── WorkFilesController
    │   ├── WorkQuickLook
    │   └── local workspace API
    ├── WorkCodeWorkspace
    │   ├── WorkIdeExplorer
    │   ├── MonacoCodeEditor
    │   └── Markdown live preview
    ├── WorkHome (managed artifact compatibility surface)
    ├── WorkEditorShell
    │   ├── DocumentEditor
    │   ├── SpreadsheetEditor
    │   └── PresentationEditor
    └── Work AI Assistant
        ├── ExecutionStream
        └── TaskComposer

WorkRepository
├── A3S Work API
│   ├── atomic JSON artifacts and folders
│   ├── imported source binaries
│   └── bounded revision history
├── IndexedDB cache and compatibility fallback
└── localStorage fallback

Local Office binding
├── device-local artifact ID → absolute path + source fingerprint
├── one active binding per path with unchanged-path artifact reuse
├── direct current-folder DOCX/XLSX/PPTX creation with no implicit overwrite
├── compatibility-gated Cmd/Ctrl+S and Save As
├── external-change conflict review
└── sibling temporary write → replace → fingerprint verification

Office interoperability
├── Mammoth              DOCX import
├── docx                 DOCX export
├── SheetJS              spreadsheet import/export
├── JSZip + OOXML parser PPTX import and compatibility inspection
├── PptxGenJS            PPTX export
├── EmbedPDF             complete PDF editor and plugin UI
├── PDFium/WASM          dependency-bundled PDF rendering, mutation, and serialization
└── html2canvas + jsPDF  PDF export
```

Work filesystem, WebIDE, Office editor, AI session, and AI draft state are
isolated from Code product state. The shared Activity Bar selects a product;
Work reuses execution and composer components without reusing Code sessions.
Product switches persist and restore each product's own active conversation.
Office runtime dependencies are loaded only when the relevant workflow needs
them.

## Native artifact model

Every saved artifact has a stable ID, kind, title, folder, favorite flag,
timestamps, revision, trash state, optional source-file metadata, and
kind-specific content.

```text
WorkArtifact
├── document      HTML-based rich-text sections and per-section page settings
├── spreadsheet   FortuneSheet workbook data
├── presentation  ordered slides with positioned native elements and notes
└── pdf           source-backed binary edited and serialized by PDFium
```

The selected operating-system folder is authoritative for the local-files
surface. Separately, the local A3S service is authoritative for converted
native artifacts. By default it stores those artifacts under `~/.a3s/work`; a
custom A3S configuration path places `work/` beside that configuration file.
Import converts an external file into the native model and keeps the source
binary for recovery. When import starts from the Finder-like surface, a
separate device-local binding retains the absolute source path and fingerprint.
That binding is unique by normalized local path. Reopening the same fingerprint
returns to the existing managed state; a different fingerprint creates a fresh
bound artifact without deleting the previous recovery copy.
Creating a native Office file from the local-files surface uses the same model
in the opposite direction: Work serializes a new artifact, persists it as
recovery state, writes and verifies the requested path without replacing a
known existing file, then stores the binding and opens the editor. If the local
write fails, Work attempts to remove the just-created recovery artifact.
Managed autosave never silently overwrites that path. Explicit save-back and
Save As run compatibility review, compare the current source fingerprint, write
a hidden sibling temporary file, replace the destination, and verify the
result. The current service does not yet expose a conditional atomic-replace
operation or file watcher, so a cross-process change in the narrow
check-to-replace window is not claimed to be solved on every platform.
Compatibility diagnostics remain attached to converted artifacts and are shown
before saving or exporting. Supported basic DOCX and PPTX content has round-trip
tests, but export must not be described as lossless while advanced Office
features remain source-only.

## Validation

Run from `apps/web`:

```sh
bun run format:check
bun run lint:check
bun run typecheck
bun run test
bun run build
```

Work-focused tests cover template completeness, local fallback, server
migration, optimistic revisions, source upload, folder and trash lifecycles,
version restoration, filesystem path normalization, root persistence,
back/forward navigation, persisted sidebar favorites, favorite-path rebasing,
Finder keyboard selection, root-bounded drag/drop moves with descendant and
collision guards, bounded operating-system file/folder drop imports with
collision-safe names and rollback, direct folder creation and rename, raw binary reads,
device-local path binding, binding-preserving Work renames, external-change
fingerprints, temporary sibling replacement, post-write verification, Save As
overwrite confirmation,
bounded Quick Look loading, unsupported-format and size guards, safe text
rendering, keyboard/context-menu/toolbar entry points, and adjacent-item
navigation,
AI Assistant workspace switching, relative context preparation, bounded selected
content, contextual file actions, AI Assistant draft-only starters, keyboard panel
resizing, document-selection extraction, spreadsheet range serialization,
presentation element/slide serialization, editor AI menus, structured proposal
parsing, target whitelisting, selective diff application, stale-target conflict
handling, search, opening, Activity Bar activation, compatibility
review, DOCX and PPTX round-tripping, document page setup and explicit breaks,
presentation master/layout import, editing, inheritance, application,
rendering, native layout-part round-tripping, element/slide clipboard cloning,
copy/cut/paste/duplicate keyboard and toolbar actions, presentation chart
creation and data editing, native doughnut/radar chart settings and multi-level
category-cache round-tripping, editable presentation legend placement and full
primary-axis titles, direction, labels, ticks, intervals, bounds, major units,
gridlines, and number formats, chart-level data-label content, placement, rendering, diagnostics, and
native PPTX round-tripping, native presentation scatter/bubble editing,
shared rendering, AI context, compatibility diagnostics, and PPTX round-tripping,
basic transition parsing,
editing, timed playback, and PPTX round-tripping, document equal/custom-column
and section editing, XLSX worksheet image import across one-cell, two-cell, and
absolute anchors, native drawing/media round-tripping, anchored spreadsheet
print/PDF rendering, XLSX chart cached-data and cell-reference import across
column, bar, line, pie, doughnut, area, radar, scatter, and bubble families,
selection-based chart creation and editing, move/resize/delete reconciliation,
native DrawingML/ChartML round-tripping alongside worksheet images, editable
doughnut holes, radar styles, scatter line/marker styles, independent XY and
bubble-size references, bubble sizing controls, per-series column/line/area
combination plots, primary/secondary axes and axis titles with live worksheet
references, reversible category/value axes, four label positions, four major
tick styles, category-label intervals, editable value-axis bounds, major units,
major gridlines, and number formats, editable five-position and overlay legends, positive/negative and
percent-stacked plot geometry, stacked-area boundaries, column/bar gap and
overlap, line smoothing, per-series solid fills/transparency, line colors,
widths and dash patterns, marker symbols/sizes/fills/outlines, native series
formatting and layout ChartML round-tripping, editable
multi-type trendlines with forecast, constraint, equation,
and R² controls, native trendline ChartML
  round-tripping, editable series data-label content/separators/positions and
  native label round-tripping, editable directional fixed, percentage,
  statistical, and custom-range error bars with native ChartML round-tripping,
  precise remaining advanced-chart diagnostics, and anchored spreadsheet chart
  print/PDF rendering,
native workbook calculation-setting, shared-formula expansion, legacy-array,
dynamic-array metadata, what-if data-table, future-function prefix, and cached
formula-error round-tripping, formula compatibility analysis, grouped-range
conflict normalization, explicit selection/workbook recalculation, and cached
error print/PDF rendering, deterministic worksheet-range pivot aggregation,
single-selection report filtering, output protection and metadata
reconciliation, pivot-manager editing, native pivot-table/page-field/cache
round-tripping, and unsupported multi-selection/filter diagnostics,
DOCX
section-marker and per-section page-layout round-tripping, rich
default/first/even page-chrome editing and DOCX interoperability, editable
PAGE/NUMPAGES/SECTION/SECTIONPAGES/DATE/TIME body fields, PAGE-field
page-chrome normalization, citation source-library editing, source-tag rename
and missing-source behavior, native DOCX `CITATION`/`BIBLIOGRAPHY` fields and
bibliography custom-XML round-tripping, continuous and odd/even-page PDF
pagination, editable footnote/endnote DOCX parts and shared note placement,
body-text revision tracking, individual/all accept-reject behavior,
browser-native spellcheck activation, tracked AI Assistant/Find replacements,
read-only/PDF revision rendering, and native DOCX `w:ins`/`w:del` plus
`trackRevisions` round-tripping,
anchored comment editing and review, copied-anchor paste sanitization,
read-only/PDF comment presentation, and native DOCX comment/reply/resolution
round-tripping,
shared document/spreadsheet/presentation print preview, keyboard page
navigation and zoom, localized custom-page-range parsing, selected-page native
printing and PDF export, compatibility-confirmed range retention,
presenter-view notes and timing, presentation notes-page and
handout pagination, editable traditional slide comments, PPTX comment-author
and position round-tripping, modern-comment diagnostics, review-only
playback/PDF behavior, spreadsheet layout, filters, panes, links, and validation,
PDF print layouts,
named ranges, print areas, repeated print titles, and manual row/column page
breaks, spreadsheet paper/orientation, percentage and fit-to-page scaling,
print margins and centering, print-header/footer field mapping, starting page
numbers, and both page orders, conditional-format
parsing, editing, XLSX round-tripping, deterministic
icon/data-bar/scale evaluation and rendering, cell-comment interoperability,
and sheet-protection and editable-range interoperability, plus progressive
source-backed EmbedPDF loading and real PDFium modified-copy persistence. Full
completion additionally requires the
browser-level and advanced format-fidelity evidence listed above.

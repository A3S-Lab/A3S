# A3S Web

A3S Web is a desktop super-app shell. The current release ships A3S Code; A3S
Work and Science remain “coming soon”. Code is a task
workspace, not a slash-command launcher or a generic chat client.

Product implementation is governed by the
[super-app plan](docs/SUPER_APP.md),
[product blueprint](docs/PRODUCT_BLUEPRINT.md),
[functional specification](docs/FUNCTIONAL_SPEC.md),
[component specification](docs/COMPONENT_SPEC.md),
[product architecture](docs/PRODUCT_ARCHITECTURE.md),
[design system](DESIGN.md),
[domain model](docs/DOMAIN_MODEL.md),
[core user journeys](docs/USER_JOURNEYS.md), and
[TUI-to-Web product mapping](TUI_PARITY.md).

## Current product surface

- A VS Code-style Activity Bar for A3S products and one Settings entry.
- A WorkBuddy-aligned global Settings dialog that preserves and dims the
  current Code surface; Help and Shortcuts is a searchable dialog tab rather
  than a separate full-screen page.
- A compact, grouped Code Task Library with on-demand search and one
  current-task workspace; rename and delete stay inline in the affected row.
- A continuous task conversation with Workspace and Activity opened as
  contextual right-side views that can expand in place to a full content-area
  presentation without remounting the editor or losing drafts. Conversation
  headers expose launch actions only while no context panel is open; the
  mounted panel then owns switching, presentation, and close actions so a
  responsive overlay never leaves covered duplicate controls in the focus
  order. Opening moves keyboard focus into the active panel mode, while closing
  returns it to the control that opened the panel.
- Natural-language task composition with a searchable recent-workspace picker,
  native local-folder selection, a lazy color-coded `@` workspace tree,
  searchable highlighted Skill suggestions, safe file/folder drop import, and
  inline `/goal` control.
- A calm turn-based execution document with restored Skill/file context,
  stable Code response headers, local copy and continue-edit actions,
  lifecycle-aware Markdown reasoning, reader-controlled stream following, and
  typographically tuned Streamdown/Shiki rendering for headings, lists, task
  lists, quotations, tables, links, images, footnotes, inline code, and
  line-numbered code blocks. Its semantic tool timeline merges live events,
  output, HITL decisions, and recovery into one execution block, with
  syntax-highlighted commands and arguments, working-directory context, live
  output metrics, copy actions, and a compact tail preview after completion.
- Visible task execution mode with a mode-specific icon, provider-tabbed model
  selection, an independent Effort slider with English values and Chinese
  guidance, task goal timing, context usage, manual context compaction, and an
  upper-right task-runtime panel that appears for a real plan or subagent
  lifecycle and shows only the checklist, completion, elapsed time, and
  parallel work actually published by the runtime. Dedicated Use workers are
  identified by their observed standard MCP routes (`Use · Browser`,
  `Use · Office`, or multiple deduplicated routes), while their evidence uses
  readable domain actions instead of raw MCP tool names.
- A bounded startup transition with explicit loading, version-mismatch,
  disconnected, retry, and technical-detail states. Older local services that
  lack the model-catalog route fall back to their configured Provider models
  instead of blocking the workspace.
- A VS Code-aligned Web IDE with a compact explorer, color-coded file and Git
  decorations, pointer and keyboard context menus with in-place file-operation
  flows, one roving tree tab stop with visual-order and hierarchical arrow-key
  navigation, focused-row `F2` rename and confirmed `Delete` with focus
  recovery, a global `Cmd/Ctrl+P` file picker with fuzzy name/path ranking,
  lazy-loaded Monaco editing, independent dirty file tabs with shortest-unique
  parent labels for same-named files, a semantic roving tab strip with
  post-close focus recovery and editor-to-editor `Ctrl+Tab` focus handoff,
  Simplified Chinese Monaco and code-navigation menus, pointer and keyboard
  tab context menus for guarded close-one/other/right/all operations and path
  copying,
  keyboard save/close/tab switching scoped to workspace focus, an editor-safe
  `Cmd/Ctrl+B` task-sidebar toggle, bounded
  back/forward location history,
  a task-scoped full-screen workspace with Escape restoration,
  source-focused search with an explicit dependency/build scope, reviewed
  replacement, conflict protection, config validation,
  and saved-file Code Intelligence for document symbols, semantic navigation,
  and diagnostics, with one visible toolbar menu for definition, declaration,
  references, implementations, and the file outline.
- Workspace-wide Git review with complete original/modified Monaco diff tabs,
  stage, unstage, and commit.
- A complete local configuration center for A3S OS account and endpoint,
  runtime-detected Claude Code, Codex, and WorkBuddy account status and refresh,
  appearance, models and Providers, Agent execution and queues, session storage
  and memory policy, search and headless browsing, document/OCR parsing, MCP
  transports and OAuth, updates, service information, and searchable Help.
  Categories load and save independently; effect labels distinguish new-task
  changes from restart-required changes, and secrets remain masked.
  Configuration rows use aligned controls and explicit units; editable Provider
  names and model IDs retain focus and disclosure state.
- A source-grouped task model switcher that combines configured Provider models
  with valid local Claude Code, Codex, and WorkBuddy account models through the
  same runtime discovery and client routing used by the TUI. Account credentials
  remain in the CLI, while Settings reports only connection state and available
  model counts.
- Browser-native command (`Cmd/Ctrl+K`) and file (`Cmd/Ctrl+P`) palettes for
  existing pages, contextual actions, and bounded workspace navigation.
- Wide and compact desktop layouts, plus system, light, and dark themes.

The primary journey is:

```text
Create task → add context → execute → decide permissions
→ inspect evidence in context → correct and validate → stage/commit
→ continue the same conversation
```

## Code Intelligence

Monaco shares the workspace-scoped native Code Intelligence runtime owned by
the CLI backend. The file toolbar exposes definition, declaration, references,
implementations, and Go to Symbol in Editor together with their keyboard
shortcuts. The same navigation commands remain available from Monaco's context
menu, whose native actions and A3S additions use the same Simplified Chinese
catalog as the surrounding Web IDE; diagnostics appear as Monaco markers. The
editor toolbar keeps a bounded,
workspace-scoped location history: `Ctrl+-` returns to the previous file and
caret, while `Ctrl+Shift+-` moves forward. Open drafts are reused rather than
reread, a new navigation clears the forward branch, and file rename/delete
operations reconcile stored locations. Dirty buffers remain browser-local, and
the status bar says when semantic results use the saved version while also
following the live cursor, selection, and Monaco model line ending. Its line
ending control converts between LF and CRLF through Monaco's undo history and
normal dirty-file protection. Files without a native language profile keep
Monaco's local editing and outline features without exposing backend protocol
errors; the document-symbol bridge always uses the mounted Monaco model's
concrete language identifier, including plaintext fallback, so an unfamiliar
extension cannot corrupt Monaco's provider registry. Genuine runtime failures
remain visible as concise status messages.

`Cmd/Ctrl+P` opens a keyboard-first workspace file picker from Monaco or the
surrounding task surface. It ranks exact filenames, path fragments, and fuzzy
subsequences, keeps open tabs at the top before a query, ignores dependency and
build outputs, and reports bounded or truncated catalogs without blocking the
current draft. Selecting an already-open file reuses that tab and its unsaved
content. Explorer directory entries and quick-open results share one file-type
contract: common source, configuration, and lockfile formats remain editable;
known binary formats use extension hints and unfamiliar extensions are sampled
before either entry point labels them as binary.

The editor and diff viewer share one lazy local Monaco runtime. It retains the
complete standalone editing surface and the JSON, CSS, HTML, JavaScript, and
TypeScript language services, while registering tokenizers only for the file
types the product opens as source text. The runtime does not import Monaco's
broad package entry, so unused bundled languages and protocol clients stay out
of the editor activation graph without weakening find, folding, suggestions,
diagnostics, navigation, themes, workers, or diff behavior.

Explorer mutations preserve the visible tree as well as open editors. Renaming
an expanded directory rebases its loaded descendants, expansion state, and
retry state; deleting a path evicts its entire cached subtree immediately.
Late directory responses are ignored, so a failed parent refresh cannot bring
back an old name or a deleted child. New files use the backend's atomic
create-only operation, so a conflicting path reports an error in place without
truncating the existing file.

Text reads also return a content revision. A normal save sends that revision as
its server-side precondition and performs no client-side read-before-write
request. Restored legacy tabs without a revision use their last saved content as
the precondition. A mismatch returns HTTP 412 without changing the file, after
which the editor fetches the latest disk version and offers reload or explicit
unconditional overwrite. Successful saves and both conflict resolutions update
the tab's revision before the next edit.

The entire editor workspace is task-scoped rather than repository-scoped.
Switching tasks snapshots tabs, dirty drafts, the active selection and view,
explorer and search state, Git review state, conflicts, and load errors, then
restores the destination task even when both tasks use the same repository.
Within one live page, every text document has a task-isolated Monaco model URI.
The mounted editor switches models instead of remounting, so each open document
keeps its undo/redo history, cursor and selections, folding, and scroll state
across file and task switches. An explicit search or semantic location is
consumed once; later tab returns restore the document's own view rather than
replaying a stale jump. A successful file or parent-directory rename rebinds
the new logical path to the document's existing immutable model URI before its
tab path changes, preserving that same editing session and live status. If a
different file is later opened at the old path while the renamed document is
still retained, it receives a distinct URI instead of sharing undo or view
state. Models remain retained only while referenced by an open tab in the
active task or an inactive task snapshot. Cancelling a guarded dirty close
keeps the model, while confirmed close and snapshot removal dispose the
orphaned model deterministically. A page refresh restores persisted drafts and
tabs but starts a new in-memory Monaco undo history.
Because the switch does not discard content, dirty drafts do not interrupt it;
destructive close, reload, replacement, and overwrite operations still require
explicit resolution. Workspace reads and mutations carry a monotonic task
generation guard, so responses from a previously selected task cannot write
into the current editor. Versioned browser-local snapshots are debounced during
editing and flushed synchronously on `pagehide`, so a normal refresh restores
the active task as well as inactive task snapshots. Malformed data is ignored;
if browser storage cannot fit the complete caches and clean documents, the
fallback snapshot preserves dirty drafts and restores other tabs with an
explicit retry state.

The first release supports Rust through `rust-analyzer` and
TypeScript/JavaScript through `typescript-language-server --stdio`. See the
[Code Intelligence guide](../../crates/cli/docs/code-intelligence.md) for
installation, shortcuts, saved-file behavior, and the typed local API.

Text search excludes repository metadata, dependency caches, and common build
outputs by default so source matches remain useful. The Search panel can opt
into those directories and reruns the current query immediately; query, scope,
or workspace changes make the displayed replacement set stale until a search
succeeds. Search renders at most 300 matches and probes one additional match;
when that sentinel exists, the panel reports truncation and keeps replacement
disabled until the user narrows the search. Search, replace, file loading, and
writes continue through the existing workspace APIs. Code Intelligence returns
only semantic metadata and locations, then reuses the normal file-selection
flow to open a target.

Memory browsing and consolidation, Knowledge, task branching, automation
assets, plugins, and global processes are deliberately excluded until they
have complete Web product journeys. Memory runtime configuration is available
in Settings; backend endpoints alone are not treated as product features.

The logo at `public/logo.png` preserves the authoritative A3S OS asset. Its
SHA-256 is `72b94cf69a95dc6153f865c4f8742c0f67079caa876f35f8b2b5f970ea795a2d`.

## Stack

- Rsbuild, React 19, and Monaco Editor
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
not access A3S OS tokens directly; the CLI owns token storage and refresh.

## Deployment boundary

The default service binds to `127.0.0.1`. The browser and `a3s web` are
expected to run on the same machine. Do not expose file, session, configuration,
or Git APIs on a non-loopback interface without an authenticated gateway.

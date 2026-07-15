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
  contextual right-side views.
- Natural-language task composition with a searchable recent-workspace picker,
  native local-folder selection, a lazy color-coded `@` workspace tree,
  searchable highlighted Skill suggestions, safe file/folder drop import, and
  inline `/goal` control.
- A calm turn-based execution document with restored Skill/file context,
  stable Code response headers, local copy and continue-edit actions,
  lifecycle-aware Markdown reasoning, reader-controlled stream following, and
  Streamdown/Shiki rendering for prose, code, and tables. Its semantic tool
  timeline merges live events, output, HITL decisions, and recovery into one
  execution block.
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
  decorations, pointer and keyboard context menus with in-place file-operation
  flows, lazy-loaded Monaco editing, independent dirty file tabs, keyboard
  save/close/tab switching, search, replace, conflict protection, config
  validation, and saved-file Code Intelligence for document symbols, semantic
  navigation, and diagnostics.
- Workspace-wide Git review with complete original/modified Monaco diff tabs,
  stage, unstage, and commit.
- A complete local configuration center for A3S OS account and endpoint,
  appearance, models and Providers, Agent execution and queues, session storage
  and memory policy, search and headless browsing, document/OCR parsing, MCP
  transports and OAuth, updates, service information, and searchable Help.
  Categories load and save independently; effect labels distinguish new-task
  changes from restart-required changes, and secrets remain masked.
  Configuration rows use aligned controls and explicit units; editable Provider
  names and model IDs retain focus and disclosure state.
- A source-grouped task model switcher that combines configured Provider models
  with valid local Claude Code, Codex, and WorkBuddy account models through the
  same runtime discovery and client routing used by the TUI.
- A browser-native command palette (`Cmd/Ctrl+K`) for existing pages and
  contextual actions.
- Wide and compact desktop layouts, plus system, light, and dark themes.

The primary journey is:

```text
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

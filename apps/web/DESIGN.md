# A3S Code Web Design System

## Purpose

This document defines the visual and interaction language for A3S Code Web. It
extracts proven workspace patterns from AionUI and the calm, guided task-entry
language visible in the supplied WorkBuddy reference while preserving A3S OS
brand identity and the A3S Code product architecture.

This is an adaptation, not a skin or a component-by-component copy. AionUI is
the reference for interaction maturity; the supplied WorkBuddy screen is a
reference for China-market task guidance and visual restraint; A3S OS is
authoritative for brand color; the A3S Code product blueprint is authoritative
for information architecture.

Related contracts:

- [Product blueprint](docs/PRODUCT_BLUEPRINT.md)
- [Domain and state model](docs/DOMAIN_MODEL.md)
- [Core user journeys](docs/USER_JOURNEYS.md)
- [TUI-to-Web product mapping](TUI_PARITY.md)

## Source extraction

The following AionUI patterns are intentionally retained:

| AionUI source | Extracted pattern | A3S Code adaptation |
| --- | --- | --- |
| `components/layout/Sider` | Stable collapsible navigation, aligned rows, hover-revealed actions | Primary product navigation and task list |
| `hooks/ui/useResizableSplit.tsx` | Pointer-safe resizable panels with persisted width | Code tree/editor/changes splits |
| Conversation timeline utilities | Semantic ordering of text, reasoning, tools, and results | Task execution stream |
| `CommandQueuePanel.tsx` | Visible, editable, reorderable follow-up queue | Composer follow-up queue |
| `SendBox` | Composed input, attachments, model controls, explicit send/stop | A3S task composer without slash-first UX |
| `AtFileMenu` and media components | File selection, upload, paste, preview | Context attachment picker |
| `AionModal.tsx` | Standard header/body/footer dialog structure | Confirmations and bounded forms only |
| Theme base CSS | Thin scrollbars, reduced motion, dark/light semantic tokens | Reimplemented with A3S tokens |

The following AionUI patterns are explicitly not inherited:

- AOU purple scales and Arco's default primary blue;
- assistant/team switching as primary navigation;
- slash commands as the main discovery model;
- complex workbenches inside modal dialogs;
- Electron title bar and window controls;
- fixed product categories that do not match the A3S super-app product rail and
Code's task and Result Workspace model.

### WorkBuddy reference extraction

Only the supplied new-task, active-task, and right-side result-workspace screens are treated as
evidence. No assumptions are made about WorkBuddy behavior that is not visible
in those references.

| Visible reference pattern | Product value | A3S Code adaptation |
| --- | --- | --- |
| One centered task entry area | Makes the first useful action unmistakable | New-task state centers one Composer and removes inactive task-context chrome |
| Continuous conversation beside an artifact workspace | Keeps intent, result, and artifact connected | Active tasks keep Conversation visible while the selected result opens on the right |
| One mode switcher for overview, files, browser, and changes | Preserves content width while keeping result types discoverable | Use one compact popover instead of permanent mode buttons |
| Artifact tabs and restrained tool chrome | Prioritizes the artifact over IDE decoration | Use one Result Workspace header with tabs, full-screen, close, and no second product navigation |
| Changed-file navigator with line metrics | Makes review scope scannable before opening a diff | Show workspace-wide status and additions/deletions without claiming task provenance |
| Large Chinese headline with generous whitespace | Lowers cognitive pressure and builds confidence | A concise outcome-led welcome appears only before the first instruction |
| Familiar scenario chips | Helps users start without learning commands | Code-specific starters such as fix, explain, implement, test, and review |
| Controls attached to the Composer | Keeps configuration connected to the instruction it affects | The mode-specific icon control owns execution mode; model, Effort, and context usage keep dedicated entries, while `/goal` stays inline |
| Soft neutral surfaces with restrained accent color | Feels calm and contemporary without looking decorative | Neutral canvas and surfaces use black for primary actions and A3S blue only for focus, selection, and active progress |
| Compact monochrome navigation | Keeps destinations recognizable without competing with the task | Preserve the A3S Activity Bar and Code task library with quieter inactive states |
| Small product label, plain navigation rows, and collapsible object groups | Keeps the sidebar useful without turning it into a second dashboard | Show A3S Code and its version quietly, keep New task as a 34 px row, and group single-line task titles with relative time |
| Short, conversational Chinese labels | Reduces technical intimidation | Use direct verbs and user outcomes; do not expose transport or backend language |

The following visible patterns are not inherited:

- campaign cards, points, rewards, promotional notices, and engagement banners;
- mascot decoration inside the primary coding workflow;
- a generic assistant taxonomy that replaces Code's task object and context;
- large empty areas after a task starts producing execution evidence;
- green as the brand accent or WorkBuddy-specific iconography and assets.

## China-market design character

"China-market" describes the product's language, density, guidance, and
interaction expectations. It is not a claim that all Chinese users share one
taste. The target character is:

```text
温润克制 · 清晰可信 · 轻商务 · 强引导 · 有效率但不压迫
Calm and warm · clear and trustworthy · lightly professional · guided · efficient without pressure
```

### Experience principles

1. **The next action is visible.** A user should understand what to do within
   three seconds without reading documentation or remembering a command.
2. **Explain capability through outcomes.** Prefer “审阅代码变更” over a
   protocol name, route name, or internal agent term.
3. **Progressive disclosure protects focus.** Show the instruction and its
   immediate choices first; reveal configuration, logs, and repository detail
   only when they become relevant.
4. **Dense information still breathes.** Operational screens may be compact,
   but each region has one clear hierarchy and avoids nested decorative cards.
5. **Feedback is reassuring and factual.** State what is happening, what is
   safe, and what the user can do next. Do not use celebratory language for
   ordinary completion or hide uncertainty behind friendly copy.
6. **Chinese is authored, not translated.** Labels are concise natural Chinese;
   English product or model names remain intact when they are proper nouns.
7. **Professional does not mean cold.** Use soft neutrals, moderate radii, and
   direct human language while reserving decoration for empty and onboarding
   states.

### Visual tension

Balance the system between these endpoints:

| Too cold | Target | Too playful |
| --- | --- | --- |
| IDE chrome everywhere | Task-first professional workspace | Consumer chat toy |
| Raw logs and protocol names | Semantic execution evidence | Vague animated thinking |
| Dense controls at first sight | Progressive controls near the task | Hidden capability and mystery actions |
| Flat monochrome hierarchy | Neutral surfaces with restrained A3S accent | Gradients, mascots, and colored cards everywhere |

### Density modes

A3S Code uses state-dependent density rather than a global compact/comfortable
preference:

- **Preparation density:** spacious, centered, one dominant Composer, optional
  starters, and no inactive execution controls.
- **Execution density:** document-like stream with compact semantic blocks and
  a stable Composer.
- **Workspace density:** IDE-like explorer, editor, and changes information with
  explicit dividers and minimal decoration.
- **Decision density:** dialogs and permission blocks contain only the scope,
  consequence, and choices needed for that decision.

## Brand identity

### Brand signature

A3S uses a blue-to-indigo-to-purple spectrum:

```css
--a3s-blue: #2864e8;
--a3s-indigo: #4034cc;
--a3s-purple: #5420bd;
--a3s-gradient: linear-gradient(135deg, #2587f5 0%, #3b53dc 47%, #5221bd 100%);
```

The gradient is reserved for brand moments: the logo environment, first-run
hero accents, selected high-level navigation markers, and progress that
represents A3S orchestration. It is not a generic button fill or large page
background.

Primary actions use a high-contrast neutral action token. A3S blue communicates
brand identity, keyboard focus, selection, links, and active progress; it does
not fill ordinary buttons. Indigo and purple communicate brand depth and remote
A3S OS capability, not arbitrary status.

### Logo

Use the supplied A3S logo without recoloring, stretching, masking, or adding a
competing gradient. The logo has a visible accessible name only when it serves
as navigation; decorative instances use an empty alt attribute.

## Design tokens

This document is the normative token source. During implementation,
`src/styles/base.css` must be migrated to these values in one scoped change.
Components consume semantic aliases instead of literal colors.

### Surface and text tokens

| Role | Light | Dark | Current token |
| --- | --- | --- | --- |
| App canvas | `#f7f7f8` | `#101118` | `--a3s-bg` |
| Primary surface | `#ffffff` | `#171820` | `--a3s-panel` |
| Subtle surface | `#f2f3f5` | `#1e2028` | `--a3s-panel-soft` |
| Strong surface | `#e9ebef` | `#282b35` | `--a3s-panel-strong` |
| Primary text | `#17181a` | `#f2f3f5` | `--a3s-ink` |
| Secondary text | `#71757d` | `#a4a8b2` | `--a3s-muted` |
| Tertiary text | `#a1a5ad` | `#727783` | `--a3s-faint` |
| Divider | `#e2e4e8` | `#2a2d35` | `--a3s-line` |
| Strong divider | `#d3d6dc` | `#3a3d48` | `--a3s-line-strong` |
| Primary action | `#242424` | `#f2f3f5` | `--a3s-action` |
| Primary action text | `#ffffff` | `#17181a` | `--a3s-action-ink` |

Do not use tertiary text for important status or body copy in dark mode.

### Semantic tokens

| Meaning | Token | Usage |
| --- | --- | --- |
| Primary action | `--a3s-action` | Send, confirm, save, and commit |
| Brand accent / active | `--a3s-blue` | Focus, links, selection, and active progress |
| Success / ready | `--a3s-green` | Completed checks and healthy services |
| Destructive / failed | `--a3s-red` | Failure, delete, denied execution |
| Warning | `--a3s-warning` | Approval risk, partial state, approaching limits |
| Brand remote | `--a3s-indigo` | A3S OS destination and hosted capability |

`--a3s-warning` must be added to both light and dark themes before warning UI
uses it. Do not substitute red for ordinary caution.

### Interaction states

Interactive colors are derived with `color-mix` from semantic tokens and the
current surface:

```css
background: color-mix(in srgb, var(--a3s-blue) 7%, var(--a3s-panel));
border-color: color-mix(in srgb, var(--a3s-blue) 35%, var(--a3s-line));
```

State order must remain perceptible:

```text
default → hover → pressed → selected → disabled
```

Selected state cannot rely on color alone; use a marker, icon, font weight, or
`aria-current` treatment.

## Typography

### UI family

```css
ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
"Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif
```

Use the platform UI face before a Latin-first web font so mixed Chinese and
Latin text shares compatible weight, baseline, and rhythm. Do not load a
decorative Chinese web font for the product shell.

### Code family

```css
"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace
```

### Scale

| Role | Size / line height | Weight |
| --- | --- | --- |
| New-task headline | 30 / 40 | 650 |
| Page title | 22 / 30 | 650 |
| Section title | 16 / 24 | 600 |
| Card title | 14 / 21 | 600 |
| Body | 13 / 21 | 400 |
| Control | 13 / 20 | 550 |
| Metadata | 12 / 18 | 400 |
| Eyebrow | 10 / 14 | 700, tracked for Latin only |
| Code | 12 / 19 | 400 |

Avoid 8–9 px informational text. It is acceptable only for nonessential visual
labels that also have an accessible name.

Chinese headings use sentence case and no letter spacing. Avoid synthetic bold
above 650; dense strokes reduce legibility on Windows displays. Paragraphs use
full-width Chinese punctuation and do not insert spaces around ordinary Chinese
punctuation.

## Spacing, size, and shape

Use a 4 px base rhythm: `4, 8, 12, 16, 20, 24, 32, 40, 48`.

### Control heights

| Control | Height |
| --- | --- |
| Compact icon | 28–30 px |
| Standard control | 34–36 px |
| Form control | 40 px |
| Primary large action | 44 px |

### Radius

| Element | Radius |
| --- | --- |
| Small badge / code token | 5–6 px |
| Button / input / navigation row | 8–10 px |
| Card / popover | 12 px |
| Dialog / large sheet | 16 px |
| Pill | 999 px |

Do not place rounded cards inside rounded cards when a divider or spacing group
communicates hierarchy more clearly.

### Borders and elevation

The product is border-led and low-elevation. Use one-pixel semantic dividers for
persistent layout. Use shadows only for transient content above another layer:
popovers, dialogs, sheets, and drag previews. Persistent sidebars, inspectors,
cards, and top bars do not cast large shadows.

Use these elevation levels only:

| Level | Use | Treatment |
| --- | --- | --- |
| 0 | persistent layout | border or surface contrast only |
| 1 | Composer and selected object | `0 8px 28px rgb(20 24 40 / 6%)` in light mode |
| 2 | popover and menu | `0 14px 36px rgb(20 24 40 / 12%)` |
| 3 | dialog | backdrop plus `0 24px 64px rgb(20 24 40 / 18%)` |

Dark mode reduces shadow visibility and strengthens the border instead of using
a pale glow.

## Responsive layout

### Desktop: 1200 px and above

- Super-app Activity Bar: fixed 52 px.
- Page-local list/tree: 240–300 px, resizable when useful.
- Result Workspace: 44–58% of the product workspace, resizable and hideable.
- Result navigator: 180–260 px within the Result Workspace.
- Conversation retains at least 520 px before Results change to an overlay.
- Persist user-adjusted split widths locally within bounded min/max values.

### Compact desktop: 960–1199 px

- The Activity Bar remains fixed and the Task Library may collapse.
- Result Workspace overlays Conversation with a visible boundary and close
  action instead of compressing both surfaces.
- The Composer and its primary action remain visible below the overlay state.

### Unsupported widths: below 960 px

A3S Code Web has no mobile or tablet layout. Below 960 px, show an explicit
minimum-width notice instead of inventing a separate navigation model or hiding
task-critical actions.

## Product shell

### Activity Bar and product navigation

The leftmost 52 px Activity Bar is the super-app product switcher. Its upper
group contains Work (办公), Code (编码), and Science (科学) in
fixed order. Its lower group contains one Settings button pinned to the bottom;
account management is a Settings section, not a separate Activity Bar item.

The selected product is indicated by an A3S-blue edge marker, icon treatment,
and `aria-current`; color alone is insufficient. Product buttons remain
icon-only and expose names through tooltips and accessible labels.

A 220–280 px product-local sidebar sits immediately to the right. It owns the
selected product's navigation and object lists. Product switching and local
navigation must never be combined in the same list.

The Code Task Library follows the restrained density of the supplied WorkBuddy
sidebar without copying its assistant, project, or automation taxonomy:

- a small neutral `A3S Code v…` label identifies the local product;
- New task is a plain 34 px navigation row, with a neutral selected background
  only while the preparation surface is active;
- Search is a header action and expands a compact field only when requested;
- tasks live under one collapsible `任务 (n)` group;
- each task row is one line: title first, honest relative creation time second;
- the current task uses a neutral rounded background and stronger title weight;
- rename and delete remain hidden until row hover or keyboard focus, and the
  running task never exposes Delete;
- model identifiers and workspace paths stay out of the resting list because
  they compete with task recognition; the full workspace remains available by
  tooltip and inside the selected task.

### Global Settings dialog

Settings is a shell-level modal, not a product page. Opening it from the
Activity Bar, Command Palette, `Cmd/Ctrl+,`, or a settings deep link must keep
the current Code surface mounted underneath a restrained dim layer.
Closing restores the underlying surface, hash, and invoking control's focus.

```text
┌──────────────── current product remains mounted and dimmed ────────────────┐
│   ┌────────────────────── Settings dialog (max 1040 × 720) ─────────────┐  │
│   │ neutral navigation   │ section title · local badge              × │  │
│   │                      ├─────────────────────────────────────────────┤  │
│   │  Account             │                                             │  │
│   │  General             │  real A3S settings content                  │  │
│   │  Models & providers  │  in neutral rows with progressive           │  │
│   │  Agent & execution   │  disclosure for advanced configuration      │  │
│   │  Context & storage   │                                             │  │
│   │  Integrations        │                                             │  │
│   │  About and updates   │                                             │  │
│   │  Help                │                                             │  │
│   │                      │                                             │  │
│   │  A3S Code · CLI      │                            scroll if needed │  │
│   └──────────────────────┴─────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────┘
```

The dialog adapts WorkBuddy's settings proportions and hierarchy while keeping
only truthful A3S capabilities:

- use a 236 px quiet neutral navigation rail and one scrollable content pane;
- keep the dialog around 1040 × 720 px, bounded by the supported desktop
  viewport, with a 12 px radius and a subdued shadow;
- use black or neutral controls as the default; reserve A3S blue for selection,
  focus, and small status accents;
- use one top-right close action; `Escape` closes and returns focus to the
  invoker, while keyboard focus remains trapped inside when open;
- Account, General, Models & Providers, Agent & Execution, Context & Storage,
  Integrations, About & Updates, and Help remain dialog sections; Help never
  replaces the current Code surface;
- configuration categories load only when selected and expose local loading,
  retry, dirty, saving, and saved states without blocking unrelated tabs;
- settings are applied or saved in place with a category-scoped action, so no
  generic dialog footer is shown;
- show whether changes affect new tasks or require a service restart before the
  user edits a field;
- use a consistent label-and-description column with one right-aligned control
  column for common choices. Text, number, secret, and select controls share a
  38 px height, while number fields show their unit inside the control and
  explain invalid ranges beside it;
- keep category save state sticky and explicit: synced, unsaved, saving, saved,
  and failed are local states rather than global toasts. Unsaved categories
  offer one local Undo action before Save;
- use native select semantics with one consistent visual arrow, direct switches
  for binary choices, and nested disclosure only for queues, model metadata,
  headers, OCR, OAuth, and transport details. A section-level switch always has
  a visible enabled/disabled label; dependent controls remain visible but
  disabled so the relationship is understandable;
- use a compact segmented control only for two or three short mutually
  exclusive settings, and a formatted slider for bounded proportions such as
  confidence or relevance weights. User-facing timeouts use seconds unless the
  setting is explicitly a low-level scheduler value;
- Provider and model editors preserve their selected object, disclosure state,
  and input focus while editable names or model IDs change. React list identity
  must never derive from a field the user is currently editing;
- API keys, tokens, and sensitive headers show only an `already configured`
  state, allow explicit replacement or clearing, and never reveal the value. A
  reveal control appears only for a replacement value that exists in browser
  memory, never for a server-held configured marker;
- do not expose raw JSON or ACL text as the primary editor;
- while an update installation is active, close and shell shortcuts cannot
  dismiss or replace the dialog.

Clicking Settings does not deselect Code. The Activity Bar may indicate both
the underlying product and the open Settings overlay because they describe
different levels of state.

#### Models and Providers settings

Model configuration uses a master-detail workspace rather than a stack of open
Provider forms. The first screen answers three questions in order: which model
new tasks use, whether runtime defaults are overridden, and which Provider the
user wants to manage.

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Default model          [ model name · Provider                 ▾ ]  │
├───────────────────────────────┬──────────────────────────────────────┤
│ Reasoning budget              │ Request timeout                      │
├───────────────────┬───────────┴──────────────────────────────────────┤
│ Providers         │ selected Provider                               │
│                   │ [ Connection ] [ Models 2 ]                     │
│ ● OpenAI       ✓  │                                                  │
│   Anthropic       │ edit only the selected connection or model      │
│   Local gateway   │ advanced metadata remains disclosed on demand   │
└───────────────────┴──────────────────────────────────────────────────┘
```

- The default-model picker is searchable and grouped by Provider tabs. Its
  trigger shows both the model display name and source.
- The Provider rail shows model count and credential readiness without showing
  secrets or URLs as primary identifiers.
- Provider connection settings and its model directory are peer tabs. Selecting
  one model opens one editor; other model forms are not mounted as a long stack.
- Adding a Provider or model selects it immediately so the next required field
  is visible without another navigation step.
- Destructive actions modify the local draft and remain recoverable through the
  category-level Undo action until Save succeeds.

The task Composer's model switcher consumes the runtime model catalog rather
than the editable Provider draft. That catalog merges configured models with
locally signed-in Claude Code, Codex, and WorkBuddy account models discovered
by the same CLI authority used by the TUI.

- Account models use stable source-qualified IDs such as
  `claude-code/claude-sonnet-…`, `codex/gpt-…`, and `workbuddy/glm-…`; the source
  tab and trigger use human labels such as `Claude Code`, `Codex`, and
  `WorkBuddy`.
- Selecting an account model must change the session's actual LLM client. A
  display-only model row is never acceptable.
- Tokens and credential contents remain in the local service and are never
  returned to the browser.
- Expired or invalid logins do not produce selectable rows. Account-specific
  sign-in guidance belongs in Settings or a bounded empty state.
- WorkBuddy discovery and execution reuse the TUI's supported CodeBuddy CLI
  provider. The local service locates the installed CLI, verifies reusable
  WorkBuddy account state, refreshes the entitled model list, and translates
  its streamed host-tool protocol; the browser never reads WorkBuddy tokens.
- Account entitlement refresh must not hold the startup transition open. The
  first catalog response uses the TUI-compatible local fallback immediately;
  Web refreshes the entitled WorkBuddy list in the background and replaces the
  same source tab in place.

### Page header

A page header contains breadcrumb or page title, optional object status, and no
more than one primary action. Secondary actions use an overflow menu.

### Resizable splits

Adapt AionUI's pointer-capture approach:

- store bounded width preferences;
- disable text selection while dragging;
- use `col-resize` cursor and a visible active handle;
- throttle visual updates with animation frames;
- support double-click reset and keyboard adjustment;
- remove motion during drag.

## Task experience

### New-task preparation state

The new-task state is a preparation surface, not an empty execution surface. It
adapts the strongest pattern in the supplied WorkBuddy reference: one centered
place to express intent, surrounded only by help that improves that intent.

```text
┌────┬──────────────┬────────────────────────────────────────────────────┐
│A3S │ Tasks        │                                                    │
│    │ + New task   │              让 Code 完成一项工作                  │
│Code│ Recent       │        描述目标、范围和你期待的结果                │
│    │ tasks        │                                                    │
│    │              │   [修复问题] [实现功能] [理解代码] [审阅变更]     │
│    │              │  ┌──────────────────────────────────────────────┐ │
│    │              │  │ Task instruction                            │ │
│    │              │  │                                              │ │
│    │              │  ├──────────────────────────────────────────────┤ │
│    │              │  │ Workspace · Model · Effort · Permission  Send│ │
│    │              │  └──────────────────────────────────────────────┘ │
│Set │              │                                                    │
└────┴──────────────┴────────────────────────────────────────────────────┘
```

Rules:

- center the content optically, not mathematically; account for the Composer's
  visual weight and keep it slightly below the headline;
- content width is 720–820 px and never exceeds the active workspace width;
- the headline is one line when possible and no more than two lines;
- supporting copy is one sentence and names the information that improves the
  result: goal, scope, constraints, and acceptance criteria;
- show four starters by default and place additional starters behind “更多”;
- a starter inserts editable natural language into the Composer; it never sends
  immediately or changes configuration invisibly;
- hide Result Workspace actions until a task and a meaningful result exist;
- do not show context percentages, delivery status, or empty operational panels
  before the first instruction;
- no promotional card, mascot, reward, or unrelated notification competes with
  the Composer.

### Active-task state

After the first instruction is accepted, the layout transitions from preparation
to work. Task identity appears, the Composer docks to the bottom, and the
execution stream uses the available vertical space. Conversation initially
keeps the full product workspace.

Selecting an artifact or review action opens the Result Workspace beside the
same Conversation. This is a state change within the task journey, not
navigation to another product. Operational Activity remains inside the
execution stream instead of becoming a competing right-side page.

### Execution stream

Use a calm document flow, not alternating chat bubbles. User instructions may
use a subtle tinted surface; agent content remains on the page surface.

Semantic block order:

```text
Instruction
Plan
Reasoning disclosure
Execution lifecycle
Permission decision
Assistant result
Delivery summary
Artifact entries
```

One execution ID produces one block that updates in place. Do not render raw
start and end events separately.

Assistant Markdown uses Streamdown in streaming mode while a response is live
and static mode after completion. Fenced code is highlighted with Shiki in both
themes. Tool start, argument, output-delta, completion, denial, timeout, and
confirmation events are projected into one Web-native timeline row. Completed
successful calls collapse by default; running, failed, and HITL calls remain
open. The owning HITL decision card is the primary reading path for operation,
reason, scope, risk, and timeout; raw arguments remain available but start
collapsed so the same command is not repeated through the decision surface.
Full output remains available without permanent truncation, while file editing
calls hand off to the Monaco review surface instead of embedding a large
terminal-style diff. Missing ids on streamed argument deltas resolve to the
latest compatible open call rather than manufacturing another row. A settled
parent response turns any unclosed call or confirmation into a visible,
non-actionable interrupted state. Above six calls, attention states and the
four latest successes stay visible in chronological order while one quiet
control reveals earlier successful history.

Each visible turn uses one stable message grammar:

- the instruction surface keeps its original Skill and workspace-file
  resources in a compact typed strip; Continue editing restores the text and
  those resources to the Composer without sending;
- every assistant response starts with the same compact Code identity row,
  local timestamp, pending state, and hover/focus copy action;
- reasoning uses a Markdown disclosure, opens while reasoning is live, labels
  that state as `实时更新`, allows a reader collapse to survive later deltas,
  and returns to a collapsed `已完成` state without exposing the reasoning body
  in the primary reading path;
- the Code identity row is the single lifecycle authority. Reasoning and tool
  blocks may expose their own local state, but an additional generic body-level
  waiting message must not repeat `正在规划`, `正在执行`, or `正在思考`;
- a reader who leaves the bottom of the transcript keeps their scroll position
  and receives one floating “latest content” action instead of being pulled
  back by streamed output;
- streamed tool output follows only while its own viewport remains at the
  bottom, and copy, failure evidence, permission outcome, and recovery stay in
  that execution block; global recovery is reserved for turn-level failure,
  cancellation, and exhausted retry state;
- a turn-level error is suppressed beside a failed tool only when its normalized
  message explicitly repeats that tool's output or typed error evidence, or is
  the protocol's exact generic tool-failure summary. A distinct model,
  transport, or stream error remains visible, and cancellation or exhausted
  retry state is never owned by a tool card. When both surfaces are present,
  tool recovery keeps its tool-specific repair action while the turn surface
  uses `诊断并恢复`; identical labels never obscure which failure an action owns;
- turn-level recovery leads with one concise human-readable failure summary.
  Long transport errors, stack traces, request identifiers, and other raw
  diagnostics remain intact under an inline `查看技术详情` disclosure with a
  bounded scroll area;
- failure and cancellation are lifecycle evidence, not generated assistant
  prose. The recovery surface is the single owner of their summary and next
  action;
- message-stream disclosures use explicit buttons, `aria-expanded`, and owned
  content regions. HITL submission failure remains inline and retryable, while
  a terminal tool or parent event clears stale client decisions even when it
  races the HTTP acknowledgement;
- artifact entries lead with a colored file-type icon and filename, retain the
  parent path as secondary context, and open the task-scoped review workspace.

### Composer

Adapt AionUI's SendBox composition while simplifying it for A3S Code:

- attachment strip above the instruction editor;
- TipTap editor with plain-text task transport and capped transcript footprint;
- left side: the execution-mode control uses the selected mode's semantic icon
  and keeps its Chinese name visible on the closed trigger; the icon changes
  with 按需确认, 只读规划, and 自动执行 instead of using a generic `+`;
- execution mode, model, Effort, and context usage remain attached to the
  instruction; the mode surface contains only the three execution policies;
- model and Effort are separate controls: the model surface has source/provider
  tabs and search, while the Effort surface uses one discrete draggable slider;
  only the values Low through Ultra stay English, while guidance and level
  descriptions use concise Chinese;
- typing `@` opens a workspace tree. The root loads on demand, directories load
  only when expanded, VS Code-like colored file/folder icons make types
  scannable, and a chosen file becomes a removable context chip;
- typing `/` opens enabled Skills plus the pinned `/goal` control command. The
  text after `/` filters and ranks results immediately, with matching fragments
  highlighted in Skill names and descriptions. A Skill becomes a removable
  chip; choosing `/goal` inserts `/goal ` into the editor and the command is
  intercepted instead of sent as a task instruction;
- dragging files or folders onto the Composer copies them into the served
  workspace, preserves directory hierarchy, resolves top-level collisions with
  ` (n)` names, refreshes the workspace tree, and adds imported roots as
  removable context chips. The overlay communicates copy semantics before the
  drop and progress during import;
- `/goal <target>` updates the task-scoped goal, `/goal clear` clears it, and a
  bare `/goal` remains in the editor with guidance. Recognized command text is
  accented in the editor without changing the transported plain text. No goal
  configuration popover exists;
- Web does not reproduce TUI management commands such as `/clear`, `/exit`, or
  `/config`;
- right side: one stateful primary action renders Send while idle and morphs in
  place to Stop while the active task is running;
- while the primary action is Stop, Enter still submits follow-up instructions
  into the visible queue;
- no generic slash-command menu or terminal-command hint in placeholder text;
- model is searchable within provider/source tabs; Effort is independently
  draggable; both use compact, explicitly labelled upward surfaces.

Composer visual contract:

- new-task width: 760 px; active-task width: up to 800 px and constrained by
  the visible Conversation pane;
- border: one neutral one-pixel line, strengthened on focus-within;
- radius: 14–16 px for the outer surface, 8–10 px for internal controls;
- shadow: elevation 1 in light mode, border-led in dark mode;
- complete Composer height: about 168 px in preparation and 118 px during
  execution; the editable region is 84 px and 72 px respectively;
- footer controls remain one quiet horizontal group; labels do not disappear
  into ambiguous icons at supported desktop widths;
- the current model trigger has no persistent fill or selected treatment. Its
  name remains visible, while hover, keyboard focus, loading, and an open
  picker provide the only interaction emphasis;
- a successful model change produces one temporary inline notice immediately
  above the Composer (`previous model` → `current model`) with quiet divider
  lines. It does not compete with the task as a global success toast; failures
  continue to use the error notification path;
- model, Effort, execution-mode, HITL, cancellation, and queue success states
  are reflected by their local controls and never create redundant global
  success toasts; failures continue to use the error notification path;
- Send/Stop is the only filled action in the Composer and stays at the lower
  right without changing position between states;
- context usage appears as a quiet footer status with token and message details
  in an upward surface. A directly adjacent compact action runs manual
  compaction, shows progress in place, and refreshes both transcript and usage;
- `/goal` elapsed time appears as a separate passive footer status and never
  makes the task-runtime panel appear by itself;
- task tracking has the same lifecycle authority as the TUI, but uses a
  ChatGPT Codex-style floating panel at the upper-right of Conversation rather
  than another Composer footer control. It is absent until a non-empty
  `PlanningEnd` / `TaskUpdated` payload publishes real tasks or a real subagent
  lifecycle begins. Layout follows the actual Conversation pane rather than the
  browser viewport. At 1040 px or wider, the transcript reserves a readable
  message-safe rail and the panel floats in that rail without covering user or
  assistant content. It expands for the first real evidence in a turn, when a
  plan first becomes available, or when work escalates to failed or
  interrupted. Additional healthy parallel branches update quietly and respect
  a manual collapse without moving the transcript or Composer. Below 1040 px,
  including when Result Workspace narrows Conversation, the panel becomes a
  top-right docked summary between the task header and transcript. Its detail is
  collapsed by default even for new or failed work and opens only on explicit
  user action; expanding it contracts the transcript viewport without moving
  the Composer or obscuring message content. The wide floating surface treats
  the latest user instruction as a collision anchor: at mount, resize, and
  transcript scroll it moves below that instruction when their visible regions
  would overlap. When vertical room becomes limited, only the panel's detail
  viewport contracts and scrolls;
- a real `SubagentStart` can independently open the same upper-right surface in
  an agent-only form when no plan exists. When both exist, the expanded runtime
  panel leads with the real checklist and progress, then shows associated
  parallel subagents with state and duration. Step and subagent events update
  existing runtime evidence without manufacturing waiting or plan rows. Failed
  and interrupted work is never counted as completed; status precedence is
  failed, interrupted, running, then completed, so a terminal problem cannot be
  hidden by pending work or an open stream transport;
- each subagent row preserves the child session relationship, progress
  milestones, completion-token evidence, and final output. Results and failure
  detail expand inline instead of opening another panel. The default list keeps
  at most four attention-worthy branches visible, prioritizing running, failed,
  interrupted, and most-recently completed work before offering one quiet
  disclosure for the remainder. A parent terminal event settles any branch
  without a matching `SubagentEnd` as interrupted; A3S blue remains exclusive
  to active progress. Adding a healthy sibling never resets an expanded result
  disclosure. Plan rows preserve readable Chinese task context in the narrow
  surface, while child results and failures render as compact Markdown with
  copyable highlighted code when structured evidence is returned. A terminal
  parent event settles every still-pending or active plan row as interrupted,
  including after a persisted task is restored. Restored interrupted branches
  freeze duration at persisted completion evidence rather than appearing to
  run forever. When volatile client timing is unavailable, total turn duration
  falls back to the owning user and assistant message timestamps. Progress
  color follows terminal semantics: blue is running only, green is completed,
  red is failed, amber is interrupted, and waiting remains neutral;
- every selector attached to the Composer footer opens upward, including the
  execution-mode surface, Effort slider, model selector, and context details;
  none may move the Composer or Send action or extend below the viewport;
- Escape closes the active surface and restores focus to the control that
  opened it; clicking outside dismisses it without changing the draft;
- the editing surface remains visually empty while focused; Markdown input may
  work through typing and keyboard conventions, but no floating formatting
  toolbar competes with task actions.

TUI capability mapping:

| TUI capability | Web surface | Composer rule |
| --- | --- | --- |
| `/model` | Quiet model trigger beside Send | Searchable source/provider tabs; the current model remains visible without a persistent selected background, and successful changes receive one inline notice |
| `/effort` | Independent Effort control | Discrete draggable slider with English values from Low through Ultra and Chinese explanations |
| Shift+Tab run mode | Upward execution-mode surface | Uses a distinct semantic icon and direct Chinese policy name for 按需确认、只读规划、自动执行 |
| `@<path>` | Lazy workspace tree | Expand colored file/folder rows, add a file as a context chip, and preserve the surrounding draft |
| Loaded `/<skill>` entries | Skill suggestion panel | `/` filters enabled Skills, highlights query matches, and keeps the sole pinned `/goal` command; Skill selection adds a chip and explicit transport directive |
| `/goal` | Pinned inline control command | `/goal <target>` saves the task-scoped value; `/goal clear` clears it; neither becomes a normal message |
| `/compact` | Context footer status and compact action | Usage details and manual compaction stay together; compaction is not a slash item and does not emit a success toast |
| `/ide`, `/output`, `/top`, `/memory`, `/kb` | Result Workspace, Activity, or future dedicated product surfaces | Never appear in the Composer suggestion list |
| `/clear`, `/fork`, `/init`, `/config`, `/update` | Task or Settings actions with confirmation where needed | Never execute from typed Composer text |
| `!` shell and `?` research modes | Future explicit mode controls | Prefix typing never silently changes Web execution mode |

### Follow-up queue

Adapt the AionUI queue interaction:

- compact rows show instruction preview and attachment count;
- reorder uses a drag handle and keyboard alternatives;
- actions include Send now, Edit, and Remove;
- queue mode is explained in plain language;
- hover-revealed controls remain keyboard-visible.

### Plan and permission

Plan steps update in place and show state through icon, label, and text. A
collapsed upper-right runtime panel shows completed/total count, the current
step, and elapsed time. A new real plan expands the panel; a task with neither a
real plan nor real subagent lifecycle renders no placeholder panel. Parallel
subagents belong below the plan when both exist; agent-only execution reuses
the same panel instead of creating a second dashboard or Composer popover.

A permission request names operation, reason, affected scope, risk, and timeout.
Primary choices are Deny and Allow once. Broader approval is offered only when
the backend supports an explicit bounded policy. The decision summary owns the
primary information hierarchy; serialized tool arguments are a collapsed
secondary disclosure even while confirmation is pending.

### Delivery summary

Every material completion groups outcome, changed files, checks and evidence,
unresolved items, and next actions.

The summary includes one thin semantic progress track for passed required
checks. Its accessible value is `passed / required`; pending, failed, and
residual-risk counts remain explicit adjacent evidence and are never folded
into a misleading success percentage.

## Result Workspace experience

The right-side surface adapts the strongest product pattern in the active
WorkBuddy reference: task results expand into a focused artifact workspace
without replacing the Conversation that produced them.

```text
┌───────────────────────┬──────────────────────────────────────────────┐
│ Conversation          │ Result header: artifact tabs · full · close │
│                       ├──────────────┬───────────────────────────────┤
│ response and artifact │ mode trigger │                               │
│ entries               │ navigator    │ artifact viewport             │
│                       │              │                               │
├───────────────────────┤              │                               │
│ Composer              │              │                               │
└───────────────────────┴──────────────┴───────────────────────────────┘
```

### Opening behavior

- keep Results closed until the user selects an artifact, “查看全部产物”,
  “查看变更”, a preview entry, or the task header's reopen action;
- open directly to the relevant mode and artifact;
- focus an existing tab instead of duplicating the same artifact;
- preserve Conversation scroll, Composer draft, and queue;
- close returns Conversation to full width and restores focus to the opening
  control;
- full screen expands the same workspace instance and is reversible;
- reopening restores task-scoped mode, tabs, selection, split, and safe scroll
  state.

Never auto-open an empty Result Workspace merely because a task exists. New
results may announce availability in Conversation, but the user controls when
the right surface expands.

### Workspace header

- height: 44–48 px with one bottom border;
- artifact tabs occupy the flexible center region;
- selected tab uses a quiet neutral surface, not a heavy filled pill;
- tab type, title, dirty state, and close action remain readable;
- full-screen and close are the only persistent workspace-level icon actions;
- file or mode-specific commands stay in the navigator or viewport header.

### Mode switcher

Overview, Files, Browser, and Changes use one compact labelled popover trigger
at the top of the navigator. Do not render four permanent mode buttons.

- label shows the current Chinese mode name: “概览”, “工作空间文件”, “浏览器”,
  or “变更”;
- popover width follows content and uses 36–40 px rows;
- selected mode uses one check mark and a low-contrast surface;
- Browser is absent when no valid preview target exists;
- selecting a tab activates its owning mode;
- switching modes focuses that mode's most recent tab or useful empty state and
  retains other tabs and task context;
- Escape and outside click close the popover and restore trigger focus.

### Navigator and viewport

- navigator width: 180–260 px, resizable or collapsible;
- navigator rows: 28–32 px with one selected treatment;
- file and change metrics align to the trailing edge and use semantic color only
  for real state;
- the viewport receives all remaining width and owns the dominant visual weight;
- empty state names what can be opened next; it does not advertise unrelated
  capabilities;
- loading and errors stay within the failed navigator or viewport region instead
  of replacing the complete workspace.

### Mode character

| Mode | Navigator | Viewport emphasis |
| --- | --- | --- |
| Overview | grouped task results | delivery, evidence, and artifact summary |
| Files | VS Code-density workspace tree and search | Monaco code editing with persistent file and diff tabs |
| Browser | valid preview targets | managed local preview and lifecycle state |
| Changes | changed files, status, and line counts | diff review, staging, and commit |

The A3S palette remains authoritative. Use brand blue for focus and selection,
semantic green/red for additions and deletions, and a restrained tinted diff
background. Do not copy WorkBuddy's mint color as a new brand primitive.

## Code experience

- File tree rows are 25–28 px high and use indentation, disclosure icons,
  extension-specific color, an active-row marker, and trailing Git decoration.
- File and folder rows never reveal a trailing cluster of create, rename, copy,
  or delete buttons on hover. Pointer right-click and keyboard `Shift+F10` open
  one VS Code-style context menu at the invocation point; right-clicking tree
  whitespace opens root-level create and refresh actions.
- Context menus stay inside the viewport, use separators for operation groups,
  support Arrow keys, Home, End, Enter, and Escape, close on outside click, and
  restore the invoking tree row's focus after keyboard dismissal. Choosing
  create, rename, copy, or delete transitions the affected tree location into
  the existing in-place editor, confirmation, busy, and recovery state.
- File and diff documents share one horizontally scrollable editor tab strip.
  Opening another document preserves every draft; only closing a dirty file
  requires Save, Don't Save, or Cancel.
- Monaco is loaded locally and on demand. It owns syntax highlighting, folding,
  search, cursor navigation, model view state, and `Cmd/Ctrl+S`; browser text
  areas are not code editors.
- Diff uses Monaco's original/modified document model, automatically switches
  to inline presentation when width is constrained, and uses semantic added
  and removed colors with accessible labels.
- Opening workspace Changes replaces the file navigator with a source-control
  navigator instead of overlaying or compressing the editor. Closing Changes
  restores the file tree and every open editor tab.
- The editor frame uses neutral tabs, breadcrumbs, tool actions, and a quiet
  status bar. A3S blue is reserved for the active tab, focus, and selection.
- Changes always identifies Git state as workspace-wide and groups unstaged and
  staged files without implying selected-task provenance.
- Validation belongs to the active file result and may also contribute evidence
  to the task delivery.
- Destructive file operations start from the scoped context menu and use a
  compact in-tree confirmation that keeps the affected path and recovery visible.

## Execution details

Operational detail expands inside the execution that produced it. Compact rows
show status, operation, duration, and time; expanded content may show input,
output, exit state, and recovery. Do not create a global process dashboard or a
separate Activity mode in the Result Workspace.

## Components

### Navigation rows

- height: 36–40 px for destinations and 44–52 px for task objects;
- icon: 16–18 px, monochrome by default;
- selected: neutral tinted background plus an A3S-blue marker or icon;
- hover may reveal secondary actions, but keyboard focus reveals the same
  actions and never shifts the row label;
- one navigation level uses one selection treatment; do not stack a pill,
  colored icon tile, bold label, and edge marker on the same row.

### Scenario starters

Scenario starters are instructional shortcuts, not product modules.

- use compact outlined chips with an optional 14 px icon;
- labels are outcome verbs, normally four to six Chinese characters;
- default Code starters are “修复问题”, “实现功能”, “理解代码”, and
  “审阅变更”;
- selecting a starter inserts a concise editable prompt scaffold;
- starters disappear after the task begins and never become transcript content;
- do not use colored category chips unless color communicates real state.

### Buttons and inputs

- Primary: solid high-contrast neutral (`--a3s-action`); one primary action per
  local decision area.
- Secondary: surface with semantic border.
- Quiet: transparent, visible on hover and focus.
- Danger: red text/border; solid red only for final destructive confirmation.
- Loading retains width and prevents duplicate submission.
- Form inputs have persistent labels; placeholder text is supplementary.
- Errors are associated with the field through `aria-describedby`.
- A3S blue is reserved for focus, selection, links, brand markers, and active
  progress rather than ordinary button fills.

### Cards and popovers

Cards group one object or decision with 16 px internal padding; dense operational
rows may use 12 px. Popovers contain selection, search, or explanation and use
bounded internal scrolling. Escape closes a popover and restores focus.

### Segmented controls

Use tabs for open artifacts with stable identity. Use a compact popover for
Result Workspace modes. Conversation is not a peer tab and remains visible
beside the workspace. Do not use segmented controls for commands, multi-select
filters, or long mode labels.

### Dialogs

Adapt AionUI's standard three-part structure:

- header: 20 px top, 24 px horizontal, 16 px bottom;
- body: 20 px vertical, 24 px horizontal, independently scrollable;
- footer: top divider, 16 px vertical, 24 px horizontal;
- width presets: 400, 600, 800, and viewport-bounded large;
- 16 px radius;
- focus trap, initial focus, topmost Escape, and focus return are mandatory.

Dialogs are not used for Conversation, Result Workspace, or other multi-view
workbenches.

### Empty, loading, error, and offline states

- Empty: explain the object and offer one relevant next action.
- Loading: preserve final layout dimensions with skeletons; use spinners only
  for bounded inline actions.
- Error: state what failed, what remains safe, and how to retry.
- Offline: distinguish browser disconnection from agent execution failure.
- Initial bootstrap is the one exception to in-place skeletons: use a bounded
  390 px transition card centered on the desktop canvas. Keep the A3S logo at
  28 px, use a three-pixel neutral progress track, and never expose raw route
  text unless the user expands technical details.

## Chinese content design

### Naming

- prefer a verb plus object: “添加文件”, “审阅变更”, “保存目标”;
- use the user's object vocabulary: task, workspace, file, change, check;
- avoid implementation words such as session, endpoint, payload, transport,
  kernel, and event in user-facing copy;
- keep a button label to roughly eight Chinese characters; move consequence or
  scope into nearby supporting text when needed;
- do not mix synonyms for the same object. In Code, use “任务”, not alternating
  “会话”, “对话”, and “线程” for the task object.

### Tone

- calm, direct, and respectful; avoid cute interjections and excessive
  exclamation marks;
- describe uncertainty honestly: “尚未验证” rather than “应该没问题”;
- describe recovery before blame: “连接已中断，草稿仍保留”;
- success copy reports the outcome: “已保存目标”, not “太棒了！”;
- destructive copy names the object and permanence before the action.

### Punctuation and numbers

- Chinese sentences use full-width punctuation; technical identifiers and code
  remain unchanged;
- use Arabic numerals for counts and durations, with spacing appropriate to the
  unit: `3 个文件`, `1.2 s`, `8,240 tokens`;
- timestamps use the user's locale and avoid redundant year or seconds in dense
  task lists;
- keyboard shortcuts remain platform-aware: `⌘K` on macOS and `Ctrl+K` on
  Windows/Linux.

### Empty and onboarding copy

An empty state contains three layers only:

1. what this area is for;
2. what information helps produce a good result;
3. one next action.

Do not explain every capability on first view. Scenario starters may demonstrate
good task language, but they do not replace a concise headline and supporting
sentence.

## Motion

- Micro-interactions: 120–180 ms.
- Panels and sheets: 180–240 ms.
- Do not animate layout during active resizing.
- Running state may use a subtle spinner or progress sweep; avoid perpetual glow
  on large surfaces.
- `prefers-reduced-motion: reduce` disables nonessential transitions,
  breathing, shimmer, and smooth scrolling.

## Accessibility

- WCAG AA contrast is the minimum for text and essential controls.
- Visible focus uses a two-pixel A3S blue ring with two-pixel offset.
- Icon-only controls have accessible names and tooltips where needed.
- Hover-only actions also appear on focus-within.
- Status always uses text or icon in addition to color.
- Keyboard operation covers navigation, menus, dialogs, resizers, queues, file
  trees, and execution decisions.
- Escape affects only the topmost transient layer.

## Content style

- Use direct Chinese product language: “审阅变更”, “仅允许本次”, “添加上下文”,
  “运行验证”.
- Do not expose slash commands as labels.
- Distinguish local and A3S OS actions before confirmation.
- Avoid unexplained infrastructure language and raw enum values.
- Empty and error states state the next useful action.

## Implementation checklist

Before a component is design-complete:

- it belongs to the page defined by the product blueprint;
- it uses semantic A3S tokens with light and dark coverage;
- wide, compact, and minimum desktop layouts are specified;
- default, hover, pressed, focus, selected, disabled, loading, empty, error,
  success, and offline states are addressed where applicable;
- focus order, Escape behavior, focus return, and accessible names are tested;
- it introduces no AionUI/AOU brand color or new literal primary color;
- it does not copy WorkBuddy brand assets, mascot, engagement UI, or promotional
  patterns;
- Chinese labels follow the naming, tone, punctuation, and typography rules in
  this document;
- it does not make a slash command the primary interaction.

# A3S Code Component Specification

## Purpose

This specification defines the component boundaries for the implemented A3S Code
journey. It is an ownership and continuity contract, not a catalog of backend
capabilities.

Component rules:

- one component owns one user-visible concern;
- feature components receive typed actions and never call APIs directly;
- every component names the state before it and the useful next action after it;
- domain components do not move into the design system;
- one Result Workspace shell is shared by all artifact modes;
- a capability appears in the UI only when its useful state, recovery, and next
  action are implemented;
- implementation migrates existing ownership instead of mounting old and new
  workspace systems together.

## Composition

```text
App
├── CodeBootScreen
└── AppShell
    ├── ActivityBar
    ├── ProductWorkspace
    │   ├── WorkProduct                      separate local-workspace contract
    │   └── CodeProduct
    │       ├── TasksSurface
    │       │   ├── TaskLibrary
    │       │   └── TasksPage
    │       │       ├── NewTaskPreparation
    │       │       │   ├── NewTaskWelcome
    │       │       │   ├── TaskStarters
    │       │       │   └── TaskComposer
    │       │       │       └── NewTaskWorkspaceControl
    │       │       └── ActiveTask
    │       │           ├── TaskHeader
    │       │           └── ActiveTaskLayout
    │       │               ├── Conversation
    │       │               │   ├── TaskRuntimeFloatingPanel
    │       │               │   ├── ExecutionStream
    │       │               │   ├── ArtifactEntries
    │       │               │   └── TaskComposer
    │       │               └── ResultWorkspace
    │       │                   ├── ResultWorkspaceHeader
    │       │                   │   └── ArtifactTabs
    │       │                   ├── WorkspaceModeSwitcher
    │       │                   └── ResultWorkspaceBody
    │       │                       ├── ModeNavigator
    │       │                       └── ArtifactViewport
    │       └── MemoryPage
    │           ├── MemoryFiltersPanel
    │           ├── MemoryGraph / MemoryTimeline
    │           ├── MemoryInspector
    │           └── EvolutionWorkbench
    └── GlobalOverlays
        ├── SettingsDialog
        │   ├── AccountSettings
        │   ├── AppearanceSettings
        │   ├── ModelSettings
        │   ├── AgentSettingsView
        │   ├── ContextSettingsView
        │   ├── IntegrationsSettingsView
        │   ├── AboutSettings
        │   └── HelpSettings
        └── CommandPalette
```

## Shell components

### `CodeBootScreen`

**Role:** bridge the blank document and the authoritative Code workspace with
one bounded loading or recovery card.

**Contract:** loading preserves the final desktop canvas and uses a restrained
progress line rather than a full-screen logo. Failure copy distinguishes an
unready local service from a page/service version mismatch, keeps raw request
details collapsed, and offers one primary reconnect action. A missing model
catalog route is recoverable through the Provider-derived fallback and must not
enter this failure state by itself.

### `AppShell`

**Role:** compose product navigation, the Code-local task list, the active
product workspace, service recovery, and global overlays.

**Inputs:** `CodeActions` and the authoritative bootstrap snapshot.

**Owns:** shell layout and the disconnected-service banner.

**Continuity:** reconnect reloads all authoritative bootstrap data before the
banner disappears. Unsaved client state remains available while disconnected.

### `ActivityBar`

**Role:** open built-in Code and Work, verified plugin workbench views, Memory,
Marketplace, and Settings.

**Current behavior:** Code is always first and is the default; built-in Work is
second. Enabled A3S Use `activity_bar` contributions follow in manifest order,
with unsupported icon names using a neutral plugin glyph. Memory, Marketplace,
and Settings share the pinned bottom system section. Research and Finance are
not hardcoded, and unknown or removed plugin hashes normalize to Code after the
catalog loads. Each icon exposes one concise tooltip.

**Does not own:** tasks, artifacts, result modes, or feature commands.

### `TaskLibrary`

**Role:** create, search, select, rename, and delete task objects.

**Visual contract:** use a quiet product/version label, one plain New task row,
an on-demand compact search field, and one collapsible `任务 (n)` group. Task
rows are 36 px, single-line, and show a concise relative creation time instead
of model metadata. The selected task uses neutral background plus stronger type;
row actions appear only on hover or keyboard focus. This adapts WorkBuddy's
sidebar restraint without importing WorkBuddy-specific destinations.

**Mutation contract:** rename replaces the row with a focused input; Enter or
the row action saves and Escape cancels. Delete replaces the same row with a
compact confirmation and keeps recoverable errors there. No centered dialog or
success toast interrupts either operation.

**Continuity:** selecting another task saves the current draft and safe Result
Workspace state. A running task retains its own status. An unresolved dirty
artifact blocks selection before the active task changes.

**Next action:** a selected task opens its Conversation; a new task focuses the
preparation Composer.

### `CommandPalette`

**Role:** provide keyboard access to already available navigation and task
actions.

**Contract:** commands are filtered by current validity. It does not expose
hidden slash commands or future modes. Tasks, Memory, and Settings navigation
use the same owned routes as the Activity Bar. Arrow keys, Enter, and Escape
manage selection and restore focus.

## Task-surface components

### `TasksPage`

**Role:** bind the selected task to one continuous Conversation and at most one
Result Workspace instance.

**Variants:** new-task preparation or active task. It never renders both.

### `NewTaskPreparation`

**Role:** provide a calm, guided task draft before an authoritative task exists.

**Composition:** `NewTaskWelcome`, `TaskStarters`, and the preparation variant
of `TaskComposer`.

**Contract:** no empty transcript, result shell, operational panel, context
meter, or delivery status is rendered. Draft and parameters persist without
creating a backend task until first send.

### `NewTaskWelcome`

**Role:** explain in one headline and one sentence what information helps A3S
Code produce a useful result.

**Contract:** useful copy only. No mascot, promotion, carousel, or notice.

### `TaskStarters`

**Role:** help express common Code outcomes without commands.

**Default starters:** fix a problem, implement a feature, understand code, and
review changes.

**Contract:** a starter inserts an editable natural-language scaffold. It never
sends, creates a task, changes permission, or becomes a transcript turn by
itself.

### `TaskHeader`

**Role:** show task identity, workspace, execution state, and the action that
reopens the task's last Result Workspace state.

**Contract:** the active header is 44 px high, keeps title and workspace on one
line, and subscribes to the same persisted title source as the Task Library so
an inline rename updates both surfaces immediately.

**Actions:** reopen Results and task activity.

**Guards:** rendered only for an existing task. It does not expose a separate
Activity right panel; operational detail stays in the execution stream.

### `ExecutionStream`

**Role:** render the task as a calm semantic document instead of raw events or
alternating chat bubbles.

**Ordered blocks:** instruction, plan, reasoning disclosure, execution,
permission decision, assistant response, evidence-backed delivery, and artifact
entries.

**Contracts:**

- assistant Markdown uses Streamdown streaming mode while pending and static
  mode after completion, with refined heading, paragraph, nested-list,
  task-list, quote, table, link, image, and inline-code treatments. Shiki code
  blocks use light/dark themes, line numbers, bounded scrolling, and Chinese
  control text;
- `InstructionMessage` removes transport wrappers while retaining selected
  Skills and workspace files as typed resource chips; its Continue editing
  action restores both content and resources to the current draft;
- `AssistantResponse` always exposes one compact Code identity row and keeps
  timestamp, pending state, and copy feedback local to the response;
- `ReasoningDisclosure` renders through the same Markdown pipeline, opens for
  live reasoning with a `实时更新` status, lets the reader collapse it without
  reopening on each delta, and returns to a collapsed `已完成` state after
  completion. Its disclosure is a real button with `aria-expanded` and a
  controlled content region;
- the Code identity row owns the response lifecycle label; no generic
  body-level waiting message duplicates planning, reasoning, or execution
  state;
- one tool execution updates one block in place;
- persisted blocks and matching live events do not duplicate;
- live output appears only for the owning task;
- permission denial or timeout offers a safer continuation rather than claiming
  to correct the user's choice;
- errors and cancellation remain semantic lifecycle events. They never generate
  synthetic assistant prose that repeats the owning recovery surface;
- ordinary replies do not produce delivery or artifact UI;
- operational detail expands in place through `ExecutionDetails`;
- long turn-level failures lead with a concise summary and preserve the full
  diagnostic payload under an inline `查看技术详情` disclosure;
- automatic transcript scrolling stops when the reader leaves the bottom, and
  one floating latest-content action returns them without moving the Composer.

### `ToolCallProjection` and `ToolCallTimeline`

**Role:** merge tool start, partial arguments, execution start, streamed output,
completion, denial, timeout, confirmation, and persisted content blocks into one
stable Web interaction per tool identity.

**Contract:** successful calls default to collapsed; running, failed, and HITL
calls remain open. Shell calls expose a copyable command preview with semantic
program, flag, string, path, variable, keyword, operator, redirection, number,
and comment tokens plus the working directory when available. Generic calls
use the same grammar with a compact typed-argument signature. Running calls
show execution state and live output line count; collapsed completed calls keep
the most recent output excerpt and disclose omitted lines. Full output stays
available in a scrollable disclosure and is never permanently sliced.
File-editing calls hand off to the Monaco review surface, with raw tool output
remaining available as a secondary disclosure. Running output follows its own
bottom only until the reader scrolls away.
Output copy, permission outcomes, and safe recovery belong to the same tool
block. A global recovery card is omitted only when its normalized error message
explicitly repeats failed-tool output or typed error evidence, or is the exact
generic tool-failure summary; an independent model, transport, or stream error
remains visible. Argument deltas without an explicit tool id attach to the most
recent compatible open call instead of creating a duplicate row. Once the
parent response settles, any call without a terminal event becomes interrupted
and any stale confirmation becomes non-actionable. When more than six calls
exist, all attention states and the four most recent successes remain visible;
one inline disclosure reveals the earlier successful history without changing
chronological order. Every tool, argument, and raw-output disclosure uses a
native button with `aria-expanded`; no complex `summary` element is used as an
implicit control. A denied or timed-out decision remains the semantic terminal
state when the runtime subsequently emits a synthetic `tool_end` with a
non-zero exit code; output, metadata, duration, and exit status are still
absorbed without relabeling the operation as an execution failure.

### `ExecutionDetails`

**Role:** disclose inputs, outputs, timing, exit state, and recovery information
for one execution.

**Contract:** detail belongs to its execution block. It is not a global process
page or an independent right-side workspace mode.

### `ExecutionPlan`

**Role:** show an agent-provided plan and current step.

**Contract:** absent when no real plan exists. Steps update in place and do not
invent progress.

### `TaskRuntimeFloatingPanel`

**Role:** keep the current plan, completion, elapsed time, and associated
parallel subagents visible without turning the Composer into a status toolbar.

**Contract:** positioned at the upper-right of the task surface. It appears
immediately with a bounded startup state while the first session is being
created, then follows analysis and planning before projecting a non-empty task
list from `PlanningEnd` / `TaskUpdated` or a real subagent lifecycle. Startup
never invents a plan row or subagent. Active-Conversation layout uses the
measured Conversation pane, not the global viewport. A pane at least 1600 px
wide has enough natural right-side whitespace for the floating surface beside
the centered content; the panel never reserves a side rail or changes the
transcript and Composer centering. The first evidence in a turn, the first
available plan, and a new failed or interrupted branch expand it automatically.
Additional healthy branches respect a manual collapse and update in place. The
pre-session preparation surface uses the same measured-width behavior and docks
a collapsed tracker when a floating panel would cover the task prompt. A
narrower pane, including Conversation beside Result Workspace, uses a docked
summary between `TaskHeader` and the transcript. Compact detail never
auto-expands and opens only from its trigger, so task attention cannot hide the
answer the user is reading. Expanding compact detail reduces the transcript
viewport while leaving `TaskComposer` fixed. The
collapsed trigger shows the current step and completed/total for a plan.
Agent-only execution shows the most important active, failed, interrupted, or
completed metric without counting a failed branch as completed. The expanded
surface leads with the checklist when one exists and then renders associated
subagents with explicit state, duration, completion-token usage, progress
milestones, and an inline result or failure disclosure. Structured child output
uses the compact Markdown and highlighted code renderer rather than an
unformatted text dump. `StepStart`, `StepEnd`, and subagent lifecycle events
update existing rows in event order. Goal or execution state alone cannot make
the panel appear, and subagent events never manufacture a plan row.

**Attention and density:** failed state outranks interrupted, running, and
completed state in the summary. Progress color is semantic rather than
decorative: blue is running only, green is completed, red is failed, amber is
interrupted, and waiting is neutral. The default subagent list exposes at most
four branches, prioritizing running, failed, interrupted, and recently
completed work; one disclosure reveals the remainder. This is density control,
not data loss: all result and progress evidence remains addressable in the same
panel. Long plan rows retain enough Chinese context to remain meaningful, and
active or failed rows are never reduced to an unexplained ellipsis.

**Continuity:** the panel overlays document space without resizing the
Conversation or moving `TaskComposer`. It stays task-scoped, clears the previous
turn when a new user instruction starts, reopens even when a later turn reuses
the same step ids, preserves open result disclosures while healthy siblings
arrive, and remains available after a planned turn completes. The latest
instruction is its collision anchor: if the default upper-right placement would
cover that instruction, the panel moves below it on mount, resize, and transcript
scroll. If the remaining vertical space is constrained, the panel detail region
becomes shorter and scrolls while the transcript and Composer stay fixed. An
`agent_end`, `error`, or cancellation event is authoritative before the stream
transport closes. Any unfinished plan row and any child without a matching
terminal event then becomes interrupted rather than remaining permanently live,
including when a persisted completed turn is restored after reload. If volatile
execution timing is no longer available, an interrupted child freezes at the
persisted assistant completion timestamp instead of continuing to accumulate
time. Total turn duration falls back to the timestamps of the owning user and
assistant messages, so refreshing a completed task does not remove its elapsed
time.

### `PermissionDecision`

**Role:** request an allow or deny decision for one blocked execution.

**Inputs:** execution identity, operation, scope, reason, timeout, and allowed
decisions.

**Guard:** a stale decision cannot apply to a later execution. Pending decisions
remain visible until the service acknowledges the result. The card names the
operation, target, scope, risk, and timeout. A submission failure stays inline
with the same decision and leaves both choices retryable. A terminal tool or
parent event clears pending client state, including when the event wins a race
with the confirmation HTTP response. The decision card owns the primary
operation summary; serialized tool arguments remain available under a collapsed
secondary disclosure and never repeat the command in the default reading path.

### `DeliverySummary`

**Role:** translate verification evidence into outcome, passed, pending, failed,
residual risk, and review actions.

**Guard:** rendered only from a verification summary. It cannot use Git status
or prose as success evidence.

**Progress:** one thin semantic progressbar reports passed required checks over
all required checks. Pending, failed, and residual-risk counts remain explicit
evidence rather than being counted as progress.

**Next action:** open Overview, a specific artifact, Changes, or continue the
Conversation.

### `ArtifactEntries`

**Role:** expose addressable task results in the response that introduced them.

**Supported entries:** file, change set, preview, report, and verification
result.

**Action contract:** emit an `OpenResultIntent` containing task identity,
result mode, artifact identity when available, and the opening control used for
focus restoration.

**Guard:** an entry opens only its owning task. Missing or stale targets render
an inline retry or unavailable state rather than an empty workspace.

### `TaskComposer`

**Role:** collect the next natural-language instruction and explicit workspace
file context.

**Subparts:** `TaskComposerInput`, attachment and Skill chips,
`ComposerSuggestionMenu`, `TaskComposerModeControl`,
`ComposerWorkspaceTree`, `TaskComposerEffortControl`, provider-tabbed model control,
`TaskComposerModelChangeNotice`, `TaskComposerGoalTiming`,
`TaskComposerContextControl`, one stateful Send/Stop action, and
`FollowUpQueue`.

**Control contract:** the left execution-mode trigger opens only 按需确认,
只读规划, and 自动执行. Its semantic icon and Chinese name both change with the
selected mode; it never falls back to a generic `+` or opens a centered file
dialog. Model and Effort are independently operable: Effort uses a discrete
slider whose values remain English while all descriptions and guidance use
Chinese, and the model picker filters through source/provider tabs. Every selector attached to
the Composer footer opens upward. Context usage keeps its purpose-specific
popover plus a directly adjacent manual compaction action; goal has no standalone panel. Every popover closes on outside click or
Escape, and Escape restores focus to its trigger. At the supported desktop
widths, controls may shorten their visible labels but must remain directly
reachable and expose their full name by accessible label and native tooltip.
The closed model trigger is deliberately quiet: transparent at rest, readable
by model name, and emphasized only on hover, keyboard focus, loading, or while
open. A successful selection renders a temporary, divider-led inline notice
above the Composer naming both the previous and current models. Model failures
remain error notifications and never claim that a switch succeeded.
Effort, execution-mode, HITL, cancellation, queue, and compaction success use
the same local-state feedback rule and do not create global success toasts.

**Inline resource contract:** `@` opens a workspace tree whose root and expanded
directories load lazily. File and folder rows use type-sensitive, VS Code-like
colored icons without relying on color alone. `/` searches enabled Skills and
includes one pinned `/goal` control command; typing after `/` filters and ranks
the list and highlights every visible matching fragment in names and
descriptions. Arrow keys move the active item, Enter or Tab expands a directory
or selects an item, and Escape dismisses the surface without clearing the
surrounding draft. A selected file or Skill becomes a removable chip and is
persisted with the task draft and follow-up queue. File and Skill queries are
transient and never become part of the submitted instruction. Choosing `/goal`
inserts `/goal `; `/goal <target>` updates task controls, `/goal clear` clears
the target, and neither is queued or transported as a normal instruction. Web
must not expose the rest of the TUI built-in command registry through this
surface.

**Task-status contract:** `TaskComposerGoalTiming` passively shows persisted
live goal duration; `/goal <target>` starts or resets it, `/goal clear` removes
it, and a `goal_achieved` event freezes it. This timer never authorizes the
task-runtime panel. Planning and subagent evidence belongs to
`TaskRuntimeFloatingPanel` at the upper-right of Conversation, not to a Composer
footer trigger or upward popover.

**Drop-import contract:** dropping browser-readable files or folders anywhere
on `TaskComposerInput` copies them into the served workspace, preserves nested
paths, refreshes the workspace root, and adds each imported top-level path as a
context chip. Existing top-level content is never overwritten; collisions use
` (n)` before a file extension or after a folder name. Import is limited to 500
files, 500 directories, 16 MB per file, and 32 MB total. The client writes in
bounded chunks, disables Send during import, and removes newly-created roots if
any write fails. The overlay must state that the operation copies into the
workspace rather than merely attaching an external reference.

**Continuity:**

- Enter sends; Shift+Enter adds a line;
- model, Effort, execution mode, goal, and context usage stay with the instruction
  they affect;
- while the current task runs, the primary action becomes Stop and Enter keeps
  submitting follow-up instructions into the visible queue;
- while another task runs, the current draft remains intact;
- context paths stay inside the workspace;
- Files-based selection returns to the same draft;
- opening or closing Results never moves or clears Composer content;
- persistence failure retains in-memory input and reports one warning.

### `NewTaskWorkspaceControl`

**Role:** choose the directory that owns a new task before its first
instruction creates an authoritative session.

**Contract:** the preparation Composer shows the selected workspace name. Its
upward popover searches the current and recent session workspaces, marks the
active path, and can invoke the host operating system's local-folder picker.
Full paths remain visible as secondary text and tooltips. Cancellation keeps
the current selection and draft unchanged; an inaccessible directory reports
an inline error without creating a task.

**Continuity:** changing workspace preserves instruction text and task
parameters, clears file and Skill context that belonged to the previous root,
and scopes subsequent `@` selection and drop import to the new root. The first
session request sends the selected path as both `workspace` and `cwd`. Existing
tasks never inherit later new-task workspace changes.

### `FollowUpQueue`

**Role:** make instructions submitted during execution visible and editable.

**Actions:** reorder, edit in place without replacing the Composer draft, and
remove.

**Contract:** after execution stops, the queue explicitly says it will not run
automatically. Queue state is task-scoped.

### `RecoveryNotice`

**Role:** explain stopped, failed, interrupted, or disconnected execution and
offer the next safe task action.

**Contract:** never claim queued work resumed or a denied operation was fixed
unless confirmed by authoritative state.

The primary reading path contains a bounded human-readable summary. Long
transport errors, stack traces, and request identifiers stay lossless inside a
collapsed `查看技术详情` disclosure whose body scrolls independently.
The disclosure uses a native button and never duplicates the same failure as
assistant answer text. A failed tool suppresses this turn-level surface only
when the parent error clearly repeats its evidence. Independent model,
transport, or stream failures remain visible after a tool failure, while
`cancelled` and `command_dead_lettered` always retain their own recovery state.
Tool-specific recovery uses a repair action, an independent turn failure uses
`诊断并恢复`, and exhausted retries use `检查失败原因`; simultaneous surfaces
never expose identically named actions with different ownership.

## Result Workspace shell

### `ResultWorkspace`

**Role:** keep task results beside Conversation in one persistent supporting
plane.

**Inputs:** task-scoped workspace state, available mode definitions,
`ResultWorkspaceActions`, and the latest `OpenResultIntent`.

**Owns:** closed, docked, or full-screen presentation; panel width; shared focus
restoration; mode composition.

**Contract:** it mounts only after a meaningful result action. One instance
serves all modes. Around 1024 px it overlays Conversation. Closing preserves the
last safe state and restores full Conversation width.

**Does not own:** file content, preview lifecycle, Git truth, or task execution.

### `ResultWorkspaceHeader`

**Role:** provide artifact tabs and the few actions that affect the complete
workspace.

**Actions:** select tab, close tab, toggle full screen, and close workspace.

**Contract:** mode selection does not live as four permanent header buttons.
In-progress destructive mutations can guard close.

### `ArtifactTabs`

**Role:** represent open artifacts within the selected task.

**Identity:** one tab per stable artifact identity and presentation kind. Opening
the same artifact focuses the existing tab.

**Selection:** selecting a tab activates its owning mode. Switching modes
selects that mode's most recent tab or useful empty state without closing tabs
from other modes.

**Close behavior:** dirty tabs require resolution. Closing the active tab selects
the nearest remaining tab or the active mode's useful empty state.

**Contract:** tabs are inspection history, not product navigation. A mode switch
does not discard another mode's tabs.

### `WorkspaceModeSwitcher`

**Role:** switch among available result modes through one compact labelled
trigger and popover.

**Items:** Overview after delivery or artifacts, Files for a readable served
workspace, Browser for a valid preview target, and Changes for a Git workspace.
Unavailable modes are absent instead of disabled placeholders.

**Keyboard:** trigger supports Enter, Space, ArrowDown, and Escape. The popover
uses roving selection and restores focus to the trigger.

**Contract:** switching a mode changes navigator and viewport context without
changing task or clearing tabs.

### `ResultWorkspaceBody`

**Role:** compose the current mode's navigator and dominant artifact viewport.

**Owns:** navigator visibility and split width.

**Contract:** the viewport receives all remaining space. The navigator may
collapse, but it cannot become a second Activity Bar.

### `ModeNavigator`

**Role:** common sizing, scrolling, loading, empty, and error frame for a mode's
navigator content.

**Does not own:** the domain list, selected artifact, or mutation actions.

### `ArtifactViewport`

**Role:** common focus, loading, empty, error, and retry frame for the active
artifact renderer.

**Contract:** a failed load keeps the previous successful artifact visible when
safe and identifies the failed target in context.

## Overview mode

### `OverviewMode`

**Role:** answer what the task produced, how it was verified, and which result
needs attention.

**Navigator groups:** files, changes, previews, verification, and reports that
exist for the task.

**Viewport:** selected result summary or the evidence-backed delivery overview.

**Next action:** open the exact artifact, open Changes, or continue the task.

**Guard:** task artifact groups are task-scoped; workspace-wide Git status is
labelled separately.

## Files mode

### `FilesMode`

**Role:** compose file navigation, search, file tabs, content viewing, direct
correction, and validation.

**Contract:** Files is a result mode inside the shared shell, not a standalone
Workspace page with its own header, close, or sizing model.

### `FileNavigator`

**Role:** navigate and mutate workspace files and directories.

**Actions:** expand, select, create file/folder, rename, copy, delete, refresh,
and open search.

**Interaction contract:** rows expose no trailing hover action cluster. A
pointer context-menu gesture or `Shift+F10` opens one viewport-bounded,
keyboard-operable menu at the row; tree whitespace opens root create and refresh
actions. Menu selection moves create, rename, copy, or delete into the affected
tree location's in-place editor or confirmation state. Escape restores focus to
the invoking row, and outside click dismisses without changing selection.

**Guards:** unchanged rename is rejected; in-tree confirmation cannot be
resubmitted while a mutation runs; rename and delete rebase or close every
affected editor tab.

### `EditorTabStrip`

**Role:** keep file and diff documents in one ordered, horizontally scrollable
tab model.

**Actions:** activate, close, middle-click close, keyboard traversal, and expose
per-file loading and dirty state. Pointer right-click, the Context Menu key, or
`Shift+F10` opens a Chinese menu for close, close others, close right, close
all, copy path, and copy relative path.

**Contract:** opening another file never discards a draft. A dirty close offers
Save and Close, Don't Save, and Cancel. A multi-tab close resolves dirty
documents in tab order and stops when the user cancels; it never skips a
protected draft. `Cmd/Ctrl+W` follows the same guard. Context menus stay within
the viewport, support keyboard navigation and Escape, and restore focus to the
invoking tab.

### `MonacoFileEditor`

**Role:** provide the local VS Code editing engine for the active text tab,
including syntax highlighting, folding, indentation, exact line/column reveal,
and model view state.

**Contract:** Monaco, its Simplified Chinese language resources, and its
language workers are bundled locally and loaded on demand. Built-in and A3S
semantic-navigation context-menu commands are Chinese. `Cmd/Ctrl+S` saves the
active tab. Binary files never create a Monaco text model.

### `FileArtifactView`

**Role:** compose the active Monaco file editor, toolbar, validation evidence,
binary state, load failure, and editor status bar.

**Guards:**

- selecting the same dirty file activates its existing model without rereading;
- read failure remains attached to the failed tab with a retry;
- binary files cannot enter the text save path;
- disk changes trigger an explicit reload or overwrite decision;
- editing a validated configuration invalidates stale validation.

**Navigation input:** optional line and column from Search.

### `WorkspaceSearch`

**Role:** search text, group matches by file, open exact results, and perform
bounded replacement inside Files mode.

**State:** typed query, searched query, result set, replacement, searching, and
replacing are separate values.

**Guards:** stale results disable Replace. Replacement uses the displayed result
set's query and is blocked by affected unsaved content.

## Browser mode

### `BrowserMode`

**Role:** verify a backend-defined local preview as one task result.

**Composition:** `PreviewNavigator`, `BrowserToolbar`, and `BrowserViewport`.

**Availability:** rendered only when at least one valid preview target exists.

### `PreviewNavigator`

**Role:** list valid preview targets and recent pages within those targets.

**Contract:** selecting a target preserves the current task and emits a bounded
preview action. It is not a general bookmark or browsing history surface.

### `BrowserToolbar`

**Role:** show target identity, lifecycle status, refresh, and reopen actions.

**Contract:** controls describe whether they refresh page state or restart a
preview. Duplicate process starts are guarded.

### `BrowserViewport`

**Role:** render the managed preview and explicit starting, ready, stopped,
failed, and disconnected states.

**Security boundary:** navigation stays within service-defined preview targets.
Unrestricted external browsing requires separate product and security design.

**Recovery:** retain selected target and expose one useful retry or diagnostic.

## Changes mode

### `ChangesMode`

**Role:** compose workspace-wide Git status, changed-file navigation, diff
review, staging, and commit.

**Contract:** it uses the shared Result Workspace shell and always labels state
as workspace-wide rather than selected-task provenance. In the compact task
workspace it replaces `FileNavigator` in the navigator column; it never overlays
or narrows the active diff editor.

### `ChangedFileNavigator`

**Role:** list changed files with status, additions, deletions, staging state,
and current selection.

**Actions:** select, stage, unstage, and refresh.

**Guard:** mutation progress prevents concurrent refresh or duplicate staging.

### `DiffViewer`

**Role:** compare complete original and modified documents in Monaco's diff
editor with file identity and staging state.

**Actions:** open the file for correction and return to the existing diff tab.

**Guard:** failed selection remains a retryable diff tab. Binary changes use an
explicit non-text state. Staging and commit close stale diff models.

### `CommitDialog`

**Role:** confirm commit message and authoritative staged scope.

**Contract:** cannot close or resubmit during commit. Failure retains message,
scope, and review context. Success emits a commit receipt and refreshes Changes.

## Shared result dialogs

Dirty-artifact confirmation, external-conflict resolution, replacement
confirmation, and `CommitDialog` use the shared Dialog primitive. Each names the
affected path or scope, disables duplicate submission, and preserves context on
failure. Explorer mutations instead stay in the affected tree location after a
context-menu choice.

## Memory surface

### `MemoryPage`

**Role:** compose the complete read-only Memory journey at `#code/memory`.

**Contract:** initial entry loads once, refresh is explicit, and a stale
snapshot remains usable when refresh fails. Loading, empty, no-results, initial
error, stale, and compact states do not overlap. Returning to Tasks preserves
task state; returning to Memory preserves filters, view, and any selection that
still exists after refresh.

**Visual contract:** use the same compact shell hierarchy, shared button
primitives, 230 px explorer / 300 px inspector workspace proportions, border-led
panels, typography scale, and design tokens as the Code and Work surfaces. The
default workspace has only explorer and visualization columns; the inspector is
added after a selection. At compact widths it becomes a dismissible overlay
instead of squeezing the graph.

### `MemoryFiltersPanel`

**Role:** search and combine time, type, source, tier, forgetting-signal, and
lifecycle constraints.

**Contract:** search includes entry content, tags, metadata, sources, entity
names, and aliases. Search, time, and memory type stay visible; retention,
system suggestion, processing state, and source live behind a More filters
disclosure that reports active hidden filters. Counts and reset state remain
truthful, and zero results lead to one clear-all action without discarding the
loaded store. User-facing labels never expose source, lifecycle, relation, or
system-tag enum values.

### `MemoryGraph`

**Role:** project memory events, knowledge entities, and semantic relations as
an explorable, lazy-loaded 3D graph.

**Contract:** focused mode caps the upstream event/entity projection and reports
totals from the complete filtered graph. Panorama starts from the complete
filtered topology, then retains a connected, selection-aware render sample of
at most 600 nodes and 4,000 relations. The scene follows light/dark theme,
resizes with its container, pauses on unmount, auto-frames once, and supports
rotation, pan, zoom, node focus, neighbourhood highlighting, and background
clear. A DOM node browser owns keyboard and screen-reader selection because the
WebGL canvas has no semantic nodes.

### `MemoryTimeline`

**Role:** present the same filtered entries chronologically with type,
retention, lifecycle, tags, source, and importance context.

**Contract:** render the newest 60 entries first and reveal additional batches
on demand. Similar title and preview text is not repeated.

**Continuity:** switching between graph and timeline keeps the current filters
and memory selection; a selected entry expands the visible batch when needed.

### `MemoryInspector`

**Role:** inspect either one memory or one entity without exposing internal
scoring as primary product content.

**Contract:** memory detail prioritizes content, any service-provided
plain-language explanation of why the item was retained, source and use
activity, tags, and linked entities. It can copy memory content. Scores, raw
metadata, paths, and internal identity are not rendered. Entity detail
prioritizes aliases, mentions, recent appearance, and linked memories.
Cross-links update the same inspector. No control mutates or deletes a stored
memory.

### `EvolutionWorkbench`

**Role:** let a user review what A3S proposes to reuse as a preference, working
method, or project fact.

**Contract:** candidates are service-authoritative LLM output. The browser shows
only ready candidates and saved candidates with updates until the user chooses
View all. Save and update are direct reviewed actions; ignore, return to the
unmaterialized baseline, and version restore require confirmation. Baseline
rollback removes the active asset while keeping immutable versions and a
recovery copy. Reconsider is reversible. Evidence is visible in plain language,
while versions and audit history are collapsed. Internal paths and identifiers
are not rendered. The client never derives candidate kind or recommendation
state from keywords. Automatic local materialization and runtime activation
remain service-owned; the browser never publishes a learned asset.

## Settings and help

### `SettingsDialog`

**Role:** expose shell-level preferences without replacing or unmounting the
current Code surface.

**Composition:** a quiet Settings navigation rail plus independent Account,
General, Model & Provider, Agent & Execution, Context & Storage, Integrations,
About & Updates, and searchable `HelpSettings` components. Help is a first-class
tab at `#settings/help`, not a separate product page.

**Contracts:** actual service and OS configuration state is shown; account
sign-in does not imply runtime tools are active; warnings and empty states are
actionable. Opening stores the invoking focus and underlying route. Close or
Escape restores both. Focus is trapped while open. Update installation disables
every in-app dismissal path, including shell shortcuts.

`AccountSettings` composes `A3sOsAccount` and `LocalModelAccounts`. The local
account rows recognize only qualified Claude Code, Codex, and WorkBuddy catalog
sources, show the available model count without exposing credentials, and keep
refresh loading, success, and failure inside the section. A failed refresh
retains the previously usable catalog.

### Configuration category views

`ModelSettings`, `AgentSettingsView`, `ContextSettingsView`, and
`IntegrationsSettingsView` each own one API category, one local draft, one
effect badge, and one save state. Selecting a tab loads only that category.
Saving replaces the baseline only after the CLI returns the parsed
authoritative configuration; failure retains the draft for retry.

The Integrations view composes `SearchSettingsEditor`,
`DocumentParserSettingsEditor`, `OomolConnectorSettings`, and
`McpSettingsEditor`. `OomolConnectorSettings` projects one standard
`streamable-http` MCP server named `oomol-connector`: hosted mode fixes the official
OOMOL endpoint and stores a raw API-key authorization header, while self-hosted
mode accepts the runtime endpoint and stores a Bearer runtime token. It keeps
masked secrets opaque across reads and clears them when a deployment switch
changes the required authorization scheme. The managed OOMOL entry is excluded
from the generic MCP list so a newly entered key cannot be duplicated into a
plain header field. A same-name legacy entry using another transport stays in
the generic editor until the user renames or removes it, and invalid self-hosted
endpoint URLs cannot be saved. Other MCP servers and Providers use
independently collapsible editors and inline add/remove actions.
Advanced queue, model metadata, OCR, cache, transport, and OAuth fields stay in
disclosures rather than competing with common settings.

Shared configuration components include `SettingsSection`, `SettingsRow`,
`SettingsField`, `SettingsSwitch`, typed text/number/select/secret fields,
bounded percentage sliders, short segmented choices, `SettingsDisclosure`,
`SettingsPathList`, `KeyValueEditor`, and category-local load/save states.
Section switches pair visible state text with the control, dependent settings
stay visible but disabled, invalid number ranges are explained inline, and an
unsaved category can be undone before saving. Secret fields represent an
existing value as configured,
permit explicit replacement or clearing, and never render the stored value or
an unusable reveal action for a server-held marker. Common rows keep one
label/description column and one aligned control column; number controls display
units, and advanced connection or model metadata stays behind disclosures.
Provider and model list identity is independent of editable names and IDs, so a
keystroke cannot remount the editor, drop focus, or collapse the current
disclosure. Category save state remains sticky and distinguishes synced,
unsaved, saving, saved, and failed states locally.

### `HelpSettings`

**Role:** explain the actual Code workflow, Result Workspace modes, and keyboard
shortcuts, including `?` Help. It does not teach slash commands as the primary
Web interaction. The current Code task, drafts, workspace, and route remain
mounted underneath while this tab is selected.

## Design-system primitives

| Primitive | Responsibility |
| --- | --- |
| `Button` | tone, disabled, loading, and button semantics |
| `IconButton` | accessible label, selected state, compact icon action |
| `Dialog` | focus trap, labelled structure, Escape, focus restoration |
| `Popover` | anchored non-modal content, outside click, Escape, focus return |
| `Tabs` | keyboard selection, close semantics, overflow |
| `SplitHandle` | pointer and keyboard resize with bounds |
| `StatusBadge` | semantic state label without domain logic |
| `ModelCombobox` | searchable model selection and keyboard navigation |

## Journey traceability

| Journey step | Primary component | Required next connection |
| --- | --- | --- |
| Create or select task | `TaskLibrary` | `TaskComposer` |
| Add file context | `TaskComposer` / `FilesMode` | same saved draft |
| Execute | `ExecutionStream` | decision, queue, recovery, or delivery |
| Decide permission | `PermissionDecision` | same execution lifecycle |
| Review evidence | `DeliverySummary` | `ArtifactEntries` or Conversation |
| Open a result | `ArtifactEntries` | matching workspace mode and artifact |
| Understand delivery | `OverviewMode` | artifact or follow-up |
| Inspect or correct | `FilesMode` | save, validate, or follow-up |
| Preview behavior | `BrowserMode` | retry, report problem, or continue |
| Review changes | `ChangesMode` | correct, stage, or commit |
| Commit | `CommitDialog` | receipt and same Conversation |
| Explore memory | `MemoryPage` | filter, choose a view, or return to Tasks |
| Inspect memory knowledge | `MemoryGraph` / `MemoryTimeline` | `MemoryInspector` |
| Follow a memory relation | `MemoryInspector` | linked memory or entity |

If a proposed component cannot be placed in this table with both a previous and
next step, it is not ready for implementation.

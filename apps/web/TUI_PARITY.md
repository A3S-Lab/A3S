# A3S Code TUI to Web Product Mapping

The TUI is a capability reference, not the Web information architecture. A Web
capability is complete only when it participates in a coherent journey with
honest state, recovery, and browser verification. Exposing an endpoint, raw
JSON, command-palette entry, or slash-command list is not parity.

The current Web release intentionally implements the task-to-commit loop. Other
TUI capabilities remain in TUI until their Web product journey is designed.

## Current integrated journey

| TUI capability | Web product intent | Current owner | State |
| --- | --- | --- | --- |
| New/resume session | Create or continue durable work | Task Library | Integrated |
| Streaming transcript | Understand work without raw events | Execution Stream | Integrated |
| Live plan | Understand intended and current steps | Composer task tracker | Appears only after `PlanningEnd` or `TaskUpdated`, updates from step events, and clears at the next user turn |
| Busy-submit queue | Direct follow-up work without interruption | Composer / Follow-up Queue | Integrated; editing preserves the current draft |
| Stop/interrupt | Stop current work without losing context | Composer | Integrated |
| Tool execution | Understand lifecycle, output, and failure | Execution Stream / Execution Details | Integrated; detail surface migration planned |
| Tool confirmation | Decide a scoped sensitive action | Execution permission block | Integrated |
| `/model` | Select current-task model | Composer task parameters | Integrated |
| `/effort` | Control reasoning effort | Composer task parameters | Integrated |
| Shift+Tab / `/auto` | Select permission behavior | Composer task parameters | Integrated |
| `/goal` | Preserve task intent | Composer task parameters | Integrated |
| `/compact` | Reduce active context without breaking task continuity | Composer context status | Integrated; manual action refreshes transcript and usage inline |
| Ctrl+T | Inspect selected-task operations | Inline Execution Details | Integrated; separate Activity panel will be removed |
| `/help` | Learn actual workflows and shortcuts | Settings / Help tab | Integrated without a separate full-screen page |
| `@<path>` | Attach explicit file context | Composer / Files selection | Integrated |
| `/ide` files | Browse and edit workspace | Result Workspace / Files | Integrated capability; shell migration planned |
| `/ide` search | Search and replace workspace text | Files / Workspace Search | Integrated capability; shell migration planned |
| File operations | Create, rename, copy, and delete | Files / File Navigator | Integrated capability; shell migration planned |
| Git status/diff | Inspect workspace-wide changes | Result Workspace / Changes | Integrated capability; shell migration planned |
| Stage/unstage | Prepare reviewed changes | Changes / Changed File Navigator | Integrated capability; shell migration planned |
| Commit | Record reviewed changes | Commit Dialog | Integrated |
| `/config` | Edit and validate configuration | Settings category views | Integrated for models, Agent, context, storage, search, document parsing, MCP, and A3S OS |
| `/theme` | Choose presentation theme | Settings | Integrated |
| `/login`, `/logout` | Manage optional A3S OS account | Account Settings | Integrated |
| `/update` | Check and install CLI updates | Update Settings | Integrated |

## Deliberately deferred capability decisions

| TUI capability | Why it is not in current Web | Required product work before implementation |
| --- | --- | --- |
| `/fork` | Session ancestry is not yet a useful task model | Define branch intent, comparison, merge/return path, and library behavior |
| `/clear` | Destructive reset overlaps task deletion and new task | Define distinct outcome and recovery value |
| `/init` | Project instruction setup is not connected to the task loop | Define reviewable generated change and return path |
| Image paste/upload | Service and model compatibility contract is incomplete | Define preview, upload lifecycle, limits, failure, and persistence |
| `! <cmd>` | Command syntax would recreate terminal UX | Define a scoped task outcome and permission/evidence presentation |
| `? <query>` | Evidence research belongs to the Science product direction | Complete A3S Science discovery |
| Input history | Task search and drafts cover part of the need | Validate a distinct reuse journey before adding controls |
| `/ctx`, `/memory`, `/kb`, `/sleep` | Long-term context ownership is unresolved | Define shared platform scoping, provenance, consent, and removal |
| `/agent`, `/flow`, `/mcp`, `/skill`, `/okf`, `/loop` | Reusable execution does not belong in disconnected Code utility panels | Re-evaluate through future product discovery |
| `/plugin`, `/reload` | Extension lifecycle has system-wide impact | Define compatibility, impact preview, recovery, and session rebuild behavior |
| `/exit` | Browser has no equivalent application exit | Intentionally omitted; service status/reconnect replaces it |

Deferred rows do not receive Web components or API wrappers. Backend support
alone does not change their state.

## Completion definition

A mapped row becomes `Integrated` only when:

1. it has a previous and next step in an implemented Web journey;
2. loading, empty, error, retry, success, disabled, and reconnect states are
   honest where applicable;
3. destructive or remote effects expose scope and confirmation;
4. mutations guard duplicate submission and retain context on failure;
5. refresh behavior is defined for durable and transient state;
6. keyboard, focus return, Escape, and accessible naming are verified;
7. both 1440 px and compact desktop around 1024 px remain usable;
8. browser QA verifies the outcome rather than only the click.

## Browser acceptance focus

- Create task, attach a reviewed file, execute, queue a follow-up, and stop.
- Switch away from and return to the running task without draft loss.
- Resolve permission, denial, timeout, interruption, and reconnect states.
- Open a file result, search to an exact line, protect dirty edits, and handle a
  binary file safely.
- Open Changes, inspect a workspace diff, stage, commit, and return to the same
  task.
- Verify disconnected Settings, model keyboard selection, and compact Results.
- Inspect browser console errors, close QA sessions, and stop temporary servers.

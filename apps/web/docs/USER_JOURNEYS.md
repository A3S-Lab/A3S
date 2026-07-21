# A3S Code Web Core User Journeys

## Journey 1: Complete a coding task

**Intent:** ask A3S Code to change a project while retaining control and
understanding.

1. The new-task surface explains the expected outcome and offers editable Code
   starters without showing inactive task or result UI.
2. The user confirms the visible workspace, searches recent workspaces, or
   opens a local folder through the host operating system. Changing it preserves
   instruction text but clears file and Skill context from the previous root.
   The user then writes a natural-language instruction with optional workspace
   file context. `@` opens a lazy tree with colored type icons; file selection
   returns to the same saved draft as a removable chip. Files or folders may
   also be dropped onto the Composer to copy them safely into the selected
   workspace and add the imported roots as context without replacing existing
   paths.
3. Typing `/` filters enabled Skills and highlights matching text. Composer
   parameters adjust the visible mode-specific execution icon and Chinese mode
   name, provider-filtered model, or Effort slider with English values and
   Chinese descriptions without leaving the instruction. `/goal <target>`
   updates the persistent goal inline and is never sent as a message.
4. The first accepted instruction creates the task, reveals its identity, and
   becomes a turn. A real agent plan updates in place.
5. Tool calls render as semantic lifecycles. Sensitive operations pause inside
   the execution that requires the decision.
6. A second instruction submitted while running enters the visible task queue.
   It can be reordered, edited, or removed without replacing the Composer draft.
   Stop remains a separate action.
7. Permission denial, timeout, interruption, or service loss produces an honest
   recovery path. Suggested text is appended to the draft for review instead of
   being sent implicitly.
8. Verification evidence produces a delivery summary. An answer without
   evidence remains an ordinary response.
9. Addressable outputs appear as artifact entries. The user may continue the
   Conversation or open a result beside it.

**Recovery:** refresh restores active task, draft, file references, queue, and
safe Result Workspace state when browser persistence is available. Persistence
failure retains in-memory state. Reconnect reloads server-backed truth.

**Acceptance outcome:** the user can explain what happened, inspect what was
produced, and choose the next action without reading raw events or opening a
terminal.

## Journey 2: Inspect a task result

**Intent:** move from an assistant claim to the exact result without losing the
task that produced it.

1. The user selects a file card, “view all artifacts”, or another result entry
   in Conversation.
2. Result Workspace opens beside the same task, selects the matching mode, and
   focuses the artifact in an existing or new tab.
3. The user changes between Overview, Files, Browser, and Changes through one
   compact mode switcher. Only modes with useful content are available.
4. The mode navigator controls the dominant viewport: result group, file tree,
   preview target, or changed-file list.
5. Selecting another artifact updates the viewport without resetting
   Conversation, Composer, or unrelated tabs.
6. Full screen expands the same workspace state. Closing restores full
   Conversation width and returns focus to the opening control.
7. Reopening Results restores the task's last safe mode, tabs, selection, size,
   and relevant scroll position.

**Recovery:** a failed artifact load retains the previous content and failed
target with one in-context retry. A dirty artifact blocks destructive close,
reload, and task switching until explicitly resolved.

**Acceptance outcome:** the right workspace feels like an extension of the
selected result, not a separate IDE or disconnected feature panel.

## Journey 3: Review and correct files

**Intent:** inspect or make a bounded correction while staying connected to the
originating task.

1. The user opens Files from an artifact entry or the mode switcher.
2. The navigator exposes the workspace tree and search without hiding the active
   file.
3. A selected text file opens in a Monaco tab; additional file and diff tabs
   preserve their own view and dirty state. Binary content renders as read-only
   metadata.
4. The user may edit, switch tabs, and save without losing other drafts. Dirty
   content blocks tab close, replacement, destructive reload, and deletion only
   when those actions would discard or overwrite that content.
5. Search opens a match at its exact location. A failed read keeps Search and
   the prior artifact intact. Replace uses the displayed result set's query and
   a confirmed scope.
6. Supported configuration can be validated. A failure can be appended to the
   same task as a reviewed correction instruction with explicit file context.
7. The user closes Results or continues directly in Conversation.

**Recovery:** external changes offer explicit reload or overwrite. Failed save,
rename, replace, or delete preserves the draft, selection, and retry context.

**Acceptance outcome:** direct correction and agent follow-up are two connected
ways to continue the same task.

## Journey 4: Preview and verify behavior

**Intent:** verify a runnable result without losing task or artifact context.

1. A task or service supplies a valid local preview target.
2. The user opens its preview artifact; Result Workspace selects Browser mode
   and the relevant target.
3. Browser shows explicit starting, ready, stopped, failed, or disconnected
   state instead of a blank frame.
4. The user interacts with the preview, refreshes it, or selects another known
   target.
5. A problem can be carried into the same task as a reviewed follow-up rather
   than being sent implicitly.
6. The user returns to Overview, Files, Changes, or full Conversation without
   losing the preview selection.

**Recovery:** startup and navigation failures retain the target and expose one
useful retry or diagnostic. Duplicate preview processes are guarded.

**Acceptance outcome:** behavioral verification is part of delivery review, not
an unrelated browser tool.

## Journey 5: Review and commit changes

**Intent:** understand and accept workspace changes while preserving task
continuity.

1. The user chooses “view changes” from Conversation or selects Changes mode.
2. The navigator shows authoritative workspace-wide branch, file status, and
   line counts without claiming task provenance.
3. Selecting a changed file opens its diff in the artifact viewport.
4. The user may open the file for correction, then return to the same diff.
5. Reviewed files can be staged or unstaged individually.
6. Commit confirmation names the staged scope and message.
7. Success shows an authoritative commit receipt. Failure leaves selection,
   staging, diff, and retry context intact.
8. The user closes Results and continues the same Conversation.

**Recovery:** Git refresh and mutation failures keep the last authoritative
state visible. In-progress mutations block close and duplicate submission.

**Acceptance outcome:** review, correction, commit, and continued agent work
feel like one continuous task rather than separate applications.

## Journey 6: Explore durable memory

**Intent:** understand what A3S has retained and review what it proposes to
reuse, without exposing implementation detail as the main experience.

1. The user opens Memory from the Activity Bar or command palette. The current
   task and Result Workspace state remain mounted conceptually and are restored
   when the user returns.
2. Memory loads all entry pages and one complete graph topology. The page shows
   the memories directly with one truthful filtered/total count; internal scores
   and identifiers do not occupy the default layout.
3. The user searches content, tags, metadata, sources, or entity names and may
   combine time, type, source, retention, forgetting, and lifecycle filters.
4. Graph opens in focused 3D mode with an accurate rendered/total count. The
   user may rotate, pan, zoom, reset, switch to a connected whole-store
   panorama, and select nodes by pointer or through the keyboard-accessible DOM
   browser.
5. Timeline presents the same filtered memories chronologically without losing
   the current query or selection.
6. Selecting a memory explains its content, any available retention reason,
   source, recent use, and linked content. Scores, raw metadata, paths, and
   internal identifiers are not shown. Cross-links continue in the same
   inspector.
7. In Learning, the user initially sees only items that need confirmation or
   have updates. They can review evidence, save or ignore the item, request the
   full catalog, return a saved item to its unmaterialized baseline, and restore
   any preserved version when needed. Automatically matured local assets appear
   in the same auditable history and are never published automatically.
8. The user returns to Tasks or opens Memory settings. No exploration or
   learning-review action deletes or rewrites a source memory.

**Recovery:** an initial failure offers retry; an empty store explains how the
first memory appears; zero filtered results preserve the filters with one reset
action; refresh failure retains the last successful snapshot; disconnect
remains explicit at shell level.

**Acceptance outcome:** every indexed entry can participate in search,
filtering, timeline, and whole-store graph projection. WebGL work remains
bounded, complete totals stay visible, the default graph remains readable, and
the surface stays non-destructive.

## Journey-level quality gates

All journeys are tested at 1440 px and compact desktop around 1024 px for:

- first-use, populated, loading, empty, error, and reconnect states;
- keyboard navigation, focus restoration, and screen-reader naming;
- duplicate-submission protection;
- destructive-action scope and confirmation;
- authoritative state after mutations;
- per-task restoration of tabs, selection, panel size, and drafts;
- no horizontal overflow or obscured primary action.

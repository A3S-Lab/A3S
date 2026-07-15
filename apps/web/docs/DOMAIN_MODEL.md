# A3S Code Web Domain and State Model

## Workspace

The served local project boundary.

```text
Workspace
├── root path and service health
├── files and directories
├── repository status
├── configuration diagnostics
└── tasks
```

The service is authoritative. Client states are `checking`, `connected`, and
`disconnected` with an optional error.

## Task

The durable unit of user intent. A service session is adapted into a task; the
Web UI does not expose transport mechanics as a separate product concept.

```text
Task
├── identity and workspace
├── conversation turns
├── run configuration
├── active execution output
├── queued follow-up instructions
├── file context references
├── artifact references
├── semantic execution activity
└── verification delivery
```

Relevant presentation states are draft, idle, running, waiting for a decision,
stopped, failed, and completed. The exact service state remains available but
unknown enum values must not be shown raw.

## Turn

One user instruction and its resulting assistant work. A turn may contain text,
reasoning, a plan, semantic executions, permission requests, and verification.

## Plan

An agent-provided plan updated in place. Step states include pending,
in-progress, completed, failed, skipped, and cancelled. No synthetic plan is
created merely to fill the interface.

## Execution

One semantic lifecycle for a tool or other runtime operation.

```text
preparing → waiting for permission → running
          → succeeded | failed | denied | timed out | cancelled
```

An execution may expose input, output, duration, exit status, and permission
decision. Persisted and live representations with the same identity collapse
into one rendered block.

## Permission request

Contains execution identity, operation, reason, affected scope, timeout, and
allowed decisions. It cannot be applied to a later execution.

## File context reference

A workspace-relative file path attached to the next instruction. It is a
reference, not a second file copy. Current sources are typed workspace paths and
Files-mode selection.

## Follow-up instruction

A task-scoped queued instruction with text and file references. Queue order is
explicit. A stopped execution does not imply queued instructions will run.

## Verification delivery

Service evidence containing required, pending, failed, and residual-risk data.
It is the only source for the delivery summary.

## Artifact reference

An addressable result exposed from a task turn. It points to authoritative
workspace or service state instead of copying that state into the transcript.

```text
ArtifactReference
├── stable identity
├── owning task and turn
├── kind                         file | change | preview | report | verification
├── label and optional summary
├── preferred result mode
└── domain locator               path, diff target, preview target, or evidence id
```

An artifact is task-scoped as an entry point. A referenced file, Git status, or
preview lifecycle remains authoritative in its owning workspace domain.

## Result Workspace state

Task-scoped client continuity for inspecting artifacts beside Conversation.

```text
ResultWorkspaceState
├── presentation                 closed | docked | full-screen
├── selected mode                overview | files | browser | changes
├── available modes
├── open artifact tabs
├── selected artifact
├── navigator visibility and width
├── workspace width
└── safe restoration positions
```

Dirty file content is referenced from editor state and guards destructive
workspace transitions. Result Workspace state is never used as repository or
preview truth.

## Workspace editor state

```text
EditorState
├── selected path
├── loaded disk content
├── current draft content
├── binary flag
├── dirty flag
├── external conflict
├── validation result
└── optional search location
```

Disk and draft content remain separate so navigation and external changes can be
resolved without silent data loss.

## Search result set

Owns the searched query, file matches, and exact line/column locations. Current
input is separate; divergence makes the result set stale and replacement
ineligible.

## Repository status

Workspace-wide Git truth: repository flag, branch, staged files, unstaged files,
diff, mutation state, and last commit receipt. It is never treated as task
provenance.

## Preview target

A backend-defined local application target that Browser mode may render.

```text
PreviewTarget
├── stable identity and label
├── bounded origin or route
├── lifecycle state
├── optional diagnostic
└── last authoritative refresh
```

Lifecycle states include unavailable, starting, ready, stopped, failed, and
disconnected. Browser mode is unavailable when no valid target exists. The Web
client does not infer or start arbitrary public browsing from a raw URL.

## Run configuration

```text
RunConfiguration
├── optional goal
├── model route
├── effort
├── permission mode
└── context usage
```

Permission modes are plan/read-only, confirm-sensitive/default, and automatic
within backend policy.

## State ownership

- The service owns sessions, messages, controls, output, files, and Git truth.
- Shared client state owns the rendered snapshot, selected task, task-scoped
  Result Workspace state, and cross-feature navigation intent.
- Local storage is best-effort for drafts, queues, task titles, active task,
  safe Result Workspace continuity, and theme.
- Component state owns bounded overlay input and focus only.
- A mutation failure retains the previous authoritative value.
- A refresh cannot reconstruct durable truth solely from browser state.

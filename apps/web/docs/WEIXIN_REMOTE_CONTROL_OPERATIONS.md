# WeChat Remote Management: Security, Operations, and Delivery

**Status:** Disabled/mock Alpha requirements implemented; production review open
**Last updated:** 2026-07-22
**Parent:** [WeChat Remote Management: Product and Native Rust iLink Architecture](WEIXIN_REMOTE_CONTROL.md)

This companion document defines the persistence, security, reliability,
privacy, verification, and delivery requirements for the native Rust design in
the parent document. Neither document is independently sufficient for
production approval.

## Persistence and secret handling

### Secret envelope

`bot_token`, current `context_token`, owner `ilink_user_id`, and any protocol
secret are wrapped in secret types that redact `Debug`/`Display` and zeroize
memory where practical. They never enter ACL, local storage, query strings in
local APIs, frontend state snapshots, diagnostics, tracing fields, panic text,
or audit records.

Preferred storage is the operating-system credential vault. A headless fallback
is opt-in and uses an exclusive, non-symlink private directory, a `0600` file,
atomic replacement, and a persistent warning. If ownership/permissions cannot
be verified, binding and monitor startup fail closed. Removing a binding erases
the secret envelope, context token, pending confirmations, and outbox payloads.

Public configuration such as `enabled`, scopes, workspace aliases, and
notification choices may use ACL once supported by the existing Code Web
configuration model. Dynamic protocol state is not product configuration and
does not belong in ACL.

### Runtime journal

The first implementation should use a versioned, private, single-writer runtime
journal plus atomic compacted snapshot, following existing A3S filesystem
patterns. It stores:

- validated account metadata and monitor state;
- `get_updates_buf` checkpoints;
- staged and terminal inbound message IDs;
- stable outbound `client_id` and send state;
- selected remote target and notification subscriptions;
- pending confirmations and policy/action revisions; and
- idempotency reservations and terminal command receipts.

Appends are serialized, bounded, and synced before acknowledging state that
protects a side effect. Compaction writes a new private file, syncs it, and
atomically renames it. Startup validates schema, size, ownership, permissions,
and record bounds; corrupt tails are quarantined instead of silently resetting
the cursor. A per-account exclusive lock prevents two A3S Web instances from
polling and executing the same account.

### Audit

Every binding, policy change, inbound authorization result, command draft,
confirmation, execution start, execution outcome, stale rejection, and
credential removal emits a dot-separated lowercase event such as
`weixin.action.executed`.

Audit fields include time, correlation ID, owner fingerprint, target kind,
opaque target ID, action, required scope, policy/action revisions, outcome, and
safe error code. They exclude raw chat text, full owner ID, tokens, context
tokens, raw paths, command lines, and response bodies. Text fields use a hash or
short locally rendered description when needed.

Failure to durably record the execution-start audit blocks a mutation. Failure
to record a terminal result after execution places the subsystem in degraded
read-only mode until storage is healthy. The local audit view must make this
visible.

## Security model

### Trust boundaries

- **Tencent iLink:** authenticated external transport, but responses and
  returned hosts remain untrusted input.
- **WeChat sender:** authenticated only after exact match with the locally bound
  owner ID; possession of a context token alone is not authorization.
- **Chat text:** untrusted data that may contain prompt injection or confusing
  target references.
- **Browser:** trusted local product UI but never a secret store.
- **Managed session:** controllable through typed A3S application methods and
  still subject to normal agent/tool permissions.
- **Cooperative process:** controllable only through fresh advertised one-shot
  grants.
- **Observed process:** untrusted evidence and read-only.
- **Local filesystem/processes:** potentially accessible to other local
  software; private permissions, locks, and redaction reduce but do not remove
  risk on a compromised machine.

### Threats and controls

| Threat | Required control |
| --- | --- |
| Non-owner sends a bot message | Exact constant-time owner ID comparison; ignore without revealing inventory |
| Group member triggers an action | Reject any non-empty `group_id`; direct messages only |
| Replay or duplicate update | Durable message deduplication and command idempotency reservation |
| Prompt injection asks for shell/tools | Closed `RemoteIntent` schema; no generic execute variant; local agent policy still applies to an approved turn |
| Ambiguous “stop it” hits wrong target | Stable selected target, exact preview, second-message confirmation, live revision check |
| Stale cooperative token | Store no token in draft; retrieve and consume a fresh advertised grant at confirmation |
| Fake process is treated as controllable | Only validated, fresh A3S heartbeat entries from the private per-user registry are cooperative; process matches remain observed |
| Token leaks to browser/log/audit | Server-only secret types, centralized redaction, negative serialization tests |
| Malicious `baseurl` exfiltrates bearer token | Strict HTTPS Tencent hostname policy, disabled redirects, validate every authenticated request |
| QR host redirect causes SSRF | Validate `redirect_host`; reject IPs, userinfo, ports, unknown domains, and redirects |
| Arbitrary workspace access | Locally configured opaque workspace aliases; no chat-supplied path resolution |
| Remote destructive deletion | Archive only; permanent purge local only |
| Remote grants itself more power | Policy mutations are local-admin-only; no remote policy intent |
| Transcript leaks secrets | Metadata by default; content scope off; bounded/redacted reply renderer; no tool payloads |
| Flooding consumes CPU/API quota | Per-owner token bucket, message length/count bounds, bounded channels, notification coalescing |
| Local keychain locked after restart | Monitor stays paused/read-only locally; no fallback without prior opt-in |
| Two runtimes use one account | Exclusive account monitor lock and visible owner-runtime diagnostic |

### Local exposure gate

`a3s web` defaults to `127.0.0.1` but can be bound elsewhere. The WeChat page
must not let an unauthenticated LAN visitor scan, replace an owner, enable
mutations, or read audit history. Production enablement therefore requires one
of:

- loopback binding plus same-origin/admin nonce protections; or
- an authenticated HTTPS admin surface with Origin/CSRF protection.

If neither is true, account binding and mutating scopes remain disabled even if
iLink entitlement is valid.

## Reliability and failure recovery

### Monitor behavior

- Respect valid `longpolling_timeout_ms` within approved bounds; treat a normal
  empty long-poll timeout as healthy.
- Use cancellation-aware exponential backoff with full jitter for network and
  5xx failures, capped at five minutes.
- Treat `-14` as `stale_credential`, stop outbound/inbound authenticated calls,
  and require local rebind or Tencent-approved recovery. A one-hour retry timer
  may be shown but must not be described as token refresh.
- After machine sleep/wake or network recovery, reacquire health and continue
  from the durable cursor.
- Validate every update before cursor commit. Quarantine bounded malformed
  records and expose a protocol-degraded diagnostic.
- Use bounded ingress and outbox channels. Coalesce duplicate status
  notifications; never drop or silently replay a mutation receipt.

### Outbound delivery

Every outbound response has a stable `client_id` derived from its durable
outbox record. It carries the latest owner `context_token` and a bounded text
payload. Until Tencent confirms `client_id` deduplication semantics, a request
whose transport outcome is unknown is not blindly retried. The outbox records
`outcome_unknown`; the next owner query can retrieve the underlying action
receipt without re-executing it.

Proactive notifications require a valid stored owner context token. If none is
available, the event remains visible in local audit/diagnostics and is not sent
through an invented conversation.

### User-visible recovery

| Failure | Product response |
| --- | --- |
| QR expired | Clear attempt and offer a new QR |
| Pair code blocked | Bound retry count and require a new attempt |
| Invalid redirect/base URL | Abort binding, retain no credential, show security error |
| Keychain unavailable | Pause before polling; offer explicit secure fallback only locally |
| Temporary iLink outage | Show degraded state and last successful update; retry with backoff |
| Stale token `-14` | Pause and require rebind/recovery |
| Target disappeared | Reject confirmation as stale; do not retarget by list position |
| Action capability changed | Reject with fresh status; require a new draft |
| Crash during mutation | Mark `outcome_unknown`; never auto-replay |
| Audit/runtime store unhealthy | Continue safe local product operation but make WeChat mutations read-only |

## Privacy and response rendering

All remote replies are produced from normalized domain views, not raw API JSON
or process snapshots. Default rendering rules are:

- workspace alias or basename only, never an absolute path;
- session display title and opaque short reference, never filesystem ID;
- exact evidence age and confidence label;
- child-agent task/status only when emitted by a cooperative A3S source;
- no environment values, full command lines, tool arguments/results, diffs, or
  file content;
- no internal stack traces or upstream bodies;
- bounded latest assistant excerpt only with `sessions.content.read`;
- known configured secrets redacted before any outbound text; and
- maximum message size below the Tencent-confirmed limit, with deterministic
  pagination for long inventories. Numeric selection is bound to the durable
  opaque IDs from the last displayed page and revalidated against a fresh
  snapshot before use.

The product must state that enabling session-content forwarding can expose
model-generated text over WeChat and is not equivalent to end-to-end local
storage.

## Observability and service objectives

Metrics and traces contain no user IDs, target titles, prompts, tokens, cursor,
or context token. Useful dimensions are account state, target kind, intent kind,
policy outcome, protocol operation, and safe error code.

Initial local service objectives, measured after iLink delivers an update, are:

- p95 read-only query response enqueued within 3 seconds;
- managed target state no older than the current runtime snapshot;
- cooperative state clearly stale after its existing 10-second presence TTL;
- 100% of attempted remote mutations have a durable start decision and a
  terminal or `outcome_unknown` receipt;
- zero secret-bearing fields in REST DTO snapshots, logs, metrics, or audit;
- transient monitor recovery begins within 60 seconds for ordinary network
  failures, subject to bounded backoff; and
- graceful shutdown completes within a bounded 10-second window, after which
  unresolved sends remain durable rather than blocking process exit.

Suggested metrics include poll latency, update lag, consecutive failures,
inbox dedup hits, quarantined messages, intent outcomes, confirmation expiry,
command receipts, outbox outcomes, and credential-store failures.

## Test strategy

### Protocol unit tests

- Golden JSON fixtures for every QR state and text update/send shape.
- Header generation, random UIN encoding, client version packing, and secret
  redaction.
- Strict host normalization and rejection of HTTP, IP literals, userinfo,
  ports, deceptive suffixes, encoded host tricks, and redirects.
- Unknown enums, missing required fields, oversized bodies, excessive item
  counts, invalid UTF-8 boundaries, and numeric overflow.
- Error mapping including `-14` and transport timeout classification.

Fixtures must be synthetic or captured with all identifiers, tokens, cursors,
context tokens, content, and routing tags irreversibly replaced.

### Mock iLink integration tests

A local mock server exercises:

- full QR flow, expiry, verification, blocked code, redirect, already-bound,
  invalid host, and concurrent-attempt cancellation;
- `get_updates_buf` resume and server-directed long-poll timeout;
- replayed batches, duplicate messages, out-of-order messages, malformed poison
  updates, cursor crash points, and restart recovery;
- outbound `client_id`, context token selection, unknown delivery outcome, and
  bounded retry behavior;
- stale token, 4xx/5xx, TLS/DNS/timeout classification, cancellation, and Boot
  shutdown; and
- single-monitor lock contention across two runtime instances.

No CI test contacts Tencent production.

### Policy and control-plane tests

Property/table tests must prove these invariants:

- a non-owner or group message executes no intent;
- an observed process can never gain a mutation capability;
- no enum or parser output can express arbitrary shell, PID kill, purge, or
  `ApproveAlways`;
- every enabled mutation still requires an unexpired confirmation;
- a policy, target, context, or action-revision change invalidates confirmation;
- a cooperative action uses only a newly fetched live grant;
- an arbitrary chat path cannot escape the workspace alias allowlist;
- duplicate confirmation messages produce one receipt and one execution;
- `executing` after crash becomes `outcome_unknown`, not replay; and
- failure to audit the start prevents execution.

Integration tests cover managed create/message/queue/archive, cooperative
stop/cancel/reply token races, child-agent status projection, and observed-only
processes. Tests must leave no state files, locks, tasks, or sockets behind.

### Frontend tests

- Every connection state, QR expiry/countdown, verification challenge, and
  reconnect path.
- Local exposure and entitlement blockers.
- Scope defaults, dangerous-scope warnings, workspace alias editing, and exact
  remote-visible preview.
- Token/identifier absence from rendered state, browser storage, and mocked
  response snapshots.
- Audit pagination, degraded states, retry, and disconnect confirmation.
- Keyboard/focus behavior, screen-reader labels, 1440 px and compact desktop
  layouts.

### Security verification

- Fuzz protocol deserialization, URL validation, intent parsing, and journal
  recovery.
- Scan logs and serialized DTOs with seeded canary secrets.
- Fault-inject every durable write around cursor advancement and command
  execution.
- Verify private directory/file modes and symlink rejection on supported Unix
  platforms; test the platform credential adapter separately.
- Conduct threat-model review before enabling any mutating scope.

## Delivery plan

The task-level sequence, dependencies, estimates, and merge order are defined
in the [WeChat Remote Management Development Plan](WEIXIN_REMOTE_CONTROL_DEVELOPMENT_PLAN.md).

### Phase 0 — entitlement and contract harness

- Obtain Tencent authorization and protocol identifiers.
- Record an architecture decision that A3S never impersonates OpenClaw.
- Add Rust protocol DTOs, strict URL policy, synthetic fixtures, and a mock
  iLink server.
- Add a disabled capability endpoint so the Web page can show the release gate.

**Exit gate:** Tencent terms and identifiers are recorded; all protocol tests
run without production traffic; no secret can appear in diagnostics.

### Phase 1 — native binding and monitor foundation

- Add `WeixinModule`, Boot lifecycle, secure credential abstraction, account
  lock, runtime journal, QR coordinator, and text-only `getupdates`/
  `sendmessage`.
- Add the built-in WeChat Remote page for bind, health, pause, reconnect, and
  local removal.
- Keep every remote action read-only or disabled.

**Exit gate:** QR states and restart/cursor behavior pass mock and Tencent
sandbox tests; shutdown leaves no task; credential handling passes security
review.

### Phase 2 — truthful read-only remote view

- Add normalized managed/cooperative/observed inventory.
- Add owner-only direct-text ingress, deterministic commands, safe renderer,
  help, list, select, status, progress, and session metadata.
- Add content-read as a separate, default-off local scope.

**Exit gate:** every target is correctly labeled by evidence; observed targets
are provably non-controllable; privacy snapshots pass.

### Phase 3 — managed session commands

- Add local scope editor, workspace aliases, command previews, confirmations,
  idempotency receipts, and audit.
- Add managed submit/queue, session creation, notifications, and recoverable
  archive through narrow Kernel providers.

**Exit gate:** no mutation occurs without two-message confirmation and fresh
policy; crash injection cannot duplicate a command; archive recovery works.

### Phase 4 — cooperative controls

- Adapt exact A3S heartbeat targets.
- Add fresh-grant stop, cancel, and reply actions.
- Validate the stable `action_revision` design against the existing 10–12
  second grants.

**Exit gate:** token-expiry races fail closed and no PID/TTY fallback exists.

### Phase 5 — bounded approvals and later capabilities

- Consider `ApproveOnce` and `Deny` only after a separate permission-risk
  review and exact remote rendering of the requested operation.
- Consider media, voice transcription, multiple accounts, or multiple owners
  only from demonstrated product need and with new threat models.

`ApproveAlways`, arbitrary shell, remote permanent purge, and inferred-process
control remain prohibited unless a future architecture explicitly replaces
this decision.

## Acceptance criteria for the initial product

The initial product is complete only when:

1. The Rust process alone performs QR binding, polling, parsing, sending,
   persistence, and shutdown; Node/OpenClaw is absent at build and runtime.
2. A3S-specific entitlement is present and no OpenClaw identity is copied.
3. The browser can bind and diagnose the account without ever receiving a bot
   token, context token, owner ID, cursor, or authenticated base URL.
4. Only the scanning owner’s direct text messages are processed.
5. Managed, cooperative, and observed targets are truthfully distinct in both
   Web and WeChat responses.
6. Observed processes expose no mutation path.
7. Natural language produces a closed typed intent; no direct shell/tool/PID
   execution path exists.
8. Every mutation is locally enabled, previewed, confirmed in a second message,
   freshly revalidated, idempotency-reserved, and audited.
9. Session deletion from WeChat is recoverable archive; permanent purge is
   unavailable remotely.
10. Duplicate updates, expired grants, restart, sleep/wake, upstream outage,
    stale token, and crash-during-action all have tested fail-safe outcomes.
11. Focused Rust tests, frontend tests, formatting, and documentation checks pass
    from their respective crate/application directories.

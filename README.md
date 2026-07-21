# A3S

<p align="center">
  <strong>Rust-Native Platform for Governed Agents and AI Workloads</strong>
</p>

<p align="center">
  <em>Build coding agents, run isolated workloads, evaluate automated systems, and compose reusable runtime infrastructure</em>
</p>

<p align="center">
  <a href="#overview">Overview</a> •
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#platform-model">Platform Model</a> •
  <a href="#projects">Projects</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#development">Development</a>
</p>

---

## Overview

**A3S** is the integration repository for a set of Rust-first agent products,
runtimes, infrastructure libraries, and first-party capability packages. The
`a3s` command is the primary user entry point: it runs the A3S Code terminal,
hosts the local Code API and supplied Web assets, manages local configuration
and accounts, and discovers or delegates to separately distributed products
such as A3S Box, Bench, Search, and Use. A3S Science is maintained as an
independently versioned package under `packages/science`.

The repository also contains independently usable building blocks. A3S Code Core
provides governed agent sessions and tools; Runtime defines provider-neutral Task
and Service lifecycles; Flow, Event, Lane, Memory, Search, and ORM supply durable
coordination and data capabilities; Boot, Gateway, Cloud, and Power address
service and workload infrastructure.

The `a3s` command is the unified product entrypoint: `a3s code` launches the
interactive coding agent, `a3s box` manages isolated runtimes, `a3s bench` runs
reproducible evaluations, and `a3s use` exposes Browser, native Office, OCR,
and installed Use extensions. `a3s list`, `a3s install`, `a3s upgrade`, and
`a3s uninstall` provide one typed component lifecycle. Local Code, Runtime,
provider/model, and Bench workflows do not require an A3S OS login unless the
selected remote capability requires one.

A3S is not one root Cargo workspace, one monolithic binary, or a hosted service.
Many projects under `crates/`, `apps/`, and `packages/` are independent
repositories with their own release and support boundaries, while shared crates
and applications are maintained directly in this repository. Run build and test
commands from the project that owns the change.

Local A3S Code, Web, configuration, component management, and Bench workflows do
not require an A3S OS account. A model-backed agent still needs a configured
provider or compatible local account. A3S OS login is optional and enables
remote asset, Runtime, workflow, knowledge, and RemoteUI operations where the
selected product exposes them.

## Repository Map

| Area | Paths | Purpose |
| --- | --- | --- |
| Product surfaces | `crates/cli`, `crates/bench`, `apps/web`, `apps/box`, `apps/cloud`, `apps/docs` | CLI, browser workspace, benchmark control component, native app, Cloud control plane, and documentation site. |
| Capability packages | `packages/science` | First-party scientific Skills, MCP data services, compute workflows, and research tooling. |
| Agent runtime | `crates/code`, `crates/ahp`, `crates/acl`, `crates/common` | Sessions, tools, policy, protocol, config, and shared types. |
| UI systems | `crates/tui`, `crates/gui`, `crates/webview` | Terminal UI, native RSX UI, and trusted WebView helpers. |
| Use and retrieval | `crates/use`, `crates/search` | Browser, native Office, and OCR capability surfaces, external Use extensions, and search through the shared Browser runtime. |
| State and coordination | `crates/memory`, `crates/event`, `crates/flow`, `crates/lane`, `crates/orm` | Memory, events, workflows, queues, and typed persistence. |
| Runtime safety and operations | `crates/runtime`, `crates/box`, `crates/observer`, `crates/sentry` | Provider-neutral execution, isolation, observability, and runtime control. |
| Services | `crates/boot`, `crates/gateway`, `crates/power` | Service framework, ingress, and model serving. |
| Distribution | `crates/updater`, `homebrew-tap` | CLI self-update support and Homebrew formulae. |

### Basic usage

```bash
# Install the published Rust CLI.
cargo install a3s

# Start A3S Code in the workspace it should inspect.
cd /path/to/project
a3s code

# Or start only the local Code API; no frontend assets are required.
a3s web --api-only
```

`a3s code` creates or discovers an ACL configuration and launches the terminal
application. `a3s web --api-only` exposes the local agent runtime without a
frontend. Browser mode requires a built Web asset directory discovered by the CLI
or passed with `--web-dir`; the CLI does not embed those assets. Both modes bind
to loopback by default.

## Features

- **Governed Coding Agents**: Run interactive or non-interactive agent sessions
  with bounded workspace tools, shared risk-aware TUI/Web guardrails, human
  approval for unbounded operations, persistence, context management, memory,
  delegation, and verification
- **Terminal and Web Workspaces**: Use the event-driven A3S Code TUI or the local
  React/Monaco task workspace backed by the CLI's Boot-based API when a compatible
  frontend build is supplied
- **Local Web Office**: Create, edit, preview, organize, version, import, and
  export documents, spreadsheets, presentations, and source-backed PDFs through
  A3S Work, with server-owned local storage, recoverable file operations,
  Office compatibility reports, editable DOCX/XLSX/PPTX conversion, and PDF
  export from each native editor. Basic DOCX page setup, headers, footers,
  numbering, and explicit breaks round-trip, while XLSX filters, frozen panes,
  hyperlinks, named ranges, print areas, common validation rules, and common
  conditional formats including standard icon sets, legacy cell comments, sheet
  protection, and passwordless editable ranges are preserved; conditional
  formats remain editable and render deterministically in the spreadsheet
  canvas and PDF output
- **Whole-System Agent Status**: On supported desktop sessions, use one native
  per-user, top-center Agent Island whenever a cooperating A3S task or a
  recognized coding-agent process is active. It shows lease-bounded
  parent/subagent state, attention/running/recent filters, direct-child progress,
  and larger inline HITL controls from cooperating local `a3s code` processes.
  Exact approval rows explain why input is required and accept a direct text
  reply; inferred Codex and other process rows remain clearly labeled and never
  receive controls. New actionable requests expand once without stealing focus,
  and any working evidence enables the diffuse multicolor breathing border.
  Centered MacBook notches are derived from native safe-area geometry and fused
  into a top-edge layout, while a dedicated handle supports manual placement
  without later recenter or expand/collapse snap-back.
- **Evidence-First Research**: Gather bounded local evidence and materialize
  source-backed Markdown and HTML reports
- **Scientific Capability Packages**: Reuse the independently versioned A3S
  Science catalog of scientific Skills, MCP data services, compute workflows,
  and research tooling
- **Isolated Workloads**: Run Linux OCI workloads through A3S Box's Docker-like
  MicroVM CLI on supported virtualization hosts
- **Reproducible Evaluation**: Bind a Task, packaged Candidate adapter, and
  task-owned Judge into an identity-bound Bench result
- **Typed Application Capabilities**: Automate Browser, native Office, and OCR domains through
  typed Rust, native CLI, standard MCP, and Skill surfaces
- **Composable Runtime Foundations**: Reuse provider-neutral execution, durable
  workflows, events, priority queues, memory, search, and typed SQL independently
- **Service Infrastructure**: Build modular async services with Boot, route AI
  traffic with Gateway, and operate the implemented portions of the self-hosted
  Cloud control plane
- **Safety and Observability Components**: Add eBPF-backed observation on
  supported Linux hosts and tiered runtime policy through Observer and Sentry
- **Native SDK and UI Components**: Embed A3S Code from Rust, Node.js, or Python,
  build terminal interfaces with TUI, or render native RSX applications with GUI

### Capability matrix

| Area | Primary project | Available capability | Boundary |
| --- | --- | --- | --- |
| Coding agent | A3S CLI, Code, TUI | Streaming TUI, workspace tools, sessions, context, memory, knowledge, local assets, subagents, and dynamic workflows | Model execution requires a configured provider or compatible account; remote OS actions require login |
| Browser workspace | A3S CLI, Code Web | Local task conversations, tool approval, context, configuration, Monaco editing, Git review, and session persistence | Requires a compatible built frontend; binds to `127.0.0.1` by default; do not expose workspace APIs without an authenticated gateway |
| Local command isolation | A3S CLI, Code | Managed SRT provider for routine workspace commands, with network denial, bounded filesystem access, scrubbed environment, timeout, streaming, and cancellation | Official CLI archives include the fixed support payload and require Node.js 20.11 or newer; source and Cargo installs may also need npm for development bootstrap |
| Research | A3S CLI, Code, Flow | `a3s code research` runs a bounded local retrieval-summary workflow and writes Markdown and HTML report artifacts | The explicit OS research mode is reserved but currently disabled; signed-in Runtime remains available to ordinary Code workflows |
| Scientific packages | A3S Science | First-party scientific Skills, MCP data services, compute workflows, and research tooling | Package contracts and release cadence are owned by the independent Science repository |
| Isolation | A3S Box | Docker-like lifecycle for Linux OCI workloads in per-workload MicroVMs | Requires a supported host and virtualization backend; CRI, TEE, and Windows paths retain platform-specific validation requirements |
| Evaluation | A3S Bench | Local Task/Candidate/Judge execution with immutable locks and results | The current local path requires Docker and produces `local_unofficial` results; official evaluation requires signed admission and matching Runtime evidence |
| Application automation | A3S Use | Built-in Browser, native Office, and local PP-OCRv6 domains plus ACL-declared external domains | Domain availability depends on installed runtime/model assets; external packages keep their native CLI, standard MCP, or Skill contracts |
| Search | A3S Search | Multi-engine aggregation, deduplication, consensus ranking, CLI output, and optional A3S Use browser rendering | Engines, proxies, and browser providers depend on network and local runtime availability |
| General execution | A3S Runtime | Immutable finite Task and long-running Service generations with capabilities, idempotent lifecycle, observations, logs, and exec contracts | Runtime defines contracts and managed durability; callers still choose and supply a concrete provider |
| Cloud control plane | A3S Cloud | Tenancy, PostgreSQL state, durable operations, node enrollment/control, observations, SSE, and a Web console | Foundation, node control, and digest-pinned OCI deployment are complete; reachability is in progress, while source workflows, control surfaces, assets, stateful resources, and multi-node scale remain planned |
| Services | A3S Boot, Gateway | Modular async services, typed providers, protocol pipelines, reverse proxying, streaming, middleware, and AI traffic controls | Optional transports, brokers, scaling executors, certificates, and external backends must be supplied and operated separately |
| Coordination and data | Flow, Event, Lane, Memory, ORM | Durable workflows, pluggable events, priority scheduling, agent memory, and typed SQL | Distributed stores and database drivers are feature- and backend-specific; an abstraction is not a claim that every backend is bundled |
| Privacy and safety | Power, Observer, Sentry | TEE-oriented inference, agent observability, and tiered runtime security controls | Hardware attestation, eBPF collection, and enforcement depend on host capabilities and explicit deployment configuration |

The matrix describes capabilities present in the current projects, not one
preconfigured deployment. Optional Cargo features expose integrations; external
brokers, databases, browsers, model providers, container engines, hypervisors,
and hardware still have to be available.

## Quick Start

### Install the CLI

Install the latest stable release on macOS or glibc Linux:

```bash
curl --proto '=https' --tlsv1.2 -LsSf \
  https://raw.githubusercontent.com/A3S-Lab/a3s/main/install.sh | sh
```

The Unix installer writes `a3s` to `~/.local/bin` by default. It does not edit
a shell profile unless explicitly requested. If that directory is not already
on `PATH`, follow the command printed by the installer or run:

```bash
export PATH="$HOME/.local/bin:$PATH"
a3s --version
```

Install on Windows x64 from PowerShell 5.1 or newer. The TLS setting also
protects the initial script download on older Windows PowerShell installations:

```powershell
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
irm https://raw.githubusercontent.com/A3S-Lab/a3s/main/install.ps1 | iex
```

The Windows installer writes to `%LOCALAPPDATA%\Programs\a3s\bin` by default
and prints the exact `PATH` instruction when needed. Persisting `PATH` is opt-in
on both platforms:

```bash
curl --proto '=https' --tlsv1.2 -LsSf \
  https://raw.githubusercontent.com/A3S-Lab/a3s/main/install.sh | A3S_MODIFY_PATH=1 sh
```

```powershell
$env:A3S_MODIFY_PATH = '1'
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
irm https://raw.githubusercontent.com/A3S-Lab/a3s/main/install.ps1 | iex
```

Both installers:

- resolve `latest` or an exact stable `vX.Y.Z` release from
  [`A3S-Lab/CLI`](https://github.com/A3S-Lab/CLI/releases);
- require one exact asset for the detected operating system and architecture;
- verify the asset against GitHub's SHA-256 release digest;
- reject unexpected, duplicate, linked, or traversal archive entries;
- verify the staged binary reports the requested version before activation;
- install the bundled Web workspace into the CLI's versioned data cache; and
- preserve the previous binary and Web cache if activation cannot complete.

The default installation paths require neither `sudo` nor an administrator
session. Supported overrides are `A3S_VERSION`, `A3S_INSTALL_DIR`,
`A3S_DATA_HOME`, `A3S_MODIFY_PATH`, and `A3S_GITHUB_TOKEN`. Downloaded scripts
also accept normal arguments:

```bash
sh install.sh --version v0.9.8 --install-dir /absolute/path/to/bin
```

```powershell
.\install.ps1 -Version v0.9.8 -InstallDir C:\Tools\A3S\bin -ModifyPath
```

Homebrew remains available on macOS and Linux:

```bash
brew install a3s-lab/tap/a3s
```

Homebrew and the one-command installers include the matching Web workspace.
`cargo install a3s` installs only the binary; the first allowed `a3s web`
startup downloads and verifies its exact-version Web asset. On macOS and Linux,
use `a3s self update` for a standalone CLI. On Windows, rerun the installer to
upgrade because in-place self-update is not yet supported there.

The release archives and Homebrew formula also install `a3s-webview` beside
`a3s`, which provides RemoteUI windows and the native Agent Island. A repository
checkout launched with `just code` builds the local WebView helper and injects
its absolute path automatically. Other source installations must also build the
helper from `crates/webview` or set `A3S_AGENT_ISLAND_BIN` to an installed
helper.

The Homebrew tap is released independently and can trail the CLI source tree.
The command reference below follows the current CLI source; check
`a3s --version` before relying on a newer command surface. A crates.io install
remains available for users who intentionally want the binary-only package:

```bash
cargo install a3s
```

Inspect the active paths and create a starter ACL configuration when needed:

```bash
a3s config path
a3s config init
a3s config validate
a3s model list
```

`a3s model list` combines models from the effective ACL configuration with
compatible account-backed sources discovered on the machine. Select a validated
source-qualified model with `a3s model use <provider>/<model>`.

### Use A3S Code

```bash
# Interactive terminal workspace.
a3s code

# Resume the newest or a selected saved session.
a3s code resume
a3s code resume <session-id>

# Run one non-interactive task.
a3s code exec "Summarize the public API and run its focused tests."

# Start the API without frontend assets, or supply a compatible Web build.
a3s web --api-only
a3s web --web-dir /path/to/web-assets
a3s web --web-dir /path/to/web-assets -d
a3s web status
a3s web logs
a3s web stop
```

On a normal TUI exit, the CLI saves the session and highlights the complete
`a3s code resume <session-id>` command when color output is enabled. Resuming
restores that session's selected model and credential source, effort profile,
execution mode (`default`, `plan`, or `auto`), and syntax theme. If exit
interrupted a durable `/goal`, the resumed TUI asks whether to `Resume goal` or
`Leave paused`; a paused goal can be continued later with `/goal resume`.

The TUI and Web host share A3S Code Core and its risk-aware tool guardrail, while
owning different presentation. In the TUI, Default mode runs workspace changes
and ordinary Bash inside the installed local process sandbox without repeated
approval; explicit boundary crossings enter HITL. Plan mode is strictly
read-only and stages its result behind an Approve, Revise, or Abandon boundary.
Auto mode never enters HITL. It executes only operations that remain inside the
active boundary; host escalation, missing-sandbox Bash, and any unexpected
confirmation request, including a tool-owned request, are rejected before a
confirmation event is emitted. Permission and confirmation routing are frozen
when each run is admitted. Delegated, parallel, Skill, and background work keep
that exact snapshot even after the composer advances to another mode.

Official CLI archives carry the exact local process-sandbox support tree. The
CLI verifies its fixed package identity, version, registry lock, file types,
size bounds, and compiled complete-tree digest before use, then pins the
Node.js 20.11-or-newer executable selected for that Code process. Offline mode
and `A3S_NO_AUTO_INSTALL=1` can use this payload without mutation. Existing
user-wide managed installations remain reusable only after their receipt and
complete tree verify. Source and Cargo installations without the release
payload may use a fixed npm bootstrap when first-use mutation is allowed;
lifecycle scripts remain disabled and every registry URL and integrity value
is pinned. A global `srt` installation is neither required nor selected. If no
verified boundary is available, Default may ask for one exact host Bash
invocation while Auto denies Bash. The boundary hides existing `.env*` files at
every source-tree depth and read/write-masks pre-existing multi-link source
files so a workspace hardlink cannot alias data outside the governed tree.
The TUI applies the corresponding Core credential policy to in-process file
tools as well: direct and range reads, writes, edits, patches, and both
manifest-backed and fallback grep cannot bypass the command boundary.
Explicit sensitive targets fail closed, broad grep filters denied files, and
ordinary package-store hardlinks remain usable unless they alias a discovered
credential inode. Read-only Git diff regenerates output only for allowed
changed paths; option-like revisions cannot become Git flags, and displayed
remotes omit embedded HTTP credentials and query tokens.

Queued turns retain the execution mode captured at submission. `/queue`
inspects those pending turns and can send the exact selected row now, remove
one row, or explicitly confirm clearing the queue without losing attachments,
Plan state, or untouched Lane ordering.
Memory evolution accepts only validated, LLM-authored reuse signals rather
than promoting ordinary memories through keyword matching. Repeated,
conflict-free evidence can materialize a versioned local Preference, Skill, or
OKF asset after strict maturity thresholds. Preferences enter bounded promp…787 tokens truncated…io and async-std"

# Enforce offline, workspace-only evidence.
a3s code research --local-only "Map this repository's release process"
```

`research` is the canonical command; `deepresearch` and `deep-research` remain
aliases. The command produces report artifacts instead of treating raw retrieval
output as the final result. `--web` and `--local-only` select the evidence
boundary explicitly; the retired `--runtime`, `--local`, and `--os` routes are
rejected. Web research uses native AnySearch and Tavily discovery with
DuckDuckGo, then admits only fetched source text into its closed evidence
ledger. Provider ranking, snippets, and dates remain discovery metadata.

### Manage optional products

```bash
# Inspect the component catalog and installation health.
a3s list
a3s doctor

# Box installs automatically on first supported use; it can also be prepared.
a3s install box
a3s box ps

# Bench and Search require an explicit install.
a3s install bench
a3s install search

# Run the browser Code workspace when compatible assets are available.
a3s web

# Manage the A3S Use parent or one delegated domain explicitly.
a3s install use
a3s upgrade use
a3s uninstall use/office

# Bench runs the short conformance Task through a packaged Candidate adapter.
a3s bench list
a3s bench run quick_file_edit --agent <candidate-adapter>
a3s bench result

# Search delegates its arguments to the installed A3S Search product.
a3s search "rust async" --engines ddg,wiki --limit 5

# Inspect Use without invoking its auto-installing product proxy.
a3s info use --sources
a3s doctor use

# Request the GitHub release source when a compatible asset is published.
a3s install use --source release

# Run Use commands only after `a3s doctor use` reports Ready.
a3s use capabilities --json
a3s use browser doctor
a3s use office doctor
a3s use ocr doctor --json
a3s install use/ocr

# Delegated catalog inspection includes the built-in OCR route.
a3s info use/ocr --sources
a3s doctor use/ocr

# Stateful Browser sessions then use its authenticated loopback MCP service.
a3s use browser open https://example.com --session research
a3s use browser snapshot --session research --json
a3s use browser close --session research

# A ready Use parent manages provider runtimes through delegated component IDs.
a3s install use/browser
a3s install use/office

# External Use packages come from an explicitly pinned TUF registry.
a3s registry add https://packages.example.org/a3s/ \
  --trust-root ./root.json \
  --yes
a3s registry refresh packages
a3s --output json install use/a3s/science --dry-run
a3s --output json install use/a3s/science \
  --plan-digest <reviewed-plan-sha256>
a3s --output json upgrade use/a3s/science --dry-run
a3s --output json upgrade use/a3s/science \
  --plan-digest <reviewed-upgrade-sha256>

# List upgrades, apply eligible component upgrades, and check the CLI itself.
a3s upgrade
a3s upgrade --all --yes
a3s self update --check
```

`a3s list` is read-only. Mutation commands resolve typed component IDs from
trusted catalogs, verify provenance, and modify only component-owned files;
they are not general package managers for arbitrary macOS, Linux, or Windows
ecosystems. Use `a3s self update` for the umbrella CLI itself. Managed component
installation and runtime support currently target macOS and Linux; Windows
remains a compile/package preview until its lifecycle and persistent Browser
session gates pass.

The catalog marks Box and Use for first-use installation, but this is an install
attempt rather than an availability guarantee. Component releases and matching
host assets must exist. A Homebrew-managed umbrella CLI selects a catalogued
formula before the GitHub release source; this repository's current tap snapshot
does not contain an `a3s-use` formula. Until one is published, request
`--source release` only when the owning Use project provides a compatible asset,
or follow that project's installation instructions. Set `A3S_NO_AUTO_INSTALL=1`
or `A3S_OFFLINE=1` to prevent product proxy commands from attempting a first-use
install.

Browser, native Office, and OCR are built-in A3S Use domains. Before terminal
takeover, `a3s code` reuses a healthy Use installation or installs its verified
release when networking and automatic setup are allowed. `--offline`,
`A3S_OFFLINE=1`, and `A3S_NO_AUTO_INSTALL=1` remain strict zero-network,
zero-receipt boundaries, and setup failure never prevents Code from starting.
External domains retain ACL-declared native CLI, standard MCP, and/or `SKILL.md`
surfaces; Use does not introduce a custom extension protocol. Search depends on
the typed `a3s-use-browser` library instead of owning another browser runtime.

When Code delegates to the restricted `use` worker, TUI and Web project standard
child-tool metadata into a first-class capability identity. A Browser route
appears as `Using Browser` / `Used Browser` in the terminal and `Use · Browser`
in Web; multiple routes stay ordered and deduplicated, and restored task
snapshots preserve the same identity. This is presentation over the existing
subagent event stream, not another transport.

A component install prepares the product binary or delegates to the owning
component. It does not make external services, browser engines, Office runtimes,
Docker, or virtualization support appear on an incompatible host.
Signed extension dry-runs verify TUF metadata without downloading the target;
apply binds both the umbrella component plan and the exact registry target
before activation. Upgrade restores the registry identity and channel from the
installed signed receipt, rejects trust-root drift and version downgrades, and
includes newer signed targets in `a3s upgrade` listings while avoiding download
of an already installed target. Local development archives remain a separate
explicit `--from ... --allow-unsigned` path and cannot impersonate registry
trust.

### Optional A3S OS login

```bash
a3s auth list
a3s auth status os
a3s auth login os
a3s model list
```

The top-level authentication command currently manages the A3S OS session.
Signed-out Code remains useful for local files, tools, memory, knowledge,
subagents, and workflows. Signing in adds only the OS-backed capabilities exposed
by the selected command, such as remote asset lifecycle, Runtime batches,
service activity, or authenticated RemoteUI views.

## Platform Model

### Product entry points

The umbrella CLI owns configuration, authentication, component discovery, and
command routing. Domain-specific behavior remains in the product that implements
it:

```text
user
  |
  v
`a3s` CLI
  |-- code ------> A3S Code Core + A3S TUI
  |-- web -------> A3S Code API + supplied frontend assets
  |-- box -------> managed A3S Box product
  |-- bench -----> managed A3S Bench product
  |-- search ----> managed A3S Search product
  |-- use -------> A3S Use product proxy
  `-- auth / model / config / component lifecycle
```

Code is bundled with the CLI. Box, Bench, Search, and Use have independent owning
repositories and entries in the component catalog; a catalog entry describes
discovery and installation policy, not proof that every release channel currently
contains a compatible artifact. Browser, native Office, and OCR are Use domains.
The Code TUI may first-use install the verified Use release before terminal
takeover. Browser runtime and pinned PP-OCRv6 model preparation remain owned by
Use rather than adding a second umbrella-CLI protocol; OCR inference stays local
through ONNX Runtime.

### Agent sessions

A3S Code separates resolved agent capabilities from workspace-bound session
state:

```text
ACL configuration + model/MCP adapters + typed providers
                         |
                         v
                       Agent
                         |
                         v
                  workspace session
                         |
          tools / policy / context / memory
                         |
                         v
             streamed, persisted AgentEvents
```

Hosts choose which tools, stores, providers, security policies, delegation, and
dynamic workflows to register. Having a Core type available does not implicitly
enable it in every session.

### Runtime units

A3S Runtime is the common execution boundary used by applications that need
provider-neutral lifecycle semantics:

```text
caller policy and durable workflow
              |
              v
   Runtime Task or Service generation
              |
              v
 managed validation and durable receipts
              |
              v
 selected provider driver and infrastructure
```

The Runtime contract does not schedule workloads or silently select a provider.
Cloud, Bench, or another caller owns that policy. A driver owns integration with
its actual local, container, sandbox, or remote execution system.

### Configuration and extensions

A3S product configuration uses the A3S Agent Configuration Language and the
`a3s-acl` parser. Product extensions retain typed or standard boundaries:
Runtime providers implement Rust contracts, Event and storage backends implement
their provider traits, Use extensions declare native CLI/MCP/Skill surfaces, and
AHP transports agent supervision without tying the protocol to one transport.

## Projects

The repository does not maintain one root package version. Release-bearing
projects publish on their owning cadence; the owning manifest, changelog, and
local README are the source of truth for release numbers and detailed support
status. A directory being present here does not imply that it shares the CLI's
version or release channel.

### Products and applications

| Project | Role |
| --- | --- |
| [A3S CLI](crates/cli/) | Umbrella `a3s` command, A3S Code TUI host, local Web API, account/model configuration, and component lifecycle |
| [A3S Code](crates/code/) | Governed async agent runtime with Rust Core plus Node.js and Python native SDKs |
| [A3S Web](apps/web/) | Local Code and Work browser products with task conversations, Monaco editing, file management, AI-assisted Office editors, and locally supplied assets |
| [A3S Windhole](apps/windhole/) | Local React and Three.js wind-tunnel laboratory covering the complete A3S Bench catalog, run, result, validation, Doctor, and lock workflows through a loopback CLI bridge |
| [A3S Box](crates/box/) | Docker-like MicroVM runtime for Linux OCI workloads, with host-specific isolation and integration paths |
| [A3S Bench](crates/bench/) | Reproducible evaluation of packaged Candidates against immutable Tasks and task-owned Judges |
| [A3S Search](crates/search/) | Embeddable and command-line meta-search with ranking, deduplication, proxies, and optional browser rendering |
| [A3S Use](crates/use/) | Typed Browser, native Office, OCR, external application, and standard MCP capability host |
| [A3S Science](packages/science/) | Independently versioned scientific Skills, MCP data services, compute workflows, and research tooling |
| [A3S Cloud](apps/cloud/) | Self-hosted control plane for desired state, durable operations, outbound-managed Runtime nodes, and verified OCI deployment; reachability is in progress, with source delivery, developer workflows, automation surfaces, assets, stateful resources, and multi-node scale planned |
| [Documentation](apps/docs/) | Next.js documentation, tutorials, and project reference site |

### Runtime, coordination, and data

| Project | Role |
| --- | --- |
| [A3S Runtime](crates/runtime/) | Provider-neutral finite Task and long-running Service contract, managed durability, and provider conformance support |
| [A3S Flow](crates/flow/) | Event-sourced durable workflow engine with replay-safe steps, waits, hooks, retries, workers, and optional SQL stores |
| [A3S Event](crates/event/) | Provider-neutral event publish, subscribe, history, and persistence with in-memory and optional NATS support |
| [A3S Lane](crates/lane/) | Priority-lane async command scheduling with bounded concurrency, retry, observability, and optional Redis jobs |
| [A3S Memory](crates/memory/) | Pluggable memory storage for agents with optional SQLite full-text and vector search |
| [A3S ORM](crates/orm/) | Immutable, parameterized, type-safe SQL builder with async SQLite and PostgreSQL drivers and compile-only MySQL generation |
| [A3S Common](crates/common/) | Shared privacy, tool, transport, and protocol primitives used by local A3S crates |

### Services and protocols

| Project | Role |
| --- | --- |
| [A3S Boot](crates/boot/) | Adapter-first modular async service framework with typed providers, protocol pipelines, HTTP/WebSocket, and optional transports |
| [A3S Gateway](crates/gateway/) | AI-oriented reverse proxy with streaming, routing, middleware, traffic controls, and scale-to-zero integration |
| [A3S Power](crates/power/) | Privacy-preserving LLM inference components for TEE-oriented environments and supported inference backends |
| [A3S AHP](crates/ahp/) | Transport-neutral Agent Harness Protocol supervision primitives with optional network transports |
| [A3S ACL](crates/acl/) | Parser for the A3S Agent Configuration Language |

### Interfaces, safety, and distribution

| Project | Role |
| --- | --- |
| [A3S TUI](crates/tui/) | TEA-style terminal UI framework with optional Markdown and syntax highlighting |
| [A3S GUI](crates/gui/) | Browser-free native RSX and reducer runtime with platform and headless hosts |
| [A3S WebView](crates/webview/) | Native helper for authenticated RemoteUI windows and the always-on-top Agent Island, with platform WebView dependencies |
| [A3S Observer](crates/observer/) | Language-neutral observation model plus Linux eBPF collector components for agent activity |
| [A3S Sentry](crates/sentry/) | Tiered rule, model, and agent runtime security control built around observed activity |
| [A3S Updater](crates/updater/) | GitHub Releases self-update support used by A3S CLI binaries |
| [Homebrew Tap](homebrew-tap/) | Formulae for published A3S command-line products and helpers |

## Architecture

A3S is a collection of composable boundaries rather than a mandatory vertical
stack:

```text
terminal / browser / Rust SDK / Node.js / Python
                       |
          product hosts and control planes
   (CLI, Code Web, Bench, Science, Cloud, services)
                       |
       +---------------+----------------+
       |               |                |
       v               v                v
 governed agents   durable state    service traffic
   A3S Code       Flow/Event/Lane   Boot/Gateway
       |           Memory/ORM            |
       +---------------+----------------+
                       |
              Runtime contracts
                       |
       concrete providers and infrastructure
       (process, container, MicroVM, remote)
```

This diagram shows common composition points, not a dependency claim. For
example, Runtime intentionally leaves provider selection to its caller, Boot can
be used without Cloud, Flow can use an in-memory store without Event, and each
product documents which optional integrations it actually enables.

The main architectural boundaries are:

1. **Hosts own policy**: the CLI, Web application, Bench, and Cloud decide which
   models, tools, providers, permissions, and workflows are active.
2. **Core contracts stay replaceable**: Runtime drivers, event providers, memory
   stores, SQL executors, HTTP adapters, and application providers use explicit
   interfaces.
3. **Durable systems persist identity before relying on process memory**: Code
   sessions, Flow runs, Runtime units, Bench locks/results, and Cloud operations
   each define their own durable record.
4. **External capability remains explicit**: OS login, brokers, databases,
   browsers, container engines, hypervisors, TEE hardware, and model credentials
   are operational dependencies, not hidden defaults.
5. **Local execution separates policy from enforcement**: Code owns permission
   and confirmation routing, the managed SRT provider enforces routine local
   command boundaries, Runtime owns durable Task and Service lifecycle and
   placement, and Box owns OCI and stronger-isolation workloads.

## Development

Clone a committed repository snapshot with its registered submodules. Git
requires the root commit's `.gitmodules` entries and gitlink paths to describe
the same snapshot:

```bash
git clone --recurse-submodules git@github.com:A3S-Lab/a3s.git
cd a3s

# For an existing checkout.
git submodule update --init --recursive

# Verify the exact Cloud integration stack and contract fixtures.
just cloud-stack-check

# Run A3S Code from source.
just code

# Run the default development surface.
just dev

# Build and run the browser Code workspace.
just web

# Exercise real Use hot-plug and release-shaped Code first-use.
just use-hotplug-e2e

# Run the A3S Box desktop client.
just box

# Test the GUI runtime and RSX support.
cd crates/gui
cargo test
```

If Git reports that a submodule path has no mapping, do not delete or re-add the
component blindly. First check whether the root checkout mixes `.gitmodules`
from one revision with gitlinks from another, or whether a submodule migration
is still in progress. Check out a consistent root revision or complete that
migration before retrying the recursive update. This repository's current
development commands assume a consistent committed snapshot, not partially
applied submodule metadata.

The root `justfile` orchestrates common development entry points:

```bash
just code   # build the local island helper, then run Code; the island appears when agent work is detected
just docs   # start the documentation site
just windhole # start the local A3S Bench visual laboratory
just use-hotplug-e2e # verify real Use hot-plug plus release-shaped Code first-use
```

Install app-local JavaScript dependencies before running application recipes.
Platform-specific products may require additional toolchains, system libraries,
container engines, brokers, databases, or virtualization support; follow the
owning project's README.

The repository root is not a Cargo workspace. Do not run root-level Cargo
commands expecting them to validate every project. A typical Rust project check
starts in the owning crate or submodule:

```bash
cd crates/<project>
cargo fmt --all -- --check
cargo test --all-targets
cargo clippy --all-targets -- -D warnings
```

Use the project's documented feature flags and platform checks where they differ.
The root repository directly tracks the `apps/web/` development project. Use its
package scripts, or the root recipe, for Web changes:

```bash
cd apps/web
bun run format:check
bun run lint:check
bun run typecheck
bun run test
bun run build

cd ../..
just web
```

Projects registered in `.gitmodules` and the root repository have separate Git
histories. Commit a registered component's code in its own repository first,
then update the corresponding gitlink in this repository. Shared crates and
applications tracked directly by the root repository do not use that two-commit
flow. In either case, do not combine unrelated component changes into a root
documentation update.

Applications under `apps/` use app-local workflows. The root `justfile` only
orchestrates common entry points such as `just code`, `just dev`, `just web`,
`just use-hotplug-e2e`, and `just cloud-stack-check`.

Installer validation is self-contained and does not build the Rust stack:

```bash
bash scripts/test-install.sh
```

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/test-install.ps1
```

Cloud integration revisions and protocol levels are recorded in
`compat/cloud-stack.acl`. Update a component gitlink, its exact Cargo dependency,
and the ACL lock entry together; its verifier rejects missing, dirty, or
mismatched inputs before the cross-repository contract gate runs.

## Documentation

Full documentation and tutorials:
[a3s-lab.github.io/a3s](https://a3s-lab.github.io/a3s/).

Each project README records its detailed API, feature flags, platform
requirements, verification commands, and remaining limitations.

## Community

Questions and discussion: [Discord](https://discord.gg/XVg6Hu6H).

## License

This repository is licensed under the [MIT License](LICENSE). Independently
versioned projects retain the license declared in their own repository.

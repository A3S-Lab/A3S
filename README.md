# A3S

<p align="center">
  <strong>Rust-Native Platform for Coding Agents, Isolated Execution, and Reproducible Evaluation</strong>
</p>

<p align="center">
  <em>One CLI for agent coding surfaces, trusted capabilities, component lifecycle, runtime isolation, workflows, memory, and operations</em>
</p>

<p align="center">
  <a href="#overview">Overview</a> •
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#projects">Projects</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#development">Development</a>
</p>

---

## Overview

**A3S** is the orchestration repository for A3S Code, A3S Box, A3S Cloud,
A3S Bench, A3S Science, and the independent Rust-first components behind them.
Applications live under `apps/`, first-party product packages live under
`packages/`, and most independently versioned component crates are git
submodules. `crates/common` and `crates/updater` are root-owned shared crates.

The `a3s` command is the unified product entrypoint. `a3s code` starts the
terminal coding agent, `a3s web` starts its browser workspace, `a3s box`
manages isolated Linux workloads, `a3s bench` runs reproducible evaluations,
and `a3s use` exposes Browser, native Office, OCR, and installed Use
extensions. The same CLI owns a typed, provenance-checked component lifecycle
through `list`, `install`, `upgrade`, and `uninstall`.

Local Code, Runtime, provider/model, and Bench workflows do not require an
A3S OS login. A selected remote capability can still require its own account,
network, or host entitlement.

This repository root is intentionally not a Rust workspace or a JavaScript UI
runtime. Each project keeps its own build, test, release, and compatibility
boundary.

### Basic usage

```bash
# Start the terminal coding agent in the current project.
a3s code

# Start the local browser workspace.
a3s web

# Inspect the trusted catalog and local component state.
a3s list
```

## Features

- **Unified product CLI**: One `a3s` entrypoint for Code, Web, Box, Bench,
  Use, accounts, models, and managed components
- **Terminal and browser coding surfaces**: A shared Rust agent runtime behind
  an interactive TUI and a local Web workspace
- **Explicit execution isolation**: Provider-neutral Runtime contracts and
  A3S Box MicroVM/Sandbox backends with documented security boundaries
- **Reproducible evaluation**: Versioned Bench tasks, candidate adapters,
  judges, artifacts, and admission evidence
- **Trusted local capabilities**: Browser, native Office, and OCR domains plus
  ACL-declared native CLI, standard MCP, and `SKILL.md` extensions
- **Durable coordination**: Memory, events, workflows, queues, typed
  persistence, observability, and runtime safety components
- **Verified component lifecycle**: Exact release targets, SHA-256 integrity,
  staged activation, receipts, ownership boundaries, and explicit upgrades
- **Independent Rust modules**: Components evolve and release separately while
  the root repository records compatible integration snapshots

### Capability matrix

| Area | Current capability | Status and boundary |
| --- | --- | --- |
| CLI installation | One-command installers select and verify release archives for macOS ARM64/x64, GNU/Linux ARM64/x64, and Windows x64 | Linux assets require glibc. musl Linux, Windows ARM64, and 32-bit hosts have no published CLI asset. |
| A3S Code | Terminal and local browser workspaces, account/model routing, tools, sessions, memory, and local Runtime workflows | Local use does not require A3S OS login. A configured remote model or capability can require credentials. |
| Managed components | Read-only discovery plus typed install, upgrade, uninstall, and repair for registered A3S components | macOS and Linux remain the broad lifecycle targets. Windows x64 has validated Code first-use, WebView, and selected Use paths; advanced Browser sessions and full file-lock conformance remain preview work. |
| A3S Use | Built-in Browser, native Office, and OCR domains with external extension surfaces | `--offline`, `A3S_OFFLINE=1`, and `A3S_NO_AUTO_INSTALL=1` are strict no-download boundaries. |
| A3S Box | Docker-like lifecycle for Linux OCI workloads through explicit MicroVM and Sandbox isolation classes | Host requirements and maturity vary by backend and operating system; see the [A3S Box capability matrix](crates/box/README.md#capability-matrix). |
| A3S Bench | Local conformance and long-horizon task/judge adapters with durable result artifacts | Published Bench targets currently cover macOS ARM64 and GNU/Linux x64. Local results are `local_unofficial`; official evaluation additionally requires signed component and Task admission plus matching Runtime evidence. |
| A3S Science | First-party scientific Skills, MCP data services, compute workflows, and research tooling under `packages/science` | Package contracts and release cadence are owned by the independent Science repository. |
| A3S Cloud | Locked component revisions, package versions, ownership, protocols, and contract fixtures | `compat/cloud-stack.acl` is authoritative; a compatibility change is incomplete until the lock verifier and Cloud contract gates pass. |

## Quick Start

### Installation

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

The Windows installer writes to
`%LOCALAPPDATA%\Programs\a3s\bin` by default and prints the exact `PATH`
instruction when needed. Persisting `PATH` is opt-in on both platforms:

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

### Start coding

```bash
# Work in the current directory.
a3s code

# Or serve the browser workspace.
a3s web
```

On first launch, Code creates the user configuration it needs. Interactive
Code startup can also prepare verified native helpers when networking and
automatic setup are allowed; a helper failure does not prevent Code from
starting.

### Manage components

```bash
# Discovery is read-only.
a3s list

# Mutations accept registered, typed component IDs.
a3s install use
a3s upgrade use
a3s uninstall use/office

# Update only the umbrella CLI and included Code surface.
a3s self update
```

These commands manage component-owned A3S files. They are not general
frontends for Homebrew, APT, DNF, Pacman, Winget, npm, pip, Cargo, or arbitrary
package names.

### Use Browser, Office, and OCR

```bash
a3s use browser render https://example.com
a3s use office doctor --json
a3s use ocr doctor --json
```

Before terminal takeover, `a3s code` reuses a healthy Use installation or
prepares its verified release when policy permits. External domains remain
independently implementable through ACL-declared native CLI, standard MCP,
and/or `SKILL.md` surfaces; A3S Use does not add a custom extension protocol.

### Choose an account and model

```bash
a3s auth login os               # A3S OS browser OAuth
a3s auth list                   # Managed and discovered account status
a3s model list                  # Configured and account-backed models
a3s model use codex/<model>     # Persist the A3S Code model route
```

Account-provider credentials are not copied into `config.acl`.

### Run a Bench task

```bash
a3s install bench
a3s bench list
a3s bench run quick_file_edit --agent <candidate-adapter>
a3s bench result
```

Docker is required for the current local execution path and is the signed-out
default. Review the resulting admission and Runtime evidence before comparing
a local run with an official result.
The published Bench component currently supports macOS ARM64 and GNU/Linux
x64; other CLI platforms cannot run this Quick Start yet.

## Projects

| Project | Path | Role |
| --- | --- | --- |
| A3S CLI | [`crates/cli`](crates/cli/) | Unified end-user CLI, Code entrypoint, accounts/models, and typed component lifecycle |
| A3S Code | [`crates/code`](crates/code/) | Rust agent runtime plus Node and Python SDK bindings |
| A3S Box | [`crates/box`](crates/box/) | MicroVM/Sandbox runtime for Linux OCI workloads |
| A3S Desktop | [`apps/desktop`](apps/desktop/) | Native desktop surface for A3S Code |
| A3S Web | [`apps/web`](apps/web/) | Browser workspace served by the local CLI |
| A3S Cloud | [`apps/cloud`](apps/cloud/) | Multi-tenant control plane, node agent, and versioned Cloud contracts |
| A3S Docs | [`apps/docs`](apps/docs/) | Documentation site and tutorials |
| A3S Science | [`packages/science`](packages/science/) | Scientific Skills, MCP data services, compute workflows, and research tooling |

The project table intentionally does not duplicate release versions. For
submodule-backed projects, each component manifest and release repository is
the source of truth and the root gitlink records the integration snapshot.
Root-owned applications and shared crates follow the root repository revision.

## Architecture

Every product surface enters through the same CLI and typed component model,
then delegates to independently versioned runtime modules:

```text
Terminal / Web / Desktop / automation
                 │
              a3s CLI
       Code · Box · Bench · Use
                 │
     ┌───────────┼────────────┐
     │           │            │
 agent core   Runtime      capabilities
 AHP / ACL    Box / Flow   Browser / Office / OCR
     │           │            │
 memory · events · lanes · ORM · observer · sentry
                 │
       boot · gateway · power · Cloud
```

Main repository areas:

| Area | Paths | Responsibility |
| --- | --- | --- |
| Product surfaces | `crates/cli`, `crates/code`, `crates/box`, `apps/desktop`, `apps/web`, `apps/cloud` | User-facing coding, isolation, and control-plane products |
| Capability packages | `packages/science` | First-party scientific Skills, MCP data services, compute workflows, and research tooling |
| Agent contracts | `crates/ahp`, `crates/acl`, `crates/common` | Supervision, bounded configuration and schema admission, canonical digests, protocol, and shared types |
| UI systems | `crates/tui`, `crates/gui`, `crates/webview` | Terminal UI, native RSX UI, and trusted WebView helpers |
| Use and retrieval | `crates/use`, `crates/search` | Browser, native Office, OCR, extensions, and search |
| State and coordination | `crates/memory`, `crates/event`, `crates/flow`, `crates/lane`, `crates/orm` | Durable memory, events, workflows, queues, and persistence |
| Runtime safety | `crates/runtime`, `crates/observer`, `crates/sentry` | Provider-neutral execution, observability, and digest-bound workload policy control |
| Services | `crates/boot`, `crates/gateway`, `crates/power` | Service framework, ingress, and model serving |
| Distribution | `crates/updater`, `homebrew-tap`, `install.sh`, `install.ps1` | Verified updates and platform installation |

## Development

Clone all component repositories before working across the stack:

```bash
git clone --recurse-submodules git@github.com:A3S-Lab/a3s.git
cd a3s

# Or initialize an existing clone.
git submodule update --init --recursive
```

This repository root is orchestration-only. Do not run `cargo init`,
`cargo new`, `cargo fmt --all`, or `cargo test` from the root expecting one
workspace. Run Rust commands from the crate or application that owns the
change:

```bash
cd crates/<component>
cargo fmt --all -- --check
cargo test --all-targets
cargo clippy --all-targets -- -D warnings
```

Common root orchestration commands:

```bash
just code                 # Run A3S Code from source
just dev                  # Run the default native development surface
just web                  # Build and run the browser workspace
just use-hotplug-e2e      # Exercise real Use hot-plug and Code first-use
just cloud-stack-check    # Verify locked Cloud revisions and contracts
```

Installer validation is self-contained and does not build the Rust stack:

```bash
bash scripts/test-install.sh
```

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/test-install.ps1
```

Most component crates are submodules, so their code and root gitlinks are
committed in separate repositories. `crates/common` and `crates/updater`, along
with root-owned applications such as `apps/web` and `apps/docs`, are committed
in this repository. Never discard a dirty submodule while updating a root
snapshot.

Cloud integration revisions and protocol levels are recorded in
`compat/cloud-stack.acl`. Update a component gitlink, its exact Cargo
dependency, and the lock entry together, then run `just cloud-stack-check`
from a clean checkout with every locked submodule initialized.

## Documentation

Full reference and tutorials:
[a3s-lab.github.io/a3s](https://a3s-lab.github.io/a3s/).

## Community

Questions and discussion: [Discord](https://discord.gg/XVg6Hu6H).

## License

MIT. See [LICENSE](LICENSE).

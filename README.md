# A3S

<p align="center">
  <strong>Rust-native platform for coding agents, isolated execution, and reproducible evaluation.</strong>
</p>

<p align="center">
  <em>Agent runtime, terminal and native UI, memory, workflows, safety,
  service infrastructure, and release tooling maintained as independent
  components.</em>
</p>

---

## Overview

A3S is the orchestration repository for A3S Code, A3S Box, A3S Bench, and their
Rust-first platform components. Crates under `crates/` are independent git
submodules, and applications live under `apps/`.

The `a3s` command is the unified product entrypoint: `a3s code` launches the
interactive coding agent, `a3s box` manages isolated runtimes, `a3s bench` runs
reproducible evaluations, and `a3s use` exposes Browser, native Office, OCR,
and installed Use extensions. `a3s list`, `a3s install`, `a3s upgrade`, and
`a3s uninstall` provide one typed component lifecycle. Local Code, Runtime,
provider/model, and Bench workflows do not require an A3S OS login unless the
selected remote capability requires one.

The stack is intentionally not a root Rust workspace and not a JavaScript UI
runtime. Web and WebView packages are auxiliary surfaces; the core product path
is Rust.

## Repository Map

| Area | Paths | Purpose |
| --- | --- | --- |
| Product surfaces | `crates/cli`, `crates/bench`, `apps/web`, `apps/box`, `apps/cloud`, `apps/docs` | CLI, browser workspace, benchmark control component, native app, Cloud control plane, and documentation site. |
| Agent runtime | `crates/code`, `crates/ahp`, `crates/acl`, `crates/common` | Sessions, tools, policy, protocol, config, and shared types. |
| UI systems | `crates/tui`, `crates/gui`, `crates/webview` | Terminal UI, native RSX UI, and trusted WebView helpers. |
| Use and retrieval | `crates/use`, `crates/search` | Browser, native Office, and OCR capability surfaces, external Use extensions, and search through the shared Browser runtime. |
| State and coordination | `crates/memory`, `crates/event`, `crates/flow`, `crates/lane`, `crates/orm` | Memory, events, workflows, queues, and typed persistence. |
| Runtime safety and operations | `crates/runtime`, `crates/box`, `crates/observer`, `crates/sentry` | Provider-neutral execution, isolation, observability, and runtime control. |
| Services | `crates/boot`, `crates/gateway`, `crates/power` | Service framework, ingress, and model serving. |
| Distribution | `crates/updater`, `homebrew-tap` | CLI self-update support and Homebrew formulae. |

## Projects

| Project | Version | Role |
| --- | --- | --- |
| [A3S Web](apps/web/) | 0.1.0 | Browser workspace for the A3S Code product, served by the local CLI. |
| [A3S Box Desktop](apps/box/) | 0.1.0 | Native A3S Box management client. |
| [A3S Cloud](apps/cloud/) | 0.1.0 | Multi-tenant control plane, node agent, and versioned Cloud contracts. |
| [a3s](crates/cli/) | 0.9.1 | End-user CLI and typed component-management entrypoint. |
| [a3s-code](crates/code/) | core and SDKs 5.3.1 | Rust agent runtime plus Node and Python SDK bindings. |
| [a3s-gui](crates/gui/) | 0.1.0 | Native GUI runtime with hooks, RSX templates, semantic UI, and platform hosts. |
| [a3s-tui](crates/tui/) | 0.1.10 | Terminal UI framework used by `a3s code`. |
| [a3s-flow](crates/flow/) | 0.4.1 | Durable workflow engine with event-sourced runs and replay. |
| [a3s-orm](crates/orm/) | 0.1.0 | Typed SQL, migrations, and PostgreSQL/SQLite persistence. |
| [a3s-memory](crates/memory/) | 0.1.2 | Pluggable long-term memory storage for agents. |
| [a3s-event](crates/event/) | 0.3.0 | Event subscription, dispatch, and persistence. |
| [a3s-lane](crates/lane/) | 0.5.0 | Rust-only priority and job queue with Redis, flows, repeat jobs, worker leases, retry, and DLQ. |
| [a3s-use](crates/use/) | 0.1.1 | Typed Browser, native Office, and OCR capability layer plus native CLI, standard MCP, and Skill extension surfaces. |
| [a3s-search](crates/search/) | 1.4.3 | Embeddable meta-search engine using `a3s-use-browser` for headless browsing. |
| [a3s-bench](crates/bench/) | 0.1.0 | Reproducible evaluation of coding agents, automated systems, and deterministic tools. |
| [a3s-runtime](crates/runtime/) | 0.2.0 | Provider-neutral execution contract and Runtime client. |
| [a3s-box](crates/box/) | 3.0.5 | Docker-like MicroVM runtime for Linux OCI workloads. |
| [a3s-observer](crates/observer/) | 0.11.0 | eBPF observability for LLM calls, tools, files, and egress. |
| [a3s-sentry](crates/sentry/) | 0.7.0 | Tiered runtime security control with staged L3 dispatch and incomplete-evidence safeguards. |
| [a3s-boot](crates/boot/) | 0.1.1 | Nest-inspired modular service framework for Rust APIs. |
| [a3s-gateway](crates/gateway/) | 1.0.12 | Reverse proxy, routing, middleware, streaming, and scale-to-zero. |
| [a3s-power](crates/power/) | 0.4.2 | Privacy-preserving LLM inference for TEE environments. |
| [a3s-ahp](crates/ahp/) | 2.4.0 | Agent Harness Protocol supervision primitives. |
| [a3s-acl](crates/acl/) | 0.2.2 | Agent Configuration Language parser. |
| [a3s-webview](crates/webview/) | 0.1.1 | Native trusted WebView popup helper. |
| [a3s-common](crates/common/) | 0.1.1 | Shared primitives and transport types. |
| [a3s-updater](crates/updater/) | 0.3.0 | Verified component transactions and self-update support for CLI binaries. |

## Quick Start

```bash
# Install the published CLI.
brew install a3s-lab/tap/a3s

# Run the terminal coding agent.
a3s code

# Run the browser Code workspace.
a3s web

# Inspect the trusted component catalog and local installation state.
a3s list

# Use the built-in Browser, native Office, and OCR domains.
a3s use browser render https://example.com
a3s use office doctor --json
a3s use ocr doctor --json

# Manage catalog components explicitly.
a3s install use
a3s upgrade use
a3s uninstall use/office
```

`a3s list` is read-only. The mutation commands resolve typed component IDs from
trusted catalogs, verify provenance, and modify only component-owned files;
they are not general package managers for arbitrary macOS, Linux, or Windows
ecosystems. Use `a3s self update` for the umbrella CLI itself.

Managed component installation and runtime support currently target macOS and
Linux. Windows remains a compile/package preview on the roadmap until its
managed lifecycle, file-locking, and persistent Browser session gates pass.

Browser, native Office, and OCR are built-in A3S Use domains. Before terminal
takeover, `a3s code` reuses a healthy Use installation or installs its verified
release when networking and automatic setup are allowed. `--offline`,
`A3S_OFFLINE=1`, and `A3S_NO_AUTO_INSTALL=1` remain strict zero-network,
zero-receipt boundaries, and setup failure never prevents Code from starting.
External domains remain independently implementable through ACL-declared native
CLI, standard MCP, and/or `SKILL.md` surfaces; A3S Use does not introduce a
custom JSON-RPC extension protocol. A3S Search depends directly on the typed
`a3s-use-browser` library rather than owning a second browser runtime.

When Code delegates to the restricted `use` worker, TUI and Web project the
standard child-tool metadata into a first-class capability identity. A Browser
route appears as `Using Browser` / `Used Browser` in the terminal and
`Use · Browser` in Web; multiple routes remain ordered and deduplicated, and
restored task snapshots preserve the same identity. This is presentation over
the existing subagent event stream, not another transport.

Manage account-owned and configured model routes without copying Claude Code,
Codex, or A3S OS credentials into `config.acl`:

```bash
a3s login                         # A3S OS browser OAuth
a3s account list                  # Claude Code, Codex, and A3S OS status
a3s model list                    # config.acl plus signed-in account models
a3s model use codex/<model>       # persist the A3S Code model route
```

Run the short Bench conformance task after installing the stable Bench control
component. Signed-out local execution defaults to Docker:

```bash
a3s bench list
a3s bench run quick_file_edit --agent <candidate-adapter>
a3s bench result
```

Bench v0.1.0 packages one short conformance task and 51 locally runnable
long-horizon Task/Judge adapters. The long-horizon catalog is not a permanent
task boundary. Local runs remain `local_unofficial`; official evaluation also
requires signed Task admission and matching Runtime evidence.

Local development:

```bash
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

## Working In This Repository

This repository root is not a Rust workspace. Do not run `cargo init`,
`cargo new`, `cargo fmt --all`, or `cargo test` from the root expecting it to
cover every component. Run Rust commands from the crate or app directory that
owns the change.

Typical component workflow:

```bash
cd crates/<component>
cargo fmt --all
cargo test
cargo clippy --all-targets -- -D warnings
```

Crates are submodules, so component code and root submodule pointers are
committed separately:

```bash
cd crates/<component>
git add .
git commit -m "Describe component change"

cd ../..
git add crates/<component>
git commit -m "Update <component> snapshot"
```

Applications under `apps/` use app-local workflows. The root `justfile` only
orchestrates common entry points such as `just code`, `just dev`, `just web`,
`just use-hotplug-e2e`, and `just cloud-stack-check`.

Cloud integration revisions and protocol levels are recorded in
`compat/cloud-stack.acl`. Update that ACL lock and the corresponding gitlinks
together; its verifier rejects missing, dirty, or mismatched inputs before the
cross-repository contract gate runs.

## Documentation

Full reference and tutorials: [a3s-lab.github.io/a3s](https://a3s-lab.github.io/a3s/).

## Community

Questions and discussion: [Discord](https://discord.gg/XVg6Hu6H).

## License

MIT. See [LICENSE](LICENSE).

# A3S

<p align="center">
  <strong>Rust-native agent application stack for A3S Code.</strong>
</p>

<p align="center">
  <em>Agent runtime, TUI, native GUI, memory, safety controls, workflow
  primitives, services, and release tooling maintained as independent
  components.</em>
</p>

---

## Overview

A3S is the monorepo for A3S Code and the Rust-first infrastructure around it.
The root repository is for orchestration only: Rust crates under `crates/` are
independent git submodules, while applications live under `apps/`.

The primary product surface today is `a3s code`, the interactive terminal
coding agent. The native desktop direction is built with `a3s-gui`, Rust
function components, RSX view templates, and platform hosts for AppKit, GTK,
and WinUI.

The stack is intentionally not a root Rust workspace and not a browser or
JavaScript UI runtime. Web and WebView packages are auxiliary surfaces; the
core product path is Rust.

## Repository Map

| Area | Paths | Purpose |
| --- | --- | --- |
| Product surfaces | `crates/cli`, `apps/desktop`, `apps/box`, `apps/docs` | CLI, native desktop apps, and documentation site. |
| Agent runtime | `crates/code`, `crates/ahp`, `crates/acl`, `crates/common` | Sessions, tools, policy, protocol, config, and shared types. |
| UI systems | `crates/tui`, `crates/gui`, `crates/webview` | Terminal UI, native RSX UI, and trusted WebView helpers. |
| State and coordination | `crates/memory`, `crates/event`, `crates/flow`, `crates/lane`, `crates/search` | Memory, events, workflows, queues, and retrieval. |
| Runtime safety and operations | `crates/box`, `crates/observer`, `crates/sentry` | Isolation, observability, and runtime control. |
| Services | `crates/boot`, `crates/gateway`, `crates/power` | Nest-style service framework, ingress, and model serving. |
| Distribution | `crates/updater`, `homebrew-tap` | CLI self-update support and Homebrew formulae. |

## Projects

| Project | Version | Role |
| --- | --- | --- |
| [A3S Code Desktop](apps/desktop/) | 0.1.0 | Native desktop shell for A3S Code. |
| [A3S Box Desktop](apps/box/) | 0.1.0 | Native A3S Box management client built with `a3s-gui`. |
| [a3s](crates/cli/) | 0.7.5 | End-user CLI; `a3s code` launches the TUI coding agent. |
| [a3s-code](crates/code/) | core 4.3.1, SDKs 4.3.0 | Rust agent runtime plus Node and Python SDK bindings. |
| [a3s-gui](crates/gui/) | 0.1.0 | Native GUI runtime with `ComponentCx` hooks, RSX templates, semantic UI, and AppKit/GTK/WinUI hosts. |
| [a3s-tui](crates/tui/) | 0.1.6 | Terminal UI framework used by `a3s code`. |
| [a3s-flow](crates/flow/) | 0.4.1 | Durable workflow engine with event-sourced runs and replay. |
| [a3s-memory](crates/memory/) | 0.1.2 | Pluggable long-term memory storage for agents. |
| [a3s-event](crates/event/) | 0.3.0 | Event subscription, dispatch, and persistence. |
| [a3s-lane](crates/lane/) | 0.4.0 | Priority queues with concurrency, retry, and dead-letter support. |
| [a3s-search](crates/search/) | 1.3.0 | Embeddable meta-search engine with consensus ranking. |
| [a3s-box](crates/box/) | 3.0.4 | Docker-like MicroVM runtime for Linux OCI workloads. |
| [a3s-observer](crates/observer/) | 0.11.0 | eBPF observability for LLM calls, tools, files, and egress. |
| [a3s-sentry](crates/sentry/) | 0.6.0 | Tiered runtime security control. |
| [a3s-boot](crates/boot/) | 0.1.0 | Modular Rust web framework with Nest-style controllers, providers, route macros, SSE, events, scheduling, WebSockets, and transports. |
| [a3s-gateway](crates/gateway/) | 1.0.11 | Reverse proxy, routing, middleware, streaming, and scale-to-zero. |
| [a3s-power](crates/power/) | 0.4.2 | Privacy-preserving LLM inference for TEE environments. |
| [a3s-ahp](crates/ahp/) | 2.4.0 | Agent Harness Protocol supervision primitives. |
| [a3s-acl](crates/acl/) | 0.2.1 | Agent Configuration Language parser. |
| [a3s-webview](crates/webview/) | 0.1.1 | Native trusted WebView popup helper. |
| [a3s-common](crates/common/) | 0.1.1 | Shared primitives and transport types. |
| [a3s-updater](crates/updater/) | 0.2.0 | Self-update support for CLI binaries. |

## Quick Start

```bash
# Install the published CLI.
brew install a3s-lab/tap/a3s

# Run the terminal coding agent.
a3s code
```

Local development:

```bash
git submodule update --init --recursive

# Run A3S Code from source.
just code

# Run the native desktop app.
just dev

# Check the desktop app.
just desktop-check

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
orchestrates common entry points such as `just code`, `just dev`, and
`just desktop-check`.

## Current Focus

- Keep `a3s code` reliable as the production terminal surface.
- Build the native desktop shell on `a3s-gui`, Rust hooks, and RSX templates.
- Keep `a3s-boot` moving toward Nest.js-style framework ergonomics for Rust
  services while staying GraphQL-free.
- Keep runtime, memory, eventing, workflow, isolation, and safety crates aligned
  with A3S Code instead of drifting into unrelated product surfaces.

## Documentation

Full reference and tutorials: [a3s-lab.github.io/a3s](https://a3s-lab.github.io/a3s/).

## Community

Questions and discussion: [Discord](https://discord.gg/XVg6Hu6H).

## License

MIT. See [LICENSE](LICENSE).

# A3S

<p align="center">
  <strong>Infrastructure components for AI agent applications.</strong>
</p>

<p align="center">
  <em>Runtime, isolation, serving, routing, memory, observability, control, UI, and update
  packages maintained as independent Rust crates and SDKs.</em>
</p>

---

## Overview

A3S is a monorepo for A3S-Lab infrastructure components used to build,
package, run, observe, and control agent-based applications. The repository
root is an orchestration repository; each component under `crates/` is an
independent git submodule with its own build and release lifecycle.

The project is organized around these component groups:

| Area | Components |
|---|---|
| Agent runtime and SDKs | `a3s-code`, `a3s-flow`, `a3s-ahp`, `a3s-common` |
| Workload isolation | `a3s-box` |
| Model serving and ingress | `a3s-power`, `a3s-gateway` |
| State, retrieval, and scheduling | `a3s-memory`, `a3s-search`, `a3s-lane`, `a3s-event` |
| Observability and control | `a3s-observer`, `a3s-sentry`, `a3s-acl` |
| User interfaces | `a3s-tui`, `a3s-gui`, `a3s-webview` |
| Distribution | `a3s`, `a3s-updater`, `homebrew-tap` |

The `a3s` CLI packages selected components into an end-user command-line
application. `a3s code` launches an interactive terminal coding agent built on
`a3s-code` and `a3s-tui`.

## Architecture

```
   users / SDKs / services
              |
              v
        a3s-code                 a3s-gateway
   agent runtime and SDKs   ingress, routing, streaming
              |                         |
              |                         v
              |                  a3s-power
              |             model-serving endpoint
              |
              v
        a3s-box
   isolated workload runtime
              |
              v
        a3s-observer  --->  a3s-sentry
   eBPF telemetry        runtime control policy

   supporting libraries:
   a3s-flow, a3s-acl, a3s-ahp, a3s-event, a3s-memory, a3s-search,
   a3s-lane, a3s-common, a3s-tui, a3s-gui
```

Components communicate through typed APIs, protocol messages, or platform
adapters depending on the crate. The repository keeps these components separate
so each crate can be built, tested, versioned, and released independently.

## Projects

| Project | Version | Role |
|---|---|---|
| [a3s](crates/cli/) | 0.5.11 | Interactive terminal coding agent; `a3s code` launches the TUI. Prebuilt binaries for macOS, Linux, Windows |
| [a3s-code](crates/code/) | 4.1.0 | Harness-driven agent runtime: ACL config, tools, hooks, security policy, memory, MCP, structured output, planning, subagents, and pluggable workspaces. Rust core with Node/Python SDKs |
| [a3s-flow](crates/flow/) | 0.1.0 | Rust SDK and durable workflow engine core: event-sourced runs, replay, steps, waits, hooks, retries, and a Perry-style native TypeScript runtime boundary |
| [a3s-box](crates/box/) | 2.6.0 | Docker-like MicroVM runtime for Linux OCI workloads |
| [a3s-gateway](crates/gateway/) | 1.0.11 | Reverse proxy for routing, middleware, SSE streaming, scale-to-zero, and agent orchestration |
| [a3s-power](crates/power/) | 0.4.2 | Privacy-preserving LLM inference for TEE environments (OpenAI-compatible) |
| [a3s-search](crates/search/) | 1.3.0 | Embeddable meta-search engine with consensus ranking, CLI, and proxy pool |
| [a3s-lane](crates/lane/) | 0.4.0 | Lane-based priority queues with concurrency, retry, and dead-letter support |
| [a3s-memory](crates/memory/) | 0.1.1 | Pluggable long-term memory storage for agents |
| [a3s-observer](crates/observer/) | 0.11.0 | Language-agnostic eBPF observability (LLM calls, tools, files, egress) + opt-in kernel intervention |
| [a3s-sentry](crates/sentry/) | 0.6.0 | Tiered runtime security control using L1 rules, L2 LLM checks, and L3 agent review |
| [a3s-ahp](crates/ahp/) | 2.4.0 | Agent Harness Protocol for transport-agnostic supervision primitives |
| [a3s-acl](crates/acl/) | 0.2.1 | Agent Configuration Language (HCL-like parser) |
| [a3s-event](crates/event/) | 0.3.0 | Pluggable event subscription, dispatch, and persistence |
| [a3s-tui](crates/tui/) | 0.1.4 | TEA framework for terminal UIs with Flexbox layout |
| [a3s-gui](crates/gui/) | 0.1.0 | Native GUI runtime for structured UI protocol frames with AppKit, WinUI, and GTK targets |
| [a3s-webview](crates/webview/) | 0.1.1 | Native WebView popup helper for the a3s code TUI (RemoteUI); renders Shu'an OS viewUrls |
| [a3s-common](crates/common/) | 0.1.1 | Shared primitives and transport types |
| [a3s-updater](crates/updater/) | 0.2.0 | Self-update for CLI binaries via GitHub Releases |

## Quick start

```bash
# CLI: the interactive coding agent (`a3s code` launches the TUI)
brew install a3s-lab/tap/a3s
# or a prebuilt binary (macOS / Linux / Windows): https://github.com/A3S-Lab/Cli/releases/latest

# SDKs
npm install @a3s-lab/code        # Node.js
pip install a3s-code             # Python
cargo add a3s-code-core          # Rust
```

## Repository structure

```text
a3s/                            # monorepo root (NOT a Rust workspace)
├── apps/
│   ├── desktop/                # A3S Code desktop app (A3S GUI native shell, submodule)
│   └── docs/                   # documentation site
├── crates/                     # components, each its own git submodule
│   ├── cli/                    # a3s interactive coding-agent TUI
│   ├── code/                   # a3s-code agent runtime + SDKs
│   ├── flow/                   # a3s-flow Rust SDK and durable workflow engine
│   ├── box/                    # a3s-box MicroVM runtime
│   ├── power/                  # a3s-power LLM serving
│   ├── gateway/                # a3s-gateway reverse proxy / ingress
│   ├── observer/               # a3s-observer eBPF observability
│   ├── sentry/                 # a3s-sentry runtime security control
│   ├── search/ memory/ lane/   # retrieval, memory, scheduling
│   ├── acl/ ahp/ event/        # config, protocol, events
│   ├── common/ tui/ gui/       # shared types, terminal UI, native GUI
│   ├── updater/                # self-update
│   └── webview/                # a3s-webview native WebView popup (RemoteUI)
└── homebrew-tap/               # Homebrew formulae
```

Each crate lives in its own repository under the [A3S-Lab](https://github.com/A3S-Lab) org and is
vendored here as a submodule. Component-specific README files contain the build,
test, and usage details for each crate.

## Documentation

Full reference and tutorials: [a3s-lab.github.io/a3s](https://a3s-lab.github.io/a3s/).

## Community

Questions and discussion: [Discord](https://discord.gg/XVg6Hu6H).

## License

MIT. See [LICENSE](LICENSE).

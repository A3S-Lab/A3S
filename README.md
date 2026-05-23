# A3S

<p align="center">
  <strong>Agentic Adaptive Augmentation System</strong>
</p>

<p align="center">
  <em>An agent infrastructure stack: embeddable coding agents, VM-isolated execution, gateway/runtime components, and supporting libraries.</em>
</p>

---

## Overview

**A3S** is a monorepo for agent infrastructure. It contains an embeddable coding-agent runtime, a MicroVM runtime, a gateway, scheduling, memory, search, and LLM-serving components.

```text
a3s-code             <- harness-driven agent runtime (Rust + Node.js + Python SDKs)
a3s-box              <- Docker-like MicroVM runtime for Linux OCI workloads
a3s-gateway          <- application-agnostic ingress/reverse proxy layer
```

**a3s-code** is a coding-agent runtime library. It exposes ACL config, tools, hooks, security policy, memory, MCP, structured output (`generate_object`), explicit planning mode, run replay, QuickJS PTC, task delegation, automatic subagent delegation, and a pluggable workspace subsystem through runtime APIs and SDKs. v3.1 adds Claude Code-style built-in subagents (`explore`, `plan`, `general`, `verification`, `review`), native `.a3s/agents` custom-agent loading, and a global `auto_parallel` / `autoParallel` switch that disables automatic parallel fan-out while keeping manual `parallel_task` available. The v3 workspace stack includes local filesystem, S3-compatible object storage (with ETag CAS, opt-in degraded search, cost-bounded operations), and an HTTP/JSON `RemoteGitBackend` that keeps the `git` tool available on workspaces that have no `.git` directory. Failures surface as a typed `ToolErrorKind` discriminator (`version_conflict`, `not_found`, `timeout`, ...) end-to-end into Node and Python SDKs, so callers branch on `.type` instead of regex-matching messages.

**a3s-box** is a MicroVM runtime. Its local Docker-like CLI is the primary product surface. Kubernetes CRI, hardware TEE, and Windows paths are integration surfaces with explicit platform limits.

**a3s-gateway** is an application-agnostic reverse proxy with middleware, routing, and privacy features.

## Architecture

| Layer | Component | Role |
| --- | --- | --- |
| Agent Framework | a3s-code | Embeddable coding-agent runtime with Rust, Node.js, and Python SDKs |
| VM Runtime | a3s-box | MicroVM isolation, Docker-like CLI, OCI image lifecycle |
| Ingress | a3s-gateway | Reverse proxy with middleware and routing |
| Scheduling | a3s-lane | Per-session priority queues and retry/dead-letter behavior |
| Infrastructure | a3s-power / a3s-search | LLM inference and meta search |
| Libraries | a3s-acl / a3s-ahp / a3s-event / a3s-memory / a3s-common | Configuration, harness protocol, events, memory, shared types |

## Projects

| Project | Version | Description | Docs |
| --- | --- | --- | --- |
| [a3s-code](crates/code/) | 3.1.0 | Harness-driven coding-agent runtime with ACL config, SDKs, structured output, planning, run replay, PTC, task/parallel_task delegation, automatic subagent delegation, `.a3s/agents`, memory, and a hexagonal workspace stack: local FS, S3 (ETag CAS, cost-bounded grep/glob), remote-git over HTTP/JSON, all with typed errors end-to-end | [README](crates/code/README.md) |
| [a3s-box](crates/box/) | 2.0.4 | Docker-like MicroVM runtime for Linux OCI workloads | [README](crates/box/README.md) |
| [a3s-gateway](crates/gateway/) | 0.2.5 | Reverse proxy with middleware, routing, and privacy features | [README](crates/gateway/README.md) |
| [a3s-lane](crates/lane/) | 0.4.0 | Priority queues with lanes, concurrency, retry, and DLQ | [README](crates/lane/README.md) |
| [a3s-power](crates/power/) | 0.4.2 | Local LLM inference engine with OpenAI-compatible API | [README](crates/power/README.md) |
| [a3s-search](crates/search/) | 1.2.3 | Meta search engine with consensus ranking | [README](crates/search/README.md) |
| [a3s-memory](crates/memory/) | 0.1.1 | Long-term memory storage for agents | [README](crates/memory/README.md) |
| [a3s-ahp](crates/ahp/) | 2.4.0 | Agent Harness Protocol primitives | [README](crates/ahp/README.md) |
| [a3s-acl](crates/acl/) | 0.2.1 | Agent Configuration Language (HCL-like config parser) | [README](crates/acl/README.md) |
| [a3s-event](crates/event/) | 0.3.0 | Pluggable event subscription, dispatch, and persistence | [README](crates/event/README.md) |
| [a3s-updater](crates/updater/) | 0.2.0 | Self-update for CLI binaries via GitHub Releases | [Source](crates/updater/) |
| [a3s-tui](crates/tui/) | 0.1.0 | TEA (The Elm Architecture) framework for terminal UIs with Flexbox layout | [README](crates/tui/README.md) |
| [a3s-common](crates/common/) | 0.1.1 | Shared primitives and transport types | [Source](crates/common/) |

## Quick start

```bash
# Node.js SDK
npm install @a3s-lab/code

# Python SDK
pip install a3s-code

# Rust crate
cargo add a3s-code-core
```

## Repository structure

```text
a3s/
├── apps/
│   └── docs/            # Documentation site
├── crates/              # Rust crates (submodules)
│   ├── acl/             # a3s-acl config language
│   ├── ahp/             # a3s-ahp harness protocol
│   ├── box/             # a3s-box MicroVM runtime
│   ├── code/            # a3s-code agent framework
│   ├── common/          # Shared types
│   ├── event/           # a3s-event pub/sub
│   ├── gateway/         # a3s-gateway
│   ├── lane/            # a3s-lane scheduling
│   ├── memory/          # a3s-memory
│   ├── power/           # a3s-power LLM inference
│   ├── search/          # a3s-search
│   ├── tui/             # a3s-tui terminal UI framework
│   └── updater/         # a3s-updater
└── homebrew-tap/        # Homebrew formulae
```

## Documentation

Full reference and tutorials: [a3s-lab.github.io/a3s](https://a3s-lab.github.io/a3s/)

## Community

Join us on [Discord](https://discord.gg/XVg6Hu6H) for questions, discussions, and updates.

## License

MIT — see [LICENSE](LICENSE).

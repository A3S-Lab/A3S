# A3S

<p align="center">
  <strong>Infrastructure for running AI agents.</strong>
</p>

<p align="center">
  <em>The runtime, isolation, serving, routing, memory, observability, and control an autonomous
  agent needs to operate in production — as a set of small, composable components.</em>
</p>

---

## Why a separate stack

An AI agent is a new kind of workload, and the difference is not incremental.

A web request is shaped by a developer; a batch job runs a program a human wrote. An agent does
neither — it generates its own next action from a probabilistic model. That makes it at once **more
autonomous** (no human in the loop for each step) and **less trustworthy** (the action was sampled,
not authored) than anything the previous generation of infrastructure was built to carry.

Almost everything that follows is a consequence of those two properties:

- Because an agent **acts on its own**, the loop that drives it — tools, memory, planning, model
  calls — is itself a runtime that has to be built, not a script you run once.
- Because its actions are **model-generated and untrusted**, they cannot run on the host; they need
  real isolation, not a permission flag.
- Because the agent **will not honestly instrument itself**, observability has to come from below it —
  the kernel — with zero cooperation from the code being watched.
- Because a sampled action can be wrong or hostile, you need a **runtime veto**: something outside the
  agent that can judge what it is doing and stop it, mid-flight.

Generic infrastructure — web gateways, container runtimes, APM agents — assumes a cooperative,
deterministic program. None of those assumptions hold here. A3S is the stack you get when you take the
agent's actual properties as the starting point.

## First principles: what an agent actually needs

Strip an autonomous agent to its core and it is one loop — **observe → reason → act** — running
against the real world. Ask what must exist for that loop to run in production, and the component list
falls out. One component per irreducible need:

| The agent must… | so A3S provides | which is |
|---|---|---|
| **drive its loop** — hold tools, memory, planning, model calls, the harness | **a3s-code** | a harness-driven agent runtime (Rust core + Node/Python SDKs) |
| **act in isolation** — run model-generated code without trusting it | **a3s-box** | a Docker-like MicroVM runtime for Linux OCI workloads |
| **reason** — call a model, privately | **a3s-power** | LLM inference, OpenAI-compatible, built for TEE/confidential environments |
| **be reached & reach out** — ingress, routing, proxying | **a3s-gateway** | an AI-native reverse proxy: routing, middleware, SSE streaming, scale-to-zero |
| **remember & retrieve** | **a3s-memory** · **a3s-search** | pluggable long-term memory; an embeddable meta-search engine |
| **be scheduled** — many agents, priorities, retries | **a3s-lane** | lane-based priority queues with concurrency, retry, and dead-lettering |
| **be seen** — ground truth on what it actually did | **a3s-observer** | language-agnostic **eBPF** telemetry (LLM calls, tools, files, egress), zero instrumentation |
| **be stopped** — a veto on dangerous actions, at runtime | **a3s-sentry** | tiered runtime security control (L1 rules / L2 LLM / L3 agent) that judges observer's events and blocks via kernel guards |

The last two are where A3S departs hardest from ordinary infrastructure, and the "untrustworthy" half
of the thesis is why. **a3s-observer** watches from the kernel because the agent cannot be relied on to
report itself; **a3s-sentry** is an *external* judge with a kernel-enforced veto because a sampled
action needs to be stoppable by something the agent does not control. Observe is always-on and passive;
intervene is opt-in and isolated, so a policy mistake can never blind the telemetry.

Everything else is connective tissue — the libraries the components are built from:

| Library | Role |
|---|---|
| **a3s-acl** | the configuration language (HCL-like) all components read |
| **a3s-ahp** | the Agent Harness Protocol — transport-agnostic supervision of autonomous agents |
| **a3s-event** | pluggable event subscription, dispatch, and persistence |
| **a3s-common** | shared primitives — privacy classification, tool definitions, transport types |
| **a3s-tui** | a TEA (Elm-Architecture) framework for terminal UIs |
| **a3s-gui** | native cross-platform GUI renderer for Web-compatible React UI |
| **a3s-updater** | self-update for the CLI binaries via GitHub Releases |

And **a3s** — the CLI — is the stack packaged as a usable product: `a3s code` launches an interactive
terminal coding agent built on a3s-code and a3s-tui.

## Architecture

```
   you ─▶  a3s (CLI)   ·   SDKs: Rust · Node · Python          drive an agent
              │
              ▼
        a3s-code ───────────── the loop: tools · memory · planning · MCP · subagents
              │
        runs model-generated actions inside        reasons via            is reached / proxied by
              ▼                                         ▼                        ▼
        a3s-box (MicroVM isolation)              a3s-power (LLM serving)    a3s-gateway (ingress · routing)
              │
   ═══════════╪═══════════════════════════════════════════════  the agent acts; the kernel watches
              ▼
        a3s-observer ───────── eBPF: which agent ran which tool, made which LLM call,
              │                touched which files, reached which endpoint  (no agent cooperation)
        feeds │
              ▼
        a3s-sentry ─────────── judges each event (L1 rules → L2 LLM → L3 agent) and
                               blocks the dangerous ones through observer's kernel guards

   built from:  a3s-acl · a3s-ahp · a3s-event · a3s-memory · a3s-search · a3s-lane · a3s-tui · a3s-gui · a3s-common
```

The spine is **drive → isolate → serve/route → observe → govern**. Observe and govern wrap the rest:
whatever the agent does — through a3s-code, inside a3s-box, out through a3s-gateway — surfaces in
a3s-observer and is answerable to a3s-sentry.

## Projects

| Project | Version | Role |
|---|---|---|
| [a3s](crates/cli/) | 0.5.11 | Interactive terminal coding agent — `a3s code` launches the TUI. Prebuilt binaries for macOS, Linux, Windows |
| [a3s-code](crates/code/) | 4.1.0 | Harness-driven agent runtime: ACL config, tools, hooks, security policy, memory, MCP, structured output, planning, subagents, pluggable workspaces — Rust core + Node/Python SDKs |
| [a3s-box](crates/box/) | 2.6.0 | Docker-like MicroVM runtime for Linux OCI workloads |
| [a3s-gateway](crates/gateway/) | 1.0.11 | AI-native reverse proxy — routing, middleware, SSE streaming, scale-to-zero, agent orchestration |
| [a3s-power](crates/power/) | 0.4.2 | Privacy-preserving LLM inference for TEE environments (OpenAI-compatible) |
| [a3s-search](crates/search/) | 1.3.0 | Embeddable meta-search engine with consensus ranking, CLI, and proxy pool |
| [a3s-lane](crates/lane/) | 0.4.0 | Lane-based priority queues — concurrency, retry, dead-letter |
| [a3s-memory](crates/memory/) | 0.1.1 | Pluggable long-term memory storage for agents |
| [a3s-observer](crates/observer/) | 0.11.0 | Language-agnostic eBPF observability (LLM calls, tools, files, egress) + opt-in kernel intervention |
| [a3s-sentry](crates/sentry/) | 0.6.0 | Tiered runtime security control — L1 rules / L2 LLM / L3 agent — judges observer events and blocks dangerous actions |
| [a3s-ahp](crates/ahp/) | 2.4.0 | Agent Harness Protocol — transport-agnostic supervision primitives |
| [a3s-acl](crates/acl/) | 0.2.1 | Agent Configuration Language (HCL-like parser) |
| [a3s-event](crates/event/) | 0.3.0 | Pluggable event subscription, dispatch, and persistence |
| [a3s-tui](crates/tui/) | 0.1.4 | TEA framework for terminal UIs with Flexbox layout |
| [a3s-gui](crates/gui/) | 0.1.0 | Native cross-platform GUI renderer for Web-compatible React UI — direct AppKit/WinUI/GTK target, no WebView |
| [a3s-webview](crates/webview/) | 0.1.1 | Native WebView popup helper for the a3s code TUI (RemoteUI) — renders Shu'an OS viewUrls |
| [a3s-common](crates/common/) | 0.1.1 | Shared primitives and transport types |
| [a3s-updater](crates/updater/) | 0.2.0 | Self-update for CLI binaries via GitHub Releases |

## Quick start

```bash
# CLI — the interactive coding agent (`a3s code` launches the TUI)
brew install a3s-lab/tap/a3s
# or a prebuilt binary (macOS / Linux / Windows): https://github.com/A3S-Lab/Cli/releases/latest

# SDKs
npm install @a3s-lab/code        # Node.js
pip install a3s-code             # Python
cargo add a3s-code-core          # Rust
```

## Repository structure

```text
a3s/                            ← monorepo root (NOT a Rust workspace)
├── apps/
│   └── docs/                   # documentation site
├── crates/                     # components, each its own git submodule
│   ├── cli/                    # a3s — interactive coding-agent TUI
│   ├── code/                   # a3s-code — agent runtime + SDKs
│   ├── box/                    # a3s-box — MicroVM runtime
│   ├── power/                  # a3s-power — LLM serving
│   ├── gateway/                # a3s-gateway — reverse proxy / ingress
│   ├── observer/               # a3s-observer — eBPF observability
│   ├── sentry/                 # a3s-sentry — runtime security control
│   ├── search/ memory/ lane/   # retrieval · memory · scheduling
│   ├── acl/ ahp/ event/        # config · protocol · events
│   ├── common/ tui/ gui/       # shared types · terminal UI · native GUI
│   ├── updater/                # self-update
│   └── webview/                # a3s-webview — native WebView popup (RemoteUI)
└── homebrew-tap/               # Homebrew formulae
```

Each crate lives in its own repository under the [A3S-Lab](https://github.com/A3S-Lab) org and is
vendored here as a submodule; its README is the deep reference for that component.

## Documentation

Full reference and tutorials: [a3s-lab.github.io/a3s](https://a3s-lab.github.io/a3s/).

## Community

Questions and discussion: [Discord](https://discord.gg/XVg6Hu6H).

## License

MIT — see [LICENSE](LICENSE).

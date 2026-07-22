# A3S - Justfile

host := env_var_or_default("A3S_CODE_WEB_HOST", "127.0.0.1")
port := env_var_or_default("A3S_CODE_WEB_PORT", "29653")
use_e2e_target := env_var_or_default("A3S_USE_E2E_TARGET", justfile_directory() / "target/use-hotplug-e2e")
use_e2e_use_target := use_e2e_target / "use"
use_e2e_code_target := use_e2e_target / "code"
agent_island_target := justfile_directory() / "target/agent-island-dev"
agent_island_executable := if os() == "windows" { "a3s-webview.exe" } else { "a3s-webview" }
agent_island_bin := agent_island_target / "debug" / agent_island_executable

[private]
cli-submodules:
    sh scripts/ensure-dev-submodules.sh \
        crates/acl:Cargo.toml \
        crates/boot:Cargo.toml \
        crates/cli:Cargo.toml \
        crates/code:core/Cargo.toml \
        crates/flow:Cargo.toml \
        crates/lane:Cargo.toml \
        crates/memory:Cargo.toml \
        crates/search:Cargo.toml \
        crates/tui:Cargo.toml \
        crates/use:crates/extension/Cargo.toml

[private]
webview-submodule:
    sh scripts/ensure-dev-submodules.sh crates/webview:Cargo.toml

default:
    @just --list

# ============================================================================
# Development
# ============================================================================

# Start the primary development surface
dev: code

# ============================================================================
# Documentation Site
# ============================================================================

# Start docs dev server
docs:
    cd apps/docs && bun run dev

# Build docs site
docs-build:
    cd apps/docs && bun run build

# ============================================================================
# A3S GUI
# ============================================================================

# Start the A3S GUI native calculator example for this operating system
calculator:
    cd crates/gui && just calculator

# Start the A3S GUI semantic component playground for this operating system
playground:
    cd crates/gui && just playground

# ============================================================================
# A3S Code CLI
# ============================================================================
# Run the local umbrella CLI and forward all arguments

# Example: `just a3s search status` or `just a3s --help`
a3s *args: cli-submodules
    cargo --config 'patch.crates-io.a3s-code-core.path="crates/code/core"' --config 'patch.crates-io.a3s-memory.path="crates/memory"' --config 'patch.crates-io.a3s-search.path="crates/search"' --config 'patch.crates-io.a3s-tui.path="crates/tui"' run --manifest-path crates/cli/Cargo.toml -- {{ args }}

# Start the A3S Code TUI in the current repository
code: cli-submodules webview-submodule
    CARGO_TARGET_DIR='{{ agent_island_target }}' cargo build --manifest-path crates/webview/Cargo.toml --bin a3s-webview
    A3S_AGENT_ISLAND_BIN='{{ agent_island_bin }}' cargo --config 'patch.crates-io.a3s-code-core.path="crates/code/core"' --config 'patch.crates-io.a3s-memory.path="crates/memory"' --config 'patch.crates-io.a3s-tui.path="crates/tui"' run --manifest-path crates/cli/Cargo.toml -- code

# Test Code hot-plug against a real, independently built A3S Use process
use-hotplug-e2e: cli-submodules
    CARGO_TARGET_DIR='{{ use_e2e_use_target }}' cargo build --manifest-path crates/use/Cargo.toml -p a3s-use -p a3s-use-browser-driver
    CARGO_TARGET_DIR='{{ use_e2e_code_target }}' A3S_USE_E2E_BIN='{{ use_e2e_use_target }}/debug/a3s-use' cargo test --manifest-path crates/cli/Cargo.toml --lib use_registry::tests::real_use_process_converges_install_upgrade_rebuild_disable_and_enable -- --ignored --nocapture
    CARGO_TARGET_DIR='{{ use_e2e_code_target }}' A3S_USE_E2E_BIN='{{ use_e2e_use_target }}/debug/a3s-use' A3S_USE_E2E_SOURCE_ROOT='{{ justfile_directory() }}/crates/use' cargo test --manifest-path crates/cli/Cargo.toml --test code_use_first_use code_tui_first_use_installs_a_real_use_release_before_the_first_turn -- --ignored --nocapture

# Build and start the A3S Web application
web: cli-submodules
    cd apps/web && A3S_HOST={{ host }} A3S_PORT={{ port }} just web

# Start the Windhole visual A3S Bench laboratory
windhole:
    cd apps/windhole && just dev

# Validate the Windhole frontend and local Bench bridge
windhole-check:
    cd apps/windhole && just check

# ============================================================================
# A3S Desktop
# ============================================================================

# Start the native A3S Code desktop app
desktop:
    cd apps/desktop && cargo run --locked

# Test the native A3S Code desktop app
desktop-check:
    cd apps/desktop && cargo test --locked --all-targets

# ============================================================================
# A3S Flow
# ============================================================================

# Check the A3S Flow Rust SDK
flow-check:
    cd crates/flow && cargo check --all-targets

# Test the A3S Flow Rust SDK
flow-test:
    cd crates/flow && cargo test --all-targets

# ============================================================================
# A3S Cloud Compatibility
# ============================================================================

# Verify the exact Cloud stack, resolve it, and run its cross-repository gates
cloud-stack-check:
    node --test scripts/verify-cloud-stack.test.mjs
    node scripts/verify-cloud-stack.mjs
    cargo metadata --manifest-path apps/cloud/Cargo.toml --locked --format-version 1 > /dev/null
    cargo check --manifest-path apps/cloud/Cargo.toml --workspace --all-targets --locked
    cargo test --manifest-path apps/cloud/Cargo.toml --locked -p a3s-cloud-contracts
    cargo check --manifest-path crates/gateway/Cargo.toml --locked --all-targets --features wire

# ============================================================================
# Maintenance
# ============================================================================

# Clean all build artifacts across the monorepo
clean:
    cd crates/box && just clean
    cd crates/code && just clean
    cd crates/event && just clean
    cd crates/lane && just clean
    cd crates/power && just clean
    cd crates/search && just clean

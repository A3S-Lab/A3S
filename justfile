# A3S - Justfile

use_e2e_target := env_var_or_default("A3S_USE_E2E_TARGET", justfile_directory() / "target/use-hotplug-e2e")
use_e2e_use_target := use_e2e_target / "use"
use_e2e_code_target := use_e2e_target / "code"

default:
    @just --list

# ============================================================================
# Development
# ============================================================================

# Start the primary native development app
dev: desktop

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

# Start the A3S Code TUI in the current repository
code:
    cargo --config 'patch.crates-io.a3s-code-core.path="crates/code/core"' --config 'patch.crates-io.a3s-memory.path="crates/memory"' --config 'patch.crates-io.a3s-tui.path="crates/tui"' run --manifest-path crates/cli/Cargo.toml -- code

# Test Code hot-plug and first-use startup against an independently built Use process
use-hotplug-e2e:
    CARGO_TARGET_DIR='{{ use_e2e_use_target }}' cargo build --manifest-path crates/use/Cargo.toml -p a3s-use -p a3s-use-browser-driver
    CARGO_TARGET_DIR='{{ use_e2e_code_target }}' A3S_USE_E2E_BIN='{{ use_e2e_use_target }}/debug/a3s-use' cargo test --manifest-path crates/cli/Cargo.toml --lib use_registry::tests::real_use_process_converges_install_upgrade_rebuild_disable_and_enable -- --ignored --nocapture
    CARGO_TARGET_DIR='{{ use_e2e_code_target }}' A3S_USE_E2E_BIN='{{ use_e2e_use_target }}/debug/a3s-use' A3S_USE_E2E_SOURCE_ROOT='{{ justfile_directory() }}/crates/use' cargo test --manifest-path crates/cli/Cargo.toml --test code_use_first_use code_tui_first_use_installs_a_real_use_release_before_the_first_turn -- --ignored --nocapture

# Build and start the A3S Web application
web:
    cd apps/web && just web

# ============================================================================
# A3S Desktop
# ============================================================================

# Start the native A3S Code desktop app
desktop:
    cd apps/desktop && cargo run

# Build the native A3S Code desktop app
desktop-build:
    cd apps/desktop && cargo build --release

# Check the native A3S Code desktop app
desktop-check:
    cd apps/desktop && cargo check --all-targets

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

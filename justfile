# A3S - Justfile

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

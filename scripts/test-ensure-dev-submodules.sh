#!/usr/bin/env bash

set -euo pipefail

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
helper="$script_dir/ensure-dev-submodules.sh"
test_root=$(mktemp -d "${TMPDIR:-/tmp}/a3s-submodule-preflight.XXXXXX")
trap 'rm -rf -- "$test_root"' EXIT

fail() {
    printf 'submodule preflight test failed: %s\n' "$*" >&2
    exit 1
}

source_repo="$test_root/source"
super_repo="$test_root/super"
mkdir -p "$source_repo" "$super_repo"

git -C "$source_repo" init -q
git -C "$source_repo" config user.name 'A3S Test'
git -C "$source_repo" config user.email 'test@a3s.local'
printf '[package]\nname = "fixture"\nversion = "0.1.0"\n' >"$source_repo/Cargo.toml"
git -C "$source_repo" add Cargo.toml
git -C "$source_repo" commit -qm 'fixture source'

git -C "$super_repo" init -q
git -C "$super_repo" config user.name 'A3S Test'
git -C "$super_repo" config user.email 'test@a3s.local'
git -C "$super_repo" -c protocol.file.allow=always \
    submodule add -q "$source_repo" crates/example
git -C "$super_repo" commit -qam 'register fixture submodule'

git -C "$super_repo" submodule deinit -f -- crates/example >/dev/null
rm -rf -- "$super_repo/crates/example"

(
    cd "$super_repo"
    GIT_CONFIG_COUNT=1 \
    GIT_CONFIG_KEY_0=protocol.file.allow \
    GIT_CONFIG_VALUE_0=always \
        sh "$helper" crates/example:Cargo.toml
)
[[ -f "$super_repo/crates/example/Cargo.toml" ]] \
    || fail 'missing submodule was not initialized'

rm -f -- "$super_repo/crates/example/Cargo.toml"
error_log="$test_root/missing-manifest.log"
if (cd "$super_repo" && sh "$helper" crates/example:Cargo.toml >"$error_log" 2>&1); then
    fail 'an initialized submodule with a deleted manifest unexpectedly passed'
fi
[[ ! -e "$super_repo/crates/example/Cargo.toml" ]] \
    || fail 'preflight overwrote the initialized submodule worktree'
grep -Fq 'the initialized submodule was left unchanged' "$error_log" \
    || fail 'missing-manifest diagnostic did not explain worktree preservation'

printf 'development submodule preflight tests passed\n'

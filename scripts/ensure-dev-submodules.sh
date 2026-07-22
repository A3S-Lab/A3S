#!/bin/sh

# Initialize only the submodules needed by a development recipe. Existing
# submodule worktrees are never reset or checked out by this helper.

set -eu

die() {
    printf 'a3s dev setup: error: %s\n' "$*" >&2
    exit 1
}

[ "$#" -gt 0 ] || die "no required submodules were specified"

repo_root=$(git rev-parse --show-toplevel 2>/dev/null) \
    || die "run this command from an A3S repository checkout"
cd "$repo_root"

missing_submodules=""
for requirement in "$@"; do
    case "$requirement" in
        *:*) submodule=${requirement%%:*} ;;
        *) die "invalid submodule requirement: $requirement" ;;
    esac
    [ -n "$submodule" ] || die "invalid submodule requirement: $requirement"
    if [ ! -e "$submodule/.git" ]; then
        missing_submodules="${missing_submodules}${missing_submodules:+ }$submodule"
    fi
done

if [ -n "$missing_submodules" ]; then
    printf 'a3s dev setup: initializing required submodules:%s\n' \
        "${missing_submodules:+ $missing_submodules}"
    # The registered repository paths never contain whitespace.
    # shellcheck disable=SC2086
    git submodule update --init -- $missing_submodules \
        || die "could not initialize the required submodules"
fi

for requirement in "$@"; do
    submodule=${requirement%%:*}
    required_file=${requirement#*:}
    [ -n "$required_file" ] \
        || die "invalid submodule requirement: $requirement"
    [ -e "$submodule/.git" ] \
        || die "$submodule is not an initialized Git submodule"
    if [ ! -f "$submodule/$required_file" ]; then
        printf 'a3s dev setup: error: required file is missing: %s/%s\n' \
            "$submodule" "$required_file" >&2
        printf 'a3s dev setup: the initialized submodule was left unchanged to preserve local work.\n' >&2
        git -C "$submodule" status --short 2>/dev/null | sed -n '1,12p' >&2 || true
        printf 'a3s dev setup: stash or commit that submodule, then synchronize it with:\n' >&2
        printf '  git submodule update --init -- %s\n' "$submodule" >&2
        exit 1
    fi
done

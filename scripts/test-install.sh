#!/usr/bin/env bash

set -euo pipefail

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)
installer="$repo_root/install.sh"
test_root=$(mktemp -d "${TMPDIR:-/tmp}/a3s-installer-test.XXXXXX")

cleanup() {
    case "$test_root" in
        "${TMPDIR:-/tmp}"/a3s-installer-test.*) rm -rf -- "$test_root" ;;
        *) printf 'refusing to remove unexpected test directory: %s\n' "$test_root" >&2 ;;
    esac
}
trap cleanup EXIT

fail() {
    printf 'installer test failed: %s\n' "$*" >&2
    exit 1
}

assert_file() {
    [[ -f "$1" ]] || fail "expected file $1"
}

assert_content() {
    local expected=$1
    local path=$2
    [[ "$(cat "$path")" == "$expected" ]] \
        || fail "unexpected content in $path"
}

assert_no_generated_paths() {
    local root=$1
    local leftovers
    leftovers=$(find "$root" -name '.a3s.*' -o -name '.a3s-web.*' -o \
        -name '.a3s-webview.*' -o -name '.a3s-support.*')
    [[ -z "$leftovers" ]] || fail "installer left temporary paths: $leftovers"
}

expect_failure() {
    local description=$1
    shift
    if "$@" >"$test_root/failure.stdout" 2>"$test_root/failure.stderr"; then
        fail "$description unexpectedly succeeded"
    fi
}

mock_bin="$test_root/mock-bin"
fixture_root="$test_root/fixture"
mkdir -p "$mock_bin" "$fixture_root"
real_mv=$(command -v mv)

cat >"$mock_bin/uname" <<'EOF'
#!/bin/sh
case "${1:-}" in
    -s) printf '%s\n' "${MOCK_UNAME_S:-Linux}" ;;
    -m) printf '%s\n' "${MOCK_UNAME_M:-x86_64}" ;;
    *) printf '%s\n' "${MOCK_UNAME_S:-Linux}" ;;
esac
EOF

cat >"$mock_bin/getconf" <<'EOF'
#!/bin/sh
if [ "${MOCK_GLIBC:-1}" = 1 ] && [ "${1:-}" = GNU_LIBC_VERSION ]; then
    printf 'glibc 2.36\n'
    exit 0
fi
exit 1
EOF

cat >"$mock_bin/ldd" <<'EOF'
#!/bin/sh
printf 'musl libc (test fixture)\n' >&2
exit 1
EOF

cat >"$mock_bin/curl" <<'EOF'
#!/bin/sh
set -eu
: "${MOCK_CURL_CALLED:?}"
: >"$MOCK_CURL_CALLED"
destination=
while [ "$#" -gt 0 ]; do
    case "$1" in
        -o)
            destination=$2
            shift 2
            ;;
        *) shift ;;
    esac
done
if [ -n "$destination" ]; then
    cp "$MOCK_ARCHIVE" "$destination"
else
    cat "$MOCK_RELEASE_JSON"
fi
EOF

cat >"$mock_bin/mv" <<'EOF'
#!/bin/sh
set -eu

source_path=${1:-}
destination_path=${2:-}
if [ "$source_path" = -f ]; then
    source_path=${2:-}
    destination_path=${3:-}
fi

"$REAL_MV" "$@"

if [ -z "${MOCK_MV_FAULT:-}" ] || [ -e "${MOCK_MV_FAULT_MARKER:-}" ]; then
    exit 0
fi

source_leaf=${source_path##*/}
destination_leaf=${destination_path##*/}
inject=0
case "$MOCK_MV_FAULT" in
    web-backup)
        if [ "$source_leaf" = "${MOCK_MV_FAULT_VERSION:-}" ]; then
            case "$destination_leaf" in
                .a3s-web.backup.*) inject=1 ;;
            esac
        fi
        ;;
    web-activate)
        case "$source_leaf:$destination_leaf" in
            .a3s-web.new.*:"${MOCK_MV_FAULT_VERSION:-}") inject=1 ;;
        esac
        ;;
    binary-activate)
        case "$source_leaf:$destination_leaf" in
            .a3s.new.*:a3s) inject=1 ;;
        esac
        ;;
    webview-activate)
        case "$source_leaf:$destination_leaf" in
            .a3s-webview.new.*:a3s-webview) inject=1 ;;
        esac
        ;;
    support-activate)
        case "$source_leaf:$destination_leaf" in
            .a3s-support.new.*:support) inject=1 ;;
        esac
        ;;
esac

if [ "$inject" -eq 1 ]; then
    : >"$MOCK_MV_FAULT_MARKER"
    kill -TERM "$PPID"
fi
EOF
chmod +x "$mock_bin/uname" "$mock_bin/getconf" "$mock_bin/ldd" "$mock_bin/curl" "$mock_bin/mv"

base_path=$PATH
export PATH="$mock_bin:$base_path"
export MOCK_CURL_CALLED="$test_root/curl.called"
export REAL_MV="$real_mv"
export MOCK_MV_FAULT_MARKER="$test_root/mv-fault.triggered"
unset A3S_VERSION A3S_INSTALL_DIR A3S_DATA_HOME A3S_MODIFY_PATH A3S_GITHUB_TOKEN XDG_DATA_HOME
unset MOCK_MV_FAULT MOCK_MV_FAULT_VERSION

sha256_file() {
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$1" | awk '{ print $1 }'
    else
        shasum -a 256 "$1" | awk '{ print $1 }'
    fi
}

make_fixture() {
    local version=$1
    local target=$2
    local include_webview=${3:-1}
    local include_support=${4:-1}
    local payload="$fixture_root/payload"
    local archive="$fixture_root/a3s-v${version}-${target}.tar.gz"
    local asset_name="a3s-v${version}-${target}.tar.gz"
    local archive_members=(a3s web)
    local digest

    rm -rf -- "$payload"
    mkdir -p "$payload/web"
    printf '#!/bin/sh\nprintf "a3s %s\\n"\n' "$version" >"$payload/a3s"
    chmod +x "$payload/a3s"
    printf '<!doctype html><title>A3S %s</title>\n' "$version" >"$payload/web/index.html"
    if [ "$include_webview" -eq 1 ]; then
        printf '#!/bin/sh\nif [ "${1:-}" = "--agent-island" ]; then\n  printf "%%s\\n" "usage: a3s-webview --agent-island --snapshot <absolute-path> --lock-file <absolute-path>" >&2\n  exit 2\nfi\nprintf "a3s-webview %s\\n"\n' \
            "$version" >"$payload/a3s-webview"
        chmod +x "$payload/a3s-webview"
        archive_members+=(a3s-webview)
    fi
    if [ "$include_support" -eq 1 ]; then
        mkdir -p "$payload/support/managed-srt/node_modules/@anthropic-ai/sandbox-runtime/dist"
        printf '{"name":"a3s-managed-srt-fixture","version":"%s"}\n' \
            "$version" >"$payload/support/managed-srt/package.json"
        printf '{"name":"a3s-managed-srt-fixture","lockfileVersion":3}\n' \
            >"$payload/support/managed-srt/package-lock.json"
        printf 'managed-srt %s\n' \
            "$version" >"$payload/support/managed-srt/node_modules/@anthropic-ai/sandbox-runtime/dist/cli.js"
        printf 'fixture-tree-sha256-%s\n' \
            "$version" >"$payload/support/managed-srt.tree-sha256"
        archive_members+=(support)
    fi
    tar -czf "$archive" -C "$payload" "${archive_members[@]}"
    digest=$(sha256_file "$archive")

    MOCK_ARCHIVE=$archive
    MOCK_RELEASE_JSON="$fixture_root/release.json"
    export MOCK_ARCHIVE MOCK_RELEASE_JSON
    printf '%s' \
        "{\"tag_name\":\"v${version}\",\"draft\":false,\"prerelease\":false,\"assets\":[{\"url\":\"https://api.github.com/repos/A3S-Lab/CLI/releases/assets/1\",\"name\":\"unrelated.tar.gz\",\"uploader\":{\"login\":\"bot\"},\"state\":\"uploaded\",\"digest\":\"sha256:$(printf '0%.0s' {1..64})\",\"browser_download_url\":\"https://example.invalid/unrelated\"},{\"url\":\"https://api.github.com/repos/A3S-Lab/CLI/releases/assets/2\",\"name\":\"${asset_name}\",\"uploader\":{\"login\":\"bot\",\"following_url\":\"https://api.github.com/users/bot/following{/other_user}\"},\"state\":\"uploaded\",\"digest\":\"sha256:${digest}\",\"browser_download_url\":\"https://github.com/A3S-Lab/CLI/releases/download/v${version}/${asset_name}\"}]}" \
        >"$MOCK_RELEASE_JSON"
}

run_install() {
    local version=$1
    local install_dir=$2
    local data_home=$3
    shift 3
    HOME="$test_root/home" \
    A3S_INSTALL_DIR="$install_dir" \
    A3S_DATA_HOME="$data_home" \
    MOCK_GLIBC=1 \
    sh "$installer" --version "$version" --no-modify-path "$@"
}

mkdir -p "$test_root/home"

# Stable archives published before the companion bundle remain installable;
# Code owns their verified WebView first-use setup.
export MOCK_UNAME_S=Linux MOCK_UNAME_M=x86_64
make_fixture 1.2.2 x86_64-unknown-linux-gnu 0 0
legacy_root="$test_root/legacy-without-webview"
run_install 1.2.2 "$legacy_root/bin" "$legacy_root/data"
assert_file "$legacy_root/bin/a3s"
assert_file "$legacy_root/data/web/1.2.2/index.html"
[[ ! -e "$legacy_root/bin/a3s-webview" ]] \
    || fail 'legacy release unexpectedly installed a WebView companion'
[[ ! -e "$legacy_root/bin/support" ]] \
    || fail 'legacy release unexpectedly installed a support payload'
assert_no_generated_paths "$legacy_root"

# Every published Unix target maps to the exact release asset name.
for target_case in \
    'Linux x86_64 x86_64-unknown-linux-gnu' \
    'Linux aarch64 aarch64-unknown-linux-gnu' \
    'Darwin x86_64 x86_64-apple-darwin' \
    'Darwin arm64 aarch64-apple-darwin'; do
    read -r mock_os mock_arch target <<<"$target_case"
    make_fixture 1.2.3 "$target"
    export MOCK_UNAME_S=$mock_os MOCK_UNAME_M=$mock_arch
    case_root="$test_root/targets/$target"
    run_install 1.2.3 "$case_root/bin" "$case_root/data"
    assert_file "$case_root/bin/a3s"
    assert_file "$case_root/bin/a3s-webview"
    assert_file "$case_root/bin/support/managed-srt/node_modules/@anthropic-ai/sandbox-runtime/dist/cli.js"
    assert_file "$case_root/data/web/1.2.3/index.html"
    [[ "$("$case_root/bin/a3s" --version)" == 'a3s 1.2.3' ]] \
        || fail "wrong installed version for $target"
    [[ "$("$case_root/bin/a3s-webview")" == 'a3s-webview 1.2.3' ]] \
        || fail "wrong installed WebView companion for $target"
    assert_content 'managed-srt 1.2.3' \
        "$case_root/bin/support/managed-srt/node_modules/@anthropic-ai/sandbox-runtime/dist/cli.js"
    assert_no_generated_paths "$case_root"
done

# Upgrade replaces the binary, retains versioned Web caches, and leaves no staging files.
export MOCK_UNAME_S=Linux MOCK_UNAME_M=x86_64
upgrade_root="$test_root/upgrade 用户 space"
make_fixture 1.2.3 x86_64-unknown-linux-gnu
run_install 1.2.3 "$upgrade_root/bin" "$upgrade_root/data"
make_fixture 1.2.4 x86_64-unknown-linux-gnu
run_install 1.2.4 "$upgrade_root/bin" "$upgrade_root/data"
[[ "$("$upgrade_root/bin/a3s" --version)" == 'a3s 1.2.4' ]] || fail 'upgrade did not replace binary'
[[ "$("$upgrade_root/bin/a3s-webview")" == 'a3s-webview 1.2.4' ]] \
    || fail 'upgrade did not replace WebView companion'
assert_content 'managed-srt 1.2.4' \
    "$upgrade_root/bin/support/managed-srt/node_modules/@anthropic-ai/sandbox-runtime/dist/cli.js"
assert_file "$upgrade_root/data/web/1.2.3/index.html"
assert_file "$upgrade_root/data/web/1.2.4/index.html"
assert_no_generated_paths "$upgrade_root"

# A digest mismatch fails before activation and preserves the installed version.
make_fixture 1.2.5 x86_64-unknown-linux-gnu
sed 's/"digest":"sha256:[0-9a-f]*"/"digest":"sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"/2' \
    "$MOCK_RELEASE_JSON" >"$fixture_root/bad-digest.json"
MOCK_RELEASE_JSON="$fixture_root/bad-digest.json"
export MOCK_RELEASE_JSON
expect_failure 'digest mismatch' run_install 1.2.5 "$upgrade_root/bin" "$upgrade_root/data"
[[ "$("$upgrade_root/bin/a3s" --version)" == 'a3s 1.2.4' ]] || fail 'digest failure changed old binary'
[[ "$("$upgrade_root/bin/a3s-webview")" == 'a3s-webview 1.2.4' ]] \
    || fail 'digest failure changed old WebView companion'
assert_content 'managed-srt 1.2.4' \
    "$upgrade_root/bin/support/managed-srt/node_modules/@anthropic-ai/sandbox-runtime/dist/cli.js"
assert_file "$upgrade_root/data/web/1.2.4/index.html"

# A missing target digest cannot borrow the following asset's digest.
make_fixture 1.2.6 x86_64-unknown-linux-gnu
asset_name='a3s-v1.2.6-x86_64-unknown-linux-gnu.tar.gz'
actual_digest=$(sha256_file "$MOCK_ARCHIVE")
printf '%s' \
    "{\"tag_name\":\"v1.2.6\",\"draft\":false,\"prerelease\":false,\"assets\":[{\"url\":\"https://api.github.com/repos/A3S-Lab/CLI/releases/assets/3\",\"name\":\"${asset_name}\",\"state\":\"uploaded\",\"browser_download_url\":\"https://github.com/A3S-Lab/CLI/releases/download/v1.2.6/${asset_name}\"},{\"url\":\"https://api.github.com/repos/A3S-Lab/CLI/releases/assets/4\",\"name\":\"other.tar.gz\",\"state\":\"uploaded\",\"digest\":\"sha256:${actual_digest}\",\"browser_download_url\":\"https://example.invalid/other\"}]}" \
    >"$fixture_root/missing-digest.json"
MOCK_RELEASE_JSON="$fixture_root/missing-digest.json"
export MOCK_RELEASE_JSON
expect_failure 'missing target digest' run_install 1.2.6 "$upgrade_root/bin" "$upgrade_root/data"

# Unexpected archive members are rejected before activation.
payload="$fixture_root/unsafe-payload"
rm -rf -- "$payload"
mkdir -p "$payload/web"
printf '#!/bin/sh\nprintf "a3s 1.2.7\\n"\n' >"$payload/a3s"
chmod +x "$payload/a3s"
printf '#!/bin/sh\nprintf "a3s-webview 1.2.7\\n"\n' >"$payload/a3s-webview"
chmod +x "$payload/a3s-webview"
printf '<!doctype html>\n' >"$payload/web/index.html"
printf 'unexpected\n' >"$payload/escape"
MOCK_ARCHIVE="$fixture_root/a3s-v1.2.7-x86_64-unknown-linux-gnu.tar.gz"
tar -czf "$MOCK_ARCHIVE" -C "$payload" a3s a3s-webview web escape
export MOCK_ARCHIVE
unsafe_digest=$(sha256_file "$MOCK_ARCHIVE")
unsafe_asset=$(basename "$MOCK_ARCHIVE")
printf '%s' \
    "{\"tag_name\":\"v1.2.7\",\"draft\":false,\"prerelease\":false,\"assets\":[{\"url\":\"https://api.github.com/repos/A3S-Lab/CLI/releases/assets/5\",\"name\":\"${unsafe_asset}\",\"state\":\"uploaded\",\"digest\":\"sha256:${unsafe_digest}\",\"browser_download_url\":\"https://github.com/A3S-Lab/CLI/releases/download/v1.2.7/${unsafe_asset}\"}]}" \
    >"$fixture_root/unsafe.json"
MOCK_RELEASE_JSON="$fixture_root/unsafe.json"
export MOCK_RELEASE_JSON
expect_failure 'unsafe archive member' run_install 1.2.7 "$upgrade_root/bin" "$upgrade_root/data"
[[ "$("$upgrade_root/bin/a3s" --version)" == 'a3s 1.2.4' ]] || fail 'unsafe archive changed old binary'
[[ "$("$upgrade_root/bin/a3s-webview")" == 'a3s-webview 1.2.4' ]] \
    || fail 'unsafe archive changed old WebView companion'
assert_content 'managed-srt 1.2.4' \
    "$upgrade_root/bin/support/managed-srt/node_modules/@anthropic-ai/sandbox-runtime/dist/cli.js"

# Unsupported and non-glibc hosts fail before making a network request.
rm -f "$MOCK_CURL_CALLED"
export MOCK_UNAME_S=Linux MOCK_UNAME_M=riscv64
expect_failure 'unsupported architecture' run_install 1.2.4 "$test_root/unsupported/bin" "$test_root/unsupported/data"
[[ ! -e "$MOCK_CURL_CALLED" ]] || fail 'unsupported architecture reached the network'

rm -f "$MOCK_CURL_CALLED"
export MOCK_UNAME_S=Linux MOCK_UNAME_M=x86_64 MOCK_GLIBC=0
expect_failure 'musl host' env \
    HOME="$test_root/home" A3S_INSTALL_DIR="$test_root/musl/bin" A3S_DATA_HOME="$test_root/musl/data" \
    MOCK_GLIBC=0 sh "$installer" --version 1.2.4 --no-modify-path
[[ ! -e "$MOCK_CURL_CALLED" ]] || fail 'non-glibc host reached the network'

# PATH modification is opt-in and idempotent.
export MOCK_UNAME_S=Linux MOCK_UNAME_M=x86_64 MOCK_GLIBC=1
make_fixture 1.2.8 x86_64-unknown-linux-gnu
profile_home="$test_root/profile-home"
mkdir -p "$profile_home"
HOME="$profile_home" A3S_DATA_HOME="$test_root/profile-data" SHELL=/bin/sh \
    sh "$installer" --version 1.2.8
[[ ! -e "$profile_home/.profile" ]] || fail 'default install modified a shell profile'
HOME="$profile_home" A3S_DATA_HOME="$test_root/profile-data" SHELL=/bin/sh \
    sh "$installer" --version 1.2.8 --modify-path
HOME="$profile_home" A3S_DATA_HOME="$test_root/profile-data" SHELL=/bin/sh \
    sh "$installer" --version 1.2.8 --modify-path
[[ "$(grep -Fxc 'export PATH="$HOME/.local/bin:$PATH"' "$profile_home/.profile")" -eq 1 ]] \
    || fail 'PATH profile entry is not idempotent'

# Interruptions after filesystem mutations restore the prior disk state even
# before the installer can update its in-memory activation flags.
fault_root="$test_root/fault-injection"
make_fixture 4.0.0 x86_64-unknown-linux-gnu
run_install 4.0.0 "$fault_root/bin" "$fault_root/data"
printf 'old Web sentinel\n' >"$fault_root/data/web/4.0.0/index.html"
support_cli="$fault_root/bin/support/managed-srt/node_modules/@anthropic-ai/sandbox-runtime/dist/cli.js"
printf 'old support sentinel\n' >"$support_cli"
old_webview_sha=$(sha256_file "$fault_root/bin/a3s-webview")

export MOCK_MV_FAULT=web-backup MOCK_MV_FAULT_VERSION=4.0.0
rm -f "$MOCK_MV_FAULT_MARKER"
expect_failure 'interruption after Web backup' \
    run_install 4.0.0 "$fault_root/bin" "$fault_root/data"
[[ -e "$MOCK_MV_FAULT_MARKER" ]] || fail 'Web backup fault was not injected'
assert_content 'old Web sentinel' "$fault_root/data/web/4.0.0/index.html"
assert_content 'old support sentinel' "$support_cli"
[[ "$("$fault_root/bin/a3s" --version)" == 'a3s 4.0.0' ]] \
    || fail 'Web backup interruption changed the installed binary'
assert_no_generated_paths "$fault_root"

export MOCK_MV_FAULT=webview-activate
rm -f "$MOCK_MV_FAULT_MARKER"
expect_failure 'interruption after WebView companion activation' \
    run_install 4.0.0 "$fault_root/bin" "$fault_root/data"
[[ -e "$MOCK_MV_FAULT_MARKER" ]] || fail 'WebView companion fault was not injected'
assert_content 'old Web sentinel' "$fault_root/data/web/4.0.0/index.html"
assert_content 'old support sentinel' "$support_cli"
[[ "$(sha256_file "$fault_root/bin/a3s-webview")" == "$old_webview_sha" ]] \
    || fail 'WebView activation interruption did not restore the previous companion'
[[ "$("$fault_root/bin/a3s" --version)" == 'a3s 4.0.0' ]] \
    || fail 'WebView activation interruption changed the installed binary'
assert_no_generated_paths "$fault_root"

export MOCK_MV_FAULT=web-activate
rm -f "$MOCK_MV_FAULT_MARKER"
expect_failure 'interruption after Web activation' \
    run_install 4.0.0 "$fault_root/bin" "$fault_root/data"
[[ -e "$MOCK_MV_FAULT_MARKER" ]] || fail 'Web activation fault was not injected'
assert_content 'old Web sentinel' "$fault_root/data/web/4.0.0/index.html"
assert_content 'old support sentinel' "$support_cli"
[[ "$("$fault_root/bin/a3s" --version)" == 'a3s 4.0.0' ]] \
    || fail 'Web activation interruption changed the installed binary'
assert_no_generated_paths "$fault_root"

export MOCK_MV_FAULT=support-activate
rm -f "$MOCK_MV_FAULT_MARKER"
expect_failure 'interruption after support payload activation' \
    run_install 4.0.0 "$fault_root/bin" "$fault_root/data"
[[ -e "$MOCK_MV_FAULT_MARKER" ]] || fail 'support payload fault was not injected'
assert_content 'old Web sentinel' "$fault_root/data/web/4.0.0/index.html"
assert_content 'old support sentinel' "$support_cli"
[[ "$("$fault_root/bin/a3s" --version)" == 'a3s 4.0.0' ]] \
    || fail 'support activation interruption changed the installed binary'
assert_no_generated_paths "$fault_root"

make_fixture 4.0.1 x86_64-unknown-linux-gnu
export MOCK_MV_FAULT=binary-activate MOCK_MV_FAULT_VERSION=4.0.1
rm -f "$MOCK_MV_FAULT_MARKER"
expect_failure 'interruption after binary activation' \
    run_install 4.0.1 "$fault_root/bin" "$fault_root/data"
[[ -e "$MOCK_MV_FAULT_MARKER" ]] || fail 'binary activation fault was not injected'
[[ "$("$fault_root/bin/a3s" --version)" == 'a3s 4.0.0' ]] \
    || fail 'binary activation interruption did not restore the previous binary'
[[ "$(sha256_file "$fault_root/bin/a3s-webview")" == "$old_webview_sha" ]] \
    || fail 'binary activation interruption did not restore the previous WebView companion'
assert_content 'old support sentinel' "$support_cli"
[[ ! -e "$fault_root/data/web/4.0.1" ]] \
    || fail 'binary activation interruption left the new Web cache active'
assert_content 'old Web sentinel' "$fault_root/data/web/4.0.0/index.html"
assert_no_generated_paths "$fault_root"
unset MOCK_MV_FAULT MOCK_MV_FAULT_VERSION

printf 'install.sh tests passed\n'

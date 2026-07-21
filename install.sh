#!/bin/sh

# Install the latest stable A3S CLI release on macOS or GNU/Linux.
#
# Environment overrides:
#   A3S_VERSION          Release tag (for example v0.9.8); defaults to latest.
#   A3S_INSTALL_DIR      Binary directory; defaults to $HOME/.local/bin.
#   A3S_DATA_HOME        Data directory for versioned Web assets.
#   A3S_MODIFY_PATH      Set to 1 to add the default directory to a shell profile.
#   A3S_GITHUB_TOKEN     Optional GitHub token for release API rate limits.

set -eu

REPOSITORY="A3S-Lab/CLI"
DEFAULT_INSTALL_DIR="${HOME:+$HOME/.local/bin}"

version="${A3S_VERSION:-latest}"
install_dir="${A3S_INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"
modify_path=0

case "${A3S_MODIFY_PATH:-}" in
    1|true|TRUE|yes|YES) modify_path=1 ;;
esac

info() {
    printf 'a3s installer: %s\n' "$*"
}

warn() {
    printf 'a3s installer: warning: %s\n' "$*" >&2
}

die() {
    printf 'a3s installer: error: %s\n' "$*" >&2
    exit 1
}

usage() {
    cat <<'EOF'
Install the A3S CLI from its official GitHub release.

Usage: install.sh [options]

Options:
  --version <tag>       Install a stable tag such as v0.9.8 (default: latest)
  --install-dir <path>  Install the binary in this directory
  --modify-path         Add the default install directory to a shell profile
  --no-modify-path      Leave shell profiles unchanged (the default)
  -h, --help            Show this help

The same settings are available through A3S_VERSION, A3S_INSTALL_DIR,
A3S_DATA_HOME, and A3S_MODIFY_PATH. A3S_GITHUB_TOKEN can raise GitHub API rate
limits. Shell profiles are not changed unless explicitly requested.
EOF
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        --version)
            [ "$#" -ge 2 ] || die "--version requires a value"
            version=$2
            shift 2
            ;;
        --install-dir)
            [ "$#" -ge 2 ] || die "--install-dir requires a value"
            install_dir=$2
            shift 2
            ;;
        --modify-path)
            modify_path=1
            shift
            ;;
        --no-modify-path)
            modify_path=0
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            die "unknown option '$1' (run with --help for usage)"
            ;;
    esac
done

[ -n "$install_dir" ] || die "HOME or A3S_INSTALL_DIR is required"
case "$install_dir" in
    *'
'*) die "the install directory cannot contain a newline" ;;
esac
install_dir=${install_dir%/}
[ -n "$install_dir" ] || die "refusing to install directly into /"
case "$install_dir" in
    /*) ;;
    *) die "the install directory must be an absolute path: $install_dir" ;;
esac
requested_default_install=0
if [ -n "$DEFAULT_INSTALL_DIR" ] && [ "$install_dir" = "$DEFAULT_INSTALL_DIR" ]; then
    requested_default_install=1
fi

if [ -n "${A3S_DATA_HOME:-}" ]; then
    case "$A3S_DATA_HOME" in
        /) die "A3S_DATA_HOME cannot be a filesystem root" ;;
        /*) ;;
        *) die "A3S_DATA_HOME must be absolute for installer-managed Web assets" ;;
    esac
fi
if [ -n "${XDG_DATA_HOME:-}" ]; then
    case "$XDG_DATA_HOME" in
        /*) ;;
        *) die "XDG_DATA_HOME must be absolute for installer-managed Web assets" ;;
    esac
fi

case "$version" in
    ""|latest) version=latest ;;
    [0-9]*) version="v$version" ;;
esac
if [ "$version" != latest ] && ! printf '%s\n' "$version" | grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+$'; then
    die "invalid stable release tag '$version' (expected vX.Y.Z)"
fi

for command_name in uname mktemp tar awk grep tr mkdir mv cp chmod rm rmdir sort uniq find curl; do
    command -v "$command_name" >/dev/null 2>&1 || die "required command '$command_name' was not found"
done

case "$(uname -s)" in
    Darwin) os=apple-darwin ;;
    Linux)
        os=unknown-linux-gnu
        glibc_detected=0
        if command -v getconf >/dev/null 2>&1 \
            && getconf GNU_LIBC_VERSION >/dev/null 2>&1; then
            glibc_detected=1
        elif command -v ldd >/dev/null 2>&1 \
            && ldd --version 2>&1 | grep -Eqi '(glibc|gnu libc)'; then
            glibc_detected=1
        fi
        [ "$glibc_detected" -eq 1 ] \
            || die "the published Linux CLI requires glibc, which could not be verified on this host"
        ;;
    MINGW*|MSYS*|CYGWIN*)
        die "use install.ps1 from PowerShell to install A3S on Windows"
        ;;
    *) die "unsupported operating system: $(uname -s)" ;;
esac

case "$(uname -m)" in
    x86_64|amd64) arch=x86_64 ;;
    arm64|aarch64) arch=aarch64 ;;
    *) die "unsupported CPU architecture: $(uname -m)" ;;
esac

target="$arch-$os"

mkdir -p "$install_dir" || die "failed to create $install_dir"
install_dir=$(CDPATH= cd -P "$install_dir" && pwd -P) \
    || die "failed to resolve the install directory"
[ "$install_dir" != / ] || die "refusing to install directly into /"

lock_dir="$install_dir/.a3s-installer.lock"
lock_acquired=0
web_lock_dir=""
web_lock_acquired=0
release_install_lock() {
    if [ "$lock_acquired" -eq 1 ]; then
        if rmdir "$lock_dir" 2>/dev/null; then
            lock_acquired=0
        else
            warn "could not remove installer lock $lock_dir"
        fi
    fi
}
release_web_lock() {
    if [ "$web_lock_acquired" -eq 1 ]; then
        if rmdir "$web_lock_dir" 2>/dev/null; then
            web_lock_acquired=0
        else
            warn "could not remove Web installer lock $web_lock_dir"
        fi
    fi
}
mkdir "$lock_dir" 2>/dev/null \
    || die "another installer may be running (remove stale lock $lock_dir only after checking)"
lock_acquired=1
trap release_install_lock EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

fetch_release() {
    api_url=$1
    if [ -n "${A3S_GITHUB_TOKEN:-}" ]; then
        case "$A3S_GITHUB_TOKEN" in
            *'"'*|*'
'*) die "A3S_GITHUB_TOKEN contains an unsupported character" ;;
        esac
        printf 'header = "Authorization: Bearer %s"\n' "$A3S_GITHUB_TOKEN" | \
            curl -q -fsSL --proto '=https' --tlsv1.2 --config - \
                --connect-timeout 15 --max-time 60 --retry 3 --retry-delay 1 \
                -H 'Accept: application/vnd.github+json' \
                -H 'X-GitHub-Api-Version: 2022-11-28' \
                -H 'User-Agent: a3s-installer' \
                "$api_url"
    else
        curl -q -fsSL --proto '=https' --tlsv1.2 \
            --connect-timeout 15 --max-time 60 --retry 3 --retry-delay 1 \
            -H 'Accept: application/vnd.github+json' \
            -H 'X-GitHub-Api-Version: 2022-11-28' \
            -H 'User-Agent: a3s-installer' \
            "$api_url"
    fi
}

download_asset() {
    download_url=$1
    destination=$2
    curl -q -fL --proto '=https' --tlsv1.2 \
        --connect-timeout 15 --max-time 600 --retry 3 --retry-delay 1 \
        -o "$destination" "$download_url"
}

if [ "$version" = latest ]; then
    release_api="https://api.github.com/repos/$REPOSITORY/releases/latest"
else
    release_api="https://api.github.com/repos/$REPOSITORY/releases/tags/$version"
fi

info "resolving ${version} release for $target"
release_json=$(fetch_release "$release_api") || die "failed to query $release_api"
compact_json=$(printf '%s' "$release_json" | tr -d '\r\n')
release_tag=$(printf '%s' "$compact_json" | awk -F'"tag_name":"' 'NF > 1 { split($2, value, "\""); print value[1]; exit }')

printf '%s\n' "$release_tag" | grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+$' \
    || die "GitHub returned an invalid stable release tag"
release_draft=$(printf '%s' "$compact_json" \
    | awk -F'"draft":' 'NF > 1 { split($2, value, "[,}]"); print value[1]; exit }')
[ "$release_draft" = false ] || die "GitHub returned a draft release"
release_prerelease=$(printf '%s' "$compact_json" \
    | awk -F'"prerelease":' 'NF > 1 { split($2, value, "[,}]"); print value[1]; exit }')
[ "$release_prerelease" = false ] || die "GitHub returned a prerelease"
if [ "$version" != latest ] && [ "$release_tag" != "$version" ]; then
    die "GitHub returned release '$release_tag' while '$version' was requested"
fi
expected_version=${release_tag#v}

asset_name="a3s-$release_tag-$target.tar.gz"
asset_marker="\"name\":\"$asset_name\""
asset_separator='},{"url":"https://api.github.com/repos/A3S-Lab/CLI/releases/assets/'
asset_json=$(printf '%s' "$compact_json" | awk \
    -v separator="$asset_separator" -v needle="$asset_marker" '
    function inspect(segment) {
        if (index(segment, needle)) {
            matches++
            matched = segment
        }
    }
    {
        remainder = $0
        while ((boundary = index(remainder, separator)) > 0) {
            inspect(substr(remainder, 1, boundary - 1))
            remainder = substr(remainder, boundary + 1)
        }
        inspect(remainder)
    }
    END {
        if (matches != 1) {
            exit 1
        }
        print matched
    }
') || die "release $release_tag does not contain exactly one asset for $target"
printf '%s' "$asset_json" | grep -F '"state":"uploaded"' >/dev/null \
    || die "release asset '$asset_name' is not in the uploaded state"
expected_sha=$(printf '%s' "$asset_json" \
    | awk -F'"digest":"sha256:' 'NF > 1 { split($2, value, "\""); print value[1]; exit }' \
    | tr 'A-F' 'a-f')
printf '%s\n' "$expected_sha" | grep -Eq '^[0-9a-f]{64}$' \
    || die "release asset '$asset_name' has no valid GitHub SHA-256 digest"

asset_url="https://github.com/$REPOSITORY/releases/download/$release_tag/$asset_name"
printf '%s' "$asset_json" | grep -F "\"browser_download_url\":\"$asset_url\"" >/dev/null \
    || die "release asset '$asset_name' returned an unexpected download URL"
temp_dir=$(mktemp -d "${TMPDIR:-/tmp}/a3s-install.XXXXXX") \
    || die "failed to create a temporary directory"
archive="$temp_dir/$asset_name"
archive_list="$temp_dir/archive.list"

web_parent=""
web_dir=""
staged_web=""
backup_web=""
failed_web=""
staged_binary=""
backup_binary=""
failed_binary=""
web_active=0
old_web_saved=0
binary_active=0
old_binary_saved=0
web_activation_started=0
binary_activation_started=0
committed=0

remove_generated_web_tree() {
    generated_path=${1:-}
    [ -n "$generated_path" ] || return 0
    case "$generated_path" in
        "$web_parent"/.a3s-web.*) rm -rf -- "$generated_path" ;;
        *) warn "refusing to remove unexpected directory $generated_path" ;;
    esac
}

remove_generated_binary() {
    generated_path=${1:-}
    [ -n "$generated_path" ] || return 0
    case "$generated_path" in
        "$install_dir"/.a3s.*) rm -f -- "$generated_path" ;;
        *) warn "refusing to remove unexpected file $generated_path" ;;
    esac
}

rollback_activation() {
    if [ "$binary_activation_started" -eq 1 ]; then
        if [ ! -e "$staged_binary" ] && [ ! -L "$staged_binary" ]; then
            if [ -e "$install_dir/a3s" ] || [ -L "$install_dir/a3s" ]; then
                if mv "$install_dir/a3s" "$failed_binary"; then
                    binary_active=0
                else
                    binary_active=1
                    warn "could not move the failed binary; the previous binary is preserved at $backup_binary"
                fi
            else
                binary_active=0
            fi
        else
            binary_active=0
        fi

        if [ -e "$backup_binary" ] || [ -L "$backup_binary" ]; then
            if [ ! -e "$install_dir/a3s" ] && [ ! -L "$install_dir/a3s" ]; then
                if mv "$backup_binary" "$install_dir/a3s"; then
                    old_binary_saved=0
                else
                    old_binary_saved=1
                    warn "could not restore the previous binary; its backup is preserved at $backup_binary"
                fi
            elif [ -e "$staged_binary" ] || [ -L "$staged_binary" ]; then
                # Activation did not consume the staged binary; the original is still active.
                old_binary_saved=0
            else
                old_binary_saved=1
                warn "could not restore the previous binary; its backup is preserved at $backup_binary"
            fi
        else
            old_binary_saved=0
        fi
    fi

    if [ "$web_activation_started" -eq 1 ]; then
        if [ ! -e "$staged_web" ] && [ ! -L "$staged_web" ]; then
            if [ -e "$web_dir" ] || [ -L "$web_dir" ]; then
                if mv "$web_dir" "$failed_web"; then
                    web_active=0
                else
                    web_active=1
                    warn "could not move the failed Web assets; the previous assets are preserved at $backup_web"
                fi
            else
                web_active=0
            fi
        else
            web_active=0
        fi

        if [ -e "$backup_web" ] || [ -L "$backup_web" ]; then
            if [ ! -e "$web_dir" ] && [ ! -L "$web_dir" ]; then
                if mv "$backup_web" "$web_dir"; then
                    old_web_saved=0
                else
                    old_web_saved=1
                    warn "could not restore the previous Web assets; their backup is preserved at $backup_web"
                fi
            else
                old_web_saved=1
                warn "could not restore the previous Web assets; their backup is preserved at $backup_web"
            fi
        else
            old_web_saved=0
        fi
    fi
}

cleanup() {
    exit_status=$?
    trap - EXIT HUP INT TERM
    set +e
    if [ "$committed" -ne 1 ]; then
        rollback_activation
    fi
    remove_generated_web_tree "$staged_web"
    if [ "$old_web_saved" -eq 0 ]; then
        remove_generated_web_tree "$backup_web"
    elif [ -e "$backup_web" ] || [ -L "$backup_web" ]; then
        warn "preserved the previous Web assets at $backup_web"
    fi
    remove_generated_web_tree "$failed_web"
    remove_generated_binary "$staged_binary"
    if [ "$old_binary_saved" -eq 0 ]; then
        remove_generated_binary "$backup_binary"
    elif [ -e "$backup_binary" ] || [ -L "$backup_binary" ]; then
        warn "preserved the previous binary at $backup_binary"
    fi
    remove_generated_binary "$failed_binary"
    rm -f -- "$archive" "$archive_list" "$temp_dir/a3s"
    if [ -d "$temp_dir/web" ]; then
        rm -rf -- "$temp_dir/web"
    fi
    rmdir "$temp_dir" 2>/dev/null
    release_web_lock
    release_install_lock
    exit "$exit_status"
}

trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

info "downloading $asset_name"
download_asset "$asset_url" "$archive" || die "failed to download $asset_url"

if command -v sha256sum >/dev/null 2>&1; then
    actual_sha=$(sha256sum "$archive" | awk '{ print $1 }')
elif command -v shasum >/dev/null 2>&1; then
    actual_sha=$(shasum -a 256 "$archive" | awk '{ print $1 }')
elif command -v openssl >/dev/null 2>&1; then
    actual_sha=$(openssl dgst -sha256 "$archive" | awk '{ print $NF }')
else
    die "sha256sum, shasum, or openssl is required to verify the release"
fi
actual_sha=$(printf '%s' "$actual_sha" | tr 'A-F' 'a-f')
[ "$actual_sha" = "$expected_sha" ] \
    || die "SHA-256 mismatch for $asset_name (expected $expected_sha, got $actual_sha)"
info "verified SHA-256 $actual_sha"

tar -tzf "$archive" >"$archive_list" || die "failed to inspect $asset_name"
[ "$(grep -Fxc 'a3s' "$archive_list")" -eq 1 ] \
    || die "release archive must contain exactly one a3s binary"
[ "$(grep -Fxc 'web/index.html' "$archive_list")" -eq 1 ] \
    || die "release archive must contain exactly one web/index.html"
duplicate_entries=$(awk '{ sub(/\/$/, ""); print }' "$archive_list" | LC_ALL=C sort | uniq -d)
[ -z "$duplicate_entries" ] \
    || die "release archive contains duplicate paths: $duplicate_entries"
tar -tvzf "$archive" | awk '
    substr($1, 1, 1) != "-" && substr($1, 1, 1) != "d" { unsafe = 1 }
    END { exit unsafe }
' || die "release archive contains a link or special file"
while IFS= read -r entry; do
    case "$entry" in
        a3s|web|web/|web/*) ;;
        *) die "release archive contains an unexpected path: $entry" ;;
    esac
    case "/$entry/" in
        */../*|*/./*) die "release archive contains an unsafe path: $entry" ;;
    esac
done <"$archive_list"

tar --no-same-owner --no-same-permissions -xzf "$archive" -C "$temp_dir" a3s web \
    || die "failed to extract $asset_name"
[ -f "$temp_dir/a3s" ] && [ ! -L "$temp_dir/a3s" ] \
    || die "the extracted a3s binary is not a regular file"
[ -f "$temp_dir/web/index.html" ] && [ ! -L "$temp_dir/web/index.html" ] \
    || die "the extracted Web workspace is invalid"
unsafe_extracted=$(find "$temp_dir/web" ! -type d ! -type f -print)
[ -z "$unsafe_extracted" ] \
    || die "the extracted Web workspace contains a link or special file: $unsafe_extracted"
chmod 755 "$temp_dir/a3s" || die "failed to make the staged a3s binary executable"

verify_binary_version() {
    candidate=$1
    candidate_output=$("$candidate" --version 2>&1) || return 1
    [ "$candidate_output" = "a3s $expected_version" ] || {
        warn "binary reported '$candidate_output', expected version $expected_version"
        return 1
    }
}

if [ -n "${A3S_DATA_HOME:-}" ]; then
    data_root=${A3S_DATA_HOME%/}
elif [ "$os" = apple-darwin ]; then
    [ -n "${HOME:-}" ] || die "HOME or A3S_DATA_HOME is required for Web assets"
    data_root="$HOME/Library/Application Support/A3S"
elif [ -n "${XDG_DATA_HOME:-}" ]; then
    data_root="${XDG_DATA_HOME%/}/a3s"
else
    [ -n "${HOME:-}" ] || die "HOME, XDG_DATA_HOME, or A3S_DATA_HOME is required for Web assets"
    data_root="$HOME/.local/share/a3s"
fi
mkdir -p "$data_root" || die "failed to create $data_root"
data_root=$(CDPATH= cd -P "$data_root" && pwd -P) \
    || die "failed to resolve the A3S data directory"
[ "$data_root" != / ] || die "refusing to use a filesystem root as A3S_DATA_HOME"
web_parent="$data_root/web"
mkdir -p "$web_parent" || die "failed to create $web_parent"
web_parent=$(CDPATH= cd -P "$web_parent" && pwd -P) \
    || die "failed to resolve the Web data directory"
[ "$web_parent" != / ] || die "refusing to install Web assets into /"
web_dir="$web_parent/$expected_version"
web_lock_dir="$web_parent/.a3s-installer.lock"
if [ "$web_lock_dir" != "$lock_dir" ]; then
    mkdir "$web_lock_dir" 2>/dev/null \
        || die "another installer may be updating $web_parent (remove a stale lock only after checking)"
    web_lock_acquired=1
fi

if [ -f "$install_dir/web/index.html" ]; then
    die "$install_dir/web would override the versioned Web assets; remove that packaged Web directory and retry"
fi
case "$install_dir" in
    */bin)
        packaged_web="${install_dir%/bin}/share/a3s/web"
        if [ -f "$packaged_web/index.html" ]; then
            die "$packaged_web would override the versioned Web assets; remove that packaged Web directory and retry"
        fi
        ;;
esac

activation_id=$$
staged_web="$web_parent/.a3s-web.new.$activation_id"
backup_web="$web_parent/.a3s-web.backup.$activation_id"
failed_web="$web_parent/.a3s-web.failed.$activation_id"
staged_binary="$install_dir/.a3s.new.$activation_id"
backup_binary="$install_dir/.a3s.backup.$activation_id"
failed_binary="$install_dir/.a3s.failed.$activation_id"

for generated_path in "$staged_web" "$backup_web" "$failed_web" \
    "$staged_binary" "$backup_binary" "$failed_binary"; do
    [ ! -e "$generated_path" ] && [ ! -L "$generated_path" ] \
        || die "temporary activation path already exists: $generated_path"
done

mv "$temp_dir/web" "$staged_web" || die "failed to stage Web assets"
cp "$temp_dir/a3s" "$staged_binary" || die "failed to stage the a3s binary"
chmod 755 "$staged_binary" || die "failed to make the a3s binary executable"
verify_binary_version "$staged_binary" \
    || die "the staged a3s binary failed its version check"

web_activation_started=1
if [ -L "$web_dir" ]; then
    die "refusing to replace symlink $web_dir"
fi
if [ -e "$web_dir" ]; then
    [ -d "$web_dir" ] || die "$web_dir is not a directory"
    mv "$web_dir" "$backup_web" || die "failed to back up the existing Web assets"
    old_web_saved=1
fi
mv "$staged_web" "$web_dir" || die "failed to activate the Web assets"
web_active=1
staged_web=""

binary_activation_started=1
if [ -L "$install_dir/a3s" ]; then
    die "refusing to replace symlink $install_dir/a3s"
fi
if [ -e "$install_dir/a3s" ]; then
    [ -f "$install_dir/a3s" ] || die "$install_dir/a3s is not a regular file"
    cp -p "$install_dir/a3s" "$backup_binary" \
        || die "failed to back up the existing a3s binary"
    old_binary_saved=1
fi
mv -f "$staged_binary" "$install_dir/a3s" || die "failed to activate the a3s binary"
binary_active=1
staged_binary=""

verify_binary_version "$install_dir/a3s" \
    || die "the installed a3s binary failed its version check"

committed=1
if remove_generated_web_tree "$backup_web"; then
    old_web_saved=0
    backup_web=""
else
    warn "could not remove the old Web backup at $backup_web"
fi
if remove_generated_binary "$backup_binary"; then
    old_binary_saved=0
    backup_binary=""
else
    warn "could not remove the old binary backup at $backup_binary"
fi

path_is_ready=0
case ":${PATH:-}:" in
    *":$install_dir:"*) path_is_ready=1 ;;
esac

if [ "$modify_path" -eq 1 ]; then
    if [ "$requested_default_install" -ne 1 ]; then
        warn "custom install directory $install_dir was not added to PATH automatically"
        if [ "$path_is_ready" -eq 0 ]; then
            warn "add it for this shell with: export PATH=\"$install_dir:\$PATH\""
        fi
    else
        shell_name=${SHELL:-}
        shell_name=${shell_name##*/}
        case "$shell_name" in
            zsh)
                profile="$HOME/.zshrc"
                path_line='export PATH="$HOME/.local/bin:$PATH"'
                ;;
            bash)
                profile="$HOME/.bashrc"
                path_line='export PATH="$HOME/.local/bin:$PATH"'
                ;;
            fish)
                profile="$HOME/.config/fish/config.fish"
                path_line='fish_add_path "$HOME/.local/bin"'
                mkdir -p "$HOME/.config/fish"
                ;;
            *)
                profile="$HOME/.profile"
                path_line='export PATH="$HOME/.local/bin:$PATH"'
                ;;
        esac
        if ! grep -F "$path_line" "$profile" >/dev/null 2>&1; then
            if printf '\n# Added by the A3S installer.\n%s\n' "$path_line" >>"$profile"; then
                info "added $DEFAULT_INSTALL_DIR to PATH in $profile"
            else
                warn "could not update $profile"
            fi
        fi
        if [ "$path_is_ready" -eq 0 ]; then
            warn "restart your shell or run: export PATH=\"$install_dir:\$PATH\""
        fi
    fi
elif [ "$path_is_ready" -eq 0 ]; then
    warn "$install_dir is not on PATH"
    warn "add it for this shell with: export PATH=\"$install_dir:\$PATH\""
fi

active_a3s=$(command -v a3s 2>/dev/null || true)
if [ -n "$active_a3s" ] && [ "$active_a3s" != "$install_dir/a3s" ]; then
    warn "a3s currently resolves to $active_a3s; ensure $install_dir precedes it on PATH"
fi

info "installed a3s $expected_version to $install_dir/a3s"
info "installed Web assets to $web_dir"

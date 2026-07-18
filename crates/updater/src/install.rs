//! Binary replacement logic.

use std::path::{Path, PathBuf};

use anyhow::Context;

/// Replace the currently running binary with a new one.
///
/// 1. Determines the current executable path.
/// 2. Renames the current binary to `{name}.bak`.
/// 3. Copies the new binary into place.
/// 4. Sets executable permissions (unix).
///
/// Note: The caller is responsible for cleaning up the temp directory
/// that contains `new_binary_path` (e.g. by dropping a `TempDir`).
pub fn replace_binary(new_binary_path: &Path) -> anyhow::Result<()> {
    let current_exe = std::env::current_exe()
        .map_err(|e| anyhow::anyhow!("Failed to determine current executable path: {}", e))?;

    // Resolve symlinks to get the real path
    let current_exe = current_exe
        .canonicalize()
        .map_err(|e| anyhow::anyhow!("Failed to resolve current executable path: {}", e))?;

    replace_binary_at(new_binary_path, &current_exe)
}

fn replace_binary_at(new_binary_path: &Path, current_exe: &Path) -> anyhow::Result<()> {
    if !new_binary_path.is_file() {
        return Err(anyhow::anyhow!(
            "new binary does not exist: {}",
            new_binary_path.display()
        ));
    }
    let parent = current_exe
        .parent()
        .context("current executable has no parent directory")?;
    let staging = tempfile::NamedTempFile::new_in(parent).with_context(|| {
        format!(
            "failed to create update staging file in {}",
            parent.display()
        )
    })?;
    std::fs::copy(new_binary_path, staging.path()).with_context(|| {
        format!(
            "failed to stage new binary {} in {}",
            new_binary_path.display(),
            parent.display()
        )
    })?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        std::fs::set_permissions(staging.path(), std::fs::Permissions::from_mode(0o755))
            .with_context(|| {
                format!(
                    "failed to set executable permissions on {}",
                    staging.path().display()
                )
            })?;
    }
    staging
        .as_file()
        .sync_all()
        .with_context(|| format!("failed to sync staged binary in {}", parent.display()))?;

    let backup = unique_backup_path(current_exe);
    std::fs::rename(current_exe, &backup).with_context(|| {
        format!(
            "failed to move current binary {} to {}",
            current_exe.display(),
            backup.display()
        )
    })?;
    match staging.persist(current_exe) {
        Ok(_) => {
            let _ = std::fs::remove_file(&backup);
            sync_directory(parent)?;
            Ok(())
        }
        Err(error) => {
            let restore = std::fs::rename(&backup, current_exe);
            if let Err(restore_error) = restore {
                return Err(anyhow::anyhow!(
                    "failed to activate staged binary at {}: {}; failed to restore backup {}: {}",
                    current_exe.display(),
                    error.error,
                    backup.display(),
                    restore_error
                ));
            }
            Err(error.error).with_context(|| {
                format!(
                    "failed to atomically activate staged binary at {}",
                    current_exe.display()
                )
            })
        }
    }
}

fn unique_backup_path(current_exe: &Path) -> PathBuf {
    let parent = current_exe.parent().unwrap_or_else(|| Path::new("."));
    let name = current_exe
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("binary");
    for suffix in 0..u32::MAX {
        let candidate = parent.join(format!(".{name}.a3s-backup-{suffix}"));
        if !candidate.exists() {
            return candidate;
        }
    }
    parent.join(format!(".{name}.a3s-backup"))
}

#[cfg(unix)]
fn sync_directory(path: &Path) -> anyhow::Result<()> {
    std::fs::File::open(path)
        .and_then(|directory| directory.sync_all())
        .with_context(|| format!("failed to sync update directory {}", path.display()))
}

#[cfg(not(unix))]
fn sync_directory(_path: &Path) -> anyhow::Result<()> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn atomic_replacement_preserves_the_old_binary_until_staging_succeeds() {
        let temp = tempfile::tempdir().unwrap();
        let current = temp.path().join("a3s");
        let replacement = temp.path().join("replacement");
        std::fs::write(&current, b"old").unwrap();
        std::fs::write(&replacement, b"new").unwrap();

        replace_binary_at(&replacement, &current).unwrap();

        assert_eq!(std::fs::read(&current).unwrap(), b"new");
        assert!(!temp
            .path()
            .read_dir()
            .unwrap()
            .flatten()
            .any(|entry| entry.file_name().to_string_lossy().contains("a3s-backup")));
    }

    #[test]
    fn missing_replacement_leaves_the_current_binary_unchanged() {
        let temp = tempfile::tempdir().unwrap();
        let current = temp.path().join("a3s");
        std::fs::write(&current, b"old").unwrap();

        assert!(replace_binary_at(&temp.path().join("missing"), &current).is_err());

        assert_eq!(std::fs::read(&current).unwrap(), b"old");
    }
}

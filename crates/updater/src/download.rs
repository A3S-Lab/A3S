//! Download and extract release assets.

use anyhow::{bail, Context};
use sha2::{Digest, Sha256};
use std::collections::BTreeSet;
use std::io::Cursor;
use std::path::{Component, Path, PathBuf};
use tempfile::TempDir;

const MAX_ARCHIVE_BYTES: u64 = 512 * 1024 * 1024;
const MAX_EXTRACTED_BYTES: u64 = 4 * 1024 * 1024 * 1024;
const MAX_EXTRACTED_ENTRIES: usize = 50_000;

/// Download one release asset into memory.
pub async fn download_asset(url: &str) -> anyhow::Result<Vec<u8>> {
    let client = reqwest::Client::builder()
        .user_agent("a3s-updater/0.3")
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .context("failed to build release download client")?;
    let mut response = client
        .get(url)
        .send()
        .await
        .with_context(|| format!("failed to download release asset from {url}"))?;
    if !response.status().is_success() {
        bail!(
            "release asset download returned HTTP {} for {}",
            response.status(),
            url
        );
    }
    if response
        .content_length()
        .is_some_and(|size| size > MAX_ARCHIVE_BYTES)
    {
        bail!("release asset exceeds the {} byte limit", MAX_ARCHIVE_BYTES);
    }
    let initial_capacity = response
        .content_length()
        .unwrap_or_default()
        .min(MAX_ARCHIVE_BYTES) as usize;
    let mut bytes = Vec::with_capacity(initial_capacity);
    while let Some(chunk) = response
        .chunk()
        .await
        .with_context(|| format!("failed to read release asset body from {url}"))?
    {
        let next_len = bytes.len().saturating_add(chunk.len());
        if next_len as u64 > MAX_ARCHIVE_BYTES {
            bail!("release asset exceeds the {} byte limit", MAX_ARCHIVE_BYTES);
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}

/// Return a lowercase SHA-256 digest.
pub fn sha256_hex(data: &[u8]) -> String {
    format!("{:x}", Sha256::digest(data))
}

/// Verify bytes against a hexadecimal SHA-256 digest.
pub fn verify_sha256(data: &[u8], expected: &str) -> anyhow::Result<()> {
    let expected = expected
        .trim()
        .strip_prefix("sha256:")
        .unwrap_or(expected.trim())
        .to_ascii_lowercase();
    if expected.len() != 64 || !expected.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        bail!("invalid SHA-256 digest '{expected}'");
    }
    let actual = sha256_hex(data);
    if actual != expected {
        bail!("release checksum mismatch: expected {expected}, got {actual}");
    }
    Ok(())
}

/// Safely extract a complete gzip-compressed tar archive.
///
/// Only directories and regular files are accepted. Links and special files
/// are rejected, and every path must remain below the destination.
pub fn extract_tar_gz_archive(data: &[u8], dest_dir: &Path) -> anyhow::Result<Vec<PathBuf>> {
    std::fs::create_dir_all(dest_dir)
        .with_context(|| format!("failed to create extraction root {}", dest_dir.display()))?;
    let gz = flate2::read::GzDecoder::new(data);
    let mut archive = tar::Archive::new(gz);
    let mut extracted = Vec::new();
    let mut seen = BTreeSet::new();
    let mut extracted_bytes = 0_u64;

    for (entry_count, entry) in archive
        .entries()
        .context("failed to read tar entries")?
        .enumerate()
    {
        let mut entry = entry.context("failed to read tar entry")?;
        if entry_count >= MAX_EXTRACTED_ENTRIES {
            bail!("archive exceeds the {MAX_EXTRACTED_ENTRIES} entry limit");
        }
        let entry_path = entry.path().context("failed to read tar entry path")?;
        let entry_type = entry.header().entry_type();
        let Some(relative) = sanitized_relative_path(&entry_path)? else {
            if entry_type.is_dir() {
                // Common tar producers emit `./` as an explicit marker for the
                // extraction root. It does not create or own a child path.
                continue;
            }
            bail!("archive contains a non-directory root entry");
        };
        if !seen.insert(relative.clone()) {
            bail!("archive contains duplicate entry {}", relative.display());
        }
        let output = dest_dir.join(&relative);

        if entry_type.is_dir() {
            std::fs::create_dir_all(&output)
                .with_context(|| format!("failed to create {}", output.display()))?;
        } else if entry_type.is_file() {
            extracted_bytes = extracted_bytes.saturating_add(entry.size());
            if extracted_bytes > MAX_EXTRACTED_BYTES {
                bail!("archive exceeds the {MAX_EXTRACTED_BYTES} extracted byte limit");
            }
            if let Some(parent) = output.parent() {
                std::fs::create_dir_all(parent)
                    .with_context(|| format!("failed to create {}", parent.display()))?;
            }
            entry
                .unpack(&output)
                .with_context(|| format!("failed to extract {}", output.display()))?;
            extracted.push(output);
        } else {
            bail!(
                "archive entry uses unsupported link or special type: {}",
                relative.display()
            );
        }
    }
    Ok(extracted)
}

/// Safely extract a complete ZIP archive.
///
/// Directory entries and regular files are accepted. Symbolic links and paths
/// outside the destination are rejected.
pub fn extract_zip_archive(data: &[u8], dest_dir: &Path) -> anyhow::Result<Vec<PathBuf>> {
    std::fs::create_dir_all(dest_dir)
        .with_context(|| format!("failed to create extraction root {}", dest_dir.display()))?;
    let mut archive = zip::ZipArchive::new(Cursor::new(data)).context("failed to read ZIP")?;
    if archive.len() > MAX_EXTRACTED_ENTRIES {
        bail!("ZIP exceeds the {MAX_EXTRACTED_ENTRIES} entry limit");
    }
    let mut extracted = Vec::new();
    let mut seen = BTreeSet::new();
    let mut extracted_bytes = 0_u64;

    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .with_context(|| format!("failed to read ZIP entry {index}"))?;
        if entry.is_symlink() {
            bail!(
                "ZIP entry uses an unsupported symbolic link: {}",
                entry.name()
            );
        }
        let enclosed = entry
            .enclosed_name()
            .with_context(|| format!("ZIP entry escapes extraction root: {}", entry.name()))?;
        let Some(relative) = sanitized_relative_path(&enclosed)? else {
            if entry.is_dir() {
                continue;
            }
            bail!("ZIP contains a non-directory root entry");
        };
        if !seen.insert(relative.clone()) {
            bail!("ZIP contains duplicate entry {}", relative.display());
        }
        let output = dest_dir.join(&relative);

        if entry.is_dir() {
            std::fs::create_dir_all(&output)
                .with_context(|| format!("failed to create {}", output.display()))?;
        } else if entry.is_file() {
            extracted_bytes = extracted_bytes.saturating_add(entry.size());
            if extracted_bytes > MAX_EXTRACTED_BYTES {
                bail!("ZIP exceeds the {MAX_EXTRACTED_BYTES} extracted byte limit");
            }
            if let Some(parent) = output.parent() {
                std::fs::create_dir_all(parent)
                    .with_context(|| format!("failed to create {}", parent.display()))?;
            }
            let mut file = std::fs::File::create(&output)
                .with_context(|| format!("failed to create {}", output.display()))?;
            std::io::copy(&mut entry, &mut file)
                .with_context(|| format!("failed to extract {}", output.display()))?;
            extracted.push(output);
        } else {
            bail!("ZIP entry uses an unsupported type: {}", entry.name());
        }
    }
    Ok(extracted)
}

fn sanitized_relative_path(path: &Path) -> anyhow::Result<Option<PathBuf>> {
    if path.as_os_str().is_empty() {
        bail!("archive contains an empty entry path");
    }
    let mut sanitized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Normal(segment) => sanitized.push(segment),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                bail!("archive entry escapes extraction root: {}", path.display())
            }
        }
    }
    if sanitized.as_os_str().is_empty() {
        return Ok(None);
    }
    Ok(Some(sanitized))
}

/// Extract a supported release archive according to its published file name.
pub fn extract_release_archive(
    data: &[u8],
    dest_dir: &Path,
    archive_name: &str,
) -> anyhow::Result<Vec<PathBuf>> {
    if archive_name.ends_with(".tar.gz") {
        extract_tar_gz_archive(data, dest_dir)
    } else if archive_name.ends_with(".zip") {
        extract_zip_archive(data, dest_dir)
    } else {
        bail!("unsupported release archive format: {archive_name}")
    }
}

/// Safely extract a verified release archive and resolve exactly one binary.
///
/// The caller must verify the archive digest before calling this function.
/// `TempDir` keeps every extracted file isolated until replacement completes.
pub(crate) fn extract_release_binary(
    data: &[u8],
    archive_name: &str,
    binary_name: &str,
) -> anyhow::Result<(PathBuf, TempDir)> {
    let temp_dir = TempDir::new().context("failed to create release staging directory")?;
    let files = extract_release_archive(data, temp_dir.path(), archive_name)?;
    let mut matches = files.into_iter().filter(|path| {
        path.file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name == binary_name)
    });
    let binary = matches
        .next()
        .with_context(|| format!("binary '{binary_name}' not found in release archive"))?;
    if matches.next().is_some() {
        bail!("release archive contains multiple binaries named '{binary_name}'");
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        std::fs::set_permissions(&binary, std::fs::Permissions::from_mode(0o755))
            .with_context(|| format!("failed to make {} executable", binary.display()))?;
    }
    Ok((binary, temp_dir))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sha256_verification_accepts_prefix_and_rejects_mismatch() {
        let digest = sha256_hex(b"a3s");
        verify_sha256(b"a3s", &digest).unwrap();
        verify_sha256(b"a3s", &format!("sha256:{digest}")).unwrap();
        assert!(verify_sha256(b"other", &digest).is_err());
        assert!(verify_sha256(b"a3s", "not-a-digest").is_err());
    }

    #[test]
    fn full_archive_extraction_rejects_links() {
        let mut tar_bytes = Vec::new();
        {
            let encoder =
                flate2::write::GzEncoder::new(&mut tar_bytes, flate2::Compression::default());
            let mut builder = tar::Builder::new(encoder);
            let body = b"hello";
            let mut header = tar::Header::new_gnu();
            header.set_path("package/bin/a3s-use").unwrap();
            header.set_size(body.len() as u64);
            header.set_mode(0o755);
            header.set_cksum();
            builder.append(&header, &body[..]).unwrap();
            builder.finish().unwrap();
        }
        let temp = tempfile::tempdir().unwrap();
        let files = extract_tar_gz_archive(&tar_bytes, temp.path()).unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(
            std::fs::read_to_string(temp.path().join("package/bin/a3s-use")).unwrap(),
            "hello"
        );

        let mut linked_archive = Vec::new();
        {
            let encoder =
                flate2::write::GzEncoder::new(&mut linked_archive, flate2::Compression::default());
            let mut builder = tar::Builder::new(encoder);
            let mut header = tar::Header::new_gnu();
            header.set_entry_type(tar::EntryType::Symlink);
            header.set_path("package/escape").unwrap();
            header.set_link_name("../../outside").unwrap();
            header.set_size(0);
            header.set_cksum();
            builder.append(&header, std::io::empty()).unwrap();
            builder.finish().unwrap();
        }
        assert!(extract_tar_gz_archive(&linked_archive, temp.path()).is_err());
    }

    #[test]
    fn tar_archive_accepts_an_explicit_current_directory_root() {
        let mut tar_bytes = Vec::new();
        {
            let encoder =
                flate2::write::GzEncoder::new(&mut tar_bytes, flate2::Compression::default());
            let mut builder = tar::Builder::new(encoder);

            let mut root = tar::Header::new_gnu();
            root.set_path(".").unwrap();
            root.set_entry_type(tar::EntryType::Directory);
            root.set_size(0);
            root.set_mode(0o755);
            root.set_cksum();
            builder.append(&root, std::io::empty()).unwrap();

            let body = b"fixture";
            let mut binary = tar::Header::new_gnu();
            binary.set_path("./a3s-use").unwrap();
            binary.set_size(body.len() as u64);
            binary.set_mode(0o755);
            binary.set_cksum();
            builder.append(&binary, &body[..]).unwrap();
            builder.finish().unwrap();
        }

        let temp = tempfile::tempdir().unwrap();
        let files = extract_tar_gz_archive(&tar_bytes, temp.path()).unwrap();
        assert_eq!(files, [temp.path().join("a3s-use")]);
        assert_eq!(std::fs::read(&files[0]).unwrap(), b"fixture");
    }

    #[test]
    fn archive_path_sanitization_distinguishes_root_markers_from_empty_paths() {
        assert_eq!(sanitized_relative_path(Path::new(".")).unwrap(), None);
        assert_eq!(
            sanitized_relative_path(Path::new("./package/a3s-use")).unwrap(),
            Some(PathBuf::from("package/a3s-use"))
        );
        assert!(sanitized_relative_path(Path::new("")).is_err());
        assert!(sanitized_relative_path(Path::new("../escape")).is_err());
    }

    #[test]
    fn zip_archive_extraction_accepts_files_and_rejects_traversal() {
        use std::io::Write;
        use zip::write::SimpleFileOptions;

        let mut bytes = Vec::new();
        {
            let cursor = Cursor::new(&mut bytes);
            let mut writer = zip::ZipWriter::new(cursor);
            writer
                .start_file("package/a3s-use.exe", SimpleFileOptions::default())
                .unwrap();
            writer.write_all(b"fixture").unwrap();
            writer.finish().unwrap();
        }
        let temp = tempfile::tempdir().unwrap();
        let files = extract_zip_archive(&bytes, temp.path()).unwrap();
        assert_eq!(files, [temp.path().join("package/a3s-use.exe")]);
        assert_eq!(std::fs::read(&files[0]).unwrap(), b"fixture");

        let mut traversal = Vec::new();
        {
            let cursor = Cursor::new(&mut traversal);
            let mut writer = zip::ZipWriter::new(cursor);
            writer
                .start_file("../escape", SimpleFileOptions::default())
                .unwrap();
            writer.write_all(b"escape").unwrap();
            writer.finish().unwrap();
        }
        assert!(extract_zip_archive(&traversal, temp.path()).is_err());
    }

    #[test]
    fn release_archive_dispatch_rejects_unknown_formats() {
        let temp = tempfile::tempdir().unwrap();
        assert!(extract_release_archive(b"fixture", temp.path(), "release.rar").is_err());
    }
}

//! Download and extract release assets.

use anyhow::{bail, Context};
use sha2::{Digest, Sha256};
use std::io::Cursor;
use std::path::{Path, PathBuf};
use tempfile::TempDir;

const MAX_ARCHIVE_BYTES: u64 = 4 * 1024 * 1024 * 1024;

/// Download one release asset into memory.
pub async fn download_asset(url: &str) -> anyhow::Result<Vec<u8>> {
    let client = reqwest::Client::builder()
        .user_agent("a3s-updater/0.3")
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .context("failed to build release download client")?;
    let response = client
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
    let bytes = response
        .bytes()
        .await
        .with_context(|| format!("failed to read release asset body from {url}"))?;
    if bytes.len() as u64 > MAX_ARCHIVE_BYTES {
        bail!("release asset exceeds the {} byte limit", MAX_ARCHIVE_BYTES);
    }
    Ok(bytes.to_vec())
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

    for entry in archive.entries().context("failed to read tar entries")? {
        let mut entry = entry.context("failed to read tar entry")?;
        let relative = entry.path().context("failed to read tar entry path")?;
        if relative.is_absolute()
            || relative.components().any(|component| {
                matches!(
                    component,
                    std::path::Component::ParentDir | std::path::Component::RootDir
                )
            })
        {
            bail!(
                "archive entry escapes extraction root: {}",
                relative.display()
            );
        }
        let output = dest_dir.join(relative.as_ref());
        if !output.starts_with(dest_dir) {
            bail!(
                "archive entry escapes extraction root: {}",
                relative.display()
            );
        }

        let entry_type = entry.header().entry_type();
        if entry_type.is_dir() {
            std::fs::create_dir_all(&output)
                .with_context(|| format!("failed to create {}", output.display()))?;
        } else if entry_type.is_file() {
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
    let mut extracted = Vec::new();

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
        let relative = entry
            .enclosed_name()
            .with_context(|| format!("ZIP entry escapes extraction root: {}", entry.name()))?;
        let output = dest_dir.join(&relative);
        if !output.starts_with(dest_dir) {
            bail!("ZIP entry escapes extraction root: {}", relative.display());
        }

        if entry.is_dir() {
            std::fs::create_dir_all(&output)
                .with_context(|| format!("failed to create {}", output.display()))?;
        } else if entry.is_file() {
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

/// Download a `.tar.gz` asset and extract the binary from it.
///
/// Returns `(binary_path, temp_dir)`. The caller must keep `TempDir` alive
/// until the extracted binary has been consumed (e.g. copied into place).
/// Dropping `TempDir` automatically cleans up the temporary directory.
pub async fn download_and_extract(
    url: &str,
    binary_name: &str,
) -> anyhow::Result<(PathBuf, TempDir)> {
    let client = reqwest::Client::builder()
        .user_agent("a3s-updater/0.1")
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| anyhow::anyhow!("Failed to build HTTP client: {}", e))?;

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("Failed to download asset from {}: {}", url, e))?;

    if !response.status().is_success() {
        return Err(anyhow::anyhow!(
            "Download failed with status {} for {}",
            response.status(),
            url
        ));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| anyhow::anyhow!("Failed to read download body: {}", e))?;

    // Create a cryptographically unique temp directory (auto-cleaned on drop)
    let temp_dir =
        TempDir::new().map_err(|e| anyhow::anyhow!("Failed to create temp directory: {}", e))?;

    // Decompress gzip and extract tar
    extract_tar_gz(&bytes, temp_dir.path(), binary_name)?;

    let binary_path = temp_dir.path().join(binary_name);
    if !binary_path.exists() {
        return Err(anyhow::anyhow!(
            "Binary '{}' not found in downloaded archive",
            binary_name
        ));
    }

    Ok((binary_path, temp_dir))
}

/// Extract a `.tar.gz` archive, looking for the target binary.
fn extract_tar_gz(data: &[u8], dest_dir: &Path, binary_name: &str) -> anyhow::Result<()> {
    let gz = flate2::read::GzDecoder::new(data);
    let mut archive = tar::Archive::new(gz);

    for entry in archive
        .entries()
        .map_err(|e| anyhow::anyhow!("Failed to read tar entries: {}", e))?
    {
        let mut entry = entry.map_err(|e| anyhow::anyhow!("Failed to read tar entry: {}", e))?;

        // Only extract regular files — reject symlinks and hardlinks to prevent
        // path traversal via crafted archives.
        let entry_type = entry.header().entry_type();
        if !entry_type.is_file() {
            continue;
        }

        let path = entry
            .path()
            .map_err(|e| anyhow::anyhow!("Failed to read entry path: {}", e))?;

        // Extract only the target binary (may be at root or nested)
        let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

        if file_name == binary_name {
            entry
                .unpack(dest_dir.join(binary_name))
                .map_err(|e| anyhow::anyhow!("Failed to extract '{}': {}", binary_name, e))?;
            return Ok(());
        }
    }

    Err(anyhow::anyhow!(
        "Binary '{}' not found in archive",
        binary_name
    ))
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

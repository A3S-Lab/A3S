use std::path::{Component, Path};

use anyhow::{bail, Context};

pub(super) fn validate_identifier(value: &str, label: &str) -> anyhow::Result<()> {
    if value.is_empty()
        || value.len() > 128
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'))
    {
        bail!("{label} must be a bounded ASCII identifier");
    }
    Ok(())
}

pub(super) fn validate_sha256(value: &str) -> anyhow::Result<()> {
    if value.len() != 64 || !value.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        bail!("artifact SHA-256 must contain exactly 64 hexadecimal characters");
    }
    if value.bytes().any(|byte| byte.is_ascii_uppercase()) {
        bail!("artifact SHA-256 must use lowercase hexadecimal");
    }
    Ok(())
}

pub(super) fn validate_artifact_url(value: &str) -> anyhow::Result<()> {
    if value.len() > 2048 {
        bail!("artifact URL is too long");
    }
    let url = url::Url::parse(value).context("artifact URL is invalid")?;
    if url.scheme() != "https"
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        bail!("artifact URL must be credential-free HTTPS without query or fragment data");
    }
    Ok(())
}

pub(super) fn validate_absolute_path(path: &Path, label: &str) -> anyhow::Result<()> {
    if !path.is_absolute()
        || path
            .components()
            .any(|part| matches!(part, Component::ParentDir | Component::CurDir))
    {
        bail!("{label} must be an absolute path without traversal");
    }
    Ok(())
}

pub(super) fn decode_hex<const N: usize>(value: &str, label: &str) -> anyhow::Result<[u8; N]> {
    if value.len() != N * 2 || !value.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        bail!(
            "{label} must contain exactly {} hexadecimal characters",
            N * 2
        );
    }
    let mut output = [0_u8; N];
    for (index, chunk) in value.as_bytes().chunks_exact(2).enumerate() {
        let text = std::str::from_utf8(chunk)?;
        output[index] = u8::from_str_radix(text, 16)?;
    }
    Ok(output)
}

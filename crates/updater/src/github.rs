//! GitHub Releases API client.

use serde::Deserialize;

/// A GitHub release.
#[derive(Debug, Clone, Deserialize)]
pub struct Release {
    /// Tag name (e.g. `"v0.3.0"`).
    pub tag_name: String,
    /// Release notes body (may be absent).
    pub body: Option<String>,
    /// Attached binary assets.
    pub assets: Vec<Asset>,
}

/// A single release asset (downloadable file).
#[derive(Debug, Clone, Deserialize)]
pub struct Asset {
    /// File name (e.g. `"a3s-code-0.3.0-darwin-arm64.tar.gz"`).
    pub name: String,
    /// Direct download URL.
    pub browser_download_url: String,
    /// GitHub-provided content digest, when available.
    pub digest: Option<String>,
}

/// Fetch the latest release from a GitHub repository.
pub async fn fetch_latest_release(owner: &str, repo: &str) -> anyhow::Result<Release> {
    let api_base = github_api_base();
    fetch_release_url(&format!("{api_base}/repos/{owner}/{repo}/releases/latest")).await
}

/// Fetch one release by semantic version, or the latest release when omitted.
pub async fn fetch_release(
    owner: &str,
    repo: &str,
    version: Option<&str>,
) -> anyhow::Result<Release> {
    let Some(version) = version else {
        return fetch_latest_release(owner, repo).await;
    };
    let version = version.trim().trim_start_matches('v');
    if version.is_empty() {
        return Err(anyhow::anyhow!("release version cannot be empty"));
    }
    let api_base = github_api_base();
    fetch_release_url(&format!(
        "{api_base}/repos/{owner}/{repo}/releases/tags/v{version}"
    ))
    .await
}

fn github_api_base() -> String {
    std::env::var("A3S_UPDATER_GITHUB_API_BASE")
        .unwrap_or_else(|_| "https://api.github.com".to_string())
        .trim_end_matches('/')
        .to_string()
}

async fn fetch_release_url(url: &str) -> anyhow::Result<Release> {
    let client = reqwest::Client::builder()
        .user_agent("a3s-updater/0.1")
        .build()
        .map_err(|e| anyhow::anyhow!("Failed to build HTTP client: {}", e))?;

    let response = client
        .get(url)
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("Failed to fetch release from {}: {}", url, e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(anyhow::anyhow!(
            "GitHub API returned {} for {}: {}",
            status,
            url,
            body
        ));
    }

    let release: Release = response
        .json()
        .await
        .map_err(|e| anyhow::anyhow!("Failed to parse GitHub release JSON: {}", e))?;

    Ok(release)
}

/// Parse a version string, stripping an optional `v` prefix.
pub fn parse_version(tag: &str) -> anyhow::Result<semver::Version> {
    let version_str = tag.strip_prefix('v').unwrap_or(tag);
    semver::Version::parse(version_str)
        .map_err(|e| anyhow::anyhow!("Failed to parse version '{}': {}", tag, e))
}

/// Build the expected asset file name for a given binary/version/platform.
pub fn asset_name(binary_name: &str, version: &str, os: &str, arch: &str) -> String {
    format!("{}-{}-{}-{}.tar.gz", binary_name, version, os, arch)
}

/// Find the asset matching the current platform from a release's asset list.
pub fn find_matching_asset<'a>(
    release: &'a Release,
    binary_name: &str,
    os: &str,
    arch: &str,
) -> Option<&'a Asset> {
    let version = parse_version(&release.tag_name).ok()?;
    let expected = asset_name(binary_name, &version.to_string(), os, arch);
    release.assets.iter().find(|a| a.name == expected)
}

/// Return a validated GitHub-provided SHA-256 digest for a release asset.
///
/// A missing digest is a hard failure: callers must never silently downgrade
/// a self-update to an unverified download.
pub fn asset_sha256(asset: &Asset) -> anyhow::Result<String> {
    let digest = asset
        .digest
        .as_deref()
        .ok_or_else(|| anyhow::anyhow!("release asset '{}' has no SHA-256 digest", asset.name))?;
    let digest = digest.strip_prefix("sha256:").unwrap_or(digest);
    if digest.len() != 64 || !digest.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(anyhow::anyhow!(
            "release asset '{}' has an invalid SHA-256 digest",
            asset.name
        ));
    }
    Ok(digest.to_ascii_lowercase())
}

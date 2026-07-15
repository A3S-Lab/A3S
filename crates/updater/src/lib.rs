//! Self-update library for A3S CLI binaries via GitHub Releases.
//!
//! Each binary provides an [`UpdateConfig`] describing itself, then calls
//! [`run_update`] to check for a newer release, download the matching
//! platform asset, and replace the running binary in-place.

mod component;
mod download;
mod github;
mod install;
mod platform;

pub use component::{
    uninstall_owned_files, ComponentReceipt, DirectoryActivation, InstallProvenance, ReceiptStore,
    RECEIPT_SCHEMA_VERSION,
};
pub use download::{
    download_asset, extract_release_archive, extract_tar_gz_archive, extract_zip_archive,
    sha256_hex, verify_sha256,
};
pub use github::{
    fetch_latest_release, fetch_release, find_matching_asset, parse_version, Asset, Release,
};

/// Configuration for the update check — each binary provides its own.
pub struct UpdateConfig {
    /// Name of the binary file (e.g. `"a3s-code"`).
    pub binary_name: &'static str,
    /// Crate name on crates.io (for `cargo install` fallback message).
    pub crate_name: &'static str,
    /// Current version string, typically `env!("CARGO_PKG_VERSION")`.
    pub current_version: &'static str,
    /// GitHub repository owner (e.g. `"A3S-Lab"`).
    pub github_owner: &'static str,
    /// GitHub repository name (e.g. `"Code"`).
    pub github_repo: &'static str,
}

/// Run the full update flow: check -> download -> replace.
pub async fn run_update(config: &UpdateConfig) -> anyhow::Result<()> {
    println!("Checking for updates...");

    let (os, arch) = platform::platform_target()?;
    let release = github::fetch_latest_release(config.github_owner, config.github_repo).await?;
    let latest_version = github::parse_version(&release.tag_name)?;
    let current_version = semver::Version::parse(config.current_version).map_err(|e| {
        anyhow::anyhow!(
            "Failed to parse current version '{}': {}",
            config.current_version,
            e
        )
    })?;

    println!("Current version: {}", current_version);
    println!("Latest version:  {}", latest_version);

    if current_version >= latest_version {
        println!("\nAlready up to date (v{}).", current_version);
        return Ok(());
    }

    let asset = match github::find_matching_asset(&release, config.binary_name, &os, &arch) {
        Some(a) => a,
        None => {
            println!("\nNo pre-built binary found for {}-{}.", os, arch);
            println!("Run manually: cargo install {}", config.crate_name);
            return Ok(());
        }
    };

    println!(
        "\nDownloading {} v{} ({}-{})...",
        config.binary_name, latest_version, os, arch
    );

    let (new_binary, _temp_dir) =
        download::download_and_extract(&asset.browser_download_url, config.binary_name).await?;
    install::replace_binary(&new_binary)?;
    // _temp_dir is dropped here, automatically cleaning up the temp directory

    println!(
        "\nUpdated {}: {} -> {}",
        config.binary_name, current_version, latest_version
    );

    Ok(())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[cfg(not(target_os = "windows"))]
    fn test_platform_detection() {
        let result = platform::platform_target();
        assert!(result.is_ok(), "platform_target() should succeed");
        let (os, arch) = result.unwrap();
        assert!(
            os == "darwin" || os == "linux",
            "OS should be darwin or linux, got: {}",
            os
        );
        assert!(
            arch == "arm64" || arch == "x86_64",
            "Arch should be arm64 or x86_64, got: {}",
            arch
        );
    }

    #[test]
    fn test_asset_name_generation() {
        let name = github::asset_name("a3s-code", "0.3.0", "darwin", "arm64");
        assert_eq!(name, "a3s-code-0.3.0-darwin-arm64.tar.gz");
    }

    #[test]
    fn test_version_compare_newer() {
        let current = semver::Version::parse("0.1.0").unwrap();
        let latest = semver::Version::parse("0.2.0").unwrap();
        assert!(current < latest, "0.1.0 should be less than 0.2.0");
    }

    #[test]
    fn test_version_compare_same() {
        let current = semver::Version::parse("0.2.0").unwrap();
        let latest = semver::Version::parse("0.2.0").unwrap();
        assert!(current >= latest, "0.2.0 should be >= 0.2.0");
    }

    #[test]
    fn test_version_compare_older() {
        let current = semver::Version::parse("0.3.0").unwrap();
        let latest = semver::Version::parse("0.2.0").unwrap();
        assert!(current >= latest, "0.3.0 should be >= 0.2.0");
    }

    #[test]
    fn test_parse_github_release_json() {
        let json = serde_json::json!({
            "tag_name": "v0.3.0",
            "body": "Bug fixes and improvements",
            "assets": [
                {
                    "name": "a3s-code-0.3.0-darwin-arm64.tar.gz",
                    "browser_download_url": "https://example.com/a3s-code-0.3.0-darwin-arm64.tar.gz"
                },
                {
                    "name": "a3s-code-0.3.0-linux-x86_64.tar.gz",
                    "browser_download_url": "https://example.com/a3s-code-0.3.0-linux-x86_64.tar.gz"
                }
            ]
        });

        let release: Release = serde_json::from_value(json).unwrap();
        assert_eq!(release.tag_name, "v0.3.0");
        assert_eq!(release.body.as_deref(), Some("Bug fixes and improvements"));
        assert_eq!(release.assets.len(), 2);
        assert_eq!(release.assets[0].name, "a3s-code-0.3.0-darwin-arm64.tar.gz");
    }

    #[test]
    fn test_find_matching_asset() {
        let release = Release {
            tag_name: "v0.3.0".to_string(),
            body: None,
            assets: vec![
                github::Asset {
                    name: "a3s-code-0.3.0-darwin-arm64.tar.gz".to_string(),
                    browser_download_url: "https://example.com/darwin-arm64.tar.gz".to_string(),
                    digest: None,
                },
                github::Asset {
                    name: "a3s-code-0.3.0-linux-x86_64.tar.gz".to_string(),
                    browser_download_url: "https://example.com/linux-x86_64.tar.gz".to_string(),
                    digest: None,
                },
            ],
        };

        // Should find darwin-arm64
        let found = github::find_matching_asset(&release, "a3s-code", "darwin", "arm64");
        assert!(found.is_some());
        assert!(found.unwrap().name.contains("darwin-arm64"));

        // Should find linux-x86_64
        let found = github::find_matching_asset(&release, "a3s-code", "linux", "x86_64");
        assert!(found.is_some());
        assert!(found.unwrap().name.contains("linux-x86_64"));

        // Should return None for missing platform
        let found = github::find_matching_asset(&release, "a3s-code", "linux", "riscv64");
        assert!(found.is_none());
    }

    #[test]
    fn test_strip_version_prefix() {
        let v1 = github::parse_version("v0.2.0").unwrap();
        assert_eq!(v1, semver::Version::parse("0.2.0").unwrap());

        let v2 = github::parse_version("0.2.0").unwrap();
        assert_eq!(v2, semver::Version::parse("0.2.0").unwrap());
    }
}

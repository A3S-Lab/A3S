//! Deterministic systemd unit staging for Cloud-managed components.

use std::io::Write;
use std::path::{Path, PathBuf};

use anyhow::{bail, Context};

use crate::fleet::ManagedComponent;

#[derive(Debug, Clone)]
pub struct SystemdUnitSpec {
    component: ManagedComponent,
    executable: PathBuf,
    description: String,
    user: String,
    group: String,
    environment_file: Option<PathBuf>,
}

impl SystemdUnitSpec {
    pub fn new(
        component: ManagedComponent,
        executable: impl Into<PathBuf>,
    ) -> anyhow::Result<Self> {
        let spec = Self {
            component,
            executable: executable.into(),
            description: match component {
                ManagedComponent::NodeAgent => "A3S Cloud node agent".to_string(),
                ManagedComponent::Gateway => "A3S Gateway".to_string(),
            },
            user: "a3s".to_string(),
            group: "a3s".to_string(),
            environment_file: None,
        };
        spec.validate()?;
        Ok(spec)
    }

    pub fn with_identity(
        mut self,
        user: impl Into<String>,
        group: impl Into<String>,
    ) -> anyhow::Result<Self> {
        self.user = user.into();
        self.group = group.into();
        self.validate()?;
        Ok(self)
    }

    pub fn with_environment_file(mut self, path: impl Into<PathBuf>) -> anyhow::Result<Self> {
        self.environment_file = Some(path.into());
        self.validate()?;
        Ok(self)
    }

    pub fn service_name(&self) -> &'static str {
        self.component.systemd_service()
    }

    pub fn render(&self) -> anyhow::Result<String> {
        self.validate()?;
        let mut unit = format!(
            "[Unit]\nDescription={}\nAfter=network-online.target\nWants=network-online.target\n\n[Service]\nType=simple\nUser={}\nGroup={}\nExecStart={}\nRestart=on-failure\nRestartSec=5s\nNoNewPrivileges=true\nPrivateTmp=true\nProtectHome=true\n",
            self.description,
            self.user,
            self.group,
            self.executable.display()
        );
        if let Some(path) = &self.environment_file {
            unit.push_str(&format!("EnvironmentFile=-{}\n", path.display()));
        }
        unit.push_str("\n[Install]\nWantedBy=multi-user.target\n");
        Ok(unit)
    }

    fn validate(&self) -> anyhow::Result<()> {
        validate_systemd_path(&self.executable, "systemd executable")?;
        if let Some(path) = &self.environment_file {
            validate_systemd_path(path, "systemd environment file")?;
        }
        if self.description.is_empty()
            || self.description.len() > 160
            || self.description.chars().any(char::is_control)
        {
            bail!("systemd description must be bounded printable text");
        }
        validate_identity(&self.user, "systemd user")?;
        validate_identity(&self.group, "systemd group")?;
        Ok(())
    }
}

/// Write a complete unit to a caller-selected staging path and sync it.
pub fn stage_systemd_unit(spec: &SystemdUnitSpec, staging_path: &Path) -> anyhow::Result<()> {
    let parent = staging_path
        .parent()
        .context("systemd staging path has no parent directory")?;
    std::fs::create_dir_all(parent)
        .with_context(|| format!("failed to create {}", parent.display()))?;
    let mut staging = tempfile::NamedTempFile::new_in(parent)
        .with_context(|| format!("failed to stage systemd unit in {}", parent.display()))?;
    staging.write_all(spec.render()?.as_bytes())?;
    staging.flush()?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        staging
            .as_file()
            .set_permissions(std::fs::Permissions::from_mode(0o644))?;
    }
    staging.as_file().sync_all()?;
    staging
        .persist(staging_path)
        .map_err(|error| error.error)
        .with_context(|| {
            format!(
                "failed to persist staged systemd unit {}",
                staging_path.display()
            )
        })?;
    sync_directory(parent)
}

/// Atomically install a previously staged A3S systemd unit.
///
/// The prior unit is restored if the new file cannot be persisted. Callers run
/// `daemon-reload` and service lifecycle operations through their typed host
/// implementation after this filesystem transaction succeeds.
pub fn activate_systemd_unit(staged: &Path, unit_path: &Path) -> anyhow::Result<()> {
    if !staged.is_file() {
        bail!("staged systemd unit does not exist: {}", staged.display());
    }
    let service_name = unit_path
        .file_name()
        .and_then(|name| name.to_str())
        .context("systemd unit path has no UTF-8 file name")?;
    if !matches!(
        service_name,
        "a3s-cloud-node.service" | "a3s-gateway.service"
    ) {
        bail!("refusing to install an unmanaged systemd unit '{service_name}'");
    }
    let parent = unit_path
        .parent()
        .context("systemd unit path has no parent directory")?;
    std::fs::create_dir_all(parent)?;

    let mut prepared = tempfile::NamedTempFile::new_in(parent)?;
    std::io::copy(&mut std::fs::File::open(staged)?, &mut prepared)?;
    prepared.flush()?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        prepared
            .as_file()
            .set_permissions(std::fs::Permissions::from_mode(0o644))?;
    }
    prepared.as_file().sync_all()?;

    let backup = unit_path.with_extension("service.a3s-previous");
    if backup.exists() {
        std::fs::remove_file(&backup)
            .with_context(|| format!("failed to remove stale unit backup {}", backup.display()))?;
    }
    if unit_path.exists() {
        std::fs::rename(unit_path, &backup)
            .with_context(|| format!("failed to preserve unit {}", unit_path.display()))?;
        sync_directory(parent)?;
    }
    match prepared.persist(unit_path) {
        Ok(_) => {
            sync_directory(parent)?;
            if backup.exists() {
                std::fs::remove_file(&backup)?;
                sync_directory(parent)?;
            }
            Ok(())
        }
        Err(error) => {
            if backup.exists() {
                let _ = std::fs::rename(&backup, unit_path);
                let _ = sync_directory(parent);
            }
            Err(error.error)
                .with_context(|| format!("failed to activate systemd unit {}", unit_path.display()))
        }
    }
}

fn validate_identity(value: &str, label: &str) -> anyhow::Result<()> {
    if value.is_empty()
        || value.len() > 64
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-'))
    {
        bail!("{label} must be a bounded system identity");
    }
    Ok(())
}

fn validate_systemd_path(path: &Path, label: &str) -> anyhow::Result<()> {
    // These paths are rendered for a Linux systemd unit even when the
    // management tooling itself is built or tested on another platform.
    // Validate POSIX syntax explicitly instead of applying host path rules.
    let value = path
        .to_str()
        .with_context(|| format!("{label} must be valid UTF-8"))?;
    let has_traversal = value
        .split('/')
        .any(|component| matches!(component, "." | ".."));
    if !value.starts_with('/')
        || value.starts_with("//")
        || value.contains('\\')
        || value
            .chars()
            .any(|character| character.is_whitespace() || character.is_control())
        || has_traversal
    {
        bail!("{label} must be an absolute path without traversal or whitespace");
    }
    Ok(())
}

#[cfg(unix)]
fn sync_directory(path: &Path) -> anyhow::Result<()> {
    std::fs::File::open(path)
        .and_then(|directory| directory.sync_all())
        .with_context(|| format!("failed to sync systemd directory {}", path.display()))
}

#[cfg(not(unix))]
fn sync_directory(_path: &Path) -> anyhow::Result<()> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unit_rendering_is_bounded_and_contains_no_inline_secrets() {
        let spec = SystemdUnitSpec::new(
            ManagedComponent::NodeAgent,
            PathBuf::from("/var/lib/a3s/updater/node-agent/active"),
        )
        .unwrap()
        .with_environment_file("/etc/a3s/cloud-node.acl")
        .unwrap();
        let rendered = spec.render().unwrap();
        assert!(rendered.contains("ExecStart=/var/lib/a3s/updater/node-agent/active"));
        assert!(rendered.contains("EnvironmentFile=-/etc/a3s/cloud-node.acl"));
        assert!(!rendered.contains("token="));
    }

    #[test]
    fn staged_unit_activates_only_at_an_a3s_service_path() {
        let temp = tempfile::tempdir().unwrap();
        let staged = temp.path().join("staged.service");
        let spec = SystemdUnitSpec::new(
            ManagedComponent::Gateway,
            PathBuf::from("/var/lib/a3s/updater/gateway/active"),
        )
        .unwrap();
        stage_systemd_unit(&spec, &staged).unwrap();
        let unit = temp.path().join("a3s-gateway.service");
        activate_systemd_unit(&staged, &unit).unwrap();
        assert_eq!(
            std::fs::read_to_string(unit).unwrap(),
            spec.render().unwrap()
        );
        assert!(activate_systemd_unit(&staged, &temp.path().join("other.service")).is_err());
    }
}

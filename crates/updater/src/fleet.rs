//! Signed, health-gated upgrades for Cloud-managed Linux components.
//!
//! The transaction keeps artifact retrieval outbound, persists every durable
//! phase, activates one fixed executable path atomically, and retains the prior
//! binary until the replacement is proven healthy. Host-specific process
//! control stays behind [`FleetUpgradeHost`] so Cloud can expose the same typed
//! drain, stop, start, health, and applied-version operations over its outbound
//! node channel without distributing remote-login credentials.

use std::fs::{File, OpenOptions};
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use anyhow::{bail, Context};
use async_trait::async_trait;
use ed25519_dalek::{Signature, VerifyingKey};
use fs2::FileExt;
use semver::Version;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

pub const SIGNED_TARGET_SCHEMA_VERSION: u32 = 1;
pub const FLEET_RECEIPT_SCHEMA_VERSION: u32 = 1;
const DEFAULT_MAX_ARTIFACT_BYTES: u64 = 512 * 1024 * 1024;
const MAX_STEP_TIMEOUT: Duration = Duration::from_secs(60 * 60);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ManagedComponent {
    NodeAgent,
    Gateway,
}

impl ManagedComponent {
    pub fn id(self) -> &'static str {
        match self {
            Self::NodeAgent => "node-agent",
            Self::Gateway => "gateway",
        }
    }

    pub fn systemd_service(self) -> &'static str {
        match self {
            Self::NodeAgent => "a3s-cloud-node.service",
            Self::Gateway => "a3s-gateway.service",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ReleaseChannel {
    Stable,
    Beta,
    Nightly,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProtocolRange {
    pub minimum: u32,
    pub maximum: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RollbackConstraints {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub minimum_previous_version: Option<String>,
    #[serde(default)]
    pub allow_downgrade: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TargetMetadata {
    pub schema_version: u32,
    pub release_id: String,
    pub component: ManagedComponent,
    pub version: String,
    pub artifact_url: String,
    pub artifact_sha256: String,
    pub protocol: ProtocolRange,
    pub channel: ReleaseChannel,
    pub rollback: RollbackConstraints,
}

impl TargetMetadata {
    /// Canonical bytes signed by a release publisher.
    ///
    /// The schema is a fixed Rust structure with unknown JSON fields denied;
    /// serde therefore emits a deterministic declaration-order representation.
    pub fn signing_bytes(&self) -> anyhow::Result<Vec<u8>> {
        self.validate_shape()?;
        serde_json::to_vec(self).context("failed to encode signed target metadata")
    }

    fn validate_shape(&self) -> anyhow::Result<()> {
        if self.schema_version != SIGNED_TARGET_SCHEMA_VERSION {
            bail!(
                "unsupported signed target schema {}; expected {}",
                self.schema_version,
                SIGNED_TARGET_SCHEMA_VERSION
            );
        }
        validate_identifier(&self.release_id, "release ID")?;
        Version::parse(&self.version)
            .with_context(|| format!("invalid target version '{}'", self.version))?;
        validate_sha256(&self.artifact_sha256)?;
        validate_artifact_url(&self.artifact_url)?;
        if self.protocol.minimum > self.protocol.maximum {
            bail!("protocol minimum exceeds protocol maximum");
        }
        if let Some(version) = &self.rollback.minimum_previous_version {
            Version::parse(version)
                .with_context(|| format!("invalid rollback floor version '{version}'"))?;
        }
        Ok(())
    }

    fn validate_policy(
        &self,
        paths: &UpgradePaths,
        policy: &UpgradePolicy,
        previous_version: &Version,
    ) -> anyhow::Result<()> {
        self.validate_shape()?;
        policy.validate()?;
        if self.component != paths.component {
            bail!(
                "signed component '{}' does not match managed component '{}'",
                self.component.id(),
                paths.component.id()
            );
        }
        if self.channel != policy.channel {
            bail!("release channel is not allowed by the local policy");
        }
        if policy.protocol_level < self.protocol.minimum
            || policy.protocol_level > self.protocol.maximum
        {
            bail!("release protocol range is incompatible with this host");
        }
        let target_version = Version::parse(&self.version)?;
        if target_version < *previous_version && !self.rollback.allow_downgrade {
            bail!("signed rollback policy forbids a version downgrade");
        }
        if let Some(floor) = &self.rollback.minimum_previous_version {
            let floor = Version::parse(floor)?;
            if *previous_version < floor {
                bail!("installed version is below the signed rollback floor");
            }
        }
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SignedTargetMetadata {
    pub key_id: String,
    pub target: TargetMetadata,
    pub signature: String,
}

impl SignedTargetMetadata {
    pub fn verify(&self, trusted_keys: &[TrustedReleaseKey]) -> anyhow::Result<()> {
        validate_identifier(&self.key_id, "key ID")?;
        let trusted = trusted_keys
            .iter()
            .find(|key| key.key_id == self.key_id)
            .with_context(|| format!("release key '{}' is not trusted", self.key_id))?;
        let signature = decode_hex::<64>(&self.signature, "Ed25519 signature")?;
        let signature = Signature::from_bytes(&signature);
        trusted
            .verifying_key
            .verify_strict(&self.target.signing_bytes()?, &signature)
            .context("signed target metadata failed Ed25519 verification")
    }
}

#[derive(Debug, Clone)]
pub struct TrustedReleaseKey {
    key_id: String,
    verifying_key: VerifyingKey,
}

impl TrustedReleaseKey {
    pub fn from_bytes(key_id: impl Into<String>, public_key: [u8; 32]) -> anyhow::Result<Self> {
        let key_id = key_id.into();
        validate_identifier(&key_id, "key ID")?;
        let verifying_key =
            VerifyingKey::from_bytes(&public_key).context("invalid Ed25519 release public key")?;
        Ok(Self {
            key_id,
            verifying_key,
        })
    }

    pub fn key_id(&self) -> &str {
        &self.key_id
    }
}

#[derive(Debug, Clone)]
pub struct UpgradePolicy {
    pub protocol_level: u32,
    pub channel: ReleaseChannel,
    pub download_timeout: Duration,
    pub drain_timeout: Duration,
    pub stop_timeout: Duration,
    pub start_timeout: Duration,
    pub health_timeout: Duration,
    pub version_timeout: Duration,
    pub max_artifact_bytes: u64,
}

impl UpgradePolicy {
    pub fn new(protocol_level: u32, channel: ReleaseChannel) -> Self {
        Self {
            protocol_level,
            channel,
            download_timeout: Duration::from_secs(300),
            drain_timeout: Duration::from_secs(60),
            stop_timeout: Duration::from_secs(60),
            start_timeout: Duration::from_secs(60),
            health_timeout: Duration::from_secs(120),
            version_timeout: Duration::from_secs(60),
            max_artifact_bytes: DEFAULT_MAX_ARTIFACT_BYTES,
        }
    }

    pub fn with_timeouts(mut self, drain: Duration, health: Duration) -> Self {
        self.drain_timeout = drain;
        self.health_timeout = health;
        self
    }

    pub fn with_download_timeout(mut self, timeout: Duration) -> Self {
        self.download_timeout = timeout;
        self
    }

    pub fn with_control_timeout(mut self, timeout: Duration) -> Self {
        self.stop_timeout = timeout;
        self.start_timeout = timeout;
        self.version_timeout = timeout;
        self
    }

    pub fn with_max_artifact_bytes(mut self, maximum: u64) -> Self {
        self.max_artifact_bytes = maximum;
        self
    }

    fn validate(&self) -> anyhow::Result<()> {
        for (label, timeout) in [
            ("download", self.download_timeout),
            ("drain", self.drain_timeout),
            ("stop", self.stop_timeout),
            ("start", self.start_timeout),
            ("health", self.health_timeout),
            ("applied-version", self.version_timeout),
        ] {
            if timeout < Duration::from_secs(1) || timeout > MAX_STEP_TIMEOUT {
                bail!("{label} timeout must be between one second and one hour");
            }
        }
        if self.max_artifact_bytes == 0 || self.max_artifact_bytes > DEFAULT_MAX_ARTIFACT_BYTES {
            bail!(
                "artifact limit must be between one byte and {} bytes",
                DEFAULT_MAX_ARTIFACT_BYTES
            );
        }
        Ok(())
    }
}

#[derive(Debug, Clone)]
pub struct UpgradePaths {
    root: PathBuf,
    component: ManagedComponent,
}

impl UpgradePaths {
    pub fn new(root: impl Into<PathBuf>, component: ManagedComponent) -> anyhow::Result<Self> {
        let root = root.into();
        validate_absolute_path(&root, "upgrade root")?;
        Ok(Self { root, component })
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn component(&self) -> ManagedComponent {
        self.component
    }

    pub fn active_binary(&self) -> PathBuf {
        self.root.join("active")
    }

    pub fn previous_binary(&self) -> PathBuf {
        self.root.join("previous")
    }

    pub fn staged_binary(&self) -> PathBuf {
        self.root.join("candidate")
    }

    pub fn downloaded_artifact(&self) -> PathBuf {
        self.root.join("downloaded")
    }

    pub fn receipt_path(&self) -> PathBuf {
        self.root.join("receipt.json")
    }

    fn candidate(&self) -> PathBuf {
        self.staged_binary()
    }

    fn downloaded(&self) -> PathBuf {
        self.downloaded_artifact()
    }

    fn failed(&self) -> PathBuf {
        self.root.join("failed")
    }

    fn receipt(&self) -> PathBuf {
        self.receipt_path()
    }

    fn lock(&self) -> PathBuf {
        self.root.join("upgrade.lock")
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum UpgradeState {
    Received,
    Downloaded,
    Verified,
    Staged,
    Drained,
    Stopped,
    Activated,
    Healthy,
    RolledBack,
    Failed,
}

impl UpgradeState {
    pub fn is_terminal(self) -> bool {
        matches!(self, Self::Healthy | Self::RolledBack | Self::Failed)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpgradeEvent {
    pub state: UpgradeState,
    pub recorded_at_unix_seconds: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpgradeReceipt {
    pub schema_version: u32,
    pub signed_target: SignedTargetMetadata,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub previous_version: Option<String>,
    pub state: UpgradeState,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub failure_code: Option<String>,
    pub events: Vec<UpgradeEvent>,
}

impl UpgradeReceipt {
    fn new(signed_target: SignedTargetMetadata) -> Self {
        let mut receipt = Self {
            schema_version: FLEET_RECEIPT_SCHEMA_VERSION,
            signed_target,
            previous_version: None,
            state: UpgradeState::Received,
            failure_code: None,
            events: Vec::new(),
        };
        receipt.record(UpgradeState::Received, None);
        receipt
    }

    fn validate(&self) -> anyhow::Result<()> {
        if self.schema_version != FLEET_RECEIPT_SCHEMA_VERSION {
            bail!(
                "unsupported fleet receipt schema {}; expected {}",
                self.schema_version,
                FLEET_RECEIPT_SCHEMA_VERSION
            );
        }
        self.signed_target.target.validate_shape()?;
        if self.events.is_empty() || self.events.last().map(|event| event.state) != Some(self.state)
        {
            bail!("fleet receipt events do not match its current state");
        }
        if let Some(version) = &self.previous_version {
            Version::parse(version).context("fleet receipt has an invalid previous version")?;
        }
        Ok(())
    }

    fn advance(&mut self, state: UpgradeState) {
        if self.state < state && !self.state.is_terminal() {
            self.record(state, None);
        }
    }

    fn terminal(&mut self, state: UpgradeState, code: &'static str) {
        debug_assert!(matches!(
            state,
            UpgradeState::RolledBack | UpgradeState::Failed
        ));
        self.failure_code = Some(code.to_string());
        self.record(state, Some(code.to_string()));
    }

    fn record(&mut self, state: UpgradeState, code: Option<String>) {
        self.state = state;
        self.events.push(UpgradeEvent {
            state,
            recorded_at_unix_seconds: unix_seconds(),
            code,
        });
    }
}

#[async_trait]
pub trait FleetUpgradeHost: Send + Sync {
    /// Retrieve a public signed-release artifact through the node's outbound
    /// network path. Implementations must enforce `maximum_bytes` while
    /// streaming instead of buffering an unbounded response, and must enforce
    /// the supplied timeout.
    async fn download_artifact(
        &self,
        url: &str,
        maximum_bytes: u64,
        timeout: Duration,
    ) -> anyhow::Result<Vec<u8>>;

    async fn drain(&self, component: ManagedComponent, timeout: Duration) -> anyhow::Result<()>;
    async fn stop(&self, component: ManagedComponent, timeout: Duration) -> anyhow::Result<()>;
    async fn start(&self, component: ManagedComponent, timeout: Duration) -> anyhow::Result<()>;
    async fn health(&self, component: ManagedComponent, timeout: Duration) -> anyhow::Result<()>;
    async fn applied_version(
        &self,
        component: ManagedComponent,
        timeout: Duration,
    ) -> anyhow::Result<String>;
}

pub struct FleetUpdater {
    paths: UpgradePaths,
    policy: UpgradePolicy,
    trusted_keys: Vec<TrustedReleaseKey>,
}

impl FleetUpdater {
    pub fn new(
        paths: UpgradePaths,
        policy: UpgradePolicy,
        trusted_keys: Vec<TrustedReleaseKey>,
    ) -> anyhow::Result<Self> {
        policy.validate()?;
        if trusted_keys.is_empty() {
            bail!("at least one trusted release key is required");
        }
        let mut identities = std::collections::BTreeSet::new();
        if trusted_keys
            .iter()
            .any(|key| !identities.insert(key.key_id.clone()))
        {
            bail!("trusted release key IDs must be unique");
        }
        Ok(Self {
            paths,
            policy,
            trusted_keys,
        })
    }

    pub fn receipt(&self) -> anyhow::Result<Option<UpgradeReceipt>> {
        ReceiptStore::new(self.paths.receipt()).read()
    }

    pub async fn apply(
        &self,
        signed_target: &SignedTargetMetadata,
        host: &dyn FleetUpgradeHost,
    ) -> anyhow::Result<UpgradeReceipt> {
        std::fs::create_dir_all(self.paths.root()).with_context(|| {
            format!(
                "failed to create fleet upgrade root {}",
                self.paths.root().display()
            )
        })?;
        let _lock = UpgradeLock::acquire(&self.paths.lock())?;
        signed_target.target.validate_shape()?;
        let store = ReceiptStore::new(self.paths.receipt());

        if let Some(existing) = store.read()? {
            if same_target(&existing.signed_target, signed_target) {
                if existing.state.is_terminal() {
                    if existing.state == UpgradeState::Healthy {
                        cleanup_success_artifacts(&self.paths)?;
                    }
                    return Ok(existing);
                }
                return self.resume(existing, host, &store).await;
            }
            if !existing.state.is_terminal() {
                bail!(
                    "release '{}' is still in state {:?}; recover it before applying another target",
                    existing.signed_target.target.release_id,
                    existing.state
                );
            }
        }

        let receipt = UpgradeReceipt::new(signed_target.clone());
        store.write(&receipt)?;
        self.resume(receipt, host, &store).await
    }

    /// Resume the last non-terminal transaction after process death or reboot.
    pub async fn recover(
        &self,
        host: &dyn FleetUpgradeHost,
    ) -> anyhow::Result<Option<UpgradeReceipt>> {
        std::fs::create_dir_all(self.paths.root())?;
        let _lock = UpgradeLock::acquire(&self.paths.lock())?;
        let store = ReceiptStore::new(self.paths.receipt());
        let Some(receipt) = store.read()? else {
            return Ok(None);
        };
        if receipt.state.is_terminal() {
            if receipt.state == UpgradeState::Healthy {
                cleanup_success_artifacts(&self.paths)?;
            }
            return Ok(Some(receipt));
        }
        self.resume(receipt, host, &store).await.map(Some)
    }

    async fn resume(
        &self,
        mut receipt: UpgradeReceipt,
        host: &dyn FleetUpgradeHost,
        store: &ReceiptStore,
    ) -> anyhow::Result<UpgradeReceipt> {
        if receipt.signed_target.verify(&self.trusted_keys).is_err() {
            receipt.terminal(UpgradeState::Failed, "signature_invalid");
            store.write(&receipt)?;
            return Ok(receipt);
        }

        let previous_version = match &receipt.previous_version {
            Some(version) => Version::parse(version)?,
            None => match host
                .applied_version(self.paths.component(), self.policy.version_timeout)
                .await
            {
                Ok(version) => match Version::parse(&version) {
                    Ok(version) => {
                        receipt.previous_version = Some(version.to_string());
                        store.write(&receipt)?;
                        version
                    }
                    Err(_) => {
                        receipt.terminal(UpgradeState::Failed, "applied_version_invalid");
                        store.write(&receipt)?;
                        return Ok(receipt);
                    }
                },
                Err(_) => {
                    receipt.terminal(UpgradeState::Failed, "applied_version_unavailable");
                    store.write(&receipt)?;
                    return Ok(receipt);
                }
            },
        };
        if receipt
            .signed_target
            .target
            .validate_policy(&self.paths, &self.policy, &previous_version)
            .is_err()
        {
            receipt.terminal(UpgradeState::Failed, "metadata_incompatible");
            store.write(&receipt)?;
            return Ok(receipt);
        }

        let expected_digest = receipt.signed_target.target.artifact_sha256.clone();
        if !file_matches_sha256(&self.paths.downloaded(), &expected_digest)? {
            let bytes = match host
                .download_artifact(
                    &receipt.signed_target.target.artifact_url,
                    self.policy.max_artifact_bytes,
                    self.policy.download_timeout,
                )
                .await
            {
                Ok(bytes) if bytes.len() as u64 <= self.policy.max_artifact_bytes => bytes,
                Ok(_) => {
                    receipt.terminal(UpgradeState::Failed, "artifact_too_large");
                    store.write(&receipt)?;
                    return Ok(receipt);
                }
                Err(_) => {
                    receipt.terminal(UpgradeState::Failed, "download_failed");
                    store.write(&receipt)?;
                    return Ok(receipt);
                }
            };
            write_atomic_bytes(&self.paths.downloaded(), &bytes, false)?;
            receipt.advance(UpgradeState::Downloaded);
            store.write(&receipt)?;
        } else {
            receipt.advance(UpgradeState::Downloaded);
            store.write(&receipt)?;
        }

        if !file_matches_sha256(&self.paths.downloaded(), &expected_digest)? {
            receipt.terminal(UpgradeState::Failed, "digest_mismatch");
            store.write(&receipt)?;
            return Ok(receipt);
        }
        receipt.advance(UpgradeState::Verified);
        store.write(&receipt)?;

        let active_is_target = file_matches_sha256(&self.paths.active_binary(), &expected_digest)?;
        if !active_is_target {
            if !file_matches_sha256(&self.paths.candidate(), &expected_digest)? {
                let bytes = std::fs::read(self.paths.downloaded())
                    .context("failed to read verified fleet artifact")?;
                write_atomic_bytes(&self.paths.candidate(), &bytes, true)?;
            }
            receipt.advance(UpgradeState::Staged);
            store.write(&receipt)?;

            if receipt.state < UpgradeState::Drained {
                if host
                    .drain(self.paths.component(), self.policy.drain_timeout)
                    .await
                    .is_err()
                {
                    receipt.terminal(UpgradeState::Failed, "drain_failed");
                    store.write(&receipt)?;
                    return Ok(receipt);
                }
                receipt.advance(UpgradeState::Drained);
                store.write(&receipt)?;
            }
            if receipt.state < UpgradeState::Stopped {
                if host
                    .stop(self.paths.component(), self.policy.stop_timeout)
                    .await
                    .is_err()
                {
                    receipt.terminal(UpgradeState::Failed, "stop_failed");
                    store.write(&receipt)?;
                    return Ok(receipt);
                }
                receipt.advance(UpgradeState::Stopped);
                store.write(&receipt)?;
            }

            if let Err(_error) = activate_candidate(&self.paths, &expected_digest) {
                return self
                    .rollback(receipt, host, store, "activation_failed")
                    .await;
            }
            receipt.advance(UpgradeState::Activated);
            store.write(&receipt)?;
        } else {
            receipt.advance(UpgradeState::Activated);
            store.write(&receipt)?;
        }

        if host
            .start(self.paths.component(), self.policy.start_timeout)
            .await
            .is_err()
        {
            return self.rollback(receipt, host, store, "start_failed").await;
        }
        if host
            .health(self.paths.component(), self.policy.health_timeout)
            .await
            .is_err()
        {
            return self.rollback(receipt, host, store, "health_failed").await;
        }
        let applied = host
            .applied_version(self.paths.component(), self.policy.version_timeout)
            .await;
        if !matches!(
            applied.as_deref(),
            Ok(version) if version == receipt.signed_target.target.version
        ) {
            return self
                .rollback(receipt, host, store, "applied_version_mismatch")
                .await;
        }

        receipt.failure_code = None;
        receipt.record(UpgradeState::Healthy, None);
        store.write(&receipt)?;
        cleanup_success_artifacts(&self.paths)?;
        Ok(receipt)
    }

    async fn rollback(
        &self,
        mut receipt: UpgradeReceipt,
        host: &dyn FleetUpgradeHost,
        store: &ReceiptStore,
        failure_code: &'static str,
    ) -> anyhow::Result<UpgradeReceipt> {
        let _ = host
            .stop(self.paths.component(), self.policy.stop_timeout)
            .await;
        let restored = restore_previous(&self.paths).is_ok()
            && self.paths.active_binary().is_file()
            && host
                .start(self.paths.component(), self.policy.start_timeout)
                .await
                .is_ok()
            && host
                .health(self.paths.component(), self.policy.health_timeout)
                .await
                .is_ok();
        let restored_version = if restored {
            host.applied_version(self.paths.component(), self.policy.version_timeout)
                .await
                .ok()
        } else {
            None
        };
        if restored && restored_version.as_deref() == receipt.previous_version.as_deref() {
            receipt.terminal(UpgradeState::RolledBack, failure_code);
        } else {
            receipt.terminal(UpgradeState::Failed, "rollback_failed");
        }
        store.write(&receipt)?;
        Ok(receipt)
    }
}

struct ReceiptStore {
    path: PathBuf,
}

impl ReceiptStore {
    fn new(path: PathBuf) -> Self {
        Self { path }
    }

    fn read(&self) -> anyhow::Result<Option<UpgradeReceipt>> {
        let bytes = match std::fs::read(&self.path) {
            Ok(bytes) => bytes,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(error) => {
                return Err(error)
                    .with_context(|| format!("failed to read {}", self.path.display()))
            }
        };
        let receipt: UpgradeReceipt = serde_json::from_slice(&bytes)
            .with_context(|| format!("failed to parse {}", self.path.display()))?;
        receipt.validate()?;
        Ok(Some(receipt))
    }

    fn write(&self, receipt: &UpgradeReceipt) -> anyhow::Result<()> {
        receipt.validate()?;
        let bytes = serde_json::to_vec_pretty(receipt).context("failed to encode fleet receipt")?;
        write_atomic_bytes(&self.path, &bytes, false)
    }
}

struct UpgradeLock(File);

impl UpgradeLock {
    fn acquire(path: &Path) -> anyhow::Result<Self> {
        let parent = path.parent().context("upgrade lock has no parent")?;
        std::fs::create_dir_all(parent)?;
        let file = OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(path)
            .with_context(|| format!("failed to open upgrade lock {}", path.display()))?;
        file.try_lock_exclusive()
            .with_context(|| format!("another upgrade owns {}", path.display()))?;
        Ok(Self(file))
    }
}

impl Drop for UpgradeLock {
    fn drop(&mut self) {
        let _ = FileExt::unlock(&self.0);
    }
}

fn activate_candidate(paths: &UpgradePaths, expected_digest: &str) -> anyhow::Result<()> {
    if !file_matches_sha256(&paths.candidate(), expected_digest)? {
        bail!("staged candidate does not match signed artifact digest");
    }
    if paths.active_binary().is_file() && !paths.previous_binary().exists() {
        std::fs::rename(paths.active_binary(), paths.previous_binary())
            .context("failed to preserve the previous active binary")?;
        sync_directory(paths.root())?;
    }
    if paths.active_binary().is_file() {
        if file_matches_sha256(&paths.active_binary(), expected_digest)? {
            return Ok(());
        }
        bail!("active and previous binaries are both present during activation");
    }
    std::fs::rename(paths.candidate(), paths.active_binary())
        .context("failed to atomically activate the staged binary")?;
    sync_directory(paths.root())?;
    Ok(())
}

fn restore_previous(paths: &UpgradePaths) -> anyhow::Result<()> {
    if paths.previous_binary().is_file() {
        if paths.failed().exists() {
            remove_owned_file(&paths.failed())?;
        }
        if paths.active_binary().exists() {
            std::fs::rename(paths.active_binary(), paths.failed())
                .context("failed to retain the unhealthy binary")?;
        }
        std::fs::rename(paths.previous_binary(), paths.active_binary())
            .context("failed to restore the previous binary")?;
    } else if !paths.active_binary().is_file() {
        bail!("no recoverable active or previous binary remains");
    }
    sync_directory(paths.root())
}

fn cleanup_success_artifacts(paths: &UpgradePaths) -> anyhow::Result<()> {
    for path in [
        paths.previous_binary(),
        paths.downloaded(),
        paths.candidate(),
    ] {
        if path.exists() {
            remove_owned_file(&path)?;
        }
    }
    sync_directory(paths.root())
}

fn remove_owned_file(path: &Path) -> anyhow::Result<()> {
    let metadata = std::fs::symlink_metadata(path)
        .with_context(|| format!("failed to inspect owned update file {}", path.display()))?;
    if !metadata.file_type().is_file() {
        bail!("refusing to remove non-file update path {}", path.display());
    }
    std::fs::remove_file(path)
        .with_context(|| format!("failed to remove owned update file {}", path.display()))
}

fn write_atomic_bytes(path: &Path, bytes: &[u8], executable: bool) -> anyhow::Result<()> {
    let parent = path
        .parent()
        .context("atomic file has no parent directory")?;
    std::fs::create_dir_all(parent)?;
    let mut staging = tempfile::NamedTempFile::new_in(parent)
        .with_context(|| format!("failed to stage file in {}", parent.display()))?;
    staging.write_all(bytes)?;
    staging.flush()?;
    #[cfg(unix)]
    if executable {
        use std::os::unix::fs::PermissionsExt;
        staging
            .as_file()
            .set_permissions(std::fs::Permissions::from_mode(0o755))?;
    }
    #[cfg(not(unix))]
    let _ = executable;
    staging.as_file().sync_all()?;
    staging
        .persist(path)
        .map_err(|error| error.error)
        .with_context(|| format!("failed to atomically persist {}", path.display()))?;
    sync_directory(parent)
}

fn file_matches_sha256(path: &Path, expected: &str) -> anyhow::Result<bool> {
    let bytes = match std::fs::read(path) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(false),
        Err(error) => {
            return Err(error).with_context(|| format!("failed to read {}", path.display()))
        }
    };
    Ok(format!("{:x}", Sha256::digest(bytes)) == expected)
}

#[cfg(unix)]
fn sync_directory(path: &Path) -> anyhow::Result<()> {
    File::open(path)
        .and_then(|directory| directory.sync_all())
        .with_context(|| format!("failed to sync update directory {}", path.display()))
}

#[cfg(not(unix))]
fn sync_directory(_path: &Path) -> anyhow::Result<()> {
    Ok(())
}

fn same_target(left: &SignedTargetMetadata, right: &SignedTargetMetadata) -> bool {
    left == right
}

fn validate_identifier(value: &str, label: &str) -> anyhow::Result<()> {
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

fn validate_sha256(value: &str) -> anyhow::Result<()> {
    if value.len() != 64 || !value.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        bail!("artifact SHA-256 must contain exactly 64 hexadecimal characters");
    }
    if value.bytes().any(|byte| byte.is_ascii_uppercase()) {
        bail!("artifact SHA-256 must use lowercase hexadecimal");
    }
    Ok(())
}

fn validate_artifact_url(value: &str) -> anyhow::Result<()> {
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

fn validate_absolute_path(path: &Path, label: &str) -> anyhow::Result<()> {
    if !path.is_absolute()
        || path
            .components()
            .any(|part| matches!(part, Component::ParentDir | Component::CurDir))
    {
        bail!("{label} must be an absolute path without traversal");
    }
    Ok(())
}

fn decode_hex<const N: usize>(value: &str, label: &str) -> anyhow::Result<[u8; N]> {
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

fn unix_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default()
}

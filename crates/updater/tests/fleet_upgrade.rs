use std::sync::Mutex;
use std::time::Duration;

use a3s_updater::{
    sha256_hex, FleetUpdater, FleetUpgradeHost, ManagedComponent, ProtocolRange, ReleaseChannel,
    RollbackConstraints, SignedTargetMetadata, TargetMetadata, TrustedReleaseKey, UpgradeEvent,
    UpgradePaths, UpgradePolicy, UpgradeReceipt, UpgradeState, FLEET_RECEIPT_SCHEMA_VERSION,
    SIGNED_TARGET_SCHEMA_VERSION,
};
use anyhow::bail;
use async_trait::async_trait;
use ed25519_dalek::{Signer, SigningKey};

const OLD_BINARY: &[u8] = b"a3s-cloud-node 1.0.0";
const NEW_BINARY: &[u8] = b"a3s-cloud-node 2.0.0";

struct FakeHost {
    paths: UpgradePaths,
    artifact: Vec<u8>,
    calls: Mutex<Vec<String>>,
    fail_new_health: bool,
    tamper_candidate_during_drain: bool,
}

impl FakeHost {
    fn new(paths: UpgradePaths, artifact: Vec<u8>) -> Self {
        Self {
            paths,
            artifact,
            calls: Mutex::new(Vec::new()),
            fail_new_health: false,
            tamper_candidate_during_drain: false,
        }
    }

    fn with_failed_new_health(mut self) -> Self {
        self.fail_new_health = true;
        self
    }

    fn with_tampered_candidate(mut self) -> Self {
        self.tamper_candidate_during_drain = true;
        self
    }

    fn record(&self, value: &str) {
        self.calls.lock().unwrap().push(value.to_string());
    }

    fn call_count(&self) -> usize {
        self.calls.lock().unwrap().len()
    }

    fn active_version(&self) -> anyhow::Result<String> {
        let bytes = std::fs::read(self.paths.active_binary())?;
        match bytes.as_slice() {
            OLD_BINARY => Ok("1.0.0".to_string()),
            NEW_BINARY => Ok("2.0.0".to_string()),
            _ => bail!("active fixture has no known version"),
        }
    }
}

#[async_trait]
impl FleetUpgradeHost for FakeHost {
    async fn download_artifact(
        &self,
        url: &str,
        maximum_bytes: u64,
        timeout: Duration,
    ) -> anyhow::Result<Vec<u8>> {
        self.record("downloaded");
        assert_eq!(url, "https://releases.example.test/node-agent-2.0.0");
        assert_eq!(timeout, Duration::from_secs(1));
        if self.artifact.len() as u64 > maximum_bytes {
            bail!("fixture artifact exceeds bound");
        }
        Ok(self.artifact.clone())
    }

    async fn drain(&self, component: ManagedComponent, timeout: Duration) -> anyhow::Result<()> {
        assert_eq!(component, ManagedComponent::NodeAgent);
        assert_eq!(timeout, Duration::from_secs(1));
        self.record("drained");
        if self.tamper_candidate_during_drain {
            std::fs::write(self.paths.staged_binary(), b"tampered after staging")?;
        }
        Ok(())
    }

    async fn stop(&self, component: ManagedComponent, timeout: Duration) -> anyhow::Result<()> {
        assert_eq!(component, ManagedComponent::NodeAgent);
        assert_eq!(timeout, Duration::from_secs(1));
        self.record("stopped");
        Ok(())
    }

    async fn start(&self, component: ManagedComponent, timeout: Duration) -> anyhow::Result<()> {
        assert_eq!(component, ManagedComponent::NodeAgent);
        assert_eq!(timeout, Duration::from_secs(1));
        self.record("started");
        Ok(())
    }

    async fn health(&self, component: ManagedComponent, timeout: Duration) -> anyhow::Result<()> {
        assert_eq!(component, ManagedComponent::NodeAgent);
        assert_eq!(timeout, Duration::from_secs(1));
        self.record("health");
        if self.fail_new_health && std::fs::read(self.paths.active_binary())? == NEW_BINARY {
            bail!("health failed with token=must-not-enter-receipt");
        }
        Ok(())
    }

    async fn applied_version(
        &self,
        component: ManagedComponent,
        timeout: Duration,
    ) -> anyhow::Result<String> {
        assert_eq!(component, ManagedComponent::NodeAgent);
        assert_eq!(timeout, Duration::from_secs(1));
        self.record("version");
        self.active_version()
    }
}

struct Fixture {
    _temp: tempfile::TempDir,
    paths: UpgradePaths,
    updater: FleetUpdater,
    signed: SignedTargetMetadata,
    host: FakeHost,
}

fn fixture(artifact: Vec<u8>, digest: String, protocol: ProtocolRange) -> Fixture {
    let temp = tempfile::tempdir().unwrap();
    let paths =
        UpgradePaths::new(temp.path().join("node-agent"), ManagedComponent::NodeAgent).unwrap();
    std::fs::create_dir_all(paths.root()).unwrap();
    std::fs::write(paths.active_binary(), OLD_BINARY).unwrap();
    let (signed, key) = signed_target("2.0.0", digest, protocol, false);
    let updater = FleetUpdater::new(
        paths.clone(),
        UpgradePolicy::new(3, ReleaseChannel::Stable)
            .with_timeouts(Duration::from_secs(1), Duration::from_secs(1))
            .with_download_timeout(Duration::from_secs(1))
            .with_control_timeout(Duration::from_secs(1))
            .with_max_artifact_bytes(1024),
        vec![key],
    )
    .unwrap();
    let host = FakeHost::new(paths.clone(), artifact);
    Fixture {
        _temp: temp,
        paths,
        updater,
        signed,
        host,
    }
}

fn signed_target(
    version: &str,
    digest: String,
    protocol: ProtocolRange,
    allow_downgrade: bool,
) -> (SignedTargetMetadata, TrustedReleaseKey) {
    let signing = SigningKey::from_bytes(&[7_u8; 32]);
    let target = TargetMetadata {
        schema_version: SIGNED_TARGET_SCHEMA_VERSION,
        release_id: format!("node-agent-{version}"),
        component: ManagedComponent::NodeAgent,
        version: version.to_string(),
        artifact_url: "https://releases.example.test/node-agent-2.0.0".to_string(),
        artifact_sha256: digest,
        protocol,
        channel: ReleaseChannel::Stable,
        rollback: RollbackConstraints {
            minimum_previous_version: Some("1.0.0".to_string()),
            allow_downgrade,
        },
    };
    let signature = signing.sign(&target.signing_bytes().unwrap()).to_bytes();
    let signed = SignedTargetMetadata {
        key_id: "release-2026".to_string(),
        target,
        signature: hex(&signature),
    };
    let key =
        TrustedReleaseKey::from_bytes("release-2026", signing.verifying_key().to_bytes()).unwrap();
    (signed, key)
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

#[tokio::test]
async fn successful_upgrade_is_health_gated_and_idempotent() {
    let fixture = fixture(
        NEW_BINARY.to_vec(),
        sha256_hex(NEW_BINARY),
        ProtocolRange {
            minimum: 2,
            maximum: 4,
        },
    );

    let receipt = fixture
        .updater
        .apply(&fixture.signed, &fixture.host)
        .await
        .unwrap();

    assert_eq!(receipt.state, UpgradeState::Healthy);
    assert_eq!(
        std::fs::read(fixture.paths.active_binary()).unwrap(),
        NEW_BINARY
    );
    assert!(!fixture.paths.previous_binary().exists());
    for required in [
        UpgradeState::Downloaded,
        UpgradeState::Verified,
        UpgradeState::Staged,
        UpgradeState::Drained,
        UpgradeState::Stopped,
        UpgradeState::Activated,
        UpgradeState::Healthy,
    ] {
        assert!(receipt.events.iter().any(|event| event.state == required));
    }

    let call_count = fixture.host.call_count();
    let replay = fixture
        .updater
        .apply(&fixture.signed, &fixture.host)
        .await
        .unwrap();
    assert_eq!(replay, receipt);
    assert_eq!(fixture.host.call_count(), call_count);
}

#[tokio::test]
async fn incompatible_metadata_and_bad_signatures_fail_before_download() {
    let incompatible = fixture(
        NEW_BINARY.to_vec(),
        sha256_hex(NEW_BINARY),
        ProtocolRange {
            minimum: 4,
            maximum: 5,
        },
    );
    let receipt = incompatible
        .updater
        .apply(&incompatible.signed, &incompatible.host)
        .await
        .unwrap();
    assert_eq!(receipt.state, UpgradeState::Failed);
    assert_eq!(
        receipt.failure_code.as_deref(),
        Some("metadata_incompatible")
    );
    assert!(!incompatible
        .host
        .calls
        .lock()
        .unwrap()
        .iter()
        .any(|call| call == "downloaded"));

    let bad_signature = fixture(
        NEW_BINARY.to_vec(),
        sha256_hex(NEW_BINARY),
        ProtocolRange {
            minimum: 2,
            maximum: 4,
        },
    );
    let mut signed = bad_signature.signed.clone();
    signed.signature.replace_range(0..2, "00");
    let receipt = bad_signature
        .updater
        .apply(&signed, &bad_signature.host)
        .await
        .unwrap();
    assert_eq!(receipt.state, UpgradeState::Failed);
    assert_eq!(receipt.failure_code.as_deref(), Some("signature_invalid"));
    assert_eq!(bad_signature.host.call_count(), 0);
}

#[tokio::test]
async fn digest_mismatch_fails_without_stopping_the_old_binary() {
    let fixture = fixture(
        b"tampered".to_vec(),
        sha256_hex(NEW_BINARY),
        ProtocolRange {
            minimum: 2,
            maximum: 4,
        },
    );
    let receipt = fixture
        .updater
        .apply(&fixture.signed, &fixture.host)
        .await
        .unwrap();
    assert_eq!(receipt.state, UpgradeState::Failed);
    assert_eq!(receipt.failure_code.as_deref(), Some("digest_mismatch"));
    assert_eq!(
        std::fs::read(fixture.paths.active_binary()).unwrap(),
        OLD_BINARY
    );
    assert!(!fixture
        .host
        .calls
        .lock()
        .unwrap()
        .iter()
        .any(|call| call == "stopped"));
}

#[tokio::test]
async fn failed_health_restores_the_previous_binary_and_redacts_receipts() {
    let mut fixture = fixture(
        NEW_BINARY.to_vec(),
        sha256_hex(NEW_BINARY),
        ProtocolRange {
            minimum: 2,
            maximum: 4,
        },
    );
    fixture.host =
        FakeHost::new(fixture.paths.clone(), NEW_BINARY.to_vec()).with_failed_new_health();

    let receipt = fixture
        .updater
        .apply(&fixture.signed, &fixture.host)
        .await
        .unwrap();

    assert_eq!(receipt.state, UpgradeState::RolledBack);
    assert_eq!(receipt.failure_code.as_deref(), Some("health_failed"));
    assert_eq!(
        std::fs::read(fixture.paths.active_binary()).unwrap(),
        OLD_BINARY
    );
    let serialized = std::fs::read_to_string(fixture.paths.receipt_path()).unwrap();
    assert!(!serialized.contains("must-not-enter-receipt"));
    assert!(!serialized.contains("token="));
}

#[tokio::test]
async fn activation_failure_before_the_swap_keeps_the_old_binary_recoverable() {
    let mut fixture = fixture(
        NEW_BINARY.to_vec(),
        sha256_hex(NEW_BINARY),
        ProtocolRange {
            minimum: 2,
            maximum: 4,
        },
    );
    fixture.host =
        FakeHost::new(fixture.paths.clone(), NEW_BINARY.to_vec()).with_tampered_candidate();

    let receipt = fixture
        .updater
        .apply(&fixture.signed, &fixture.host)
        .await
        .unwrap();

    assert_eq!(receipt.state, UpgradeState::RolledBack);
    assert_eq!(receipt.failure_code.as_deref(), Some("activation_failed"));
    assert_eq!(
        std::fs::read(fixture.paths.active_binary()).unwrap(),
        OLD_BINARY
    );
    assert!(!fixture.paths.previous_binary().exists());
}

#[tokio::test]
async fn reboot_recovery_converges_from_every_durable_install_phase() {
    for state in [
        UpgradeState::Received,
        UpgradeState::Downloaded,
        UpgradeState::Verified,
        UpgradeState::Staged,
        UpgradeState::Drained,
        UpgradeState::Stopped,
        UpgradeState::Activated,
    ] {
        let fixture = fixture(
            NEW_BINARY.to_vec(),
            sha256_hex(NEW_BINARY),
            ProtocolRange {
                minimum: 2,
                maximum: 4,
            },
        );
        if state >= UpgradeState::Downloaded {
            std::fs::write(fixture.paths.downloaded_artifact(), NEW_BINARY).unwrap();
        }
        if state >= UpgradeState::Staged && state < UpgradeState::Activated {
            std::fs::write(fixture.paths.staged_binary(), NEW_BINARY).unwrap();
        }
        if state == UpgradeState::Activated {
            std::fs::rename(
                fixture.paths.active_binary(),
                fixture.paths.previous_binary(),
            )
            .unwrap();
            std::fs::write(fixture.paths.active_binary(), NEW_BINARY).unwrap();
        }
        let receipt = UpgradeReceipt {
            schema_version: FLEET_RECEIPT_SCHEMA_VERSION,
            signed_target: fixture.signed.clone(),
            previous_version: Some("1.0.0".to_string()),
            state,
            failure_code: None,
            events: vec![UpgradeEvent {
                state,
                recorded_at_unix_seconds: 1,
                code: None,
            }],
        };
        std::fs::write(
            fixture.paths.receipt_path(),
            serde_json::to_vec_pretty(&receipt).unwrap(),
        )
        .unwrap();

        let recovered = fixture
            .updater
            .recover(&fixture.host)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(recovered.state, UpgradeState::Healthy, "phase {state:?}");
        assert_eq!(
            std::fs::read(fixture.paths.active_binary()).unwrap(),
            NEW_BINARY,
            "phase {state:?}"
        );
        assert!(!fixture.paths.previous_binary().exists(), "phase {state:?}");
    }
}

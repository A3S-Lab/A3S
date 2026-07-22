# Cloud Stack Compatibility Lock

`cloud-stack.acl` is the machine-readable compatibility boundary for the A3S
Cloud integration gate. It pins every participating submodule to a full commit,
records exact Cargo package versions, and names the protocol levels exercised
by the gate. The root-owned Updater crate is pinned by its exact package version
and by the root commit that contains it.

The lock is parsed and regenerated with the checked-in `a3s-acl` Node SDK.
`node scripts/verify-cloud-stack.mjs` rejects non-canonical ACL, unknown fields,
unsafe or duplicate paths, missing gitlinks, unexpected submodule URLs,
revision drift, dirty component worktrees, Cargo manifest or lockfile drift,
and mismatched Cloud or Gateway dependencies. It also parses and generates all
tracked Cloud product-configuration fixtures and rejects HCL/Terraform product
configuration in the Cloud integration surface.

## Proposing An Update

1. Update the component in its own repository and obtain an immutable release
   or full commit revision.
2. Update the root submodule gitlink and the corresponding `component` block.
   Keep component and protocol blocks sorted by label, and keep attributes in
   the order produced by `a3s-acl`.
3. Update exact dependency declarations and Cargo lockfiles in the owning
   component repository before moving its root gitlink.
4. Run `just cloud-stack-check` from a clean recursive checkout.
5. Include the printed compatibility-lock digest and component revisions in
   the pull request evidence. Do not publish the compatibility update until the
   Cloud contract gate passes.

The compatibility lock does not replace component release processes. A lock
change is integration evidence: each component still owns its implementation,
tests, release notes, and publication.

# A3S Web Knowledge

## Product boundary

Knowledge is a built-in A3S Web product for local, user-owned knowledge bases.
It is not a marketplace and it does not install executable A3S Use packages.
The signed plugin Market remains a separate system destination for reviewed
Plugin packages and registry sources.

The Knowledge product uses the same shell, sidebar, header hierarchy, spacing,
and interaction patterns as Work. It appears directly below Work in the
Activity Bar.

## Local library

The default view is **My Knowledge Bases**. It lists only knowledge bases that
are available in the current workspace, with pinned bases first. Each card
shows its origin, source count, concept count, size, and local path.

Users can:

- create an empty local knowledge base;
- import an Obsidian Vault or another local folder;
- search and pin local knowledge bases;
- click a knowledge-base card to open its editor.

There is no Knowledge Marketplace tab, catalog-install action, or executable
permission grant in this product.

## Knowledge editor

Opening a knowledge base enters a dedicated, Obsidian-inspired editor with:

- a collapsible local directory tree;
- file filtering and directory refresh;
- editing for Markdown, MDX, text, JSON, YAML, CSV, and TSV files;
- a live Markdown reading view that can be hidden;
- explicit save and `Cmd/Ctrl+S` save.

The editor reads and writes the selected managed knowledge-base directory
through the existing workspace filesystem service. Binary files and hidden A3S,
Obsidian, Git, and operating-system metadata are not opened as text. The
knowledge-base summary is refreshed after a successful save.

## External import

The Import Knowledge Base dialog accepts an Obsidian Vault or another local
folder. Users can open the native directory picker or enter an absolute path
manually when a graphical picker is unavailable.

Import is copy-based: the source directory remains unchanged, while its content
is copied into a new managed knowledge base under `sources/`. The importer:

- rejects missing paths, non-directories, symbolic-link roots, the workspace
  root, and recursive imports involving the managed knowledge directory;
- skips `.obsidian`, `.git`, `.a3s`, `.trash`, `.DS_Store`, and symbolic links;
- preserves nested notes and attachments;
- rejects an empty import after filtering;
- limits one import to 20,000 files or 1 GiB;
- stages all output and renames it into place only after the copy and manifests
  succeed.

Native directory selection uses `osascript` on macOS, PowerShell on Windows,
and Zenity or KDialog on Linux. Cancellation is returned as a normal result;
picker unavailability is shown as an actionable error so manual path entry
remains available.

## Personal storage contract

Managed bases live under the selected workspace:

```text
<workspace>/.a3s/kb/bases/<id>/
├── .a3s/
│   ├── asset.acl
│   └── knowledge-base.acl
├── README.md
├── sources/
├── wiki/
└── eval/
```

The UI consistently calls these assets knowledge bases. `okf` remains only a
technical protocol identifier in the storage manifest. The knowledge-base
manifest uses `a3s.knowledge-base.v1`; the asset manifest declares the
`knowledge` category and `okf` protocol. Both files are generated and parsed
with `a3s-acl`.

The existing legacy `<workspace>/.a3s/kb` tree remains visible as the pinned
Workspace Knowledge base when it contains sources or wiki content.

## Local Web API

The Knowledge experience uses these loopback API routes:

- `GET /api/v1/knowledge/bases`
- `POST /api/v1/knowledge/bases`
- `POST /api/v1/knowledge/bases/import`
- `POST /api/v1/knowledge/bases/{id}/pinned`
- `POST /api/v1/workspace/actions/pick-directory`
- `GET /api/v1/workspace/read-dir`
- `GET /api/v1/workspace/read`
- `POST /api/v1/workspace/write`

Responses use the standard A3S API envelope. Knowledge-base mutations return a
`changed` flag and the resulting projection so the UI can update immediately,
then reconcile through a background refresh.

## Validation

Run backend checks from `crates/cli`:

```sh
cargo fmt --all -- --check
cargo test --bin a3s api::code_web::knowledge:: -- --nocapture
cargo test --test web_cli knowledge_marketplace_creates_and_installs_real_personal_bases -- --nocapture
```

Run frontend checks from `apps/web`:

```sh
bun run format:check
bun run lint:check
bun run typecheck
bun run test
bun run build
```

Browser acceptance covers the local library, opening a card into the directory
tree editor, editing and saving Markdown, opening the import dialog, native
directory-selection entry point, and manual absolute-path fallback. The native
operating-system dialog itself requires platform-level manual acceptance.

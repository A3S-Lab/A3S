# A3S Web Plugin System

## Product model

A3S Web treats an installed A3S Use package as the equivalent of a VS Code
extension package. Code is the first and default Activity Bar entry, Work is
the second built-in entry, and the non-executable Knowledge product follows
Work. An enabled package can add a workbench view through the
`contributes.activity_bar` contribution point; vertical products such as
Research and Finance are not hardcoded shell entries.

The package remains the unit of identity, trust, installation, upgrade,
disable, and removal. A contribution adds navigation and a non-callable HTML
view only. Native actions continue to use the package's CLI, standard MCP, and
Skill surfaces.

Knowledge packages are a separate product contract. A knowledge package installs
data into the personal knowledge library and never contributes executable UI,
CLI, MCP, or Skill authority. Its discovery and local lifecycle are documented
in [A3S Web Knowledge](KNOWLEDGE.md).

The model combines two useful references without copying either runtime:

- VS Code supplies the package identity, declarative contribution point,
  Marketplace lifecycle, and enable/disable model.
- [Paciolan remote-component](https://github.com/Paciolan/remote-component)
  supplies the small loader boundary: an explicit content source, separate
  loading/error/ready states, caller-controlled fallback UI, and rejection of
  stale asynchronous loads.

The equivalent of `remote-component` dependency injection is the versioned,
bounded `host.init`/`postMessage` protocol. A plugin receives only declared host
facts and proposal capabilities, never the host React runtime or an ambient
`require` function. The equivalent of its custom fetcher is owned by A3S Code:
it resolves content only from the installed package snapshot and verifies the
registry revision and digest before rendering.

```acl
contributes {
  activity_bar "research" {
    title       = "科研"
    description = "Prepare reviewable, evidence-backed research tasks across disciplines."
    icon        = "flask-conical"
    entry       = "web/activity.html"
    styles      = ["web/activity.css"]
    scripts     = ["web/activity.js"]
    skill       = "a3s-use-science"
    order       = 120
  }
}
```

The stable host key is `<route>:<activity-id>`. The referenced Skill must be
declared by the same package. The host ignores any Skill name supplied by
plugin messages.

## Asset contract

Activity HTML and its explicitly declared CSS/JavaScript resources are validated
twice: first by A3S Use while projecting the installed package, then
independently by A3S Code before they become Web API content. Every asset must
be:

- inside the immutable package root;
- a regular file rather than a link or special file;
- UTF-8 with the declared `text/html`, `text/css`, or `text/javascript` media
  type and no larger than 2 MiB;
- bound to the registry snapshot by lowercase SHA-256;
- associated with the same package and Skill in both catalog and content
  responses.

A3S Web removes undeclared external stylesheet and script references, then
injects only the verified package resources as inline nodes under the host CSP.
A changed registry revision or asset digest invalidates cached content. Requests
carry sequence IDs and abort signals so a stale response cannot replace a newer
selection. Loading, error, and rendered states remain separate, and late loads
are discarded.

A3S does not adopt remote URL evaluation, runtime JavaScript compilation, or
`new Function`. Plugin UI always comes from an installed, reviewed package.

## Browser isolation

The host reparses package HTML and prepends a restrictive Content Security
Policy before any package node. Network connections, objects, nested frames,
workers, forms, base URLs, and navigation are denied. Images, fonts, and media
are limited to embedded `data:` or `blob:` content as applicable.

The view renders with:

```html
<iframe sandbox="allow-scripts" referrerpolicy="no-referrer"></iframe>
```

`allow-same-origin` is intentionally absent, so the plugin receives a unique
opaque origin and cannot access host DOM or storage. The host accepts messages
only when `event.source` is the active iframe and the payload passes the
bounded `a3s.activity.v1` schema.

The protocol supports:

- `host.init`: verified package identity, contribution key, resolved theme,
  and locale;
- `activity.ready`: view startup completion;
- `activity.error`: a bounded user-visible runtime error;
- `context.propose`: a bounded title, summary, prompt, and up to 12 display
  fields, plus the optional `usePackageSkill` routing decision.

There is no generic execute message.

## Context handoff

`context.propose` always opens a host-owned review dialog. The user sees the
summary, fields, exact prompt, and host-verified Skill decision before anything
enters Code. `usePackageSkill` defaults to `true` for backward compatibility;
when it is `false`, accepting the review appends only the prompt and does not
select a Skill. A plugin cannot name an arbitrary Skill: the host can attach
only the Skill declared by the same installed package. Dismissing the proposal
has no side effect, and plugin HTML cannot submit a task directly.

The Research contribution uses this distinction deliberately. Its workbench
organizes a task as a project and follows a question → evidence → analysis →
artifact → review loop. Life-science sources may request the verified
`a3s-use-science` Skill. Other disciplines use Code's current general research
capabilities and do not receive the life-science Skill. Every brief asks for a
reviewable research package with a provenance note covering sources, methods or
code, execution records, key parameters, artifact relationships, and unfinished
verification items.

The product organization takes inspiration from Claude Science's project and
artifact-centered workbench and Open Science's plan → execute → produce →
preview flow. A3S does not copy either shell or grant their runtime authority:
the contribution remains an isolated A3S Web Code surface, and Code/Work own
execution, files, editable artifacts, logs, and final review.

## Marketplace lifecycle

The Marketplace reads two explicit package-source classes:

- optional `release-bundle` packages carried by the verified A3S Use release;
- configured remote registries verified through TUF.

Release bundles are not built-in capabilities: they remain absent from the
runtime until the user installs them, and they can be disabled or removed like
any other extension. A3S Use exposes only validated bundle metadata, while the
umbrella plan binds the exact expanded-package SHA-256 and A3S Use checks it
again immediately before activation. Unconfigured or failed registries remain
visible with their verification state but contribute no installable packages.

The catalog keeps discovery and trust inspection separate. The Plugins view
provides one complete catalog plus an installed-only view, with text search and
Stable, Beta, or Nightly channel filters. It does not invent recommendations in
the browser. The Sources view shows a plain verification state and keeps TUF
metadata under Technical information. Selecting install or upgrade from a
package card opens confirmation; it never mutates the installation directly.

Every install, upgrade, or uninstall is two phase:

1. the Web API invokes the current `a3s` executable with `--dry-run`;
2. the user reviews the exact plan and its SHA-256 digest;
3. explicit confirmation invokes the same operation with `--plan-digest`;
4. a changed plan, release bundle, registry, target, or package fails closed.

Enable and disable operations use the A3S Use extension lifecycle and trigger a
registry refresh. The Activity Bar polls the immutable registry revision, so
install, upgrade, disable, and uninstall converge without reloading A3S Web.

The repository-level lifecycle proof is:

```sh
just marketplace-science-e2e
```

It builds the real `a3s-use` binary and packaged `a3s-use-science` release, then
runs both supported source paths: an A3S Use release bundle with no configured
registry and an ephemeral signed TUF repository. The checks exercise Web API
install plan/apply, direct Activity opening, verified
HTML/CSS/JavaScript delivery, reviewed workbench-to-Code handoff, packaged
`science doctor`, all 13 namespaced Science MCP tools, uninstall plan/apply,
`release-bundle`/`registry-tuf` receipt provenance, and package-directory
cleanup. The test is local and does not claim that a package has been published
to the production registry.

## Local Web API

The loopback Web service exposes:

- `GET /api/v1/plugins/activities`
- `GET /api/v1/plugins/activities/{key}`
- `GET /api/v1/plugins/marketplace`
- `POST /api/v1/plugins/operations/plan`
- `POST /api/v1/plugins/operations/apply`
- `POST /api/v1/plugins/packages/enabled`

These routes do not weaken the existing loopback deployment boundary. Browser
clients never receive A3S OS tokens, trust-root keys, package filesystem paths,
or authority to bypass plan review.

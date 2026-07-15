# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

```
a3s/                            ← MONOREPO ROOT (NOT a Rust workspace)
├── apps/
│   └── docs/                   # Documentation site (Next.js/Fumadocs-style app)
├── crates/                     # Rust crates (submodules)
│   ├── acl/ ahp/ box/ code/ event/ gateway/
│   ├── lane/ memory/ power/ search/ updater/ use/
│   └── common/                 # Shared types (local crate)
└── homebrew-tap/              # Homebrew tap
```

### Root Rules (NEVER do in root)

- No `Cargo.toml` or `src/` in root — root is NOT a Rust workspace
- No `cargo init` or `cargo new` in root
- The root `justfile` is for monorepo orchestration only; do not treat root as a Rust crate
- Git remote MUST point to `git@github.com:A3S-Lab/a3s.git`

---

## Git Safety

**`git stash pop` CAN destroy your changes** after failed merge/rebase (autostash issue).

1. Before `git pull --rebase`: commit or stash first
2. After `git stash pop`: verify changes with `git diff --stat HEAD`
3. If stash pop fails: use `git stash branch recovery` instead
4. Always use `git stash push -m "message"` with descriptive messages

---

## Adding a New Crate

1. Create repo on GitHub (PascalCase, under A3S-Lab org)
2. Init in `/tmp`, push, then `git submodule add` into `crates/<name>`
3. Commit `.gitmodules` change in a3s root
4. Update README.md (Modules table, Roadmap, Repository Structure)
5. Never `cargo init` directly in a3s root

| Item | Convention |
|------|-----------|
| GitHub repo | PascalCase (`MyNewCrate`) |
| Submodule path | kebab-case (`crates/my-new-crate`) |
| Rust crate name | `a3s-my-new-crate` |

---

## Code Style

**Rust:** Follow [Microsoft Rust Guidelines](https://microsoft.github.io/rust-guidelines). `cargo fmt` before every commit, `cargo clippy` for linting (enforced in CI).

Key rules:
- Async-first: all I/O uses Tokio, no blocking in async context
- Error handling: `BoxError` in `core/src/error.rs`, always include context in errors
- Event keys: dot-separated lowercase (`<domain>.<subject>.<action>`)
- Public types must be `Send + Sync`, no panics in production

**Python SDK:** Async/await, `async with` for cleanup, type hints.

**Config:** Prefer ACL over TOML. Use `.acl` by default. ACL means the A3S
Agent Configuration Language and must be parsed and generated with `a3s-acl`;
do not treat ACL as HCL or use an HCL parser for ACL files.

---

## NestJS Guidelines

**Module organization:** Each business module in its own folder

**DDD layering:**
- `domain/`: Entities, value objects, aggregate roots, domain events (pure TypeScript)
- `application/`: Application services, command handlers, query handlers
- `infrastructure/`: Database, Redis, external service implementations
- `presentation/`: DTOs, controllers, guards

**Dependency injection:** Use constructor injection, avoid `new` in classes

**Configuration:** Use `@nestjs/config` with validated environment variables

---

## DDD Module Structure

Every module MUST follow the 4-layer DDD structure. This is **mandatory** - violations are considered critical issues.

### Required Directory Structure

```
modules/{module-name}/
├── domain/                           # Pure TypeScript - no framework imports
│   ├── entities/                      # Aggregate roots, entities
│   │   └── *.entity.ts
│   ├── value-objects/                 # Value objects
│   │   └── *.vo.ts
│   ├── repositories/                  # Repository interfaces ONLY
│   │   └── *.repository.interface.ts
│   ├── services/                      # Service interfaces ONLY (no implementations!)
│   │   └── *.service.interface.ts
│   └── events/                       # Domain events
│       └── *.event.ts
├── application/                       # CQRS handlers
│   ├── commands/                      # Command handlers
│   │   └── {feature}/
│   │       ├── {feature}.command.ts
│   │       ├── {feature}.handler.ts
│   │       └── index.ts
│   └── queries/                       # Query handlers
│       └── {feature}/
│           ├── {feature}.query.ts
│           ├── {feature}.handler.ts
│           └── index.ts
├── infrastructure/                    # Implementations
│   └── persistence/                  # Repository implementations
│       └── *.repository.ts
├── presentation/                      # HTTP layer
│   ├── controllers/
│   │   └── *.controller.ts
│   └── dto/
│       ├── request/                   # Request DTOs only
│       │   └── *.request.dto.ts
│       └── response/                  # Response DTOs only
│           └── *.response.dto.ts
└── {module}.module.ts
```

### Critical Rules

**1. Domain Layer is PURE TypeScript**
- NO NestJS imports (`@nestjs/common`, `@nestjs/cqrs`, etc.)
- NO framework dependencies
- Only interfaces, types, and domain logic

**2. Domain Services Directory**
- ONLY contain `.interface.ts` files with interface definitions
- **NEVER** create re-export files like `*.service.ts` that re-export interfaces
- Implementation goes to `infrastructure/persistence/`

**3. Repository Interfaces**
- Define in `domain/repositories/` with `I{Entity}Repository` naming
- Symbol token: `{ENTITY}_REPOSITORY`
- Implementation in `infrastructure/persistence/`

**4. Service Interfaces**
- Define in `domain/services/` with `I{Service}Service` naming
- Symbol token: `{SERVICE}_SERVICE`
- Implementation in `infrastructure/`

**5. CQRS Handlers**
- Use **subdirectory pattern**: `commands/{feature}/handler.ts`
- NOT flat structure like `commands/handler.ts` in root
- Register handlers in module: `CommandHandlers = [...]`, `QueryHandlers = [...]`

**6. DTO Organization**
- Request DTOs: `presentation/dto/request/`
- Response DTOs: `presentation/dto/response/`
- Application layer should NOT have DTOs (they belong to presentation)

**7. Controller Rules**
- Thin controllers only - delegate to CommandBus/QueryBus
- No business logic in controllers
- Use proper typing - no `any`

### Common Mistakes to Avoid

| Mistake | Why It's Wrong | Correct Approach |
|---------|----------------|------------------|
| Re-export files in `domain/services/` | Violates "interfaces only" rule | Delete `.service.ts` re-exports, keep only `.interface.ts` |
| Handlers in flat `commands/` | Inconsistent organization | Use subdirectory: `commands/{feature}/` |
| Business logic in controller | Violates separation of concerns | Move to command/query handlers |
| Missing `infrastructure/` layer | Repository implementations have no home | Create `infrastructure/persistence/` |
| DTOs in application layer | DTOs are HTTP concerns | Move to `presentation/dto/` |
| `any` type in handlers | Defeats type safety | Use proper entity types |

---

## RESTful API Design

### Response Format

All API responses use a consistent wrapper format. The response format is enforced by `ApiResponseInterceptor`.

#### Success Response

```json
{
    "code": 200,
    "message": "Success",
    "data": { ... },
    "requestId": "uuid",
    "timestamp": "2026-04-17T00:00:00.000Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `code` | `number` | HTTP status code (e.g., 200, 201, 204) |
| `message` | `string` | Human-readable response message |
| `data` | `object \| array` | Response payload |
| `requestId` | `string` | Request tracing ID (optional) |
| `timestamp` | `string` | ISO 8601 timestamp |

#### Paginated Response

```json
{
    "code": 200,
    "message": "Success",
    "data": {
        "items": [...],
        "total": 100,
        "page": 1,
        "limit": 10,
        "totalPages": 10,
        "hasNext": true,
        "hasPrevious": false
    },
    "requestId": "uuid",
    "timestamp": "2026-04-17T00:00:00.000Z"
}
```

#### Error Response

```json
{
    "code": 404,
    "statusCode": "NOT_FOUND",
    "message": "Resource not found",
    "details": { ... },
    "requestId": "uuid",
    "timestamp": "2026-04-17T00:00:00.000Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `code` | `number` | HTTP status code |
| `statusCode` | `ErrorCode` | Business error code (string enum) |
| `message` | `string` | Human-readable error message |
| `details` | `object` | Additional error context (optional) |
| `requestId` | `string` | Request tracing ID (optional) |
| `timestamp` | `string` | ISO 8601 timestamp |

### ErrorCode Enum

The `ErrorCode` enum defines all business error codes:

```typescript
enum ErrorCode {
    // 4xx Client Errors
    BAD_REQUEST = 'BAD_REQUEST',
    UNAUTHORIZED = 'UNAUTHORIZED',
    FORBIDDEN = 'FORBIDDEN',
    NOT_FOUND = 'NOT_FOUND',
    CONFLICT = 'CONFLICT',

    // 5xx Server Errors
    INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
    SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',

    // Business Errors (10xxx)
    VALIDATION_ERROR = '10001',
    DUPLICATE_ENTRY = '10002',
    RESOURCE_NOT_FOUND = '10003',

    // Auth Errors (20xxx)
    TOKEN_EXPIRED = '20001',
    TOKEN_INVALID = '20002',
    PERMISSION_DENIED = '20004',

    // Domain Errors (30xxx)
    ENTITY_NOT_FOUND = '30001',
    ENTITY_ALREADY_EXISTS = '30002',

    // External Service Errors (40xxx)
    EXTERNAL_SERVICE_ERROR = '40001',
    EXTERNAL_SERVICE_TIMEOUT = '40002',
}
```

### Key Design Principles

1. **`code` is the HTTP status code** - Set by the HTTP layer
2. **`statusCode` is the business error code** - Set by application/domain layer
3. **Always use `ApiResponseInterceptor`** - Ensures consistent wrapper format
4. **Use OpenAPI decorators** - Document all error codes in `@ApiResponse` schema

---

## Database Conventions

### Kysely Usage

- Use Kysely for type-safe SQL queries
- Always use parameterized queries to prevent SQL injection
- Migration files go in `migrations/` directory

### pgvector Semantic Search

- Knowledge bases use pgvector for semantic search
- Vector fields use `vector(1536)` or appropriate dimensions

### Naming Conventions

| Object | Convention | Example |
|--------|------------|---------|
| Database table | snake_case | `user_accounts` |
| Column | snake_case | `created_at` |
| Class name | PascalCase | `UserAccount` |
| Method/variable | camelCase | `findById` |
| Constant | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |

---

## Language Policy

All code and documentation MUST be in English. This includes:
- Rust doc comments (`//!`, `///`, `//`)
- Python docstrings
- README.md, CLAUDE.md, AGENTS.md, `apps/docs/content/`, and crate-local documentation

---

## Documentation

**Update docs EVERY time a feature is completed.** Code is not done until docs reflect it.

For every feature:
1. Update README.md Features section
2. Update README.md Roadmap (mark ✅, add implementation notes)
3. Update related documentation under `apps/docs/content/` or crate-local `docs/`
4. Remove obsolete content (outdated docs, deprecated examples, completed TODOs)
5. Verify code examples still work

---

## Mandatory Code Design Rules

### Rule 0: DON'T BE YES MAN

Challenge assumptions. Before implementing: "Does this already exist?", "Does this layer need to know this?". After writing: "What breaks if I delete this?".

### Rule 1: First-Principles Feature Gate

**Every new feature request requires first-principles review BEFORE code:**

1. What is the project's core mission?
2. Does this feature directly serve that mission? If not, refuse.
3. Does it strengthen or weaken the architecture?
4. Is the problem real or hypothetical?
5. Is there a simpler alternative?

If it fails this review, refuse clearly with architectural justification. Do not soften with "we could do it later".

### Rule 2: Minimal Core + External Extensions

Every module system:
- **Core** (5-10 components): Minimal, stable, non-replaceable
- **Extensions**: Everything else, trait-based with default implementations

Before adding code, ask: "Is this core or extension?" If it can be replaced without breaking core, it's an extension.

### Core Principles

3. Single Responsibility — one function, one job
4. Boring Code — obvious > clever
5. Search Before Implement — grep before writing
6. Only What's Used — no future-proofing
7. DRY — single source of truth
8. Explicit Errors — self-documenting error messages
9. Periodic Pruning — after every feature, audit for dead wrappers/orphaned exports

### Rule 3: Reasonable File and Folder Splitting

**Keep files focused, directories logically organized. Fight the "god object" and "dump everything in one folder" tendencies.**

File splitting guidelines:
- **File size**: If a file exceeds ~500 lines, consider splitting it. If it exceeds ~1000 lines, it MUST be split.
- **Single responsibility per file**: One struct/trait + its closely related helpers. Don't mix unrelated concerns.
- **Protocol handlers**: Each protocol (HTTP, WebSocket, gRPC, TCP, UDP) in its own file, not one massive `entrypoint.rs`.
- **Middleware**: Each middleware type in its own file, not one `middleware/mod.rs` with 15 match arms.
- **Managers**: Extract lifecycle managers (discovery, autoscaler, ACME, providers) into separate files, not all in `gateway.rs`.

Directory structure guidelines:
- **Group by concern, not by type**: `proxy/http.rs`, `proxy/websocket.rs` not `http_proxy.rs`, `ws_proxy.rs` scattered
- **No "catch-all" directories**: `utils/`, `helpers/` with unrelated code are smells
- **Nested depth**: Maximum 3 levels deep for source code (`src/a/b/c.rs`), 2 for tests

Warning signs (refactor immediately):
- `mod.rs` files that re-export 20+ items
- `src/gateway.rs` with 1000+ lines
- `src/entrypoint.rs` handling HTTP, TCP, UDP, TLS, ACME all in one file
- Any file you need to scroll past 3 screens to understand

When in doubt: err on the side of more files with clearer names over fewer files with clever organization.

### Typed Extension Options (SDK/API only)

Extension/backend choices in SDK options MUST use typed objects, not raw primitives:

```typescript
// ❌ BAD: leaks backend name, can't be swapped
agent.session('.', { memoryDir: './memory', defaultSecurity: true });

// ✅ GOOD: typed, explicit, swappable
agent.session('.', { memoryStore: new FileMemoryStore('./memory') });
agent.session('.', { securityProvider: new DefaultSecurityProvider() });
```

This applies to: memory stores, session stores, security providers, context providers.

This does NOT apply to: feature flags (`builtinSkills: boolean`), numeric/string scalars (`model: string`, `toolTimeoutMs: number`).

### Pre-Submission Checklist

- [ ] Searched for existing functionality before implementing
- [ ] Read all affected files before modifying
- [ ] Applied Rule 0-2 to own design (not just user's request)
- [ ] Single responsibility, boring code, no future-proofing
- [ ] Pruning audit: no dead wrappers, orphaned exports, redundant modules
- [ ] Typed extension options use objects (SDK only)
- [ ] Relevant formatting, checks, and tests pass in the affected workspace or app

### DDD Structure Compliance
- [ ] Domain layer has NO framework imports (pure TypeScript)
- [ ] `domain/services/` contains only `.interface.ts` files (no re-exports)
- [ ] Repository implementations are in `infrastructure/persistence/`
- [ ] Commands/queries use subdirectory pattern (not flat structure)
- [ ] DTOs are in `presentation/dto/` (not `application/`)
- [ ] Controller delegates to CommandBus/QueryBus (no business logic)
- [ ] No `any` types - use proper entity interfaces

---

## Test-Driven Development (TDD)

1. Write tests FIRST → 2. Run (should fail) → 3. Implement → 4. Run (should pass) → 5. Feature complete

Rules:
- Tests define completion — feature is done only when tests pass
- Modified code must have updated tests
- Deleted features = deleted tests (no orphaned `#[ignore]` tests)
- Integration tests required for CLI/network/cross-module workflows
- Tests must NOT leave temp files/sockets behind
- Rust builds should be validated from the affected crate workspace; use `cargo build --all-features` where that crate supports it

Run tests from the affected project, not from the monorepo root unless a root recipe exists for that task. Use crate-local commands such as `cargo test -p <crate>`, crate-local `just` recipes, or app-local package scripts (`bun`, `npm`, `pnpm`) as appropriate.

---

#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { generate, parse } = require('../crates/acl/sdk/node/src');

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = resolve(dirname(SCRIPT_PATH), '..');
const REQUIRED_COMPONENTS = [
  'acl',
  'boot',
  'cloud',
  'event',
  'flow',
  'gateway',
  'orm',
  'runtime',
  'sentry',
  'updater',
];

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function attribute(block, name, kind) {
  const value = block.attributes.get(name);
  invariant(value, `${block.name} "${block.labels[0] ?? ''}" is missing ${name}`);
  invariant(
    value.kind === kind,
    `${block.name} "${block.labels[0] ?? ''}" attribute ${name} must be ${kind}`,
  );
  return value.value;
}

function optionalAttribute(block, name, kind) {
  const value = block.attributes.get(name);
  if (!value) {
    return undefined;
  }
  invariant(
    value.kind === kind,
    `${block.name} "${block.labels[0] ?? ''}" attribute ${name} must be ${kind}`,
  );
  return value.value;
}

function validateAttributes(block, required, optional = []) {
  invariant(block.labels.length === 1, `${block.name} blocks require exactly one label`);
  invariant(block.blocks.length === 0, `${block.name} "${block.labels[0]}" cannot contain blocks`);
  const allowed = new Set([...required, ...optional]);
  for (const key of block.attributes.keys()) {
    invariant(allowed.has(key), `${block.name} "${block.labels[0]}" has unknown attribute ${key}`);
  }
  for (const key of required) {
    invariant(
      block.attributes.has(key),
      `${block.name} "${block.labels[0]}" is missing required attribute ${key}`,
    );
  }
}

function validateRelativePath(value, label) {
  invariant(value.length > 0, `${label} cannot be empty`);
  invariant(!isAbsolute(value), `${label} must be relative`);
  invariant(!value.includes('\\') && !value.includes('\0'), `${label} uses unsafe separators`);
  invariant(
    normalize(value).split(sep).join('/') === value &&
      value !== '..' &&
      !value.startsWith('../'),
    `${label} must be a normalized repository-relative path`,
  );
}

function validateSorted(values, label) {
  const sorted = [...values].sort();
  invariant(
    values.every((value, index) => value === sorted[index]),
    `${label} must be sorted by label`,
  );
}

export function parseCloudStackLock(source) {
  let document;
  try {
    document = parse(source);
  } catch (error) {
    const location =
      Number.isInteger(error?.line) && Number.isInteger(error?.column)
        ? ` at ${error.line}:${error.column}`
        : '';
    throw new Error(`could not parse compatibility lock${location}: ${error?.message ?? error}`);
  }

  invariant(document.blocks.length > 0, 'compatibility lock cannot be empty');
  invariant(document.blocks[0].name === 'stack', 'the first block must be stack');
  const stackBlocks = document.blocks.filter((block) => block.name === 'stack');
  invariant(stackBlocks.length === 1, 'compatibility lock requires exactly one stack block');
  const stack = stackBlocks[0];
  validateAttributes(stack, ['format', 'owner', 'rust_version', 'schema']);
  invariant(stack.labels[0] === 'cloud', 'stack label must be "cloud"');
  invariant(attribute(stack, 'format', 'Number') === 1, 'stack format must be 1');
  invariant(
    attribute(stack, 'schema', 'String') === 'a3s.cloud.compatibility-lock.v1',
    'unsupported compatibility-lock schema',
  );
  invariant(attribute(stack, 'owner', 'String') === 'A3S-Lab/Cloud', 'unexpected stack owner');
  invariant(
    /^\d+\.\d+\.\d+$/.test(attribute(stack, 'rust_version', 'String')),
    'invalid Rust version',
  );

  const allowedBlocks = new Set(['stack', 'component', 'protocol']);
  for (const block of document.blocks) {
    invariant(allowedBlocks.has(block.name), `unknown top-level block ${block.name}`);
  }

  const componentBlocks = document.blocks.filter((block) => block.name === 'component');
  const protocolBlocks = document.blocks.filter((block) => block.name === 'protocol');
  invariant(componentBlocks.length > 0, 'compatibility lock requires components');
  invariant(protocolBlocks.length > 0, 'compatibility lock requires protocols');
  invariant(
    document.blocks
      .slice(1, 1 + componentBlocks.length)
      .every((block) => block.name === 'component') &&
      document.blocks.slice(1 + componentBlocks.length).every((block) => block.name === 'protocol'),
    'blocks must be ordered as stack, components, then protocols',
  );
  validateSorted(
    componentBlocks.map((block) => block.labels[0]),
    'component blocks',
  );
  validateSorted(
    protocolBlocks.map((block) => block.labels[0]),
    'protocol blocks',
  );

  const componentIds = new Set();
  const componentPaths = new Set();
  const components = componentBlocks.map((block) => {
    validateAttributes(
      block,
      ['owner', 'path', 'source', 'version'],
      ['package', 'repository', 'revision'],
    );
    const id = block.labels[0];
    const path = attribute(block, 'path', 'String');
    const sourceKind = attribute(block, 'source', 'String');
    const component = {
      id,
      owner: attribute(block, 'owner', 'String'),
      package: optionalAttribute(block, 'package', 'String'),
      path,
      repository: optionalAttribute(block, 'repository', 'String'),
      revision: optionalAttribute(block, 'revision', 'String'),
      source: sourceKind,
      version: attribute(block, 'version', 'String'),
    };
    invariant(/^[a-z][a-z0-9-]*$/.test(id), `invalid component label ${id}`);
    invariant(!componentIds.has(id), `duplicate component ${id}`);
    componentIds.add(id);
    validateRelativePath(path, `component "${id}" path`);
    invariant(!componentPaths.has(path), `duplicate component path ${path}`);
    componentPaths.add(path);
    invariant(
      /^A3S-Lab\/[A-Za-z0-9._-]+$/.test(component.owner),
      `component "${id}" has invalid owner`,
    );
    invariant(
      /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(component.version),
      `component "${id}" has invalid version`,
    );
    invariant(
      sourceKind === 'git' || sourceKind === 'workspace',
      `component "${id}" source must be git or workspace`,
    );
    if (sourceKind === 'git') {
      invariant(
        /^git@github\.com:A3S-Lab\/[A-Za-z0-9._-]+\.git$/.test(component.repository ?? ''),
        `component "${id}" requires an A3S-Lab SSH repository`,
      );
      invariant(
        /^[0-9a-f]{40}$/.test(component.revision ?? ''),
        `component "${id}" requires a full lowercase revision`,
      );
    } else {
      invariant(
        component.repository === undefined && component.revision === undefined,
        `workspace component "${id}" cannot declare repository or revision`,
      );
    }
    return component;
  });

  const protocolIds = new Set();
  const protocolSchemas = new Set();
  const protocols = protocolBlocks.map((block) => {
    validateAttributes(block, ['level', 'owner', 'schema', 'source']);
    const protocol = {
      id: block.labels[0],
      level: attribute(block, 'level', 'Number'),
      owner: attribute(block, 'owner', 'String'),
      schema: attribute(block, 'schema', 'String'),
      source: attribute(block, 'source', 'String'),
    };
    invariant(/^[a-z][a-z0-9-]*$/.test(protocol.id), `invalid protocol label ${protocol.id}`);
    invariant(!protocolIds.has(protocol.id), `duplicate protocol ${protocol.id}`);
    protocolIds.add(protocol.id);
    invariant(
      Number.isSafeInteger(protocol.level) && protocol.level > 0,
      `protocol "${protocol.id}" level must be a positive integer`,
    );
    invariant(
      protocol.schema.endsWith(`.v${protocol.level}`),
      `protocol "${protocol.id}" schema does not match level ${protocol.level}`,
    );
    invariant(!protocolSchemas.has(protocol.schema), `duplicate protocol schema ${protocol.schema}`);
    protocolSchemas.add(protocol.schema);
    validateRelativePath(protocol.source, `protocol "${protocol.id}" source`);
    return protocol;
  });

  const canonical = `${generate(document)}\n`;
  invariant(source === canonical, 'compatibility lock is not in canonical a3s-acl form');
  const digest = `sha256:${createHash('sha256').update(canonical).digest('hex')}`;
  return {
    stack: {
      format: attribute(stack, 'format', 'Number'),
      owner: attribute(stack, 'owner', 'String'),
      rustVersion: attribute(stack, 'rust_version', 'String'),
      schema: attribute(stack, 'schema', 'String'),
    },
    components,
    protocols,
    canonical,
    digest,
  };
}

function run(command, args, cwd, options = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0 && !options.allowFailure) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new Error(`${command} ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
  }
  return result;
}

function git(root, args, options) {
  return run('git', args, root, options);
}

function readManifestIdentity(manifestPath, workspace = false) {
  const source = readFileSync(manifestPath, 'utf8');
  const sectionName = workspace ? 'workspace.package' : 'package';
  const section = tomlSection(source, sectionName, manifestPath);
  const version = quotedTomlValue(section, 'version', manifestPath);
  const name = workspace ? undefined : quotedTomlValue(section, 'name', manifestPath);
  return { name, source, version };
}

function tomlSection(source, name, label) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(
    `^\\[${escapedName}\\]\\s*$([\\s\\S]*?)(?=^\\[|(?![\\s\\S]))`,
    'm',
  ).exec(source);
  invariant(match, `${label} is missing [${name}]`);
  return match[1];
}

function quotedTomlValue(section, name, label) {
  const match = new RegExp(`^${name.replaceAll('-', '\\-')}\\s*=\\s*"([^"]+)"\\s*$`, 'm').exec(
    section,
  );
  invariant(match, `${label} is missing a quoted ${name}`);
  return match[1];
}

export function tomlDependency(source, sectionName, dependency, label = 'Cargo.toml') {
  const section = tomlSection(source, sectionName, label);
  const lines = section.split('\n');
  const start = lines.findIndex((line) =>
    new RegExp(`^${dependency.replaceAll('-', '\\-')}\\s*=`).test(line),
  );
  invariant(start >= 0, `${label} [${sectionName}] is missing ${dependency}`);
  let declaration = lines[start].slice(lines[start].indexOf('=') + 1).trim();
  let depth = bracketDepth(declaration);
  let index = start + 1;
  while (depth > 0 && index < lines.length) {
    declaration += ` ${lines[index].trim()}`;
    depth = bracketDepth(declaration);
    index += 1;
  }
  invariant(depth === 0, `${label} has an incomplete ${dependency} declaration`);
  return declaration.replace(/\s+/g, ' ').trim();
}

function bracketDepth(value) {
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (const character of value) {
    if (escaped) {
      escaped = false;
    } else if (character === '\\' && quoted) {
      escaped = true;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (!quoted && (character === '{' || character === '[')) {
      depth += 1;
    } else if (!quoted && (character === '}' || character === ']')) {
      depth -= 1;
    }
  }
  return depth;
}

function dependencyField(declaration, field, label) {
  const match = new RegExp(`\\b${field}\\s*=\\s*"([^"]+)"`).exec(declaration);
  invariant(match, `${label} is missing ${field}`);
  return match[1];
}

function exactDependencyVersion(declaration, label) {
  const direct = /^"([^"]+)"$/.exec(declaration);
  const version = direct?.[1] ?? dependencyField(declaration, 'version', label);
  invariant(version.startsWith('='), `${label} must use an exact =version requirement`);
  return version.slice(1);
}

function packageFromLock(source, name, label) {
  const entries = source.split('[[package]]').slice(1);
  const entry = entries.find((candidate) => new RegExp(`^\\s*name = "${name}"\\s*$`, 'm').test(candidate));
  invariant(entry, `${label} is missing package ${name}`);
  return {
    version: quotedTomlValue(entry, 'version', `${label} package ${name}`),
    source: /^source = "([^"]+)"$/m.exec(entry)?.[1],
  };
}

function assertLockVersion(lockSource, component, label, expectedRevision) {
  const entry = packageFromLock(lockSource, component.package, label);
  invariant(
    entry.version === component.version,
    `${label} locks ${component.package} ${entry.version}, expected ${component.version}`,
  );
  if (expectedRevision) {
    invariant(
      entry.source?.endsWith(`#${expectedRevision}`),
      `${label} does not lock ${component.package} revision ${expectedRevision}`,
    );
  }
}

function relativeDependencyPath(fromManifest, targetPath) {
  const value = relative(dirname(fromManifest), targetPath).split(sep).join('/');
  return value.startsWith('.') ? value : `./${value}`;
}

function verifyDependencyBindings(root, componentMap) {
  const cloud = componentMap.get('cloud');
  const gateway = componentMap.get('gateway');
  const cloudManifestPath = join(root, cloud.path, 'Cargo.toml');
  const cloudManifest = readFileSync(cloudManifestPath, 'utf8');
  const cloudLock = readFileSync(join(root, cloud.path, 'Cargo.lock'), 'utf8');

  for (const id of ['acl', 'boot', 'event']) {
    const component = componentMap.get(id);
    const declaration = tomlDependency(
      cloudManifest,
      'workspace.dependencies',
      component.package,
      cloudManifestPath,
    );
    invariant(
      exactDependencyVersion(declaration, `Cloud ${component.package}`) === component.version,
      `Cloud ${component.package} does not match the compatibility lock`,
    );
    assertLockVersion(cloudLock, component, 'apps/cloud/Cargo.lock');
  }

  for (const id of ['flow', 'orm']) {
    const component = componentMap.get(id);
    const declaration = tomlDependency(
      cloudManifest,
      'workspace.dependencies',
      component.package,
      cloudManifestPath,
    );
    invariant(
      dependencyField(declaration, 'git', `Cloud ${component.package}`) ===
        component.repository.replace('git@github.com:', 'https://github.com/'),
      `Cloud ${component.package} repository does not match the compatibility lock`,
    );
    invariant(
      dependencyField(declaration, 'rev', `Cloud ${component.package}`) === component.revision,
      `Cloud ${component.package} revision does not match the compatibility lock`,
    );
    assertLockVersion(cloudLock, component, 'apps/cloud/Cargo.lock', component.revision);
  }

  const runtime = componentMap.get('runtime');
  const runtimeDeclaration = tomlDependency(
    cloudManifest,
    'workspace.dependencies',
    runtime.package,
    cloudManifestPath,
  );
  const expectedRuntimePath = relativeDependencyPath(
    cloudManifestPath,
    join(root, runtime.path),
  );
  invariant(
    dependencyField(runtimeDeclaration, 'path', 'Cloud a3s-runtime') === expectedRuntimePath,
    `Cloud a3s-runtime path must be ${expectedRuntimePath}`,
  );
  assertLockVersion(cloudLock, runtime, 'apps/cloud/Cargo.lock');

  const gatewayManifestPath = join(root, gateway.path, 'Cargo.toml');
  const gatewayManifest = readFileSync(gatewayManifestPath, 'utf8');
  for (const id of ['acl', 'updater', 'sentry']) {
    const component = componentMap.get(id);
    const declaration = tomlDependency(
      gatewayManifest,
      'dependencies',
      component.package,
      gatewayManifestPath,
    );
    invariant(
      exactDependencyVersion(declaration, `Gateway ${component.package}`) === component.version,
      `Gateway ${component.package} does not match the compatibility lock`,
    );
  }
  const gatewayLock = readFileSync(join(root, gateway.path, 'Cargo.lock'), 'utf8');
  for (const id of ['acl', 'updater', 'sentry']) {
    assertLockVersion(gatewayLock, componentMap.get(id), 'crates/gateway/Cargo.lock');
  }
}

function verifyAclConfiguration(root, cloudPath) {
  const listed = git(join(root, cloudPath), [
    'ls-files',
    '-z',
    '--',
    'README.md',
    'config',
    'crates',
    'deploy',
    'docs',
    'web',
  ]).stdout;
  const files = listed.split('\0').filter(Boolean);
  const forbidden = files.filter((file) => /\.(?:hcl|tf|tfvars)$/i.test(file));
  invariant(
    forbidden.length === 0,
    `Cloud product configuration must be ACL; forbidden files: ${forbidden.join(', ')}`,
  );

  for (const file of files) {
    const bytes = readFileSync(join(root, cloudPath, file));
    if (bytes.includes(0)) {
      continue;
    }
    const source = bytes.toString('utf8');
    invariant(
      !/\bHCL\b|\.hcl\b/i.test(source),
      `${cloudPath}/${file} contains an HCL product-configuration reference`,
    );
  }

  const aclFiles = files.filter((file) => file.startsWith('config/') && file.endsWith('.acl'));
  invariant(aclFiles.length > 0, 'Cloud must include tracked ACL configuration fixtures');
  for (const file of aclFiles) {
    const source = readFileSync(join(root, cloudPath, file), 'utf8');
    const document = parse(source);
    const generated = generate(document);
    invariant(
      generate(parse(generated)) === generated,
      `${cloudPath}/${file} does not reach a stable a3s-acl parse/generate form`,
    );
  }
  return aclFiles;
}

export function verifyCloudStack(root = DEFAULT_ROOT, lockRelativePath = 'compat/cloud-stack.acl') {
  const lockPath = join(root, lockRelativePath);
  invariant(existsSync(lockPath), `missing compatibility lock ${lockRelativePath}`);
  const lock = parseCloudStackLock(readFileSync(lockPath, 'utf8'));
  const componentMap = new Map(lock.components.map((component) => [component.id, component]));
  for (const id of REQUIRED_COMPONENTS) {
    invariant(componentMap.has(id), `compatibility lock is missing required component ${id}`);
  }

  const rootRevision = git(root, ['rev-parse', 'HEAD']).stdout.trim();
  const resolvedComponents = [];
  for (const component of lock.components) {
    const componentRoot = join(root, component.path);
    invariant(existsSync(componentRoot), `component "${component.id}" is not initialized`);
    const manifestPath = join(componentRoot, 'Cargo.toml');
    invariant(existsSync(manifestPath), `component "${component.id}" is missing Cargo.toml`);
    const identity = readManifestIdentity(manifestPath, component.id === 'cloud');
    invariant(
      identity.version === component.version,
      `component "${component.id}" manifest is ${identity.version}, expected ${component.version}`,
    );
    if (component.package) {
      invariant(
        identity.name === component.package,
        `component "${component.id}" package is ${identity.name}, expected ${component.package}`,
      );
    }

    let resolvedRevision = rootRevision;
    if (component.source === 'git') {
      const modulePath = git(root, [
        'config',
        '-f',
        '.gitmodules',
        '--get',
        `submodule.${component.path}.path`,
      ]).stdout.trim();
      const moduleUrl = git(root, [
        'config',
        '-f',
        '.gitmodules',
        '--get',
        `submodule.${component.path}.url`,
      ]).stdout.trim();
      invariant(modulePath === component.path, `submodule ${component.path} is not registered`);
      invariant(
        moduleUrl === component.repository,
        `submodule ${component.path} URL is ${moduleUrl}, expected ${component.repository}`,
      );
      const indexEntry = git(root, ['ls-files', '--stage', '--', component.path]).stdout.trim();
      const match = /^160000 ([0-9a-f]{40}) 0\t/.exec(indexEntry);
      invariant(match, `component "${component.id}" is not recorded as a gitlink`);
      invariant(
        match[1] === component.revision,
        `component "${component.id}" gitlink is ${match[1]}, expected ${component.revision}`,
      );
      resolvedRevision = git(componentRoot, ['rev-parse', 'HEAD']).stdout.trim();
      invariant(
        resolvedRevision === component.revision,
        `component "${component.id}" HEAD is ${resolvedRevision}, expected ${component.revision}`,
      );
      const dirty = git(componentRoot, ['status', '--porcelain=v1', '--untracked-files=all']).stdout;
      invariant(dirty.length === 0, `component "${component.id}" worktree is dirty`);
    } else {
      const tracked =
        git(
          root,
          ['ls-files', '--error-unmatch', '--', `${component.path}/Cargo.toml`],
          { allowFailure: true },
        ).status === 0;
      invariant(tracked, `workspace component "${component.id}" is not tracked`);
      const dirty = git(root, [
        'status',
        '--porcelain=v1',
        '--untracked-files=all',
        '--',
        component.path,
      ]).stdout;
      invariant(dirty.length === 0, `workspace component "${component.id}" is dirty`);
    }
    resolvedComponents.push({ ...component, resolvedRevision });
  }

  for (const protocol of lock.protocols) {
    const sourcePath = join(root, protocol.source);
    invariant(existsSync(sourcePath), `protocol "${protocol.id}" source is missing`);
    const source = readFileSync(sourcePath, 'utf8');
    invariant(
      source.includes(`"${protocol.schema}"`),
      `protocol "${protocol.id}" source does not declare ${protocol.schema}`,
    );
  }

  verifyDependencyBindings(root, componentMap);
  const aclFiles = verifyAclConfiguration(root, componentMap.get('cloud').path);
  return { ...lock, components: resolvedComponents, aclFiles, rootRevision };
}

export function formatVerification(result) {
  const lines = [
    `Cloud compatibility lock ${result.digest}`,
    `Rust ${result.stack.rustVersion}`,
  ];
  for (const component of result.components) {
    lines.push(
      `${component.id}: ${component.resolvedRevision} (${component.version}, ${component.path})`,
    );
  }
  for (const protocol of result.protocols) {
    lines.push(`${protocol.id}: ${protocol.schema}`);
  }
  lines.push(`ACL fixtures: ${result.aclFiles.join(', ')}`);
  return lines.join('\n');
}

function main() {
  const rootArgument = process.argv.indexOf('--root');
  const root =
    rootArgument >= 0
      ? resolve(process.argv[rootArgument + 1] ?? '')
      : DEFAULT_ROOT;
  const result = verifyCloudStack(root);
  process.stdout.write(`${formatVerification(result)}\n`);
}

if (resolve(process.argv[1] ?? '') === SCRIPT_PATH) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`cloud-stack verification failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

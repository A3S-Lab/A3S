import { canonicalToolName, type ToolCallProjection } from './tool-call-projection';

export type ToolSyntaxRole =
  | 'plain'
  | 'program'
  | 'argument'
  | 'flag'
  | 'string'
  | 'path'
  | 'keyword'
  | 'operator'
  | 'redirection'
  | 'variable'
  | 'number'
  | 'comment'
  | 'key';

export interface ToolSyntaxToken {
  text: string;
  role: ToolSyntaxRole;
}

export interface ToolInvocationPresentation {
  kind: 'shell' | 'tool';
  text: string;
  tokens: ToolSyntaxToken[];
  cwd?: string;
}

export interface ToolOutputExcerpt {
  lines: string[];
  omittedLines: number;
  truncated: boolean;
}

type InvocationSource = Pick<ToolCallProjection, 'name' | 'args' | 'inputText'>;
type ShellTokenKind = 'whitespace' | 'word' | 'quoted' | 'operator' | 'comment';

interface ShellToken {
  kind: ShellTokenKind;
  text: string;
}

const shellToolNames = new Set([
  'bash',
  'exec',
  'execute',
  'execute_command',
  'git',
  'run',
  'run_command',
  'shell',
  'shell_command',
  'terminal',
]);
const shellKeywords = new Set([
  '!',
  'case',
  'do',
  'done',
  'elif',
  'else',
  'esac',
  'fi',
  'for',
  'function',
  'if',
  'in',
  'select',
  'then',
  'time',
  'until',
  'while',
]);
const commandKeywords = new Set(['!', 'do', 'elif', 'else', 'if', 'then', 'time', 'until', 'while']);
const commandSeparators = new Set(['|', '||', '|&', '&&', ';', ';;', ';&', ';;&', '&']);
const testPunctuation = new Set(['[', ']', '[[', ']]', '{', '}']);
const operators = [';;&', '&&', '||', '|&', '>>', '<<', '<&', '>&', '<>', '>|', ';;', ';&'];
const argumentPriority = [
  'command',
  'file_path',
  'path',
  'pattern',
  'query',
  'url',
  'description',
  'prompt',
  'skill_name',
];

export function toolInvocationPresentation(source: InvocationSource): ToolInvocationPresentation | null {
  const rawName = source.name.trim() || 'tool';
  const name = displayToolName(rawName);
  const canonicalName = canonicalToolName(rawName);
  if (shellToolNames.has(canonicalName)) {
    const rawCommand =
      stringArgument(source.args, ['command', 'cmd']) ??
      extractPartialJsonString(source.inputText, 'command') ??
      extractPartialJsonString(source.inputText, 'cmd');
    if (!rawCommand?.trim()) return null;
    const command =
      canonicalName === 'git' && !rawCommand.trimStart().startsWith('git ') ? `git ${rawCommand}` : rawCommand;
    return {
      kind: 'shell',
      text: command,
      tokens: shellSyntaxTokens(command),
      cwd: stringArgument(source.args, ['cwd', 'workdir', 'work_dir']),
    };
  }

  const args = source.args;
  if (!args || Object.keys(args).length === 0) {
    const input = source.inputText.trim();
    const tokens: ToolSyntaxToken[] = [{ text: name, role: 'program' }];
    if (input) {
      tokens.push(
        { text: '(', role: 'operator' },
        { text: truncate(input.replace(/\s+/g, ' '), 160), role: 'argument' },
        { text: ')', role: 'operator' }
      );
    }
    return { kind: 'tool', text: tokens.map((token) => token.text).join(''), tokens };
  }

  const orderedKeys = [
    ...argumentPriority.filter((key) => Object.hasOwn(args, key)),
    ...Object.keys(args).filter((key) => !argumentPriority.includes(key)),
  ];
  const visibleKeys = orderedKeys.slice(0, 4);
  const tokens: ToolSyntaxToken[] = [
    { text: name, role: 'program' },
    { text: '(', role: 'operator' },
  ];
  visibleKeys.forEach((key, index) => {
    if (index > 0) tokens.push({ text: ', ', role: 'plain' });
    tokens.push({ text: key, role: 'key' }, { text: '=', role: 'operator' }, ...genericValueTokens(args[key]));
  });
  const omitted = orderedKeys.length - visibleKeys.length;
  if (omitted > 0) {
    if (visibleKeys.length > 0) tokens.push({ text: ', ', role: 'plain' });
    tokens.push({ text: `…+${omitted}`, role: 'comment' });
  }
  tokens.push({ text: ')', role: 'operator' });
  return { kind: 'tool', text: tokens.map((token) => token.text).join(''), tokens };
}

export function shellSyntaxTokens(command: string): ToolSyntaxToken[] {
  const spans: ToolSyntaxToken[] = [];
  let commandPosition = true;
  let redirectionTarget = false;

  for (const token of shellTokens(command)) {
    if (token.kind === 'whitespace') {
      spans.push({ text: token.text, role: 'plain' });
      if (token.text.includes('\n')) {
        commandPosition = true;
        redirectionTarget = false;
      }
      continue;
    }
    if (token.kind === 'comment') {
      spans.push({ text: token.text, role: 'comment' });
      continue;
    }
    if (token.kind === 'operator') {
      const redirection = token.text.includes('<') || token.text.includes('>');
      spans.push({ text: token.text, role: redirection ? 'redirection' : 'operator' });
      if (redirection) redirectionTarget = true;
      else if (commandSeparators.has(token.text) || token.text === '(') commandPosition = true;
      continue;
    }
    if (token.kind === 'quoted') {
      spans.push({ text: token.text, role: 'string' });
      if (redirectionTarget) redirectionTarget = false;
      else commandPosition = false;
      continue;
    }
    if (redirectionTarget) {
      pushShellValueTokens(spans, token.text);
      redirectionTarget = false;
      continue;
    }
    if (shellKeywords.has(token.text)) {
      spans.push({ text: token.text, role: 'keyword' });
      commandPosition = commandKeywords.has(token.text);
      continue;
    }
    if (testPunctuation.has(token.text)) {
      spans.push({ text: token.text, role: 'operator' });
      if (commandPosition && (token.text === '[' || token.text === '[[')) commandPosition = false;
      continue;
    }
    if (commandPosition && isAssignment(token.text)) {
      pushAssignmentTokens(spans, token.text);
      continue;
    }
    if (commandPosition) {
      spans.push({
        text: token.text,
        role: token.text === 'true' || token.text === 'false' ? 'string' : 'program',
      });
      commandPosition = false;
      continue;
    }
    pushShellValueTokens(spans, token.text);
  }

  return spans;
}

export function toolJsonSyntaxTokens(value: string): ToolSyntaxToken[] {
  const tokens: ToolSyntaxToken[] = [];
  let cursor = 0;

  while (cursor < value.length) {
    const start = cursor;
    const character = nextCharacter(value, cursor);
    if (/\s/u.test(character)) {
      cursor += character.length;
      while (cursor < value.length && /\s/u.test(nextCharacter(value, cursor))) {
        cursor += nextCharacter(value, cursor).length;
      }
      tokens.push({ text: value.slice(start, cursor), role: 'plain' });
      continue;
    }
    if (character === '"') {
      cursor = quotedTokenEnd(value, cursor, '"');
      let lookahead = cursor;
      while (lookahead < value.length && /\s/u.test(nextCharacter(value, lookahead))) {
        lookahead += nextCharacter(value, lookahead).length;
      }
      tokens.push({
        text: value.slice(start, cursor),
        role: nextCharacter(value, lookahead) === ':' ? 'key' : 'string',
      });
      continue;
    }
    const number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u.exec(value.slice(cursor))?.[0];
    if (number) {
      cursor += number.length;
      tokens.push({ text: number, role: 'number' });
      continue;
    }
    const keyword = /^(?:true|false|null)\b/u.exec(value.slice(cursor))?.[0];
    if (keyword) {
      cursor += keyword.length;
      tokens.push({ text: keyword, role: 'keyword' });
      continue;
    }
    if ('{}[],:'.includes(character)) {
      cursor += character.length;
      tokens.push({ text: character, role: 'operator' });
      continue;
    }
    cursor += character.length;
    while (cursor < value.length) {
      const next = nextCharacter(value, cursor);
      if (/\s/u.test(next) || next === '"' || '{}[],:'.includes(next)) break;
      cursor += next.length;
    }
    tokens.push({ text: value.slice(start, cursor), role: 'argument' });
  }

  return tokens;
}

export function toolOutputExcerpt(output: string, maxLines = 2, maxCharacters = 320): ToolOutputExcerpt {
  const allLines = output.replace(/\r\n?/g, '\n').split('\n');
  while (allLines.at(-1) === '') allLines.pop();
  const lineLimit = Math.max(1, maxLines);
  const selected = allLines.slice(-lineLimit);
  let omittedLines = Math.max(0, allLines.length - selected.length);
  let truncated = false;
  const characterLimit = Math.max(40, maxCharacters);
  let visible = selected.join('\n');
  if (visible.length > characterLimit) {
    visible = visible.slice(-characterLimit);
    const firstLineBreak = visible.indexOf('\n');
    if (firstLineBreak >= 0) {
      visible = visible.slice(firstLineBreak + 1);
      omittedLines += 1;
    } else {
      visible = `…${visible.slice(1)}`;
    }
    truncated = true;
  }
  return {
    lines: visible ? visible.split('\n') : [],
    omittedLines,
    truncated,
  };
}

function displayToolName(name: string): string {
  const normalized = name.trim();
  if (normalized.toLowerCase().startsWith('mcp__')) {
    const [server, ...tool] = normalized.slice(5).split('__');
    if (server && tool.length) return `${server}.${tool.join('__')}`;
  }
  return normalized.split(/[.:/]/).at(-1) || normalized;
}

function shellTokens(command: string): ShellToken[] {
  const tokens: ShellToken[] = [];
  let cursor = 0;

  while (cursor < command.length) {
    const start = cursor;
    const character = nextCharacter(command, cursor);
    if (/\s/u.test(character)) {
      cursor += character.length;
      while (cursor < command.length && /\s/u.test(nextCharacter(command, cursor))) {
        cursor += nextCharacter(command, cursor).length;
      }
      tokens.push({ kind: 'whitespace', text: command.slice(start, cursor) });
      continue;
    }
    if (character === '#') {
      cursor += character.length;
      while (cursor < command.length && nextCharacter(command, cursor) !== '\n') {
        cursor += nextCharacter(command, cursor).length;
      }
      tokens.push({ kind: 'comment', text: command.slice(start, cursor) });
      continue;
    }
    if (character === "'" || character === '"') {
      cursor = quotedTokenEnd(command, cursor, character);
      tokens.push({ kind: 'quoted', text: command.slice(start, cursor) });
      continue;
    }
    const operator = operatorAt(command, cursor);
    if (operator) {
      cursor += operator.length;
      tokens.push({ kind: 'operator', text: command.slice(start, cursor) });
      continue;
    }

    while (cursor < command.length) {
      const next = nextCharacter(command, cursor);
      if (/\s/u.test(next) || next === "'" || next === '"' || operatorAt(command, cursor)) break;
      cursor += next.length;
      if (next === '\\' && cursor < command.length) cursor += nextCharacter(command, cursor).length;
    }
    tokens.push({ kind: 'word', text: command.slice(start, cursor) });
  }

  return tokens;
}

function quotedTokenEnd(command: string, start: number, quote: string): number {
  let cursor = start + quote.length;
  while (cursor < command.length) {
    const character = nextCharacter(command, cursor);
    cursor += character.length;
    if (character === quote) break;
    if (character === '\\' && quote === '"' && cursor < command.length) {
      cursor += nextCharacter(command, cursor).length;
    }
  }
  return cursor;
}

function operatorAt(value: string, cursor: number): string | undefined {
  const remaining = value.slice(cursor);
  const operator = operators.find((candidate) => remaining.startsWith(candidate));
  if (operator) return operator;
  const character = nextCharacter(value, cursor);
  return '|&;<>()'.includes(character) ? character : undefined;
}

function pushShellValueTokens(tokens: ToolSyntaxToken[], value: string): void {
  if (value.startsWith('-')) {
    const separator = value.indexOf('=');
    if (separator > 0) {
      const flag = value.slice(0, separator);
      const argument = value.slice(separator + 1);
      tokens.push(
        { text: flag, role: 'flag' },
        { text: '=', role: 'operator' },
        { text: argument, role: shellValueRole(argument) }
      );
    } else {
      tokens.push({ text: value, role: 'flag' });
    }
  } else if (isAssignment(value)) {
    pushAssignmentTokens(tokens, value);
  } else {
    tokens.push({ text: value, role: shellValueRole(value) });
  }
}

function pushAssignmentTokens(tokens: ToolSyntaxToken[], value: string): void {
  const separator = value.indexOf('=');
  if (separator < 1) {
    tokens.push({ text: value, role: 'argument' });
    return;
  }
  const name = value.slice(0, separator);
  const argument = value.slice(separator + 1);
  tokens.push(
    { text: name, role: 'variable' },
    { text: '=', role: 'operator' },
    { text: argument, role: shellValueRole(argument) }
  );
}

function genericValueTokens(value: unknown): ToolSyntaxToken[] {
  if (typeof value === 'string') {
    const safe = value.length > 0 && !/[\s,()='"\\]/u.test(value);
    const text = safe ? value : JSON.stringify(value);
    return [{ text: truncate(text, 120), role: safe ? shellValueRole(value) : 'string' }];
  }
  if (typeof value === 'number') return [{ text: String(value), role: 'number' }];
  if (typeof value === 'boolean' || value === null) {
    return [{ text: String(value), role: 'keyword' }];
  }
  return [{ text: truncate(JSON.stringify(value) ?? 'null', 120), role: 'argument' }];
}

function shellValueRole(value: string): ToolSyntaxRole {
  if (looksLikePath(value)) return 'path';
  if (value.startsWith('$') || value.includes('${')) return 'variable';
  if (value.trim() && Number.isFinite(Number(value))) return 'number';
  if (value === 'true' || value === 'false' || value === 'null') return 'keyword';
  return 'argument';
}

function looksLikePath(value: string): boolean {
  const normalized = value.replace(/^["']|["',)\]}]+$/g, '');
  return (
    normalized === '.' ||
    normalized === '..' ||
    normalized.includes('://') ||
    normalized.startsWith('/') ||
    normalized.startsWith('./') ||
    normalized.startsWith('../') ||
    normalized.startsWith('~/') ||
    normalized.includes('/') ||
    /\.[a-z0-9]{1,8}$/i.test(normalized)
  );
}

function isAssignment(value: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*=/u.test(value);
}

function stringArgument(args: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  return keys
    .map((key) => args?.[key])
    .find((value): value is string => typeof value === 'string' && Boolean(value.trim()));
}

function extractPartialJsonString(value: string, key: string): string | undefined {
  const match = new RegExp(`"${escapeRegExp(key)}"\\s*:\\s*"`).exec(value);
  if (!match) return undefined;
  let cursor = match.index + match[0].length;
  let encoded = '';
  let escaped = false;
  while (cursor < value.length) {
    const character = nextCharacter(value, cursor);
    cursor += character.length;
    if (character === '"' && !escaped) break;
    encoded += character;
    if (character === '\\' && !escaped) escaped = true;
    else escaped = false;
  }
  if (encoded.endsWith('\\')) encoded = encoded.slice(0, -1);
  try {
    return JSON.parse(`"${encoded}"`) as string;
  } catch {
    return encoded.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
}

function nextCharacter(value: string, cursor: number): string {
  const point = value.codePointAt(cursor);
  return point === undefined ? '' : String.fromCodePoint(point);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function truncate(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

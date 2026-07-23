import type { AgentEvent, ContentBlock } from '../../../types/api';

export type ToolCallState =
  | 'preparing'
  | 'awaiting'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'denied'
  | 'timed-out'
  | 'interrupted';

export interface ToolCallProjection {
  id: string;
  name: string;
  state: ToolCallState;
  firstEventIndex?: number;
  firstBlockIndex?: number;
  args?: Record<string, unknown>;
  inputText: string;
  output: string;
  exitCode?: number;
  metadata?: Record<string, unknown>;
  errorKind?: string;
  durationMs?: number;
  reason?: string;
  scope?: string;
  risk?: string;
  timeoutMs?: number;
}

export interface ProjectToolCallsOptions {
  settleOpen?: boolean;
}

export type ToolTimelineTone = 'idle' | 'running' | 'attention' | 'problem' | 'complete';

export interface ToolTimelineSummary {
  tone: ToolTimelineTone;
  label: string;
  active: number;
  attention: number;
  problems: number;
  completed: number;
  total: number;
}

const terminalStates = new Set<ToolCallState>(['succeeded', 'failed', 'denied', 'timed-out', 'interrupted']);
const DEEP_RESEARCH_CANCELLED_MESSAGE = 'DeepResearch was cancelled by the user.';
const toolNameAliases: Readonly<Record<string, string>> = {
  append_to_file: 'write',
  cat_file: 'read',
  create_file: 'create',
  delete_file: 'delete',
  edit_file: 'edit',
  exec_command: 'exec',
  execute: 'exec',
  execute_command: 'exec',
  fetch_url: 'web_fetch',
  find_files: 'find',
  grep_search: 'grep',
  list_directory: 'ls',
  list_files: 'ls',
  patch_file: 'patch',
  read_directory: 'ls',
  read_file: 'read',
  read_text_file: 'read',
  remove_file: 'delete',
  replace_in_file: 'edit',
  rg: 'grep',
  ripgrep: 'grep',
  run_command: 'run',
  search_code: 'grep',
  search_files: 'search',
  shell_command: 'shell',
  terminal: 'shell',
  write_file: 'write',
  write_text_file: 'write',
};

export function projectToolCalls(
  events: AgentEvent[],
  contentBlocks: ContentBlock[] = [],
  options: ProjectToolCallsOptions = {}
): ToolCallProjection[] {
  const calls = new Map<string, ToolCallProjection>();
  const order: string[] = [];

  const ensure = (
    id: string,
    name: string,
    source: { eventIndex?: number; blockIndex?: number } = {}
  ): ToolCallProjection => {
    const existing = calls.get(id);
    if (existing) {
      if (existing.name === 'tool' && name !== 'tool') existing.name = name;
      existing.firstEventIndex ??= source.eventIndex;
      existing.firstBlockIndex ??= source.blockIndex;
      return existing;
    }
    const call: ToolCallProjection = {
      id,
      name: name || 'tool',
      state: 'preparing',
      firstEventIndex: source.eventIndex,
      firstBlockIndex: source.blockIndex,
      inputText: '',
      output: '',
    };
    calls.set(id, call);
    order.push(id);
    return call;
  };

  events.forEach((event, index) => {
    if (!isToolEvent(event.type)) return;
    const name = eventName(event);
    const id = eventId(event, name, index, order, calls);
    const call = ensure(id, name, { eventIndex: index });

    switch (event.type) {
      case 'tool_start':
        if (!terminalStates.has(call.state)) call.state = 'preparing';
        break;
      case 'tool_input_delta': {
        const delta = typeof event.delta === 'string' ? event.delta : '';
        call.inputText += delta;
        call.args = parsePartialArguments(call.inputText) ?? call.args;
        break;
      }
      case 'tool_execution_start':
        call.state = 'running';
        call.args = recordValue(event.args) ?? call.args;
        break;
      case 'tool_output_delta':
        call.state = 'running';
        call.output += typeof event.delta === 'string' ? event.delta : '';
        break;
      case 'confirmation_required':
        call.state = 'awaiting';
        call.args = recordValue(event.args) ?? call.args;
        call.reason = stringValue(event.reason) ?? stringValue(event.message) ?? call.reason;
        call.scope = stringValue(event.scope) ?? call.scope;
        call.risk = stringValue(event.risk) ?? call.risk;
        call.timeoutMs = numberValue(event.timeout_ms) ?? call.timeoutMs;
        break;
      case 'confirmation_received':
        call.state = event.approved ? 'running' : 'denied';
        call.reason = stringValue(event.reason) ?? call.reason;
        break;
      case 'confirmation_timeout':
        call.state = event.action_taken === 'auto_approved' ? 'running' : 'timed-out';
        call.reason =
          event.action_taken === 'auto_approved' ? '确认超时，已按策略自动允许' : '确认超时，工具调用未执行';
        break;
      case 'permission_denied':
        call.state = 'denied';
        call.args = recordValue(event.args) ?? call.args;
        call.reason = stringValue(event.reason) ?? stringValue(event.message) ?? '权限策略已拒绝该工具调用';
        break;
      case 'tool_end': {
        const exitCode = numberValue(event.exit_code);
        const errorKind = toolErrorKind(event.error_kind);
        const metadata = recordValue(event.metadata) ?? call.metadata;
        const output = stringValue(event.output) ?? call.output;
        const cancelled = isCancelledToolCall(call, errorKind, metadata, output);
        const failed = Boolean(event.is_error) || (exitCode !== undefined && exitCode !== 0) || Boolean(errorKind);
        const settledDecision = call.state === 'denied' || call.state === 'timed-out' ? call.state : undefined;
        call.state = settledDecision ?? (cancelled ? 'interrupted' : failed ? 'failed' : 'succeeded');
        call.args = recordValue(event.args) ?? call.args;
        call.output = cancelled && isCancellationTransportMessage(output, metadata) ? '' : output;
        call.exitCode = exitCode;
        call.metadata = cancelled
          ? {
              ...metadata,
              cancelled: true,
              message: cancellationMessage(metadata) ?? cancellationFallbackMessage(call),
            }
          : metadata;
        call.errorKind = errorKind;
        call.durationMs = numberValue(event.duration_ms) ?? numberFromRecord(call.metadata, 'duration_ms');
        if (cancelled) {
          call.reason =
            canonicalToolName(call.name) === 'deep_research' ? '用户已停止深度研究。' : '用户已停止该操作。';
        }
        break;
      }
      default:
        break;
    }
  });

  contentBlocks.forEach((block, index) => {
    if (!isToolBlock(block)) return;
    const id = block.toolUseId || block.id || `content-tool-${index}`;
    const call = ensure(id, block.name || 'tool', { blockIndex: index });
    if (block.input) call.args = block.input;
    if (block.content !== undefined) {
      if (!call.output) call.output = block.content;
      const exitCode = typeof block.exitCode === 'number' ? block.exitCode : undefined;
      call.exitCode ??= exitCode;
      call.durationMs ??= block.durationMs ?? undefined;
      if (!terminalStates.has(call.state)) {
        call.state = block.isError || (exitCode !== undefined && exitCode !== 0) ? 'failed' : 'succeeded';
      }
    }
  });

  const parentSettled =
    options.settleOpen || events.some((event) => ['agent_end', 'error', 'cancelled'].includes(event.type));
  if (parentSettled) {
    for (const call of calls.values()) {
      if (terminalStates.has(call.state)) continue;
      const previousState = call.state;
      call.state = 'interrupted';
      call.reason =
        call.reason ||
        (previousState === 'awaiting' ? '任务已结束，这次确认不再有效。' : '任务已结束，但没有收到该操作的完成结果。');
    }
  }

  return order.map((id) => calls.get(id)).filter((call): call is ToolCallProjection => Boolean(call));
}

export function selectToolCallsForDisplay(
  calls: readonly ToolCallProjection[],
  recentSucceededLimit = 4,
  compactThreshold = 6
): { calls: ToolCallProjection[]; hiddenCount: number } {
  if (calls.length <= compactThreshold) return { calls: [...calls], hiddenCount: 0 };
  const recentSucceededIds = new Set(
    calls
      .filter((call) => call.state === 'succeeded')
      .slice(-recentSucceededLimit)
      .map((call) => call.id)
  );
  const visible = calls.filter((call) => call.state !== 'succeeded' || recentSucceededIds.has(call.id));
  return { calls: visible, hiddenCount: calls.length - visible.length };
}

export function summarizeToolCalls(calls: readonly ToolCallProjection[]): ToolTimelineSummary {
  const total = calls.length;
  const active = calls.filter((call) => call.state === 'preparing' || call.state === 'running').length;
  const attention = calls.filter((call) => call.state === 'awaiting').length;
  const problems = calls.filter((call) => ['failed', 'denied', 'timed-out', 'interrupted'].includes(call.state)).length;
  const completed = calls.filter((call) => call.state === 'succeeded').length;

  if (attention > 0) {
    return {
      tone: 'attention',
      label: groupStateLabel(total, attention, '等待确认'),
      active,
      attention,
      problems,
      completed,
      total,
    };
  }
  if (problems > 0) {
    return {
      tone: 'problem',
      label: groupStateLabel(total, problems, '需要处理'),
      active,
      attention,
      problems,
      completed,
      total,
    };
  }
  if (active > 0) {
    return {
      tone: 'running',
      label: groupStateLabel(total, active, '执行中'),
      active,
      attention,
      problems,
      completed,
      total,
    };
  }
  return {
    tone: total > 0 ? 'complete' : 'idle',
    label: total > 0 ? `${total} 项操作已完成` : '尚无操作',
    active,
    attention,
    problems,
    completed,
    total,
  };
}

export function toolActionLabel(call: Pick<ToolCallProjection, 'name' | 'state'>): string {
  switch (canonicalToolName(call.name)) {
    case 'bash':
    case 'shell':
    case 'run':
    case 'exec':
      return statefulLabel(call.state, '正在执行命令', '已执行命令', '命令执行失败', '命令未执行');
    case 'read':
    case 'cat':
      return statefulLabel(call.state, '正在读取文件', '已读取文件', '读取文件失败', '未读取文件');
    case 'write':
    case 'create':
      return statefulLabel(call.state, '正在写入文件', '已写入文件', '写入文件失败', '未写入文件');
    case 'edit':
    case 'patch':
    case 'apply_patch':
      return statefulLabel(call.state, '正在修改文件', '已修改文件', '修改文件失败', '未修改文件');
    case 'delete':
    case 'remove':
    case 'unlink':
      return statefulLabel(call.state, '正在删除文件', '已删除文件', '删除文件失败', '未删除文件');
    case 'grep':
    case 'search':
      return statefulLabel(call.state, '正在搜索代码', '已搜索代码', '搜索代码失败', '未搜索代码');
    case 'ls':
    case 'glob':
    case 'find':
      return statefulLabel(call.state, '正在查找文件', '已查找文件', '查找文件失败', '未查找文件');
    case 'web_search':
      return statefulLabel(call.state, '正在搜索网页', '已搜索网页', '搜索网页失败', '未搜索网页');
    case 'web_fetch':
      return statefulLabel(call.state, '正在读取网页', '已读取网页', '读取网页失败', '未读取网页');
    case 'deep_research':
      if (call.state === 'interrupted') return '深度研究已停止';
      return statefulLabel(call.state, '正在深度研究', '深度研究已完成', '深度研究失败', '深度研究未执行');
    case 'task':
    case 'parallel_task':
      return statefulLabel(call.state, '正在委派任务', '已完成委派', '委派任务失败', '任务未委派');
    case 'skill':
      return statefulLabel(call.state, '正在使用 Skill', '已使用 Skill', 'Skill 执行失败', '未使用 Skill');
    case 'search_skills':
      return statefulLabel(call.state, '正在搜索 Skill', '已搜索 Skill', '搜索 Skill 失败', '未搜索 Skill');
    case 'git':
      return statefulLabel(call.state, '正在执行 Git', '已执行 Git', 'Git 执行失败', 'Git 未执行');
    default:
      return statefulLabel(
        call.state,
        `正在调用 ${call.name}`,
        `已调用 ${call.name}`,
        `${call.name} 调用失败`,
        `${call.name} 未调用`
      );
  }
}

export function toolOperationLabel(call: Pick<ToolCallProjection, 'name'>): string {
  switch (canonicalToolName(call.name)) {
    case 'bash':
    case 'shell':
    case 'run':
    case 'exec':
      return '运行本地命令';
    case 'read':
    case 'cat':
      return '读取工作区文件';
    case 'write':
    case 'create':
      return '写入工作区文件';
    case 'edit':
    case 'patch':
    case 'apply_patch':
      return '修改工作区文件';
    case 'delete':
    case 'remove':
    case 'unlink':
      return '删除工作区文件';
    case 'web_search':
      return '搜索外部网页';
    case 'web_fetch':
      return '访问外部网页';
    case 'deep_research':
      return '生成来源可追溯的研究报告';
    case 'task':
    case 'parallel_task':
      return '委派子任务';
    default:
      return `调用 ${call.name}`;
  }
}

export function toolRiskSummary(call: Pick<ToolCallProjection, 'name'>): string {
  switch (canonicalToolName(call.name)) {
    case 'bash':
    case 'shell':
    case 'run':
    case 'exec':
      return '本地命令可能读取、修改或删除文件，请确认命令内容与作用范围。';
    case 'write':
    case 'create':
    case 'edit':
    case 'patch':
    case 'apply_patch':
      return '该操作会修改工作区文件，请确认目标路径和变更范围。';
    case 'delete':
    case 'remove':
    case 'unlink':
      return '该操作会删除工作区文件，请确认目标路径和影响范围。';
    case 'web_search':
    case 'web_fetch':
      return '该操作会访问外部网络，请确认请求内容不包含不应发送的信息。';
    case 'task':
    case 'parallel_task':
      return '该操作会把当前任务的一部分交给子智能体执行。';
    default:
      return '该工具将在当前任务上下文中执行一次操作。';
  }
}

function statefulLabel(
  state: ToolCallState,
  running: string,
  succeeded: string,
  failed: string,
  skipped: string
): string {
  if (state === 'succeeded') return succeeded;
  if (state === 'failed') return failed;
  if (state === 'denied' || state === 'timed-out' || state === 'interrupted') return skipped;
  return running;
}

export function toolArgumentSummary(call: Pick<ToolCallProjection, 'name' | 'args' | 'inputText'>): string {
  const args = call.args;
  if (!args) return truncate(call.inputText.replace(/\s+/g, ' ').trim(), 140);
  const name = canonicalToolName(call.name);
  const keys =
    name === 'grep' || name === 'search'
      ? ['pattern', 'path']
      : name === 'web_search'
        ? ['query']
        : name === 'web_fetch'
          ? ['url']
          : ['command', 'file_path', 'path', 'pattern', 'query', 'url', 'description', 'prompt', 'skill_name'];
  for (const key of keys) {
    const value = args[key];
    if (typeof value === 'string' && value.trim()) return summarizeArgument(value);
  }
  return '';
}

export function isFileEditCall(call: Pick<ToolCallProjection, 'name'>): boolean {
  return ['write', 'create', 'edit', 'patch', 'apply_patch', 'delete', 'remove', 'unlink'].includes(
    canonicalToolName(call.name)
  );
}

export function toolFilePath(call: Pick<ToolCallProjection, 'args' | 'metadata'>): string | undefined {
  for (const source of [call.metadata, call.args]) {
    const value = source?.file_path ?? source?.path;
    if (typeof value === 'string' && value.trim()) return value;
  }
  return undefined;
}

function isToolEvent(type: string): boolean {
  return [
    'tool_start',
    'tool_input_delta',
    'tool_execution_start',
    'tool_output_delta',
    'tool_end',
    'confirmation_required',
    'confirmation_received',
    'confirmation_timeout',
    'permission_denied',
  ].includes(type);
}

function isToolBlock(block: ContentBlock): boolean {
  return block.type.includes('tool') || Boolean(block.toolUseId) || Boolean(block.name && block.content !== undefined);
}

function eventName(event: AgentEvent): string {
  return stringValue(event.tool_name) ?? stringValue(event.name) ?? 'tool';
}

function eventId(
  event: AgentEvent,
  name: string,
  index: number,
  order: string[],
  calls: Map<string, ToolCallProjection>
): string {
  const explicit = stringValue(event.tool_id) ?? stringValue(event.id);
  if (explicit) return explicit;
  const openCalls = [...order]
    .reverse()
    .map((id) => calls.get(id))
    .filter((call): call is ToolCallProjection => Boolean(call && !terminalStates.has(call.state)));
  const matching = openCalls.find((call) => call.name === name);
  if (matching) return matching.id;
  if (name === 'tool' || openCalls.length === 1) return openCalls[0]?.id ?? `${normalizedToolName(name)}-${index}`;
  return `${normalizedToolName(name)}-${index}`;
}

export function canonicalToolName(value: string): string {
  const normalized = normalizedToolName(value);
  if (normalized.startsWith('mcp__')) return normalized;
  const unqualified = normalized.split(/[.:/]/).at(-1) || normalized;
  return toolNameAliases[unqualified] ?? unqualified;
}

function normalizedToolName(value: string): string {
  return value.trim().toLowerCase();
}

function parsePartialArguments(value: string): Record<string, unknown> | undefined {
  try {
    return recordValue(JSON.parse(value));
  } catch {
    return undefined;
  }
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function toolErrorKind(value: unknown): string | undefined {
  return stringValue(value) ?? stringValue(recordValue(value)?.type);
}

function isCancelledToolCall(
  call: Pick<ToolCallProjection, 'name'>,
  errorKind: string | undefined,
  metadata: Record<string, unknown> | undefined,
  output: string
): boolean {
  if (errorKind?.toLowerCase() === 'cancelled' || metadata?.cancelled === true) return true;
  return canonicalToolName(call.name) === 'deep_research' && output.trim() === DEEP_RESEARCH_CANCELLED_MESSAGE;
}

function isCancellationTransportMessage(output: string, metadata: Record<string, unknown> | undefined): boolean {
  const normalized = output.trim();
  return normalized === DEEP_RESEARCH_CANCELLED_MESSAGE || normalized === cancellationMessage(metadata)?.trim();
}

function cancellationMessage(metadata: Record<string, unknown> | undefined): string | undefined {
  return stringValue(metadata?.message);
}

function cancellationFallbackMessage(call: Pick<ToolCallProjection, 'name'>): string {
  return canonicalToolName(call.name) === 'deep_research'
    ? DEEP_RESEARCH_CANCELLED_MESSAGE
    : 'Tool execution was cancelled by the user.';
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function numberFromRecord(value: Record<string, unknown> | undefined, key: string): number | undefined {
  return value ? numberValue(value[key]) : undefined;
}

function truncate(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function summarizeArgument(value: string): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact === '.' || compact === './') return '当前工作区';
  return truncate(compact, 140);
}

function groupStateLabel(total: number, count: number, state: string): string {
  return total === count ? `${count} 项${state}` : `${total} 项操作 · ${count} 项${state}`;
}

import { AlertTriangle, ChevronDown, RefreshCw, Wrench } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '../../../design-system/primitives';
import { appendTaskInstruction } from '../../../state/app-state';
import type { AgentEvent } from '../../../types/api';

export function RecoveryNotice({ events, retryContent }: { events: AgentEvent[]; retryContent?: string }) {
  const failure = findTurnFailure(events);
  if (!failure) return null;
  const details = classify(failure);
  const hasTechnicalDetails = shouldDiscloseTechnicalDetails(details.message);
  const summary = hasTechnicalDetails ? summarizeTechnicalFailure(details.message) : details.message;
  const recoveryAction = turnRecoveryAction(failure, details.message);
  const askToFix = () => {
    appendTaskInstruction(recoveryAction.instruction);
  };
  return (
    <section className={`recovery-notice ${details.tone}`} aria-label='任务恢复操作'>
      <header>
        {details.icon}
        <div>
          <strong>{details.title}</strong>
          <p>{summary}</p>
          {hasTechnicalDetails && <TechnicalDetailsDisclosure message={details.message} />}
        </div>
      </header>
      <footer>
        {retryContent && (failure.type === 'error' || failure.type === 'cancelled') && (
          <Button
            tone='secondary'
            onClick={() => {
              appendTaskInstruction(retryContent);
            }}
          >
            <RefreshCw size={13} />
            添加重试指令
          </Button>
        )}
        {failure.type !== 'cancelled' && (
          <Button tone='primary' onClick={askToFix}>
            <Wrench size={13} />
            {recoveryAction.label}
          </Button>
        )}
      </footer>
    </section>
  );
}

function turnRecoveryAction(event: AgentEvent, message: string): { instruction: string; label: string } {
  if (event.tool_name) {
    return {
      label: '让 Code 分析并修复',
      instruction: `请检查失败的 ${event.tool_name} 工具调用，定位原因并安全修复。\n\n失败信息：${message}`,
    };
  }
  if (event.type === 'command_dead_lettered') {
    return {
      label: '检查失败原因',
      instruction: `请检查本轮任务重试耗尽的原因，保留已完成结果，并提出可安全继续的方案。\n\n失败信息：${message}`,
    };
  }
  return {
    label: '诊断并恢复',
    instruction: `请诊断本轮任务失败，确认模型、连接与运行状态。保留已完成结果，并在安全可继续时恢复任务。\n\n失败信息：${message}`,
  };
}

function findTurnFailure(events: readonly AgentEvent[]): AgentEvent | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (!event || !['error', 'cancelled', 'command_dead_lettered'].includes(event.type)) continue;
    if (event.type === 'error' && repeatsFailedToolEvidence(event, events.slice(0, index))) continue;
    return event;
  }
  return undefined;
}

function repeatsFailedToolEvidence(error: AgentEvent, precedingEvents: readonly AgentEvent[]): boolean {
  const message = normalizeFailureEvidence(stringEvidence(error.message) || stringEvidence(error.error));
  if (!message) return false;

  const failedTools = precedingEvents.filter(isFailedToolEvent);
  if (!failedTools.length) return false;
  if (genericToolFailureMessages.has(message)) return true;

  return failedTools.some((tool) =>
    [tool.output, tool.error_kind, tool.message, tool.reason, tool.error]
      .map(stringEvidence)
      .map(normalizeFailureEvidence)
      .some((evidence) => evidenceMatches(message, evidence))
  );
}

function isFailedToolEvent(event: AgentEvent): boolean {
  return (
    event.type === 'tool_end' &&
    (Boolean(event.is_error) ||
      Boolean(event.error_kind) ||
      (typeof event.exit_code === 'number' && event.exit_code !== 0))
  );
}

function stringEvidence(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function normalizeFailureEvidence(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/\s+/g, ' ')
    .replace(/^[\s:：;；,，.。-]+|[\s:：;；,，.。-]+$/g, '')
    .trim();
}

function evidenceMatches(message: string, evidence: string): boolean {
  if (!evidence) return false;
  if (message === evidence) return true;

  const minimumContainedEvidenceLength = 16;
  if (message.length < minimumContainedEvidenceLength || evidence.length < minimumContainedEvidenceLength) {
    return false;
  }
  return message.includes(evidence) || evidence.includes(message);
}

const genericToolFailureMessages = new Set(
  ['tool execution failed', 'tool call failed', 'tool invocation failed', '工具执行失败', '工具调用失败'].map(
    normalizeFailureEvidence
  )
);

function TechnicalDetailsDisclosure({ message }: { message: string }) {
  const [open, setOpen] = useState(false);
  const contentId = useId();
  return (
    <div className={`recovery-technical-details ${open ? 'open' : ''}`}>
      <button type='button' aria-expanded={open} aria-controls={contentId} onClick={() => setOpen((value) => !value)}>
        查看技术详情
        <ChevronDown size={12} />
      </button>
      <pre id={contentId} hidden={!open}>
        {message}
      </pre>
    </div>
  );
}

function classify(event: AgentEvent) {
  if (event.type === 'cancelled')
    return {
      title: '任务已停止',
      message: String(event.message || '已保留完成的输出，可以修改指令后继续。'),
      tone: 'cancelled',
      icon: <AlertTriangle size={16} />,
    };
  return {
    title: event.type === 'command_dead_lettered' ? '任务重试已耗尽' : '任务运行失败',
    message: String(event.message || event.error || '连接或模型请求失败。'),
    tone: 'error',
    icon: <AlertTriangle size={16} />,
  };
}

const technicalDetailThreshold = 260;
const technicalSummaryLimit = 180;

function shouldDiscloseTechnicalDetails(message: string): boolean {
  return message.length > technicalDetailThreshold || message.split(/\r?\n/).length > 4;
}

function summarizeTechnicalFailure(message: string): string {
  const firstLine = message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  const normalized = (firstLine || message).replace(/\s+/g, ' ').trim();
  const firstClause = normalized.split(/[;；]/, 1)[0]?.trim() || normalized;
  const source = firstClause.length >= 24 ? firstClause : normalized;
  if (source.length <= technicalSummaryLimit) return `${source.replace(/[;；,，\s]+$/, '')}…`;

  const prefix = source.slice(0, technicalSummaryLimit);
  const wordBoundary = prefix.lastIndexOf(' ');
  const clipped = wordBoundary > technicalSummaryLimit * 0.7 ? prefix.slice(0, wordBoundary) : prefix;
  return `${clipped.replace(/[;；,，\s]+$/, '')}…`;
}

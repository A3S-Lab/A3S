import type { AgentEvent, ChatMessage, ContentBlock } from '../../../types/api';

export interface ConversationTurn {
  id: string;
  instruction?: ChatMessage;
  instructionResources: InstructionResources;
  responses: ChatMessage[];
  interrupted: boolean;
}

export interface InstructionResources {
  contextFiles: string[];
  skillNames: string[];
}

export interface ConversationProjectionOptions {
  running?: boolean;
}

const transportSectionPattern =
  /^\s*\[(Selected skills|Workspace context files)\]\s*\n([\s\S]*?)\n\[\/\1\]\s*(?:\n+|$)/i;

export function projectConversation(
  messages: readonly ChatMessage[],
  options: ConversationProjectionOptions = {}
): ConversationTurn[] {
  const turns: ConversationTurn[] = [];
  let currentTurn: ConversationTurn | undefined;
  let replaceLatestResponse = false;

  for (const message of messages) {
    if (message.role === 'system') continue;

    if (message.role === 'user') {
      const instructionProjection = projectInstruction(message);
      if (!instructionProjection) {
        replaceLatestResponse ||= isSynthesisContinuation(message.content);
        continue;
      }

      const instruction = { ...message, content: instructionProjection.content };
      currentTurn = {
        id: `turn-${instruction.id}`,
        instruction,
        instructionResources: instructionProjection.resources,
        responses: [],
        interrupted: false,
      };
      turns.push(currentTurn);
      replaceLatestResponse = false;
      continue;
    }

    if (!isRenderableResponse(message)) continue;
    currentTurn ??= createResponseOnlyTurn(message);
    if (!turns.includes(currentTurn)) turns.push(currentTurn);

    const response = { ...message, content: message.content.trim() };
    if (replaceLatestResponse && currentTurn.responses.length > 0) {
      currentTurn.responses[currentTurn.responses.length - 1] = response;
    } else {
      currentTurn.responses.push(response);
    }
    replaceLatestResponse = false;
  }

  const lastTurnIndex = turns.length - 1;
  turns.forEach((turn, index) => {
    turn.interrupted = Boolean(
      turn.instruction && turn.responses.length === 0 && !(options.running && index === lastTurnIndex)
    );
  });

  return turns;
}

export function visibleInstructionContent(message: ChatMessage): string | null {
  return projectInstruction(message)?.content ?? null;
}

export function projectInstruction(message: ChatMessage): { content: string; resources: InstructionResources } | null {
  if (message.role !== 'user' || isToolResultMessage(message)) return null;
  const projection = stripTransportSections(message.content);
  const content = projection.content.trim();
  if (!content || isInternalOrchestrationPrompt(content)) return null;
  return { content, resources: projection.resources };
}

function stripTransportSections(content: string): { content: string; resources: InstructionResources } {
  let visible = content;
  let previous = '';
  const resources: InstructionResources = { contextFiles: [], skillNames: [] };
  while (visible !== previous) {
    previous = visible;
    visible = visible.replace(transportSectionPattern, (_match, section: string, body: string) => {
      if (section.toLowerCase() === 'selected skills') resources.skillNames.push(...parseSkillLines(body));
      else resources.contextFiles.push(...parseBulletLines(body));
      return '';
    });
  }
  return {
    content: visible,
    resources: {
      contextFiles: unique(resources.contextFiles),
      skillNames: unique(resources.skillNames),
    },
  };
}

function parseSkillLines(body: string): string[] {
  return parseBulletLines(body)
    .map((line) => line.match(/`([^`]+)`/)?.[1] ?? line.replace(/^Use your\s+/i, '').replace(/\s+skill\.?$/i, ''))
    .filter(Boolean);
}

function parseBulletLines(body: string): string[] {
  return body
    .split('\n')
    .map((line) => line.trim().replace(/^[-*]\s+/, ''))
    .filter(Boolean);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function isInternalOrchestrationPrompt(content: string): boolean {
  if (isSynthesisContinuation(content)) return true;
  if (/\n\s*Planner-optimized request:\s*\n/i.test(content)) return true;
  if (/^\s*Original user request:\s*\n[\s\S]*\n\s*Hook-modified planning task:\s*\n/i.test(content)) return true;
  if (/^\s*Planning hook guidance:\s*\n/i.test(content)) return true;
  return false;
}

function isSynthesisContinuation(content: string): boolean {
  const value = content.trim();
  return (
    /^\[synthesis\](?:\s|$)/i.test(value) ||
    (/\bOriginal user task:\s*\n/i.test(value) && /\bWrite the final answer now\b/i.test(value))
  );
}

function isToolResultMessage(message: ChatMessage): boolean {
  const blocks = message.contentBlocks ?? [];
  return blocks.length > 0 && blocks.every(isToolOnlyBlock);
}

function isToolOnlyBlock(block: ContentBlock): boolean {
  return block.type.includes('tool') || Boolean(block.toolUseId);
}

function isRenderableResponse(message: ChatMessage): boolean {
  if (message.role !== 'assistant') return false;
  if (message.pending || message.content.trim() || message.reasoning?.trim()) return true;
  if (message.contentBlocks?.some(isToolOnlyBlock)) return true;
  return message.events?.some(isVisibleExecutionEvent) ?? false;
}

function isVisibleExecutionEvent(event: AgentEvent): boolean {
  if (event.type.startsWith('tool_') || event.type.startsWith('confirmation_') || event.type.startsWith('permission_'))
    return true;
  if (
    [
      'error',
      'cancelled',
      'command_dead_lettered',
      'planning_start',
      'planning_end',
      'task_updated',
      'step_start',
      'step_end',
      'subagent_start',
      'subagent_end',
      'subagent_started',
      'subagent_progress',
      'subagent_completed',
      'subagent_failed',
    ].includes(event.type)
  )
    return true;
  return event.type === 'agent_end' && Number(event.verification_summary?.report_count ?? 0) > 0;
}

function createResponseOnlyTurn(message: ChatMessage): ConversationTurn {
  return {
    id: `turn-${message.id}`,
    instructionResources: { contextFiles: [], skillNames: [] },
    responses: [],
    interrupted: false,
  };
}

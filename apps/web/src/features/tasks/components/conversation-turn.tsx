import type { TaskActions } from '../task-actions';
import type { ConversationTurn } from './conversation-projection';
import { AssistantResponse } from './assistant-response';
import { InstructionMessage } from './instruction-message';
import { InterruptedTurnNotice } from './interrupted-turn-notice';

export function ConversationTurnView({
  turn,
  actions,
  isLatestTurn,
}: {
  turn: ConversationTurn;
  actions: TaskActions;
  isLatestTurn: boolean;
}) {
  return (
    <section className='execution-turn' aria-label='任务回合'>
      {turn.instruction && (
        <InstructionMessage
          message={turn.instruction}
          resources={turn.instructionResources}
          runtimeAnchor={isLatestTurn}
        />
      )}
      <div className='execution-response-stack'>
        {turn.responses.map((response) => (
          <AssistantResponse
            key={response.id}
            message={response}
            actions={actions}
            retryContent={turn.instruction?.content}
          />
        ))}
        {turn.interrupted && turn.instruction && <InterruptedTurnNotice instruction={turn.instruction.content} />}
      </div>
    </section>
  );
}

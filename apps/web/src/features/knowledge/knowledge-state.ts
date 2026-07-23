import type { PersonalKnowledgeBaseCatalog } from '../../types/api';

export type KnowledgeLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface KnowledgeState {
  personalKnowledgeBases: PersonalKnowledgeBaseCatalog | null;
  knowledgeStatus: KnowledgeLoadStatus;
  knowledgeError: string | null;
  knowledgeOperationStatus: KnowledgeLoadStatus;
  knowledgeOperationId: string | null;
  knowledgeOperationError: string | null;
}

export function createKnowledgeState(): KnowledgeState {
  return {
    personalKnowledgeBases: null,
    knowledgeStatus: 'idle',
    knowledgeError: null,
    knowledgeOperationStatus: 'idle',
    knowledgeOperationId: null,
    knowledgeOperationError: null,
  };
}

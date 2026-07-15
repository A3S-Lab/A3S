import type { SessionOutput } from '../../types/api';
export interface RunsState {
  sessionOutput: SessionOutput | null;
  sessionOutputSessionId: string | null;
  sessionOutputLoading: boolean;
  sessionOutputError: string | null;
  sessionOutputErrorSessionId: string | null;
}
export function createRunsState(): RunsState {
  return {
    sessionOutput: null,
    sessionOutputSessionId: null,
    sessionOutputLoading: false,
    sessionOutputError: null,
    sessionOutputErrorSessionId: null,
  };
}

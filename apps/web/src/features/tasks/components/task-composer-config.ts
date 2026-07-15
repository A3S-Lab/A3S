import { appState, reportTaskPersistenceResult } from '../../../state/app-state';
import { persistNewTaskConfig, type NewTaskConfig } from '../task-state';

export function updateNewTaskConfig(patch: Partial<NewTaskConfig>) {
  Object.assign(appState.newTaskConfig, patch);
  reportTaskPersistenceResult(persistNewTaskConfig(appState.newTaskConfig));
}

export function effortLabel(id: string, fallback: string) {
  if (id === 'low') return 'Low';
  if (id === 'medium') return 'Medium';
  if (id === 'high') return 'High';
  if (id === 'xhigh') return 'XHigh';
  if (id === 'max') return 'Max';
  if (id === 'ultracode') return 'Ultra';
  return fallback;
}

export function effortDescription(id: string) {
  if (id === 'low') return '轻量分析，优先响应速度与资源效率。';
  if (id === 'medium') return '在响应速度、分析深度和验证之间保持平衡。';
  if (id === 'high') return '进行更深入的推理，并加强结果验证。';
  if (id === 'xhigh') return '投入更多时间分析复杂问题和潜在边界情况。';
  if (id === 'max') return '以最高常规强度进行推理、检查与验证。';
  if (id === 'ultracode') return '为最复杂的编码任务提供极限分析与验证。';
  return '选择 Code 为当前任务投入的分析与验证程度。';
}

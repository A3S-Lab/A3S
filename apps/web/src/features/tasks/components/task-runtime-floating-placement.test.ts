import { describe, expect, it } from 'vitest';
import { resolveTaskRuntimePanelLayout, resolveTaskRuntimePanelPlacement } from './task-runtime-floating-placement';

const pane = rect({ bottom: 900, left: 300, right: 1440, top: 0 });

describe('resolveTaskRuntimePanelPlacement', () => {
  it('moves the panel below the latest instruction when their visible regions collide', () => {
    const placement = resolveTaskRuntimePanelPlacement({
      composerTop: 764,
      instruction: rect({ bottom: 112, left: 1028, right: 1264, top: 70 }),
      pane,
      panelHeight: 484,
      panelHeaderHeight: 54,
      panelWidth: 360,
    });

    expect(placement).toEqual({ contentMaxHeight: 572, top: 124 });
  });

  it('keeps the panel at the top when the instruction is outside its horizontal lane', () => {
    const placement = resolveTaskRuntimePanelPlacement({
      composerTop: 764,
      instruction: rect({ bottom: 112, left: 480, right: 720, top: 70 }),
      pane,
      panelHeight: 484,
      panelHeaderHeight: 54,
      panelWidth: 360,
    });

    expect(placement).toEqual({ contentMaxHeight: 642, top: 54 });
  });

  it('caps the panel above a long instruction when there is no room below it', () => {
    const placement = resolveTaskRuntimePanelPlacement({
      composerTop: 764,
      instruction: rect({ bottom: 720, left: 1028, right: 1264, top: 400 }),
      pane,
      panelHeight: 484,
      panelHeaderHeight: 54,
      panelWidth: 360,
    });

    expect(placement).toEqual({ contentMaxHeight: 280, top: 54 });
  });

  it('does not chase an instruction that is already below the panel', () => {
    const placement = resolveTaskRuntimePanelPlacement({
      composerTop: 764,
      instruction: rect({ bottom: 650, left: 1028, right: 1264, top: 600 }),
      pane,
      panelHeight: 484,
      panelHeaderHeight: 54,
      panelWidth: 360,
    });

    expect(placement).toEqual({ contentMaxHeight: 642, top: 54 });
  });
});

describe('resolveTaskRuntimePanelLayout', () => {
  it('uses a docked compact surface when the actual conversation pane cannot fit a readable transcript rail', () => {
    expect(resolveTaskRuntimePanelLayout(488)).toBe('compact');
    expect(resolveTaskRuntimePanelLayout(960)).toBe('compact');
  });

  it('keeps the floating detail surface when the conversation pane can reserve a message-safe rail', () => {
    expect(resolveTaskRuntimePanelLayout(1040)).toBe('wide');
    expect(resolveTaskRuntimePanelLayout(1128)).toBe('wide');
  });

  it('keeps the deterministic wide default when layout geometry is unavailable in non-browser rendering', () => {
    expect(resolveTaskRuntimePanelLayout(0)).toBe('wide');
  });
});

function rect(value: { bottom: number; left: number; right: number; top: number }) {
  return value;
}

import type { CSSProperties } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';

const BASE_TOP = 54;
const CONTENT_HEIGHT_LIMIT = 430;
const PANEL_HEADER_HEIGHT = 54;
const PANEL_RIGHT_INSET = 16;
const PANEL_BOTTOM_GAP = 14;
const INSTRUCTION_GAP = 12;
const WIDE_PANEL_MIN_PANE_WIDTH = 1040;

interface RuntimePanelRect {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

interface RuntimePanelPlacementInput {
  composerTop: number;
  instruction: RuntimePanelRect | null;
  pane: RuntimePanelRect;
  panelHeight: number;
  panelHeaderHeight: number;
  panelWidth: number;
}

export interface RuntimePanelPlacement {
  contentMaxHeight: number;
  top: number;
}

export type RuntimePanelLayout = 'compact' | 'wide';

type RuntimePanelStyle = CSSProperties & {
  '--task-runtime-content-max-height': string;
  '--task-runtime-panel-top': string;
};

export function resolveTaskRuntimePanelLayout(paneWidth: number): RuntimePanelLayout {
  if (!Number.isFinite(paneWidth) || paneWidth <= 0) return 'wide';
  return paneWidth < WIDE_PANEL_MIN_PANE_WIDTH ? 'compact' : 'wide';
}

export function resolveTaskRuntimePanelPlacement({
  composerTop,
  instruction,
  pane,
  panelHeight,
  panelHeaderHeight,
  panelWidth,
}: RuntimePanelPlacementInput): RuntimePanelPlacement {
  const defaultPanel = {
    bottom: pane.top + BASE_TOP + panelHeight,
    left: pane.right - PANEL_RIGHT_INSET - panelWidth,
    right: pane.right - PANEL_RIGHT_INSET,
    top: pane.top + BASE_TOP,
  };
  const collides =
    instruction !== null &&
    instruction.right > defaultPanel.left &&
    instruction.left < defaultPanel.right &&
    instruction.bottom > defaultPanel.top &&
    instruction.top < defaultPanel.bottom;

  if (!collides || instruction === null) {
    return placementWithinComposer(BASE_TOP, composerTop, pane.top, panelHeaderHeight);
  }

  const belowInstruction = Math.max(BASE_TOP, Math.ceil(instruction.bottom - pane.top + INSTRUCTION_GAP));
  const availableBelow = composerTop - pane.top - PANEL_BOTTOM_GAP - belowInstruction;
  if (availableBelow >= panelHeaderHeight) {
    return placementWithinComposer(belowInstruction, composerTop, pane.top, panelHeaderHeight);
  }

  const contentAboveInstruction = Math.max(
    0,
    Math.floor(instruction.top - pane.top - INSTRUCTION_GAP - BASE_TOP - panelHeaderHeight)
  );
  return {
    contentMaxHeight: contentAboveInstruction,
    top: BASE_TOP,
  };
}

export function useTaskRuntimeFloatingPlacement(identity: string, expanded: boolean, visible: boolean) {
  const panelRef = useRef<HTMLElement>(null);
  const [layout, setLayout] = useState<RuntimePanelLayout>('wide');
  const [placement, setPlacement] = useState<RuntimePanelPlacement>({
    contentMaxHeight: CONTENT_HEIGHT_LIMIT,
    top: BASE_TOP,
  });

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const pane = panel?.closest<HTMLElement>('.task-conversation-pane');
    if (!panel || !pane) return;

    const scroll = pane.querySelector<HTMLElement>('.execution-scroll');
    let frame: number | undefined;

    const measure = () => {
      const instruction = pane.querySelector<HTMLElement>('[data-task-runtime-anchor="latest-instruction"]');
      const composer = pane.querySelector<HTMLElement>('.task-composer-dock');
      const trigger = panel.querySelector<HTMLElement>('.task-runtime-floating-trigger');
      const content = panel.querySelector<HTMLElement>('.task-runtime-floating-content');
      const paneRect = pane.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const nextLayout = resolveTaskRuntimePanelLayout(paneRect.width);
      pane.dataset.taskRuntimeLayout = nextLayout;
      setLayout((current) => (current === nextLayout ? current : nextLayout));
      const triggerHeight = trigger?.getBoundingClientRect().height || PANEL_HEADER_HEIGHT;
      const contentHeight = content
        ? Math.min(content.scrollHeight || content.getBoundingClientRect().height, CONTENT_HEIGHT_LIMIT)
        : 0;
      const next = resolveTaskRuntimePanelPlacement({
        composerTop: composer?.getBoundingClientRect().top ?? paneRect.bottom,
        instruction: instruction?.getBoundingClientRect() ?? null,
        pane: paneRect,
        panelHeight: triggerHeight + contentHeight,
        panelHeaderHeight: triggerHeight,
        panelWidth: panelRect.width || 360,
      });
      setPlacement((current) =>
        current.top === next.top && current.contentMaxHeight === next.contentMaxHeight ? current : next
      );
    };

    const scheduleMeasure = () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      if (typeof window.requestAnimationFrame !== 'function') {
        measure();
        return;
      }
      frame = window.requestAnimationFrame(() => {
        frame = undefined;
        measure();
      });
    };

    measure();
    window.addEventListener('resize', scheduleMeasure);
    scroll?.addEventListener('scroll', scheduleMeasure, { passive: true });

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleMeasure);
    observer?.observe(pane);
    observer?.observe(panel);
    const instruction = pane.querySelector<HTMLElement>('[data-task-runtime-anchor="latest-instruction"]');
    if (instruction) observer?.observe(instruction);

    return () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', scheduleMeasure);
      scroll?.removeEventListener('scroll', scheduleMeasure);
      observer?.disconnect();
      delete pane.dataset.taskRuntimeLayout;
    };
  }, [expanded, identity, visible]);

  const style: RuntimePanelStyle = {
    '--task-runtime-content-max-height': `${placement.contentMaxHeight}px`,
    '--task-runtime-panel-top': `${placement.top}px`,
  };
  return { layout, panelRef, style };
}

function placementWithinComposer(
  top: number,
  composerTop: number,
  paneTop: number,
  panelHeaderHeight: number
): RuntimePanelPlacement {
  return {
    contentMaxHeight: Math.max(0, Math.floor(composerTop - paneTop - PANEL_BOTTOM_GAP - top - panelHeaderHeight)),
    top,
  };
}

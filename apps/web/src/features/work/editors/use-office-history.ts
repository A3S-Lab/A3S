import { useCallback, useEffect, useRef, useState } from 'react';

const OFFICE_HISTORY_LIMIT = 100;

interface OfficeHistoryState<Content> {
  past: Content[];
  present: Content;
  future: Content[];
}

export function useOfficeHistory<Content>({
  content,
  onChange,
}: {
  content: Content;
  onChange: (content: Content) => void;
}) {
  const historyRef = useRef<OfficeHistoryState<Content>>({
    past: [],
    present: content,
    future: [],
  });
  const applyingHistoryRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const [, setVersion] = useState(0);
  onChangeRef.current = onChange;

  useEffect(() => {
    const history = historyRef.current;
    if (applyingHistoryRef.current) {
      applyingHistoryRef.current = false;
      history.present = content;
      setVersion((value) => value + 1);
      return;
    }
    if (sameOfficeHistoryValue(content, history.present)) {
      history.present = content;
      return;
    }
    history.past = [...history.past.slice(-(OFFICE_HISTORY_LIMIT - 1)), history.present];
    history.present = content;
    history.future = [];
    setVersion((value) => value + 1);
  }, [content]);

  const undo = useCallback((): boolean => {
    const history = historyRef.current;
    const previous = history.past.at(-1);
    if (!previous) return false;
    history.past = history.past.slice(0, -1);
    history.future = [...history.future, history.present];
    history.present = previous;
    applyingHistoryRef.current = true;
    setVersion((value) => value + 1);
    onChangeRef.current(previous);
    return true;
  }, []);

  const redo = useCallback((): boolean => {
    const history = historyRef.current;
    const next = history.future.at(-1);
    if (!next) return false;
    history.future = history.future.slice(0, -1);
    history.past = [...history.past, history.present].slice(-OFFICE_HISTORY_LIMIT);
    history.present = next;
    applyingHistoryRef.current = true;
    setVersion((value) => value + 1);
    onChangeRef.current(next);
    return true;
  }, []);

  return {
    canUndo: historyRef.current.past.length > 0,
    canRedo: historyRef.current.future.length > 0,
    undo,
    redo,
  };
}

function sameOfficeHistoryValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left === null || right === null || typeof left !== typeof right) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => sameOfficeHistoryValue(value, right[index]));
  }
  if (typeof left !== 'object' || typeof right !== 'object') return false;
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).filter((key) => leftRecord[key] !== undefined);
  const rightKeys = Object.keys(rightRecord).filter((key) => rightRecord[key] !== undefined);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => sameOfficeHistoryValue(leftRecord[key], rightRecord[key]));
}

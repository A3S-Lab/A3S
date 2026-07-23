import { type KeyboardEvent, useCallback, useRef } from 'react';

export type TabNavigationItem<T extends string> = {
  id: T;
  disabled?: boolean;
};

export function useTabNavigation<T extends string>({
  items,
  onChange,
}: {
  items: readonly TabNavigationItem<T>[];
  onChange: (value: T) => void;
}) {
  const elementRefs = useRef(new Map<T, HTMLElement>());

  const setTabElement = useCallback((id: T, element: HTMLElement | null) => {
    if (element) elementRefs.current.set(id, element);
    else elementRefs.current.delete(id);
  }, []);

  const getTabElement = useCallback((id: T) => elementRefs.current.get(id), []);

  const handleTabKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>, currentId: T) => {
      const enabledItems = items.filter((item) => !item.disabled);
      if (!enabledItems.length) return;
      const currentIndex = enabledItems.findIndex((item) => item.id === currentId);
      if (currentIndex < 0) return;

      let nextIndex: number | null = null;
      if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % enabledItems.length;
      if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + enabledItems.length) % enabledItems.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = enabledItems.length - 1;
      if (nextIndex === null) return;

      event.preventDefault();
      const nextItem = enabledItems[nextIndex];
      elementRefs.current.get(nextItem.id)?.focus();
      onChange(nextItem.id);
    },
    [items, onChange]
  );

  return { getTabElement, handleTabKeyDown, setTabElement };
}

import { useEffect, useMemo, useState } from 'react';
import type { ConfigCategoryMetadata } from '../../types/settings';

export type SettingsDraft<T> = Omit<T, keyof ConfigCategoryMetadata>;

export function useSettingsDraft<T extends object>(source: T | null | undefined) {
  const sourceKey = JSON.stringify(source ?? null);
  const projected = useMemo(() => (source ? editableCopy(source) : null), [sourceKey]);
  const [draft, setDraft] = useState<SettingsDraft<T> | null>(projected);
  const [baseline, setBaseline] = useState<SettingsDraft<T> | null>(projected);

  useEffect(() => {
    setDraft(projected);
    setBaseline(projected);
  }, [projected]);

  const accept = (next: T) => {
    const value = editableCopy(next);
    setDraft(value);
    setBaseline(value);
  };
  const reset = () => {
    setDraft(baseline ? cloneDraft(baseline) : null);
  };

  return {
    draft,
    setDraft,
    dirty: JSON.stringify(draft) !== JSON.stringify(baseline),
    accept,
    reset,
  };
}

function editableCopy<T extends object>(source: T): SettingsDraft<T> {
  const value = JSON.parse(JSON.stringify(source)) as T & Partial<ConfigCategoryMetadata>;
  delete value.category;
  delete value.effect;
  delete value.configPath;
  return value;
}

function cloneDraft<T extends object>(source: SettingsDraft<T>): SettingsDraft<T> {
  return JSON.parse(JSON.stringify(source)) as SettingsDraft<T>;
}

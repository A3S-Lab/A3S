import type { WorkSlideElement, WorkSlideTextRun } from '../work-types';

export function presentationElementToolbarState(element: WorkSlideElement): WorkSlideElement {
  const runs = element.textRuns?.filter((run) => run.text.length > 0);
  if (!runs?.length) return element;
  return {
    ...element,
    fontSize: commonRunValue(runs, (run) => run.fontSize, element.fontSize),
    color: commonRunValue(runs, (run) => run.color, element.color),
    bold: commonRunValue(runs, (run) => run.bold, element.bold),
    fontFamily: commonRunValue(runs, (run) => run.fontFamily, element.fontFamily),
    italic: commonRunValue(runs, (run) => run.italic, element.italic),
    underline: commonRunValue(runs, (run) => run.underline, element.underline),
  };
}

export function applyPresentationElementFormattingPatch(
  element: WorkSlideElement,
  patch: Partial<WorkSlideElement>
): WorkSlideElement {
  const next = { ...element, ...patch };
  if (!element.textRuns?.length) return next;
  const runPatch: Partial<WorkSlideTextRun> = {};
  let updatesRuns = false;
  if ('fontSize' in patch) {
    runPatch.fontSize = patch.fontSize;
    updatesRuns = true;
  }
  if ('color' in patch) {
    runPatch.color = patch.color;
    updatesRuns = true;
  }
  if ('bold' in patch) {
    runPatch.bold = patch.bold;
    updatesRuns = true;
  }
  if ('fontFamily' in patch) {
    runPatch.fontFamily = patch.fontFamily;
    updatesRuns = true;
  }
  if ('italic' in patch) {
    runPatch.italic = patch.italic;
    updatesRuns = true;
  }
  if ('underline' in patch) {
    runPatch.underline = patch.underline;
    updatesRuns = true;
  }
  if (!updatesRuns) return next;
  return {
    ...next,
    textRuns: element.textRuns.map((run) => ({ ...run, ...runPatch })),
  };
}

function commonRunValue<Value>(
  runs: readonly WorkSlideTextRun[],
  getValue: (run: WorkSlideTextRun) => Value | undefined,
  fallback: Value
): Value {
  const values = runs.map((run) => getValue(run) ?? fallback);
  return values.every((value) => value === values[0]) ? values[0] : fallback;
}

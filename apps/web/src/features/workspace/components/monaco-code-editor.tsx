import Editor, { type Monaco, type OnMount } from '@monaco-editor/react';
import type { CancellationToken, editor, IDisposable, languages } from 'monaco-editor';
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { codeApi } from '../../../lib/api';
import type {
  CodeDiagnosticSeverity,
  CodeIntelligenceCapabilities,
  CodeIntelligenceStatus,
  CodeNavigationKind,
  CodeOutlineSymbol,
} from '../../../types/api';
import {
  diagnosticsForPath,
  monacoRange,
  navigationLabel,
  workspaceCodePath,
  workspaceSelection,
} from '../code-intelligence';
import type { WorkspaceFileSelection } from '../workspace-state';
import {
  isUnsupportedCodeIntelligenceError,
  isUnsupportedCodeIntelligenceLanguageError,
} from './code-intelligence-error';
import { type NavigationCandidate, type NavigationPickerState, NavigationResultPicker } from './code-navigation-picker';
import { type MonacoEditorStatus, type MonacoLineEnding, observeMonacoEditorStatus } from './monaco-editor-status';
import { attachWorkspaceEditorModel, saveWorkspaceEditorModel } from './monaco-editor-model-store';
import { configureMonaco, languageForPath, monacoTheme } from './monaco-environment';

const markerOwner = 'a3s-code-intelligence';

export interface MonacoCodeEditorHandle {
  focus: () => boolean;
  navigate: (kind: CodeNavigationKind) => void;
  setLineEnding: (lineEnding: MonacoLineEnding) => void;
  showOutline: () => void;
}

export const MonacoCodeEditor = forwardRef<
  MonacoCodeEditorHandle,
  {
    path: string;
    modelPath: string;
    value: string;
    location: { line: number; column: number } | null;
    readOnly: boolean;
    dark: boolean;
    workspaceRoot: string;
    sessionId: string | null;
    savedDocument: boolean;
    onChange: (value: string) => void;
    onSave: () => void;
    onClose: () => void;
    onNavigate: (selection: WorkspaceFileSelection) => Promise<boolean>;
    onStatusChange: (label: string) => void;
    onEditorStatusChange: (status: MonacoEditorStatus | null) => void;
    onLocationApplied?: () => void;
    onReadyChange?: (ready: boolean) => void;
  }
>(function MonacoCodeEditor(
  {
    path,
    modelPath,
    value,
    location,
    readOnly,
    dark,
    workspaceRoot,
    sessionId,
    savedDocument,
    onChange,
    onSave,
    onClose,
    onNavigate,
    onStatusChange,
    onEditorStatusChange,
    onLocationApplied,
    onReadyChange,
  },
  ref
) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const editorDisposablesRef = useRef<IDisposable[]>([]);
  const documentSymbolDisposableRef = useRef<IDisposable | null>(null);
  const activeModelPathRef = useRef(modelPath);
  const modelPathRef = useRef(modelPath);
  const statusRef = useRef<CodeIntelligenceStatus | null>(null);
  const unsupportedDocumentsRef = useRef(new Set<string>());
  const diagnosticCountRef = useRef<number | undefined>(undefined);
  const diagnosticStaleRef = useRef(false);
  const navigationAbortRef = useRef<AbortController | null>(null);
  const propsRef = useRef({ path, workspaceRoot, sessionId, savedDocument, onNavigate, onStatusChange });
  const editorStatusChangeRef = useRef(onEditorStatusChange);
  const locationAppliedRef = useRef(onLocationApplied);
  const readyChangeRef = useRef(onReadyChange);
  const [mounted, setMounted] = useState(false);
  const [navigationPicker, setNavigationPicker] = useState<NavigationPickerState | null>(null);
  const editorLanguage = languageForPath(path);
  const saveRef = useRef(onSave);
  const closeRef = useRef(onClose);
  saveRef.current = onSave;
  closeRef.current = onClose;
  readyChangeRef.current = onReadyChange;
  editorStatusChangeRef.current = onEditorStatusChange;
  locationAppliedRef.current = onLocationApplied;
  propsRef.current = { path, workspaceRoot, sessionId, savedDocument, onNavigate, onStatusChange };
  modelPathRef.current = modelPath;

  const saveCurrentEditorModel = (): void => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model || model.isDisposed()) return;
    saveWorkspaceEditorModel(activeModelPathRef.current, model, editor.saveViewState());
  };

  const refreshDocumentSymbolProvider = (): void => {
    documentSymbolDisposableRef.current?.dispose();
    documentSymbolDisposableRef.current = null;
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const languageSelector = editor?.getModel()?.getLanguageId();
    if (!editor || !monaco || !languageSelector) return;
    documentSymbolDisposableRef.current = monaco.languages.registerDocumentSymbolProvider(languageSelector, {
      displayName: 'Code Intelligence',
      provideDocumentSymbols: runDocumentSymbols,
    });
  };

  const activateCurrentEditorModel = (): void => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model) return;
    const nextModelPath = modelPathRef.current;
    const viewState = attachWorkspaceEditorModel(nextModelPath, model);
    activeModelPathRef.current = nextModelPath;
    if (viewState) editor.restoreViewState(viewState);
    refreshDocumentSymbolProvider();
    readyChangeRef.current?.(true);
  };

  useLayoutEffect(() => {
    if (!mounted || activeModelPathRef.current === modelPath) return;
    readyChangeRef.current?.(false);
    saveCurrentEditorModel();
  }, [modelPath, mounted]);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();
    if (!mounted || !editor || !monaco || !model) return;
    const relativePath = workspaceCodePath(path, workspaceRoot);
    if (!relativePath) {
      statusRef.current = null;
      monaco.editor.setModelMarkers(model, markerOwner, []);
      onStatusChange('代码导航不可用：文件不在工作区内');
      return;
    }

    const documentKey = codeIntelligenceDocumentKey(path, workspaceRoot, sessionId);
    statusRef.current = null;
    diagnosticCountRef.current = undefined;
    diagnosticStaleRef.current = false;
    if (unsupportedDocumentsRef.current.has(documentKey)) {
      monaco.editor.setModelMarkers(model, markerOwner, []);
      onStatusChange('本地编辑功能可用');
      return;
    }

    const controller = new AbortController();
    let active = true;
    onStatusChange('代码导航连接中');

    void (async () => {
      try {
        const status = await codeApi.codeIntelligenceStatus({ sessionId, signal: controller.signal });
        if (!active) return;
        statusRef.current = status;
        if (!capabilityAvailable(status, 'diagnostics')) {
          monaco.editor.setModelMarkers(model, markerOwner, []);
          onStatusChange(statusLabel(status, savedDocument));
          return;
        }

        const result = await codeApi.codeDiagnostics(relativePath, { sessionId, signal: controller.signal });
        if (!active) return;
        const negotiatedStatus = await statusAfterStartupQuery(status, sessionId, controller.signal);
        if (!active) return;
        statusRef.current = negotiatedStatus;
        const diagnostics = diagnosticsForPath(result.items, path, workspaceRoot);
        diagnosticCountRef.current = diagnostics.length;
        diagnosticStaleRef.current = result.document?.stale ?? false;
        monaco.editor.setModelMarkers(
          model,
          markerOwner,
          diagnostics.map((diagnostic) => ({
            ...monacoRange(diagnostic.location.range),
            severity: markerSeverity(monaco, diagnostic.severity),
            message: diagnostic.message,
            code: diagnostic.code ?? undefined,
            source: diagnostic.source ?? undefined,
          }))
        );
        onStatusChange(statusLabel(negotiatedStatus, savedDocument, diagnostics.length, diagnosticStaleRef.current));
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        if (isUnsupportedCodeIntelligenceLanguageError(error)) {
          unsupportedDocumentsRef.current.add(documentKey);
        }
        monaco.editor.setModelMarkers(model, markerOwner, []);
        onStatusChange(isUnsupportedCodeIntelligenceError(error) ? '本地编辑功能可用' : '代码诊断暂时不可用');
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [mounted, onStatusChange, path, savedDocument, sessionId, workspaceRoot]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !location) return;
    const position = { lineNumber: location.line, column: location.column };
    editor.setPosition(position);
    editor.revealPositionInCenterIfOutsideViewport(position);
    editor.focus();
    locationAppliedRef.current?.();
  }, [location]);

  useEffect(
    () => () => {
      saveCurrentEditorModel();
      readyChangeRef.current?.(false);
      navigationAbortRef.current?.abort();
      documentSymbolDisposableRef.current?.dispose();
      documentSymbolDisposableRef.current = null;
      for (const disposable of editorDisposablesRef.current) disposable.dispose();
      editorDisposablesRef.current = [];
      const model = editorRef.current?.getModel();
      if (model && monacoRef.current) monacoRef.current.editor.setModelMarkers(model, markerOwner, []);
    },
    []
  );

  useEffect(() => {
    setNavigationPicker(null);
  }, [path, sessionId, workspaceRoot]);

  useEffect(() => {
    if (mounted) refreshDocumentSymbolProvider();
  }, [editorLanguage, mounted]);

  const mount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => saveRef.current());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyW, () => closeRef.current());
    for (const disposable of editorDisposablesRef.current) disposable.dispose();
    editorDisposablesRef.current = [
      observeMonacoEditorStatus(editor, (status) => editorStatusChangeRef.current(status)),
      ...navigationActions(editor, monaco, runNavigation),
      editor.onDidChangeModel(activateCurrentEditorModel),
    ];
    activateCurrentEditorModel();
    setMounted(true);
  };

  const runNavigation = async (kind: CodeNavigationKind): Promise<void> => {
    const editor = editorRef.current;
    const current = propsRef.current;
    const relativePath = workspaceCodePath(current.path, current.workspaceRoot);
    const position = editor?.getPosition();
    if (!editor || !relativePath || !position) return;

    navigationAbortRef.current?.abort();
    navigationAbortRef.current = null;
    setNavigationPicker(null);
    const label = navigationLabel(kind);
    const documentKey = codeIntelligenceDocumentKey(current.path, current.workspaceRoot, current.sessionId);
    if (unsupportedDocumentsRef.current.has(documentKey)) {
      current.onStatusChange(`此文件类型不支持${label}导航`);
      return;
    }

    const controller = new AbortController();
    navigationAbortRef.current = controller;
    current.onStatusChange(`正在查找${label}`);
    try {
      const status =
        statusRef.current ??
        (await codeApi.codeIntelligenceStatus({ sessionId: current.sessionId, signal: controller.signal }));
      statusRef.current = status;
      if (!capabilityAvailable(status, kind)) {
        current.onStatusChange(`${label}导航不可用`);
        return;
      }
      const result = await codeApi.codeNavigation(relativePath, position.lineNumber - 1, position.column - 1, kind, {
        sessionId: current.sessionId,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const negotiatedStatus = await statusAfterStartupQuery(status, current.sessionId, controller.signal);
      if (controller.signal.aborted) return;
      statusRef.current = negotiatedStatus;
      const candidates = result.items.flatMap((location) => {
        const selection = workspaceSelection(location, current.workspaceRoot);
        return selection ? [{ location, selection }] : [];
      });
      if (!candidates.length) {
        current.onStatusChange(`未找到${label}${runtimeUnavailableSuffix(negotiatedStatus)}`);
        return;
      }
      const resultSuffix = `${result.document?.stale ? ' · 索引更新中' : ''}${
        current.savedDocument ? '' : ' · 基于已保存版本'
      }${result.truncated ? ' · 结果已截断' : ''}${runtimeUnavailableSuffix(negotiatedStatus)}`;
      if (candidates.length === 1) {
        current.onStatusChange(`已打开${label}${resultSuffix}`);
        await current.onNavigate(candidates[0].selection);
        return;
      }
      setNavigationPicker({ label, candidates, resultSuffix });
      current.onStatusChange(`找到 ${candidates.length} 处${label}，请选择目标${resultSuffix}`);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (isUnsupportedCodeIntelligenceLanguageError(error)) {
        unsupportedDocumentsRef.current.add(documentKey);
      }
      current.onStatusChange(
        isUnsupportedCodeIntelligenceError(error) ? `此文件类型不支持${label}导航` : `${label}导航暂时不可用`
      );
    } finally {
      if (navigationAbortRef.current === controller) navigationAbortRef.current = null;
    }
  };

  const chooseNavigationTarget = async (candidate: NavigationCandidate): Promise<void> => {
    const picker = navigationPicker;
    if (!picker) return;
    setNavigationPicker(null);
    const current = propsRef.current;
    current.onStatusChange(`已打开${picker.label}${picker.resultSuffix}`);
    await current.onNavigate(candidate.selection);
  };

  const closeNavigationPicker = (): void => {
    if (!navigationPicker) return;
    const label = navigationPicker.label;
    setNavigationPicker(null);
    propsRef.current.onStatusChange(`已取消${label}导航`);
    editorRef.current?.focus();
  };

  useImperativeHandle(ref, () => ({
    focus: () => {
      const editor = editorRef.current;
      if (!editor) return false;
      editor.focus();
      return true;
    },
    navigate: (kind) => {
      editorRef.current?.focus();
      void runNavigation(kind);
    },
    setLineEnding: (lineEnding) => {
      const editor = editorRef.current;
      const model = editor?.getModel();
      const monaco = monacoRef.current;
      if (readOnly || !editor || !model || !monaco) return;
      const sequence =
        lineEnding === 'CRLF' ? monaco.editor.EndOfLineSequence.CRLF : monaco.editor.EndOfLineSequence.LF;
      if (model.getEndOfLineSequence() !== sequence) model.pushEOL(sequence);
      editor.focus();
    },
    showOutline: () => {
      const editor = editorRef.current;
      const action = editor?.getAction('editor.action.quickOutline');
      if (!editor || !action) {
        propsRef.current.onStatusChange('文件符号大纲不可用');
        return;
      }
      editor.focus();
      void action.run();
    },
  }));

  const runDocumentSymbols = async (
    model: editor.ITextModel,
    token: CancellationToken
  ): Promise<languages.DocumentSymbol[]> => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const current = propsRef.current;
    const relativePath = workspaceCodePath(current.path, current.workspaceRoot);
    if (!editor || !monaco || model !== editor.getModel() || !relativePath) return [];

    const documentKey = codeIntelligenceDocumentKey(current.path, current.workspaceRoot, current.sessionId);
    if (unsupportedDocumentsRef.current.has(documentKey)) return [];

    const controller = new AbortController();
    const cancellation = token.onCancellationRequested(() => controller.abort());
    if (token.isCancellationRequested) controller.abort();
    try {
      const status =
        statusRef.current ??
        (await codeApi.codeIntelligenceStatus({ sessionId: current.sessionId, signal: controller.signal }));
      statusRef.current = status;
      if (controller.signal.aborted || !capabilityAvailable(status, 'documentSymbols')) {
        return [];
      }
      const result = await codeApi.codeOutline(relativePath, {
        sessionId: current.sessionId,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return [];
      const negotiatedStatus = await statusAfterStartupQuery(status, current.sessionId, controller.signal);
      if (controller.signal.aborted) return [];
      statusRef.current = negotiatedStatus;
      current.onStatusChange(
        statusLabel(
          negotiatedStatus,
          current.savedDocument,
          diagnosticCountRef.current,
          diagnosticStaleRef.current || (result.document?.stale ?? false)
        )
      );
      return result.items.map((symbol) => monacoDocumentSymbol(monaco, symbol));
    } catch (error) {
      if (isUnsupportedCodeIntelligenceLanguageError(error)) {
        unsupportedDocumentsRef.current.add(documentKey);
      }
      if (!controller.signal.aborted && !isUnsupportedCodeIntelligenceError(error)) {
        current.onStatusChange('文件符号暂时不可用');
      }
      return [];
    } finally {
      cancellation.dispose();
    }
  };

  return (
    <section className='monaco-editor-surface' aria-label={`编辑 ${basename(path)}`}>
      <Editor
        path={modelPath}
        language={editorLanguage}
        value={value}
        theme={monacoTheme(dark)}
        beforeMount={configureMonaco as (monaco: Monaco) => void}
        onMount={mount}
        onChange={(nextValue) => onChange(nextValue ?? '')}
        saveViewState={false}
        keepCurrentModel
        loading={<span className='monaco-loading'>正在加载编辑器…</span>}
        options={{
          ariaLabel: `编辑 ${basename(path)}`,
          automaticLayout: true,
          bracketPairColorization: { enabled: true },
          contextmenu: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          detectIndentation: true,
          folding: true,
          fontFamily: "'SFMono-Regular', 'Cascadia Code', Consolas, monospace",
          fontLigatures: true,
          fontSize: 12,
          glyphMargin: false,
          lineHeight: 20,
          lineNumbersMinChars: 3,
          minimap: { enabled: false },
          padding: { top: 10, bottom: 18 },
          readOnly,
          renderLineHighlight: 'line',
          renderWhitespace: 'selection',
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          stickyScroll: { enabled: true, maxLineCount: 3 },
          tabSize: 2,
          wordWrap: 'off',
        }}
      />
      {navigationPicker && (
        <NavigationResultPicker
          state={navigationPicker}
          onChoose={(candidate) => void chooseNavigationTarget(candidate)}
          onClose={closeNavigationPicker}
        />
      )}
    </section>
  );
});

function navigationActions(
  editor: editor.IStandaloneCodeEditor,
  monaco: Monaco,
  navigate: (kind: CodeNavigationKind) => Promise<void>
): IDisposable[] {
  return [
    editor.addAction({
      id: 'a3s.code-navigation.definition',
      label: '转到定义',
      keybindings: [monaco.KeyCode.F12],
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1,
      run: () => navigate('definition'),
    }),
    editor.addAction({
      id: 'a3s.code-navigation.declaration',
      label: '转到声明',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 2,
      run: () => navigate('declaration'),
    }),
    editor.addAction({
      id: 'a3s.code-navigation.references',
      label: '查找所有引用',
      keybindings: [monaco.KeyMod.Shift | monaco.KeyCode.F12],
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 3,
      run: () => navigate('references'),
    }),
    editor.addAction({
      id: 'a3s.code-navigation.implementations',
      label: '转到实现',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.F12],
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 4,
      run: () => navigate('implementations'),
    }),
  ];
}

function capabilityAvailable(status: CodeIntelligenceStatus, capability: keyof CodeIntelligenceCapabilities): boolean {
  // An unavailable runtime may have exited after a successful query. Core
  // restarts it on the next query, so the UI must not turn status into a
  // permanent client-side capability gate.
  if (status.state === 'unavailable' || hasStartingRuntime(status)) return true;
  return status.capabilities[capability];
}

function hasStartingRuntime(status: CodeIntelligenceStatus): boolean {
  return status.state === 'starting' || status.languages.some((language) => language.state === 'starting');
}

async function statusAfterStartupQuery(
  status: CodeIntelligenceStatus,
  sessionId: string | null,
  signal: AbortSignal
): Promise<CodeIntelligenceStatus> {
  if ((!hasStartingRuntime(status) && status.state !== 'unavailable') || signal.aborted) return status;
  try {
    return await codeApi.codeIntelligenceStatus({ sessionId, signal });
  } catch {
    return status;
  }
}

function markerSeverity(monaco: Monaco, severity: CodeDiagnosticSeverity | null): number {
  switch (severity) {
    case 'error':
      return monaco.MarkerSeverity.Error;
    case 'warning':
      return monaco.MarkerSeverity.Warning;
    case 'hint':
      return monaco.MarkerSeverity.Hint;
    default:
      return monaco.MarkerSeverity.Info;
  }
}

function monacoDocumentSymbol(monaco: Monaco, symbol: CodeOutlineSymbol): languages.DocumentSymbol {
  return {
    name: symbol.name,
    detail: symbol.detail ?? '',
    kind: monacoSymbolKind(monaco, symbol.kind),
    tags: [],
    range: monacoRange(symbol.range),
    selectionRange: monacoRange(symbol.selectionRange),
    children: symbol.children.map((child) => monacoDocumentSymbol(monaco, child)),
  };
}

function monacoSymbolKind(monaco: Monaco, kind: string): languages.SymbolKind {
  const kinds: Record<string, languages.SymbolKind> = {
    file: monaco.languages.SymbolKind.File,
    module: monaco.languages.SymbolKind.Module,
    namespace: monaco.languages.SymbolKind.Namespace,
    package: monaco.languages.SymbolKind.Package,
    class: monaco.languages.SymbolKind.Class,
    method: monaco.languages.SymbolKind.Method,
    property: monaco.languages.SymbolKind.Property,
    field: monaco.languages.SymbolKind.Field,
    constructor: monaco.languages.SymbolKind.Constructor,
    enum: monaco.languages.SymbolKind.Enum,
    interface: monaco.languages.SymbolKind.Interface,
    function: monaco.languages.SymbolKind.Function,
    variable: monaco.languages.SymbolKind.Variable,
    constant: monaco.languages.SymbolKind.Constant,
    string: monaco.languages.SymbolKind.String,
    number: monaco.languages.SymbolKind.Number,
    boolean: monaco.languages.SymbolKind.Boolean,
    array: monaco.languages.SymbolKind.Array,
    object: monaco.languages.SymbolKind.Object,
    key: monaco.languages.SymbolKind.Key,
    null: monaco.languages.SymbolKind.Null,
    enumMember: monaco.languages.SymbolKind.EnumMember,
    struct: monaco.languages.SymbolKind.Struct,
    event: monaco.languages.SymbolKind.Event,
    operator: monaco.languages.SymbolKind.Operator,
    typeParameter: monaco.languages.SymbolKind.TypeParameter,
  };
  return kinds[kind] ?? monaco.languages.SymbolKind.Object;
}

function statusLabel(
  status: CodeIntelligenceStatus,
  savedDocument: boolean,
  diagnosticCount?: number,
  stale = false
): string {
  const stateLabel =
    status.state === 'starting'
      ? '代码导航启动中'
      : status.state === 'degraded'
        ? '代码导航部分可用'
        : status.state === 'unavailable'
          ? status.message || '代码导航不可用'
          : '代码导航就绪';
  const parts = [stateLabel];
  if (diagnosticCount !== undefined) parts.push(`${diagnosticCount} 个问题`);
  if (stale) parts.push('索引更新中');
  if (!savedDocument) parts.push('基于已保存版本');
  return parts.join(' · ');
}

function runtimeUnavailableSuffix(status: CodeIntelligenceStatus): string {
  if (status.state !== 'unavailable') return '';
  return ` · ${status.message || '代码导航运行时已不可用'}`;
}

function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() || path;
}

function codeIntelligenceDocumentKey(path: string, workspaceRoot: string, sessionId: string | null): string {
  return JSON.stringify([workspaceRoot, sessionId, path]);
}

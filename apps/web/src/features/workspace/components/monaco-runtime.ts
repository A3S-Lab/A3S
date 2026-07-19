// Monaco reads its NLS table while editor modules are evaluated, so the
// Simplified Chinese catalog must be the first runtime dependency.
import 'monaco-editor/esm/nls.messages.zh-cn.js';
import type * as MonacoNamespace from 'monaco-editor';
import * as editorApi from 'monaco-editor/esm/vs/editor/editor.api.js';
import * as css from 'monaco-editor/esm/vs/language/css/monaco.contribution.js';
import * as html from 'monaco-editor/esm/vs/language/html/monaco.contribution.js';
import * as json from 'monaco-editor/esm/vs/language/json/monaco.contribution.js';
import * as typescript from 'monaco-editor/esm/vs/language/typescript/monaco.contribution.js';
import 'monaco-editor/esm/vs/editor/edcore.main.js';
import 'monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/css/css.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/go/go.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/html/html.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/ini/ini.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/python/python.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/rust/rust.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/shell/shell.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/sql/sql.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/xml/xml.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution.js';

// Keep the complete standalone editor and diff surface, but expose only the
// language services used by the product. Monaco's package root also exports
// every bundled tokenizer and an unused LSP client.
const languages = Object.assign(editorApi.languages, { css, html, json, typescript });

export const monaco = {
  ...editorApi,
  css,
  html,
  json,
  languages,
  typescript,
} as typeof MonacoNamespace;

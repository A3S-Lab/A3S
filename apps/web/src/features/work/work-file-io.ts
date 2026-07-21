import type { Cell, CellMatrix, Sheet } from '@fortune-sheet/core';
import type { CellObject, WorkSheet } from 'xlsx';
import { createWorkDocumentBlob, importWorkDocumentFile } from './work-document-file-io';
import { downloadBlob, fileNameWithoutExtension, safeFileName } from './work-file-download';
import { createWorkPresentationBlob, importWorkPresentationFile } from './work-presentation-file-io';
import { readWorkSourceBlob } from './work-repository';
import { createWorkArtifact, createWorkId } from './work-templates';
import { type WorkArtifact, type WorkArtifactKind, workArtifactExtension } from './work-types';
import { exportXlsxCellComment, importXlsxCellComment } from './work-spreadsheet-comments';
import { applyPasswordlessEditableRanges, applySpreadsheetCellProtectionRanges } from './work-spreadsheet-protection';
import { refreshSpreadsheetPivotTables } from './work-spreadsheet-pivots';
import { xlsxWorksheetChartsToSheet } from './work-xlsx-charts';
import { exportXlsxDefinedNames, importXlsxDefinedNames } from './work-xlsx-defined-names';
import {
  createSpreadsheetFormulaMetadata,
  createXlsxErrorCell,
  createXlsxFormulaCell,
  patchXlsxFormulaFeatures,
  readXlsxFormulaFeatures,
} from './work-xlsx-formulas';
import { patchXlsxWorksheetDrawings, xlsxWorksheetImagesToSheet } from './work-xlsx-images';
import { patchXlsxSheetFeatures, readXlsxSheetFeatures, type XlsxDataValidation } from './work-xlsx-interop';
import { applyImportedXlsxPivotTables, patchXlsxPivotTables, readXlsxPivotTables } from './work-xlsx-pivots';
import { editableSpreadsheetFormula } from './work-spreadsheet-formulas';

const DOCUMENT_EXTENSIONS = new Set(['docx', 'html', 'htm', 'txt', 'md', 'markdown']);
const SPREADSHEET_EXTENSIONS = new Set(['xlsx', 'xls', 'csv', 'ods']);
const PRESENTATION_EXTENSIONS = new Set(['pptx']);
const PDF_EXTENSIONS = new Set(['pdf']);

export const WORK_IMPORT_ACCEPT = [
  '.docx',
  '.xlsx',
  '.xls',
  '.csv',
  '.ods',
  '.pptx',
  '.pdf',
  '.html',
  '.htm',
  '.txt',
  '.md',
].join(',');

export async function importWorkFile(file: File): Promise<WorkArtifact> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (DOCUMENT_EXTENSIONS.has(extension)) return importWorkDocumentFile(file, extension);
  if (SPREADSHEET_EXTENSIONS.has(extension)) return importSpreadsheet(file, extension);
  if (PRESENTATION_EXTENSIONS.has(extension)) return importWorkPresentationFile(file);
  if (PDF_EXTENSIONS.has(extension)) return importPdf(file);
  throw new Error('目前可导入 DOCX、XLSX、XLS、ODS、CSV、PPTX、PDF、HTML、Markdown 和文本文件。');
}

export async function exportWorkArtifact(artifact: WorkArtifact): Promise<void> {
  const blob = await createWorkArtifactBlob(artifact);
  downloadBlob(blob, `${safeFileName(artifact.title)}.${workArtifactExtension(artifact.kind)}`);
}

export async function createWorkArtifactBlob(artifact: WorkArtifact): Promise<Blob> {
  if (artifact.kind === 'document') return createWorkDocumentBlob(artifact);
  if (artifact.kind === 'spreadsheet') return createSpreadsheetBlob(artifact);
  if (artifact.kind === 'presentation') return createWorkPresentationBlob(artifact);
  return readWorkSourceBlob(artifact);
}

async function importSpreadsheet(file: File, extension: string): Promise<WorkArtifact> {
  const XLSX = await import('xlsx');
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, {
    type: 'array',
    cellDates: true,
    cellFormula: true,
    cellStyles: true,
    xlfn: true,
  });
  const sheetFeatures =
    extension === 'xlsx' ? await readXlsxSheetFeatures(arrayBuffer).catch(() => new Map()) : new Map();
  const formulaFeatures = extension === 'xlsx' ? await readXlsxFormulaFeatures(arrayBuffer).catch(() => null) : null;
  const pivotFeatures = extension === 'xlsx' ? await readXlsxPivotTables(arrayBuffer).catch(() => null) : null;
  const sheets = workbook.SheetNames.map((name, index) => {
    const worksheet = workbook.Sheets[name];
    const features = sheetFeatures.get(name);
    const range = worksheet['!ref']
      ? XLSX.utils.decode_range(worksheet['!ref'])
      : { s: { r: 0, c: 0 }, e: { r: 39, c: 11 } };
    const rowCount = Math.max(range.e.r + 1, 40);
    const columnCount = Math.max(range.e.c + 1, 12);
    const id = createWorkId('sheet');
    const hyperlinks: NonNullable<Sheet['hyperlink']> = {};
    const data: CellMatrix = Array.from({ length: rowCount }, () => Array<Cell | null>(columnCount).fill(null));
    for (let row = range.s.r; row <= range.e.r; row += 1) {
      for (let column = range.s.c; column <= range.e.c; column += 1) {
        const source = worksheet[XLSX.utils.encode_cell({ r: row, c: column })];
        if (!source) continue;
        const hyperlink = fortuneSheetHyperlink(source.l?.Target);
        const comment = importXlsxCellComment(source.c);
        const style = fortuneCellStyle(source);
        if (hyperlink) hyperlinks[`${row}_${column}`] = hyperlink;
        data[row][column] = {
          v: source.v as Cell['v'],
          m: source.w ?? String(source.v ?? ''),
          f: source.f ? `=${editableSpreadsheetFormula(source.f)}` : undefined,
          ps: comment,
          hl: hyperlink ? { r: row, c: column, id } : undefined,
          ...style,
          fc: hyperlink ? (style.fc ?? '#0563c1') : style.fc,
          un: hyperlink ? (style.un ?? 1) : style.un,
        };
      }
    }
    applySpreadsheetCellProtectionRanges(data, features?.protection.cellProtectionRanges ?? [], rowCount, columnCount);
    applyPasswordlessEditableRanges(data, features?.protection.authority?.allowRangeList ?? [], rowCount, columnCount);
    const config = fortuneSheetConfig(worksheet);
    if (features?.protection.authority) config.authority = features.protection.authority;
    const filterSelect = fortuneSheetFilter(worksheet, XLSX);
    const dataVerification = fortuneSheetDataVerification(features?.validations ?? [], rowCount, columnCount, XLSX);
    return {
      id,
      name,
      order: index,
      status: index === 0 ? 1 : 0,
      hide: workbook.Workbook?.Sheets?.[index]?.Hidden ? 1 : 0,
      row: rowCount,
      column: columnCount,
      data,
      config,
      filter: filterSelect ? {} : undefined,
      filter_select: filterSelect,
      frozen: features?.frozen,
      hyperlink: Object.keys(hyperlinks).length ? hyperlinks : undefined,
      dataVerification: Object.keys(dataVerification).length ? dataVerification : undefined,
      luckysheet_conditionformat_save: features?.conditionalFormats.length ? features.conditionalFormats : undefined,
      images: features?.images.length ? xlsxWorksheetImagesToSheet(features.images, config) : undefined,
      charts: features?.charts.length ? xlsxWorksheetChartsToSheet(features.charts, config) : undefined,
      formulaMetadata: createSpreadsheetFormulaMetadata(worksheet, formulaFeatures?.sheets.get(name)),
    };
  });
  const workbookMetadata = importXlsxDefinedNames(workbook, sheets);
  const pageBreaks = sheets.flatMap((sheet) => {
    const imported = sheetFeatures.get(sheet.name)?.pageBreaks;
    if (!sheet.id || (!imported?.rows.length && !imported?.columns.length)) return [];
    return [
      {
        sheetId: sheet.id,
        rows: imported.rows.length ? imported.rows : undefined,
        columns: imported.columns.length ? imported.columns : undefined,
      },
    ];
  });
  const pageSetups = sheets.flatMap((sheet) => {
    const imported = sheetFeatures.get(sheet.name)?.pageSetup;
    return sheet.id && imported ? [{ sheetId: sheet.id, ...imported }] : [];
  });
  const artifact = createWorkArtifact('blank-spreadsheet');
  artifact.title = fileNameWithoutExtension(file.name);
  artifact.content = applyImportedXlsxPivotTables(
    {
      type: 'spreadsheet',
      sheets,
      calculation: formulaFeatures?.calculation,
      ...workbookMetadata,
      pageBreaks: pageBreaks.length ? pageBreaks : undefined,
      pageSetups: pageSetups.length ? pageSetups : undefined,
    },
    pivotFeatures
  );
  const { analyzeSpreadsheetCompatibility } = await import('./work-office-diagnostics');
  artifact.compatibility = await analyzeSpreadsheetCompatibility(file, extension, workbook);
  return artifact;
}

function importPdf(file: File): WorkArtifact {
  const artifact = createWorkArtifact('blank-document');
  artifact.kind = 'pdf';
  artifact.title = fileNameWithoutExtension(file.name);
  artifact.content = { type: 'pdf' };
  return artifact;
}

function fortuneSheetConfig(worksheet: WorkSheet): NonNullable<Sheet['config']> {
  const config: NonNullable<Sheet['config']> = {};
  for (const range of worksheet['!merges'] ?? []) {
    config.merge ??= {};
    config.merge[`${range.s.r}_${range.s.c}`] = {
      r: range.s.r,
      c: range.s.c,
      rs: range.e.r - range.s.r + 1,
      cs: range.e.c - range.s.c + 1,
    };
  }
  for (const [index, column] of (worksheet['!cols'] ?? []).entries()) {
    if (!column) continue;
    if (column.wpx || column.wch) {
      config.columnlen ??= {};
      config.columnlen[index] = Math.round(column.wpx ?? (column.wch ?? 8.43) * 8);
    }
    if (column.hidden) {
      config.colhidden ??= {};
      config.colhidden[index] = 0;
    }
  }
  for (const [index, row] of (worksheet['!rows'] ?? []).entries()) {
    if (!row) continue;
    if (row.hpx || row.hpt) {
      config.rowlen ??= {};
      config.rowlen[index] = Math.round(row.hpx ?? ((row.hpt ?? 15) * 96) / 72);
    }
    if (row.hidden) {
      config.rowhidden ??= {};
      config.rowhidden[index] = 0;
    }
  }
  return config;
}

function fortuneCellStyle(source: CellObject): Partial<Cell> {
  const style = source.s;
  if (!style || typeof style !== 'object') {
    return source.z || source.t === 'e' ? { ct: { fa: source.z ? String(source.z) : undefined, t: source.t } } : {};
  }
  const font = style.font as
    | {
        bold?: boolean;
        italic?: boolean;
        underline?: boolean;
        name?: string;
        sz?: number;
        color?: { rgb?: string };
      }
    | undefined;
  const fill = style.fill as { fgColor?: { rgb?: string } } | undefined;
  const alignment = style.alignment as
    | { horizontal?: string; vertical?: string; wrapText?: boolean; textRotation?: number }
    | undefined;
  return {
    bl: font?.bold ? 1 : undefined,
    it: font?.italic ? 1 : undefined,
    un: font?.underline ? 1 : undefined,
    ff: font?.name,
    fs: font?.sz,
    fc: spreadsheetColor(font?.color?.rgb),
    bg: spreadsheetColor(fill?.fgColor?.rgb),
    ht: alignment?.horizontal === 'center' ? 0 : alignment?.horizontal === 'right' ? 2 : 1,
    vt: alignment?.vertical === 'center' ? 0 : alignment?.vertical === 'top' ? 1 : 2,
    tb: alignment?.wrapText ? '2' : undefined,
    tr: alignment?.textRotation ? String(alignment.textRotation) : undefined,
    ct: source.z || source.t === 'e' ? { fa: source.z ? String(source.z) : undefined, t: source.t } : undefined,
  };
}

async function createSpreadsheetBlob(artifact: WorkArtifact): Promise<Blob> {
  if (artifact.content.type !== 'spreadsheet') throw new Error('当前文件不是表格。');
  const content = refreshSpreadsheetPivotTables(artifact.content);
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  for (const sheet of content.sheets) {
    const data = sheet.data ?? [];
    const worksheet = XLSX.utils.aoa_to_sheet(
      data.map((row, rowIndex) =>
        row.map((cell, columnIndex) => {
          if (!cell) return null;
          if (cell.f) return createXlsxFormulaCell(cell, rowIndex, columnIndex, sheet);
          if (cell.ct?.t === 'e') return createXlsxErrorCell(cell);
          if (cell.ps && cell.v === undefined && cell.m === undefined) return { t: 's', v: '' };
          return cell.v ?? cell.m ?? null;
        })
      )
    );
    applySpreadsheetLayout(worksheet, sheet);
    for (const [rowIndex, row] of data.entries()) {
      for (const [columnIndex, cell] of row.entries()) {
        if (!cell) continue;
        const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
        const target = worksheet[address];
        if (!target) continue;
        if (cell.ct?.fa) target.z = cell.ct.fa;
        const style = xlsxCellStyle(cell);
        if (style) target.s = style;
        const comment = exportXlsxCellComment(cell.ps);
        if (comment) target.c = comment;
        const hyperlink = sheet.hyperlink?.[`${rowIndex}_${columnIndex}`];
        if (hyperlink) target.l = { Target: xlsxHyperlinkTarget(hyperlink) };
      }
    }
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31) || '工作表');
  }
  workbook.Workbook = {
    ...workbook.Workbook,
    Sheets: content.sheets.map((sheet) => ({
      name: sheet.name.slice(0, 31) || '工作表',
      Hidden: sheet.hide ? 1 : 0,
    })),
    Names: exportXlsxDefinedNames(content),
  };
  const bytes = XLSX.write(workbook, {
    type: 'array',
    bookType: 'xlsx',
    compression: true,
  }) as ArrayBuffer;
  const withFeatures = await patchXlsxSheetFeatures(bytes, content);
  const withDrawings = await patchXlsxWorksheetDrawings(withFeatures, content);
  const withFormulas = await patchXlsxFormulaFeatures(withDrawings, content);
  const output = await patchXlsxPivotTables(withFormulas, content);
  return new Blob([output], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function applySpreadsheetLayout(worksheet: WorkSheet, sheet: Sheet) {
  const merges = Object.values(sheet.config?.merge ?? {});
  if (merges.length) {
    worksheet['!merges'] = merges.map((merge) => ({
      s: { r: merge.r, c: merge.c },
      e: { r: merge.r + merge.rs - 1, c: merge.c + merge.cs - 1 },
    }));
  }
  const columnIndexes = new Set([
    ...Object.keys(sheet.config?.columnlen ?? {}),
    ...Object.keys(sheet.config?.colhidden ?? {}),
  ]);
  if (columnIndexes.size) {
    worksheet['!cols'] = [];
    for (const value of columnIndexes) {
      const index = Number(value);
      worksheet['!cols'][index] = {
        wpx: sheet.config?.columnlen?.[value],
        hidden: value in (sheet.config?.colhidden ?? {}),
      };
    }
  }
  const rowIndexes = new Set([
    ...Object.keys(sheet.config?.rowlen ?? {}),
    ...Object.keys(sheet.config?.rowhidden ?? {}),
  ]);
  if (rowIndexes.size) {
    worksheet['!rows'] = [];
    for (const value of rowIndexes) {
      const index = Number(value);
      worksheet['!rows'][index] = {
        hpx: sheet.config?.rowlen?.[value],
        hidden: value in (sheet.config?.rowhidden ?? {}),
      };
    }
  }
  if (sheet.filter_select) {
    worksheet['!autofilter'] = {
      ref: encodeSpreadsheetRange(sheet.filter_select),
    };
  }
}

function fortuneSheetFilter(worksheet: WorkSheet, XLSX: typeof import('xlsx')): Sheet['filter_select'] | undefined {
  const reference = worksheet['!autofilter']?.ref;
  if (!reference) return undefined;
  try {
    const range = XLSX.utils.decode_range(reference);
    return {
      row: [range.s.r, range.e.r],
      column: [range.s.c, range.e.c],
    };
  } catch {
    return undefined;
  }
}

function fortuneSheetHyperlink(target: string | undefined): NonNullable<Sheet['hyperlink']>[string] | undefined {
  if (!target) return undefined;
  if (!target.startsWith('#')) {
    return { linkType: 'webpage', linkAddress: target };
  }
  const address = target.slice(1);
  return {
    linkType: address.includes('!') ? 'cellrange' : 'sheet',
    linkAddress: address,
  };
}

function xlsxHyperlinkTarget(link: NonNullable<Sheet['hyperlink']>[string]): string {
  if (link.linkType === 'webpage') return link.linkAddress;
  if (link.linkType === 'sheet') return `#${quoteSheetName(link.linkAddress)}!A1`;
  return `#${link.linkAddress}`;
}

function quoteSheetName(value: string): string {
  return /^[A-Za-z_][A-Za-z0-9_.]*$/.test(value) ? value : `'${value.replaceAll("'", "''")}'`;
}

function fortuneSheetDataVerification(
  validations: XlsxDataValidation[],
  rowCount: number,
  columnCount: number,
  XLSX: typeof import('xlsx')
): Record<string, XlsxDataValidation['item']> {
  const result: Record<string, XlsxDataValidation['item']> = {};
  for (const validation of validations) {
    for (const reference of validation.references) {
      try {
        const range = XLSX.utils.decode_range(reference);
        const lastRow = Math.min(range.e.r, rowCount - 1);
        const lastColumn = Math.min(range.e.c, columnCount - 1);
        for (let row = Math.max(0, range.s.r); row <= lastRow; row += 1) {
          for (let column = Math.max(0, range.s.c); column <= lastColumn; column += 1) {
            result[`${row}_${column}`] = {
              ...validation.item,
              rangeTxt: reference,
            };
          }
        }
      } catch {
        // Keep the rest of the worksheet editable when one validation reference is malformed.
      }
    }
  }
  return result;
}

function encodeSpreadsheetRange(range: NonNullable<Sheet['filter_select']>): string {
  return `${encodeSpreadsheetCell(range.row[0], range.column[0])}:${encodeSpreadsheetCell(
    range.row[1],
    range.column[1]
  )}`;
}

function encodeSpreadsheetCell(row: number, column: number): string {
  let value = Math.max(0, column) + 1;
  let label = '';
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return `${label}${Math.max(0, row) + 1}`;
}

function xlsxCellStyle(cell: Cell): CellObject['s'] | undefined {
  const color = (value: string | undefined) =>
    value ? { rgb: `FF${value.replace('#', '').toUpperCase()}` } : undefined;
  if (
    !cell.bl &&
    !cell.it &&
    !cell.un &&
    !cell.ff &&
    !cell.fs &&
    !cell.fc &&
    !cell.bg &&
    cell.ht === undefined &&
    cell.vt === undefined &&
    !cell.tb
  ) {
    return undefined;
  }
  return {
    font: {
      bold: Boolean(cell.bl),
      italic: Boolean(cell.it),
      underline: Boolean(cell.un),
      name: cell.ff,
      sz: cell.fs,
      color: color(cell.fc),
    },
    fill: cell.bg ? { patternType: 'solid', fgColor: color(cell.bg) } : undefined,
    alignment: {
      horizontal: cell.ht === 0 ? 'center' : cell.ht === 2 ? 'right' : 'left',
      vertical: cell.vt === 0 ? 'center' : cell.vt === 1 ? 'top' : 'bottom',
      wrapText: cell.tb === '2',
    },
  };
}

function spreadsheetColor(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/^#/, '').slice(-6);
  return /^[0-9a-f]{6}$/i.test(normalized) ? `#${normalized.toLowerCase()}` : undefined;
}

export function workKindForFile(file: File): WorkArtifactKind | null {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (DOCUMENT_EXTENSIONS.has(extension)) return 'document';
  if (SPREADSHEET_EXTENSIONS.has(extension)) return 'spreadsheet';
  if (PRESENTATION_EXTENSIONS.has(extension)) return 'presentation';
  if (PDF_EXTENSIONS.has(extension)) return 'pdf';
  return null;
}

import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createWorkArtifactBlob,
  exportWorkArtifact,
  importWorkFile,
  WORK_IMPORT_ACCEPT,
  workKindForFile,
} from './work-file-io';
import { createPptxPresentation } from './work-pptx-export';
import { saveWorkArtifact, saveWorkSource } from './work-repository';
import { defaultSheetProtectionAuthority } from './work-spreadsheet-protection';
import { createWorkArtifact } from './work-templates';

describe('Work Office file interoperability', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('recognizes PPTX files as editable presentations', () => {
    const file = new File([], 'Quarterly Review.PPTX', {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    });
    expect(WORK_IMPORT_ACCEPT).toContain('.pptx');
    expect(workKindForFile(file)).toBe('presentation');
  });

  it('opens PDF files as source-backed preview artifacts', async () => {
    const file = new File(['%PDF-1.7'], 'Research.pdf', { type: 'application/pdf' });
    expect(WORK_IMPORT_ACCEPT).toContain('.pdf');
    expect(workKindForFile(file)).toBe('pdf');
    await expect(importWorkFile(file)).resolves.toMatchObject({
      kind: 'pdf',
      title: 'Research',
      content: { type: 'pdf' },
    });
  });

  it('returns the current managed PDF source when exporting an artifact blob', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const artifact = await saveWorkArtifact(createWorkArtifact('blank-document'));
    artifact.kind = 'pdf';
    artifact.content = { type: 'pdf' };
    const pdf = new File(['%PDF-1.7 edited'], 'Research.pdf', { type: 'application/pdf' });
    const saved = await saveWorkSource(artifact, pdf);

    const exported = await createWorkArtifactBlob(saved);

    expect(exported.type).toBe('application/pdf');
    await expect(exported.text()).resolves.toBe('%PDF-1.7 edited');
  });

  it('imports PPTX geometry, rich text, images, tables, charts, notes, and diagnostics', async () => {
    const file = await createPresentationFixture();
    const artifact = await importWorkFile(file);

    expect(artifact.kind).toBe('presentation');
    expect(artifact.title).toBe('Quarterly Review');
    expect(artifact.compatibility).toMatchObject({
      sourceFormat: 'PPTX',
      sourceName: 'Quarterly Review.pptx',
    });
    expect(artifact.compatibility?.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['pptx.transition', 'pptx.group'])
    );
    expect(artifact.compatibility?.issues.some((issue) => issue.code.startsWith('pptx.chart.format'))).toBe(false);
    expect(artifact.content.type).toBe('presentation');
    if (artifact.content.type !== 'presentation') return;

    expect(artifact.content.width).toBeCloseTo(13.333, 2);
    expect(artifact.content.height).toBeCloseTo(7.5, 2);
    expect(artifact.content.slides).toHaveLength(1);
    const slide = artifact.content.slides[0];
    expect(slide.name).toBe('Quarterly Review');
    expect(slide.notes).toBe('Remember the launch date.');
    expect(slide.elements.map((element) => element.type)).toEqual(
      expect.arrayContaining(['text', 'image', 'table', 'chart', 'shape', 'line'])
    );

    const title = slide.elements.find((element) => element.type === 'text');
    expect(title).toMatchObject({
      text: 'Quarterly Review',
      x: 10,
      y: 10,
      width: 80,
      height: 15,
      fontFamily: 'Aptos',
      href: 'https://a3s.dev',
    });
    expect(title?.textRuns?.[0]).toMatchObject({ bold: true, color: '#ffffff', href: 'https://a3s.dev' });

    const image = slide.elements.find((element) => element.type === 'image');
    expect(image?.image?.dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(image?.altText).toBe('A3S mark');

    const table = slide.elements.find((element) => element.type === 'table');
    expect(table?.table?.rows).toEqual([
      ['Metric', 'Value'],
      ['Adoption', '42'],
    ]);

    const chart = slide.elements.find((element) => element.type === 'chart');
    expect(chart?.chart).toEqual({
      type: 'column',
      title: 'Adoption',
      categories: ['Q1', 'Q2'],
      series: [{ name: 'Users', values: [12, 42] }],
      showLegend: false,
    });
  });

  it('rejects ZIP files that are not presentations', async () => {
    const zip = new JSZip();
    zip.file('readme.txt', 'not a presentation');
    const file = new File([asArrayBuffer(await zip.generateAsync({ type: 'uint8array' }))], 'invalid.pptx');
    await expect(importWorkFile(file)).rejects.toThrow('not a valid PPTX');
  });

  it('round-trips supported presentation content through a generated PPTX package', async () => {
    const imported = await importWorkFile(await createPresentationFixture());
    const presentation = createPptxPresentation(imported, PptxGenJS);
    const bytes = await presentation.write({ outputType: 'uint8array' });
    expect(bytes).toBeInstanceOf(Uint8Array);

    const reopened = await importWorkFile(
      new File([asArrayBuffer(bytes as Uint8Array)], 'Round Trip.pptx', {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      })
    );
    expect(reopened.content.type).toBe('presentation');
    if (reopened.content.type !== 'presentation') return;

    const slide = reopened.content.slides[0];
    expect(slide.notes).toContain('Remember the launch date.');
    expect(slide.elements.map((element) => element.type)).toEqual(
      expect.arrayContaining(['text', 'image', 'table', 'chart', 'shape', 'line'])
    );
    expect(slide.elements.find((element) => element.type === 'text')?.text).toContain('Quarterly Review');
    expect(slide.elements.find((element) => element.type === 'table')?.table?.rows).toEqual(
      expect.arrayContaining([['Metric', 'Value']])
    );
    expect(slide.elements.find((element) => element.type === 'chart')?.chart?.series[0]?.values).toEqual([12, 42]);
  });

  it('preserves spreadsheet merges and dimensions while reporting degraded workbook features', async () => {
    const XLSX = await import('xlsx');
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Quarterly plan', null, null],
      ['Owner', 'Status', 'Score'],
      ['A3S', 'On track', 42],
    ]);
    worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
    worksheet['!cols'] = [{ wpx: 180 }, { wpx: 96, hidden: true }];
    worksheet['!rows'] = [{ hpx: 32 }];
    worksheet['!autofilter'] = { ref: 'A2:C3' };
    if (worksheet.A3) worksheet.A3.l = { Target: 'https://a3s.dev' };
    if (worksheet.B3) worksheet.B3.c = [{ a: 'Reviewer', t: 'Confirm the launch status.' }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Plan');
    workbook.Workbook = {
      Names: [
        { Name: 'ScoreCell', Ref: 'Plan!$C$3' },
        { Name: 'PlanStatus', Ref: 'Plan!$B$3', Sheet: 0 },
        { Name: '_xlnm.Print_Area', Ref: "'Plan'!$A$2:$C$3", Sheet: 0 },
        { Name: '_xlnm.Print_Titles', Ref: "'Plan'!$1:$2,'Plan'!$A:$A", Sheet: 0 },
      ],
      Sheets: [{ name: 'Plan', Hidden: 1 }],
    };
    const bytes = await addFrozenPane(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer, 1, 1);
    const artifact = await importWorkFile(
      new File([bytes], 'Plan.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
    );

    expect(artifact.content.type).toBe('spreadsheet');
    if (artifact.content.type !== 'spreadsheet') return;
    const importedSheet = artifact.content.sheets[0];
    expect(importedSheet).toMatchObject({
      hide: 1,
      config: {
        merge: { '0_0': { r: 0, c: 0, rs: 1, cs: 3 } },
        columnlen: { 0: 180, 1: 96 },
        colhidden: { 1: 0 },
        rowlen: { 0: 32 },
        authority: {
          sheet: 1,
          selectLockedCells: 0,
          selectunLockedCells: 1,
          formatCells: 1,
          filter: 1,
          editObjects: 0,
          allowRangeList: [
            { name: 'Public input', sqref: 'B3' },
            {
              name: 'Managers',
              sqref: 'C3',
              xlsxAttributes: expect.objectContaining({ password: '1234' }),
            },
          ],
          xlsxAttributes: expect.objectContaining({ password: 'ABCD' }),
        },
      },
      filter: {},
      filter_select: { row: [1, 2], column: [0, 2] },
      frozen: {
        type: 'rangeBoth',
        range: { row_focus: 0, column_focus: 0 },
      },
      hyperlink: {
        '2_0': { linkType: 'webpage', linkAddress: 'https://a3s.dev' },
      },
      dataVerification: {
        '2_1': {
          type: 'dropdown',
          value1: 'On track,Blocked',
          prohibitInput: true,
          hintShow: true,
          hintValue: 'Choose status',
        },
      },
      luckysheet_conditionformat_save: [
        {
          type: 'default',
          cellrange: [{ row: [2, 2], column: [2, 2] }],
          format: { textColor: '#ffffff', cellColor: '#c00000' },
          stopIfTrue: true,
          conditionName: 'greaterThan',
          conditionRange: [],
          conditionValue: ['40'],
        },
        {
          type: 'colorGradation',
          cellrange: [{ row: [2, 4], column: [2, 2] }],
          format: ['rgb(99, 190, 123)', 'rgb(248, 105, 107)'],
        },
        {
          type: 'dataBar',
          cellrange: [{ row: [2, 4], column: [2, 2] }],
          format: { textColor: null, cellColor: '#5b9bd5' },
          visualOptions: {
            thresholds: [
              { type: 'num', value: 0 },
              { type: 'percent', value: 90 },
            ],
            showValue: false,
            minLength: 15,
            maxLength: 75,
          },
        },
        {
          type: 'icons',
          cellrange: [{ row: [2, 4], column: [2, 2] }],
          format: {
            iconSet: '3TrafficLights1',
            showValue: false,
            reverse: true,
            percent: true,
            thresholds: [
              { type: 'min', gte: true },
              { type: 'percent', value: 33, gte: true },
              { type: 'percent', value: 67, gte: true },
            ],
          },
        },
      ],
    });
    expect(artifact.content.namedRanges).toEqual([
      expect.objectContaining({ name: 'ScoreCell', reference: 'Plan!$C$3', scopeSheetId: undefined }),
      expect.objectContaining({ name: 'PlanStatus', reference: 'Plan!$B$3', scopeSheetId: importedSheet.id }),
    ]);
    expect(importedSheet.data?.[2]?.[1]?.ps).toMatchObject({
      value: 'Confirm the launch status.',
      isShow: false,
      author: 'Reviewer',
    });
    expect(importedSheet.data?.[2]?.[0]).toMatchObject({ lo: 0 });
    expect(importedSheet.data?.[2]?.[1]).toMatchObject({ lo: 0 });
    expect(importedSheet.data?.[2]?.[2]?.lo).toBeUndefined();
    expect(artifact.content.printAreas).toEqual([{ sheetId: importedSheet.id, reference: '$A$2:$C$3' }]);
    expect(artifact.content.printTitles).toEqual([{ sheetId: importedSheet.id, rows: '$1:$2', columns: '$A:$A' }]);
    expect(artifact.content.pageBreaks).toEqual([{ sheetId: importedSheet.id, rows: [2], columns: [1] }]);
    expect(artifact.compatibility?.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'sheet.names',
        'sheet.print-area',
        'sheet.print-titles',
        'sheet.filter',
        'sheet.links',
        'xlsx.validation',
        'xlsx.conditional-formatting',
        'sheet.comments',
        'xlsx.comments',
        'xlsx.protection',
        'xlsx.protection.password',
        'xlsx.protection.range-credentials',
        'xlsx.protection.permissions',
        'xlsx.manual-page-breaks',
      ])
    );
    expect(artifact.compatibility?.issues.find((issue) => issue.code === 'xlsx.conditional-formatting')).toMatchObject({
      severity: 'info',
      message: expect.stringContaining('preserved in editable sheet state'),
    });
    expect(artifact.compatibility?.issues.find((issue) => issue.code === 'sheet.print-titles')).toMatchObject({
      severity: 'info',
      message: expect.stringContaining('repeated in PDF output'),
    });
    expect(artifact.compatibility?.issues.find((issue) => issue.code === 'xlsx.manual-page-breaks')).toMatchObject({
      severity: 'info',
      message: expect.stringContaining('honored by PDF pagination'),
    });
  });

  it('round-trips filters, frozen panes, hyperlinks, validation, and conditional formatting through XLSX export', async () => {
    const artifact = createWorkArtifact('blank-spreadsheet');
    artifact.title = 'Pipeline';
    expect(artifact.content.type).toBe('spreadsheet');
    if (artifact.content.type !== 'spreadsheet') return;
    const sheet = artifact.content.sheets[0];
    sheet.data = [
      [
        { v: 'Owner', m: 'Owner' },
        { v: 'Status', m: 'Status' },
        { v: 'Code', m: 'Code' },
        { v: 'Score', m: 'Score' },
        { v: 'Progress', m: 'Progress' },
      ],
      [
        { v: 'Work', m: 'Work' },
        { v: 'Ready', m: 'Ready' },
        { v: 'A', m: 'A' },
        { v: 10, m: '10' },
        { v: 10, m: '10' },
      ],
      [
        { v: 'Docs', m: 'Docs' },
        { v: 'Ready', m: 'Ready' },
        { v: 'B', m: 'B' },
        { v: 20, m: '20' },
        { v: 20, m: '20' },
      ],
      [
        { v: 'Release', m: 'Release' },
        { v: 'Blocked', m: 'Blocked' },
        { v: 'B', m: 'B' },
        { v: 30, m: '30' },
        { v: 30, m: '30' },
      ],
    ];
    sheet.filter = {};
    sheet.filter_select = { row: [0, 1], column: [0, 1] };
    sheet.frozen = {
      type: 'rangeBoth',
      range: { row_focus: 0, column_focus: 0 },
    };
    sheet.hyperlink = {
      '1_0': { linkType: 'webpage', linkAddress: 'https://a3s.dev/work' },
    };
    sheet.data[1][0]!.ps = {
      left: null,
      top: null,
      width: null,
      height: null,
      value: '<div>Review owner before launch</div>',
      isShow: false,
    };
    sheet.dataVerification = {
      '1_1': {
        type: 'dropdown',
        type2: '',
        rangeTxt: 'B2',
        value1: 'Ready,Blocked',
        value2: '',
        validity: '',
        remote: false,
        prohibitInput: true,
        hintShow: true,
        hintValue: 'Choose a pipeline state',
        checked: false,
      },
    };
    sheet.data[1][1]!.lo = 0;
    sheet.config = {
      ...(sheet.config ?? {}),
      authority: {
        ...defaultSheetProtectionAuthority(true),
        selectLockedCells: 0,
        formatCells: 1,
        filter: 1,
        allowRangeList: [
          { name: 'Pipeline input', sqref: 'B2:B4' },
          {
            name: 'Manager approval',
            sqref: 'C2:C4',
            xlsxAttributes: { password: '1234' },
          },
        ],
        xlsxAttributes: { password: 'ABCD' },
      },
    };
    sheet.luckysheet_conditionformat_save = [
      {
        type: 'default',
        cellrange: [{ row: [1, 3], column: [3, 3] }],
        format: { textColor: '#ffffff', cellColor: '#c00000' },
        stopIfTrue: true,
        conditionName: 'notBetween',
        conditionRange: [],
        conditionValue: ['15', '30'],
      },
      {
        type: 'default',
        cellrange: [{ row: [1, 3], column: [1, 1] }],
        format: { textColor: '#9c0006', cellColor: '#ffc7ce' },
        conditionName: 'duplicateValue',
        conditionRange: [],
        conditionValue: ['0'],
      },
      {
        type: 'default',
        cellrange: [{ row: [1, 3], column: [2, 2] }],
        format: { textColor: '#006100', cellColor: '#c6efce' },
        conditionName: 'duplicateValue',
        conditionRange: [],
        conditionValue: ['1'],
      },
      {
        type: 'colorGradation',
        cellrange: [{ row: [1, 3], column: [3, 3] }],
        format: ['#63be7b', '#ffeb84', '#f8696b'],
      },
      {
        type: 'dataBar',
        cellrange: [{ row: [1, 3], column: [4, 4] }],
        format: { textColor: null, cellColor: '#5b9bd5' },
        visualOptions: {
          thresholds: [
            { type: 'num', value: 0 },
            { type: 'num', value: 40 },
          ],
          showValue: false,
          minLength: 15,
          maxLength: 75,
        },
      },
      {
        type: 'icons',
        cellrange: [{ row: [1, 3], column: [3, 3] }],
        format: {
          iconSet: '5Rating',
          showValue: false,
          reverse: true,
          percent: false,
          thresholds: [
            { type: 'min', gte: true },
            { type: 'num', value: 15, gte: true },
            { type: 'num', value: 20, gte: false },
            { type: 'num', value: 25, gte: true },
            { type: 'max', gte: true },
          ],
        },
      },
    ];
    artifact.content.namedRanges = [
      {
        id: 'name-pipeline-owner',
        name: 'PipelineOwner',
        reference: "'工作表1'!$A$2",
        comment: 'Primary owner cell',
      },
      {
        id: 'name-pipeline-status',
        name: 'PipelineStatus',
        reference: '$B$2',
        scopeSheetId: sheet.id,
      },
    ];
    artifact.content.printAreas = [{ sheetId: sheet.id!, reference: '$A$1:$B$2' }];
    artifact.content.printTitles = [{ sheetId: sheet.id!, rows: '$1:$1', columns: '$A:$A' }];
    artifact.content.pageBreaks = [{ sheetId: sheet.id!, rows: [2], columns: [1] }];

    let exported: Blob | null = null;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((value) => {
      if (value instanceof Blob) exported = value;
      return 'blob:a3s-work-xlsx';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await exportWorkArtifact(artifact);
    expect(exported).toBeInstanceOf(Blob);
    if (!exported) return;

    const packageArchive = await JSZip.loadAsync(exported);
    const workbookXml = await packageArchive.file('xl/workbook.xml')?.async('text');
    const worksheetXml = await packageArchive.file('xl/worksheets/sheet1.xml')?.async('text');
    const stylesXml = await packageArchive.file('xl/styles.xml')?.async('text');
    const commentsXml = await packageArchive.file('xl/comments1.xml')?.async('text');
    expect(worksheetXml).toContain('<conditionalFormatting sqref="D2:D4">');
    expect(worksheetXml).toContain('operator="notBetween"');
    expect(worksheetXml).toContain('stopIfTrue="1"');
    expect(worksheetXml).toContain('<formula>15</formula><formula>30</formula>');
    expect(worksheetXml).toContain('type="duplicateValues"');
    expect(worksheetXml).toContain('type="uniqueValues"');
    expect(worksheetXml).toContain('type="colorScale"');
    expect(worksheetXml).toContain('type="dataBar"');
    expect(worksheetXml).toContain('<dataBar showValue="0" minLength="15" maxLength="75">');
    expect(worksheetXml).toContain('type="iconSet"');
    expect(worksheetXml).toContain('<iconSet iconSet="5Rating" showValue="0" reverse="1" percent="0">');
    expect(worksheetXml).toContain('<sheetProtection password="ABCD" sheet="1"');
    expect(worksheetXml).toContain('selectLockedCells="1"');
    expect(worksheetXml).toContain('formatCells="0"');
    expect(worksheetXml).toContain('<protectedRange name="Pipeline input" sqref="B2:B4"');
    expect(worksheetXml).toContain('<protectedRange password="1234" name="Manager approval" sqref="C2:C4"');
    expect(stylesXml).toContain('<dxfs count="3">');
    expect(stylesXml).toContain('<protection locked="0" hidden="0"/>');
    expect(commentsXml).toContain('Review owner before launch');
    expect(commentsXml).toContain('A3S Work');
    expect(workbookXml).toContain('_xlnm.Print_Titles');
    expect(worksheetXml).toContain(
      '<rowBreaks count="1" manualBreakCount="1"><brk id="2" min="0" max="16383" man="1"/></rowBreaks>'
    );
    expect(worksheetXml).toContain(
      '<colBreaks count="1" manualBreakCount="1"><brk id="1" min="0" max="1048575" man="1"/></colBreaks>'
    );

    const reopened = await importWorkFile(
      new File([exported], 'Pipeline.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
    );
    expect(reopened.content.type).toBe('spreadsheet');
    if (reopened.content.type !== 'spreadsheet') return;
    const reopenedSheet = reopened.content.sheets[0];
    expect(reopenedSheet).toMatchObject({
      filter: {},
      filter_select: { row: [0, 1], column: [0, 1] },
      frozen: {
        type: 'rangeBoth',
        range: { row_focus: 0, column_focus: 0 },
      },
      hyperlink: {
        '1_0': { linkType: 'webpage', linkAddress: 'https://a3s.dev/work' },
      },
      dataVerification: {
        '1_1': {
          type: 'dropdown',
          value1: 'Ready,Blocked',
          prohibitInput: true,
          hintShow: true,
          hintValue: 'Choose a pipeline state',
        },
      },
      config: {
        authority: {
          sheet: 1,
          selectLockedCells: 0,
          formatCells: 1,
          filter: 1,
          allowRangeList: [
            { name: 'Pipeline input', sqref: 'B2:B4' },
            {
              name: 'Manager approval',
              sqref: 'C2:C4',
              xlsxAttributes: expect.objectContaining({ password: '1234' }),
            },
          ],
          xlsxAttributes: expect.objectContaining({ password: 'ABCD' }),
        },
      },
      luckysheet_conditionformat_save: [
        {
          type: 'default',
          cellrange: [{ row: [1, 3], column: [3, 3] }],
          format: { textColor: '#ffffff', cellColor: '#c00000' },
          stopIfTrue: true,
          conditionName: 'notBetween',
          conditionRange: [],
          conditionValue: ['15', '30'],
        },
        {
          type: 'default',
          cellrange: [{ row: [1, 3], column: [1, 1] }],
          format: { textColor: '#9c0006', cellColor: '#ffc7ce' },
          conditionName: 'duplicateValue',
          conditionRange: [],
          conditionValue: ['0'],
        },
        {
          type: 'default',
          cellrange: [{ row: [1, 3], column: [2, 2] }],
          format: { textColor: '#006100', cellColor: '#c6efce' },
          conditionName: 'duplicateValue',
          conditionRange: [],
          conditionValue: ['1'],
        },
        {
          type: 'colorGradation',
          cellrange: [{ row: [1, 3], column: [3, 3] }],
          format: ['rgb(99, 190, 123)', 'rgb(255, 235, 132)', 'rgb(248, 105, 107)'],
        },
        {
          type: 'dataBar',
          cellrange: [{ row: [1, 3], column: [4, 4] }],
          format: { textColor: null, cellColor: '#5b9bd5' },
          visualOptions: {
            thresholds: [
              { type: 'num', value: 0 },
              { type: 'num', value: 40 },
            ],
            showValue: false,
            minLength: 15,
            maxLength: 75,
          },
        },
        {
          type: 'icons',
          cellrange: [{ row: [1, 3], column: [3, 3] }],
          format: {
            iconSet: '5Rating',
            showValue: false,
            reverse: true,
            percent: false,
            thresholds: [
              { type: 'min', gte: true },
              { type: 'num', value: 15, gte: true },
              { type: 'num', value: 20, gte: false },
              { type: 'num', value: 25, gte: true },
              { type: 'max', gte: true },
            ],
          },
        },
      ],
    });
    expect(reopenedSheet.data?.[1]?.[0]?.ps).toMatchObject({
      value: 'Review owner before launch',
      author: 'A3S Work',
      isShow: false,
    });
    expect(reopenedSheet.data?.[1]?.[1]).toMatchObject({ lo: 0 });
    expect(reopenedSheet.data?.[2]?.[1]).toMatchObject({ lo: 0 });
    expect(reopenedSheet.data?.[3]?.[1]).toMatchObject({ lo: 0 });
    expect(reopened.content.namedRanges).toEqual([
      expect.objectContaining({
        name: 'PipelineOwner',
        reference: "'工作表1'!$A$2",
        comment: 'Primary owner cell',
        scopeSheetId: undefined,
      }),
      expect.objectContaining({
        name: 'PipelineStatus',
        reference: "'工作表1'!$B$2",
        scopeSheetId: reopenedSheet.id,
      }),
    ]);
    expect(reopened.content.printAreas).toEqual([{ sheetId: reopenedSheet.id, reference: '$A$1:$B$2' }]);
    expect(reopened.content.printTitles).toEqual([{ sheetId: reopenedSheet.id, rows: '$1:$1', columns: '$A:$A' }]);
    expect(reopened.content.pageBreaks).toEqual([{ sheetId: reopenedSheet.id, rows: [2], columns: [1] }]);
  });

  it('requires a compatibility review before saving a converted DOCX document', async () => {
    const docx = await import('docx');
    const document = new docx.Document({
      sections: [{ children: [new docx.Paragraph('A3S Work document')] }],
    });
    const artifact = await importWorkFile(
      new File([await (await docx.Packer.toBlob(document)).arrayBuffer()], 'Brief.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
    );

    expect(artifact.content.type).toBe('document');
    expect(artifact.compatibility?.issues.map((issue) => issue.code)).toContain('docx.page-layout');
  });

  it('round-trips editable tables, links, and raster images through DOCX export', async () => {
    const artifact = createWorkArtifact('blank-document');
    artifact.title = 'Launch brief';
    artifact.content = {
      type: 'document',
      pageSize: 'a4',
      html: [
        '<p><a href="https://a3s.dev">A3S launch</a></p>',
        '<table><tbody><tr><th>Owner</th><th>Status</th></tr><tr><td>Work</td><td>Ready</td></tr></tbody></table>',
        '<p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=" alt="A3S mark" width="1" height="1"></p>',
      ].join(''),
    };

    let exported: Blob | null = null;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((value) => {
      if (value instanceof Blob) exported = value;
      return 'blob:a3s-work-docx';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await exportWorkArtifact(artifact);
    expect(exported).toBeInstanceOf(Blob);
    if (!exported) return;

    const reopened = await importWorkFile(
      new File([exported], 'Launch brief.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
    );
    expect(reopened.content.type).toBe('document');
    if (reopened.content.type !== 'document') return;

    const html = new DOMParser().parseFromString(reopened.content.html, 'text/html');
    expect(Array.from(html.querySelectorAll('table td, table th')).map((cell) => cell.textContent)).toEqual([
      'Owner',
      'Status',
      'Work',
      'Ready',
    ]);
    expect(html.querySelector('a')?.getAttribute('href')).toBe('https://a3s.dev');
    expect(html.querySelector('img')?.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
  });
});

async function createPresentationFixture(): Promise<File> {
  const zip = new JSZip();
  zip.file(
    'ppt/presentation.xml',
    xml`
      <p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst>
        <p:sldSz cx="12192000" cy="6858000"/>
      </p:presentation>
    `
  );
  zip.file(
    'ppt/_rels/presentation.xml.rels',
    relationships([
      ['rId1', 'slides/slide1.xml', 'slide'],
      ['rId2', 'slideMasters/slideMaster1.xml', 'slideMaster'],
    ])
  );
  zip.file(
    'ppt/slideMasters/slideMaster1.xml',
    xml`
      <p:sldMaster xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <p:cSld><p:bg><p:bgPr><a:solidFill><a:schemeClr val="dk2"/></a:solidFill></p:bgPr></p:bg></p:cSld>
      </p:sldMaster>
    `
  );
  zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', relationships([['rId1', '../theme/theme1.xml', 'theme']]));
  zip.file(
    'ppt/theme/theme1.xml',
    xml`
      <a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <a:themeElements>
          <a:clrScheme name="A3S">
            <a:dk1><a:srgbClr val="000000"/></a:dk1>
            <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
            <a:dk2><a:srgbClr val="16213D"/></a:dk2>
            <a:accent1><a:srgbClr val="4472C4"/></a:accent1>
          </a:clrScheme>
        </a:themeElements>
      </a:theme>
    `
  );
  zip.file(
    'ppt/slideLayouts/slideLayout1.xml',
    xml`
      <p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <p:cSld><p:spTree>
          <p:sp><p:nvSpPr><p:cNvPr id="1" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title" idx="1"/></p:nvPr></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="1219200" y="685800"/><a:ext cx="9753600" cy="1028700"/></a:xfrm></p:spPr>
          </p:sp>
        </p:spTree></p:cSld>
      </p:sldLayout>
    `
  );
  zip.file(
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
    relationships([['rId1', '../slideMasters/slideMaster1.xml', 'slideMaster']])
  );
  zip.file('ppt/slides/slide1.xml', slideXml());
  zip.file(
    'ppt/slides/_rels/slide1.xml.rels',
    relationships([
      ['rIdLayout', '../slideLayouts/slideLayout1.xml', 'slideLayout'],
      ['rIdImage', '../media/image1.png', 'image'],
      ['rIdChart', '../charts/chart1.xml', 'chart'],
      ['rIdNotes', '../notesSlides/notesSlide1.xml', 'notesSlide'],
      ['rIdLink', 'https://a3s.dev', 'hyperlink', 'External'],
    ])
  );
  zip.file(
    'ppt/notesSlides/notesSlide1.xml',
    xml`
      <p:notes xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <p:cSld><p:spTree><p:sp>
          <p:nvSpPr><p:cNvPr id="1" name="Notes"/><p:cNvSpPr/><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr>
          <p:txBody><a:bodyPr/><a:p><a:r><a:t>Remember the launch date.</a:t></a:r></a:p></p:txBody>
        </p:sp></p:spTree></p:cSld>
      </p:notes>
    `
  );
  zip.file(
    'ppt/charts/chart1.xml',
    xml`
      <c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <c:chart>
          <c:title><c:tx><c:rich><a:p><a:r><a:t>Adoption</a:t></a:r></a:p></c:rich></c:tx></c:title>
          <c:plotArea><c:barChart><c:barDir val="col"/><c:ser>
            <c:tx><c:strRef><c:strCache><c:pt idx="0"><c:v>Users</c:v></c:pt></c:strCache></c:strRef></c:tx>
            <c:cat><c:strRef><c:strCache>
              <c:pt idx="0"><c:v>Q1</c:v></c:pt><c:pt idx="1"><c:v>Q2</c:v></c:pt>
            </c:strCache></c:strRef></c:cat>
            <c:val><c:numRef><c:numCache>
              <c:pt idx="0"><c:v>12</c:v></c:pt><c:pt idx="1"><c:v>42</c:v></c:pt>
            </c:numCache></c:numRef></c:val>
          </c:ser></c:barChart></c:plotArea>
        </c:chart>
      </c:chartSpace>
    `
  );
  zip.file(
    'ppt/media/image1.png',
    Uint8Array.from(
      atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),
      (character) => character.charCodeAt(0)
    )
  );

  return new File([asArrayBuffer(await zip.generateAsync({ type: 'uint8array' }))], 'Quarterly Review.pptx', {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
}

function slideXml(): string {
  return xml`
    <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
      xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
      xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
      xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart">
      <p:cSld><p:spTree>
        <p:nvGrpSpPr/><p:grpSpPr/>
        <p:sp>
          <p:nvSpPr><p:cNvPr id="2" name="Title" descr="Presentation title"/><p:cNvSpPr txBox="1"/><p:nvPr><p:ph type="title" idx="1"/></p:nvPr></p:nvSpPr>
          <p:spPr><a:noFill/></p:spPr>
          <p:txBody><a:bodyPr anchor="ctr"/><a:p><a:pPr algn="ctr"/><a:r>
            <a:rPr sz="3200" b="1"><a:solidFill><a:schemeClr val="lt1"/></a:solidFill><a:latin typeface="Aptos"/><a:hlinkClick r:id="rIdLink"/></a:rPr>
            <a:t>Quarterly Review</a:t>
          </a:r></a:p></p:txBody>
        </p:sp>
        <p:pic>
          <p:nvPicPr><p:cNvPr id="3" name="A3S mark" descr="A3S mark"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
          <p:blipFill><a:blip r:embed="rIdImage"/></p:blipFill>
          <p:spPr><a:xfrm><a:off x="914400" y="2743200"/><a:ext cx="1828800" cy="1828800"/></a:xfrm></p:spPr>
        </p:pic>
        <p:graphicFrame>
          <p:nvGraphicFramePr><p:cNvPr id="4" name="Metrics table"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>
          <p:xfrm><a:off x="3657600" y="2743200"/><a:ext cx="3657600" cy="1828800"/></p:xfrm>
          <a:graphic><a:graphicData><a:tbl>
            <a:tr><a:tc><a:txBody><a:p><a:r><a:t>Metric</a:t></a:r></a:p></a:txBody></a:tc><a:tc><a:txBody><a:p><a:r><a:t>Value</a:t></a:r></a:p></a:txBody></a:tc></a:tr>
            <a:tr><a:tc><a:txBody><a:p><a:r><a:t>Adoption</a:t></a:r></a:p></a:txBody></a:tc><a:tc><a:txBody><a:p><a:r><a:t>42</a:t></a:r></a:p></a:txBody></a:tc></a:tr>
          </a:tbl></a:graphicData></a:graphic>
        </p:graphicFrame>
        <p:graphicFrame>
          <p:nvGraphicFramePr><p:cNvPr id="5" name="Adoption chart"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>
          <p:xfrm><a:off x="7620000" y="2743200"/><a:ext cx="3657600" cy="2286000"/></p:xfrm>
          <a:graphic><a:graphicData><c:chart r:id="rIdChart"/></a:graphicData></a:graphic>
        </p:graphicFrame>
        <p:grpSp>
          <p:nvGrpSpPr/><p:grpSpPr><a:xfrm><a:off x="914400" y="5029200"/><a:ext cx="2743200" cy="914400"/><a:chOff x="0" y="0"/><a:chExt cx="2743200" cy="914400"/></a:xfrm></p:grpSpPr>
          <p:sp><p:nvSpPr><p:cNvPr id="6" name="Group shape"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="2743200" cy="914400"/></a:xfrm><a:prstGeom prst="roundRect"/><a:solidFill><a:srgbClr val="ED7D31"/></a:solidFill></p:spPr>
          </p:sp>
        </p:grpSp>
        <p:cxnSp><p:nvCxnSpPr/><p:spPr><a:xfrm><a:off x="4572000" y="5486400"/><a:ext cx="2743200" cy="0"/></a:xfrm><a:ln w="25400"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln></p:spPr></p:cxnSp>
      </p:spTree></p:cSld>
      <p:transition/>
    </p:sld>
  `;
}

function relationships(items: Array<[id: string, target: string, kind: string, targetMode?: string]>): string {
  return xml`
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      ${items
        .map(
          ([id, target, kind, targetMode]) =>
            `<Relationship Id="${id}" Target="${target}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${kind}"${targetMode ? ` TargetMode="${targetMode}"` : ''}/>`
        )
        .join('')}
    </Relationships>
  `;
}

function xml(strings: TemplateStringsArray, ...values: unknown[]): string {
  return String.raw({ raw: strings }, ...values)
    .replace(/>\s+</g, '><')
    .trim();
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer;
}

async function addFrozenPane(bytes: ArrayBuffer, rows: number, columns: number): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(bytes);
  const part = zip.file('xl/worksheets/sheet1.xml');
  if (!part) throw new Error('Worksheet fixture is missing');
  const source = await part.async('text');
  const pane = `<pane xSplit="${columns}" ySplit="${rows}" topLeftCell="B2" activePane="bottomRight" state="frozen"/>`;
  const withPane = source.replace(
    '<sheetView workbookViewId="0"/>',
    `<sheetView workbookViewId="0">${pane}</sheetView>`
  );
  const validation =
    '<dataValidations count="1"><dataValidation type="list" allowBlank="1" showErrorMessage="1" showInputMessage="1" prompt="Choose status" sqref="B3"><formula1>"On track,Blocked"</formula1></dataValidation></dataValidations>';
  const pageBreaks =
    '<rowBreaks count="1" manualBreakCount="1"><brk id="2" min="0" max="16383" man="1"/></rowBreaks>' +
    '<colBreaks count="1" manualBreakCount="1"><brk id="1" min="0" max="1048575" man="1"/></colBreaks>';
  const conditionalFormatting =
    '<conditionalFormatting sqref="C3:C5"><cfRule type="colorScale" priority="2"><colorScale><cfvo type="min"/><cfvo type="max"/><color rgb="FFF8696B"/><color rgb="FF63BE7B"/></colorScale></cfRule></conditionalFormatting>' +
    '<conditionalFormatting sqref="C3"><cfRule type="cellIs" dxfId="0" priority="1" stopIfTrue="1" operator="greaterThan"><formula>40</formula></cfRule></conditionalFormatting>' +
    '<conditionalFormatting sqref="C3:C5"><cfRule type="dataBar" priority="3"><dataBar showValue="0" minLength="15" maxLength="75"><cfvo type="num" val="0"/><cfvo type="percent" val="90"/><color rgb="FF5B9BD5"/></dataBar></cfRule></conditionalFormatting>' +
    '<conditionalFormatting sqref="C3:C5"><cfRule type="iconSet" priority="4"><iconSet iconSet="3TrafficLights1" showValue="0" reverse="1"><cfvo type="min"/><cfvo type="percent" val="33"/><cfvo type="percent" val="67"/></iconSet></cfRule></conditionalFormatting>';
  const updated = withPane.replace(
    '<ignoredErrors>',
    `${conditionalFormatting}${validation}${pageBreaks}<ignoredErrors>`
  );
  if (updated === source) throw new Error('Worksheet fixture does not contain the expected sheet features');
  const stylesPart = zip.file('xl/styles.xml');
  if (!stylesPart) throw new Error('Styles fixture is missing');
  const styles = await stylesPart.async('text');
  const updatedStyles = styles.replace(
    '<dxfs count="0"/>',
    '<dxfs count="1"><dxf><font><color rgb="FFFFFFFF"/></font><fill><patternFill patternType="solid"><fgColor rgb="FFC00000"/></patternFill></fill></dxf></dxfs>'
  );
  if (updatedStyles === styles) throw new Error('Styles fixture does not contain differential formats');
  const protectedFixture = addWorksheetProtectionFixture(updated, updatedStyles);
  zip.file('xl/worksheets/sheet1.xml', protectedFixture.worksheet);
  zip.file('xl/styles.xml', protectedFixture.styles);
  return zip.generateAsync({ type: 'arraybuffer' });
}

function addWorksheetProtectionFixture(
  worksheetSource: string,
  stylesSource: string
): { worksheet: string; styles: string } {
  const worksheet = new DOMParser().parseFromString(worksheetSource, 'application/xml');
  const styles = new DOMParser().parseFromString(stylesSource, 'application/xml');
  const worksheetRoot = worksheet.documentElement;
  const namespace = worksheetRoot.namespaceURI;
  const sheetProtection = worksheet.createElementNS(namespace, 'sheetProtection');
  for (const [name, value] of Object.entries({
    sheet: '1',
    objects: '1',
    selectLockedCells: '1',
    formatCells: '0',
    autoFilter: '0',
    password: 'ABCD',
  })) {
    sheetProtection.setAttribute(name, value);
  }
  const protectedRanges = worksheet.createElementNS(namespace, 'protectedRanges');
  const publicInput = worksheet.createElementNS(namespace, 'protectedRange');
  publicInput.setAttribute('name', 'Public input');
  publicInput.setAttribute('sqref', 'B3');
  const managers = worksheet.createElementNS(namespace, 'protectedRange');
  managers.setAttribute('name', 'Managers');
  managers.setAttribute('sqref', 'C3');
  managers.setAttribute('password', '1234');
  protectedRanges.append(publicInput, managers);
  const anchor =
    Array.from(worksheetRoot.children).find((element) =>
      ['autoFilter', 'mergeCells', 'conditionalFormatting', 'dataValidations', 'ignoredErrors'].includes(
        element.localName
      )
    ) ?? null;
  worksheetRoot.insertBefore(sheetProtection, anchor);
  worksheetRoot.insertBefore(protectedRanges, anchor);

  const targetCell = Array.from(worksheet.getElementsByTagNameNS('*', 'c')).find(
    (element) => element.getAttribute('r') === 'A3'
  );
  const cellXfs = Array.from(styles.documentElement.children).find((element) => element.localName === 'cellXfs');
  if (!targetCell || !cellXfs) throw new Error('Protection fixture is missing a cell or cell formats');
  const baseStyle = Number(targetCell.getAttribute('s') ?? '0');
  const formats = Array.from(cellXfs.children).filter((element) => element.localName === 'xf');
  const format = (formats[baseStyle] ?? formats[0]).cloneNode(true) as Element;
  for (const element of Array.from(format.children).filter((child) => child.localName === 'protection')) {
    element.remove();
  }
  format.setAttribute('applyProtection', '1');
  const cellProtection = styles.createElementNS(styles.documentElement.namespaceURI, 'protection');
  cellProtection.setAttribute('locked', '0');
  format.append(cellProtection);
  targetCell.setAttribute('s', String(formats.length));
  cellXfs.append(format);
  cellXfs.setAttribute('count', String(formats.length + 1));

  return {
    worksheet: new XMLSerializer().serializeToString(worksheet),
    styles: new XMLSerializer().serializeToString(styles),
  };
}

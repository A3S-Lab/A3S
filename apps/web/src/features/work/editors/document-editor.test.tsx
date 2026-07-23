import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceContextMenu } from '../../workspace/components/workspace-context-menu';
import { documentSections } from '../work-document-section';
import type { WorkDocumentContent } from '../work-types';
import { DocumentEditor, documentAgentMenuItems, documentEditorSelectionText } from './document-editor';

describe('Work document editor', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('keeps imported tables, images, and links editable', async () => {
    const onChange = vi.fn();
    render(
      <DocumentEditor
        content={{
          type: 'document',
          pageSize: 'a4',
          html: [
            '<p><a href="https://a3s.dev">A3S</a></p>',
            '<table><tbody><tr><th>Feature</th><th>Status</th></tr><tr><td>PDF</td><td>Ready</td></tr></tbody></table>',
            '<p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=" alt="A3S mark"></p>',
          ].join(''),
        }}
        preview={false}
        onChange={onChange}
      />
    );

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
    expect(screen.getByRole('textbox', { name: '文档正文' })).toHaveAttribute('spellcheck', 'true');
    expect(screen.getByRole('textbox', { name: '文档正文' })).toHaveAttribute('aria-multiline', 'true');
    expect(screen.getByRole('link', { name: 'A3S' })).toHaveAttribute('href', 'https://a3s.dev');
    expect(screen.getByAltText('A3S mark')).toBeInTheDocument();

    openRibbonTab('插入');
    fireEvent.click(screen.getByRole('button', { name: '插入表格' }));
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('<table'),
        })
      );
    });
  });

  it('organizes document commands into a tabbed ribbon', async () => {
    render(
      <DocumentEditor
        content={{
          type: 'document',
          pageSize: 'a4',
          html: '<p>Ribbon workflow</p>',
        }}
        preview={false}
        onChange={vi.fn()}
      />
    );

    await waitFor(() => expect(screen.getByText('Ribbon workflow')).toBeInTheDocument());
    expect(screen.getByRole('tablist', { name: '文字功能区' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      '开始',
      '插入',
      '页面布局',
      '引用',
      '审阅',
      '视图',
    ]);
    expect(screen.getByRole('tab', { name: '开始' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: '加粗' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '插入图片' })).not.toBeInTheDocument();

    openRibbonTab('插入');
    expect(screen.getByRole('tab', { name: '插入' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: '插入图片' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '加粗' })).not.toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('tab', { name: '插入' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: '页面布局' })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(screen.getByRole('tab', { name: '页面布局' })).toHaveFocus());

    openRibbonTab('审阅');
    expect(screen.getByRole('button', { name: '修订模式' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '拼写检查' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps the file menu available without exposing editing commands in preview', async () => {
    const print = vi.fn();
    render(
      <DocumentEditor
        content={{ type: 'document', pageSize: 'a4', html: '<p>Preview workflow</p>' }}
        preview
        fileActions={[{ id: 'print', label: '打印', onSelect: print }]}
        onChange={vi.fn()}
      />
    );

    expect(await screen.findByRole('region', { name: '文字预览工具' })).toHaveTextContent('只读预览1 页');
    expect(screen.queryByRole('tablist', { name: '文字功能区' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '文件' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: '打印' }));

    expect(print).toHaveBeenCalledTimes(1);
  });

  it('routes document find, replace, and page-break shortcuts inside the editor', async () => {
    const onChange = vi.fn();
    render(
      <DocumentEditor
        content={{
          type: 'document',
          pageSize: 'a4',
          html: '<p>Shortcut workflow</p>',
        }}
        preview={false}
        onChange={onChange}
      />
    );
    const editor = await screen.findByRole('textbox', { name: '文档正文' });

    expect(fireEvent.keyDown(editor, { key: 'f', ctrlKey: true })).toBe(false);
    expect(screen.getByRole('dialog', { name: '查找文字' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '取消' }));

    expect(fireEvent.keyDown(editor, { key: 'h', ctrlKey: true })).toBe(false);
    expect(screen.getByRole('dialog', { name: '查找要替换的文字' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '取消' }));

    expect(fireEvent.keyDown(editor, { key: 'k', ctrlKey: true })).toBe(false);
    expect(screen.getByRole('dialog', { name: '链接地址' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '取消' }));

    expect(fireEvent.keyDown(editor, { key: 'Enter', ctrlKey: true })).toBe(false);
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ html: expect.stringContaining('data-page-break="true"') })
      )
    );
  });

  it('supports formatting shortcuts with either platform command modifier', async () => {
    render(
      <DocumentEditor
        content={{
          type: 'document',
          pageSize: 'a4',
          html: '<p>Formatting shortcut</p>',
        }}
        preview={false}
        onChange={vi.fn()}
      />
    );
    const editor = await screen.findByRole('textbox', { name: '文档正文' });

    expect(fireEvent.keyDown(editor, { key: 'b', metaKey: true })).toBe(false);
    expect(fireEvent.keyDown(editor, { key: 'i', metaKey: true })).toBe(false);
    expect(fireEvent.keyDown(editor, { key: 'u', metaKey: true })).toBe(false);
    expect(fireEvent.keyDown(editor, { key: 'b', ctrlKey: true })).toBe(false);
    expect(fireEvent.keyDown(editor, { key: 'i', ctrlKey: true })).toBe(false);
    expect(fireEvent.keyDown(editor, { key: 'u', ctrlKey: true })).toBe(false);
    expect(fireEvent.keyDown(editor, { key: 'z', ctrlKey: true })).toBe(false);
    expect(fireEvent.keyDown(editor, { key: 'z', ctrlKey: true, shiftKey: true })).toBe(false);
    expect(fireEvent.keyDown(editor, { key: 'y', ctrlKey: true })).toBe(false);
  });

  it('does not restart document shortcuts from inside an Office dialog', async () => {
    render(
      <DocumentEditor
        content={{
          type: 'document',
          pageSize: 'a4',
          html: '<p>Shortcut workflow</p>',
        }}
        preview={false}
        onChange={vi.fn()}
      />
    );
    const editor = await screen.findByRole('textbox', { name: '文档正文' });
    fireEvent.keyDown(editor, { key: 'f', ctrlKey: true });
    const query = screen.getByRole('textbox', { name: '查找文字' });
    fireEvent.change(query, { target: { value: 'Shortcut' } });

    expect(fireEvent.keyDown(query, { key: 'f', ctrlKey: true })).toBe(false);

    expect(screen.getByRole('textbox', { name: '查找文字' })).toHaveValue('Shortcut');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('keeps focus in the replacement prompt and applies the replacement', async () => {
    const onChange = vi.fn();
    render(
      <DocumentEditor
        content={{
          type: 'document',
          pageSize: 'a4',
          html: '<p>Shortcut workflow</p>',
        }}
        preview={false}
        onChange={onChange}
      />
    );
    const editor = await screen.findByRole('textbox', { name: '文档正文' });

    fireEvent.keyDown(editor, { key: 'h', ctrlKey: true });
    const query = screen.getByRole('textbox', { name: '查找要替换的文字' });
    fireEvent.change(query, { target: { value: 'Shortcut' } });
    fireEvent.click(screen.getByRole('button', { name: '确定' }));

    const replacement = await screen.findByRole('textbox', { name: '替换为' });
    await waitFor(() => expect(replacement).toHaveFocus());
    fireEvent.change(replacement, { target: { value: 'Keyboard' } });
    fireEvent.click(screen.getByRole('button', { name: '确定' }));

    await waitFor(() =>
      expect(onChange.mock.calls.some(([next]) => next.html.includes('Keyboard workflow'))).toBe(true)
    );
    await waitFor(() => expect(editor).toHaveFocus());
  });

  it('provides live page, word, proofing, save, view, and zoom status', async () => {
    render(
      <DocumentEditor
        content={{
          type: 'document',
          pageSize: 'a4',
          html: '<p>Alpha beta 中文</p><div data-page-break="true"></div><p>Second page</p>',
        }}
        preview={false}
        saveStatus='已保存到 A3S'
        onChange={vi.fn()}
      />
    );

    await waitFor(() => expect(screen.getByText('Alpha beta 中文')).toBeInTheDocument());
    expect(screen.getByLabelText('页码状态')).toHaveTextContent('第 1 页，共 2 页');
    expect(screen.getByLabelText('字数统计')).toHaveTextContent('字数：6');
    expect(screen.getByLabelText('文档保存状态')).toHaveTextContent('已保存到 A3S');

    const textbox = screen.getByRole('textbox', { name: '文档正文' });
    expect(textbox).toHaveAttribute('spellcheck', 'true');
    fireEvent.click(screen.getByRole('button', { name: '校对：已开启' }));
    expect(textbox).toHaveAttribute('spellcheck', 'false');
    expect(screen.getByRole('button', { name: '校对：已关闭' })).toHaveAttribute('aria-pressed', 'false');

    const pageStage = screen.getByTestId('document-page-stage');
    expect(pageStage).toHaveStyle({ '--work-document-zoom': '0.9' });
    fireEvent.click(screen.getByRole('button', { name: '放大文档' }));
    expect(screen.getByLabelText('文档缩放比例')).toHaveTextContent('100%');
    expect(pageStage).toHaveStyle({ '--work-document-zoom': '1' });
    for (let step = 0; step < 5; step += 1) {
      fireEvent.keyDown(screen.getByRole('slider', { name: '文档缩放' }), { key: 'ArrowRight' });
    }
    expect(screen.getByLabelText('文档缩放比例')).toHaveTextContent('125%');
    expect(pageStage).toHaveStyle({ '--work-document-zoom': '1.25' });

    fireEvent.click(screen.getByRole('button', { name: '网页视图' }));
    expect(screen.getByRole('button', { name: '网页视图' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('文档内容编辑区域')).toHaveClass('web');
  });

  it('does not reconfigure the editor for a view-only state change', async () => {
    const setOptions = vi.spyOn(Editor.prototype, 'setOptions');
    render(
      <DocumentEditor
        content={{ type: 'document', pageSize: 'a4', html: '<p>Stable editor</p>' }}
        preview={false}
        onChange={vi.fn()}
      />
    );
    await waitFor(() => expect(screen.getByText('Stable editor')).toBeInTheDocument());
    setOptions.mockClear();

    fireEvent.click(screen.getByRole('button', { name: '放大文档' }));

    expect(screen.getByLabelText('文档缩放比例')).toHaveTextContent('100%');
    expect(setOptions).not.toHaveBeenCalled();
  });

  it('applies content replaced outside the editor without reporting another edit', async () => {
    const onChange = vi.fn();
    function Harness() {
      const [content, setContent] = useState<WorkDocumentContent>({
        type: 'document',
        pageSize: 'a4',
        html: '<p>Before restore</p>',
      });
      return (
        <>
          <button type='button' onClick={() => setContent({ ...content, html: '<p>After restore</p>' })}>
            恢复外部版本
          </button>
          <DocumentEditor content={content} preview={false} onChange={onChange} />
        </>
      );
    }
    render(<Harness />);
    await waitFor(() => expect(screen.getByText('Before restore')).toBeInTheDocument());
    onChange.mockClear();

    fireEvent.click(screen.getByRole('button', { name: '恢复外部版本' }));

    await waitFor(() => expect(screen.getByText('After restore')).toBeInTheDocument());
    expect(screen.queryByText('Before restore')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('edits page setup and inserts explicit page breaks', async () => {
    const onChange = vi.fn();
    const initial: WorkDocumentContent = {
      type: 'document',
      pageSize: 'a4',
      html: '<p>First page</p>',
    };
    function Harness() {
      const [content, setContent] = useState(initial);
      return (
        <DocumentEditor
          content={content}
          preview={false}
          onChange={(next) => {
            onChange(next);
            setContent(next);
          }}
        />
      );
    }

    render(<Harness />);
    await waitFor(() => expect(screen.getByText('First page')).toBeInTheDocument());
    openRibbonTab('页面布局');
    fireEvent.click(screen.getByRole('button', { name: '页面设置' }));
    chooseOfficeOption('纸张大小', 'Letter');
    chooseOfficeOption('页面方向', '横向');
    fireEvent.change(screen.getByLabelText('上页边距'), { target: { value: '30' } });
    const defaultHeader = screen.getByRole('textbox', { name: '默认页页眉' });
    defaultHeader.innerHTML = '<p>A3S Work</p>';
    fireEvent.input(defaultHeader);
    const defaultFooter = screen.getByRole('textbox', { name: '默认页页脚' });
    defaultFooter.innerHTML = '<p>Internal</p>';
    fireEvent.input(defaultFooter);
    fireEvent.click(screen.getByRole('checkbox', { name: '默认页显示页码' }));
    fireEvent.change(screen.getByLabelText('起始页码'), { target: { value: '4' } });

    expect(screen.getByLabelText('文字页面')).toHaveClass('letter', 'landscape');
    expect(screen.getAllByText('A3S Work')).not.toHaveLength(0);
    expect(screen.getAllByText('Internal')).not.toHaveLength(0);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        pageSize: 'letter',
        orientation: 'landscape',
        margins: expect.objectContaining({ top: 30 }),
        headerText: 'A3S Work',
        footerText: 'Internal',
        showPageNumbers: true,
        pageNumberStart: 4,
      })
    );

    fireEvent.click(screen.getByRole('button', { name: '插入分页符' }));
    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('data-page-break'),
        })
      );
      expect(screen.getByLabelText('页码状态')).toHaveTextContent('共 2 页');
    });
  });

  it('closes page setup after leaving the page-layout ribbon tab', async () => {
    render(
      <DocumentEditor
        content={{ type: 'document', pageSize: 'a4', html: '<p>正文</p>' }}
        preview={false}
        onChange={vi.fn()}
      />
    );
    await waitFor(() => expect(screen.getByRole('textbox', { name: '文档正文' })).toHaveTextContent('正文'));
    openRibbonTab('页面布局');
    fireEvent.click(screen.getByRole('button', { name: '页面设置' }));
    expect(screen.getByRole('combobox', { name: '纸张大小' })).toBeInTheDocument();

    openRibbonTab('引用');

    expect(screen.queryByRole('combobox', { name: '纸张大小' })).not.toBeInTheDocument();
  });

  it('creates editable sections with independent columns and page layout', async () => {
    const onChange = vi.fn();
    const initial: WorkDocumentContent = {
      type: 'document',
      pageSize: 'a4',
      html: '<p>First section</p><p>Move this block into the next section</p>',
    };
    function Harness() {
      const [content, setContent] = useState(initial);
      return (
        <DocumentEditor
          content={content}
          preview={false}
          onChange={(next) => {
            onChange(next);
            setContent(next);
          }}
        />
      );
    }

    render(<Harness />);
    await waitFor(() => expect(screen.getByText('First section')).toBeInTheDocument());
    openRibbonTab('页面布局');
    fireEvent.click(screen.getByRole('button', { name: '页面设置' }));
    fireEvent.change(screen.getByLabelText('分栏数量'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('分栏间距'), { target: { value: '9.5' } });
    fireEvent.click(screen.getByRole('checkbox', { name: '分栏分隔线' }));
    chooseOfficeOption('分节方式', '连续');
    fireEvent.click(screen.getByRole('button', { name: '插入分节符' }));

    await waitFor(() => expect(screen.getByLabelText('分节状态')).toHaveTextContent('共 2 节'));
    let latest = onChange.mock.lastCall?.[0] as WorkDocumentContent;
    let sections = documentSections(latest);
    expect(sections).toHaveLength(2);
    expect(sections[0].layout).toMatchObject({
      columns: { count: 2, spacing: 9.5, separator: true },
      breakAfter: 'continuous',
    });
    expect(sections[0].html).toContain('First section');
    expect(sections[1].html).toContain('Move this block into the next section');

    chooseOfficeOption('页面方向', '横向');
    await waitFor(() => {
      latest = onChange.mock.lastCall?.[0] as WorkDocumentContent;
      sections = documentSections(latest);
      expect(sections[1].layout.orientation).toBe('landscape');
    });

    fireEvent.click(screen.getByRole('button', { name: '与上一节合并' }));
    await waitFor(() => expect(screen.getByLabelText('分节状态')).toHaveTextContent('共 1 节'));
    latest = onChange.mock.lastCall?.[0] as WorkDocumentContent;
    sections = documentSections(latest);
    expect(sections).toHaveLength(1);
    expect(sections[0].html).toContain('First section');
    expect(sections[0].html).toContain('Move this block into the next section');
  });

  it('edits proportional widths and gaps for unequal columns', async () => {
    const onChange = vi.fn();
    const initial: WorkDocumentContent = {
      type: 'document',
      pageSize: 'a4',
      html: '<p>Unequal columns</p><p>Second block</p>',
    };
    function Harness() {
      const [content, setContent] = useState(initial);
      return (
        <DocumentEditor
          content={content}
          preview={false}
          onChange={(next) => {
            onChange(next);
            setContent(next);
          }}
        />
      );
    }

    render(<Harness />);
    await waitFor(() => expect(screen.getByText('Unequal columns')).toBeInTheDocument());
    openRibbonTab('页面布局');
    fireEvent.click(screen.getByRole('button', { name: '页面设置' }));
    fireEvent.change(screen.getByLabelText('分栏数量'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('checkbox', { name: '自定义栏宽' }));
    fireEvent.change(screen.getByLabelText('第 1 栏宽度百分比'), { target: { value: '65' } });
    fireEvent.change(screen.getByLabelText('第 1 栏后间距'), { target: { value: '8' } });

    await waitFor(() => {
      const latest = onChange.mock.lastCall?.[0] as WorkDocumentContent;
      expect(documentSections(latest)[0].layout.columns).toMatchObject({
        count: 2,
        custom: [
          { widthPercent: 65, spacing: 8 },
          { widthPercent: 35, spacing: 0 },
        ],
      });
    });
  });

  it('inserts an editable footnote reference and note body', async () => {
    const onChange = vi.fn();
    render(
      <DocumentEditor
        content={{
          type: 'document',
          pageSize: 'a4',
          html: '<p>Statement requiring a source</p>',
        }}
        preview={false}
        onChange={onChange}
      />
    );

    await waitFor(() => expect(screen.getByText('Statement requiring a source')).toBeInTheDocument());
    openRibbonTab('引用');
    fireEvent.click(screen.getByRole('button', { name: '插入脚注' }));

    await waitFor(() => {
      const latest = onChange.mock.lastCall?.[0] as WorkDocumentContent;
      expect(latest.html).toContain('data-document-note-reference');
      expect(latest.html).toContain('data-document-note');
      expect(latest.html).toContain('data-note-kind="footnote"');
    });
    expect(document.querySelector('[data-document-note-reference]')).toHaveTextContent('1');
    expect(document.querySelector('[data-document-note]')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  it('inserts numbered captions and live cross-references', async () => {
    const onChange = vi.fn();
    const initial: WorkDocumentContent = {
      type: 'document',
      pageSize: 'a4',
      html: '<p>Caption workflow</p>',
    };
    function Harness() {
      const [content, setContent] = useState(initial);
      return (
        <DocumentEditor
          content={content}
          preview={false}
          onChange={(next) => {
            onChange(next);
            setContent(next);
          }}
        />
      );
    }

    render(<Harness />);
    await waitFor(() => expect(screen.getByText('Caption workflow')).toBeInTheDocument());
    openRibbonTab('引用');
    fireEvent.click(screen.getByRole('button', { name: '插入图片题注' }));
    fireEvent.change(await screen.findByRole('textbox', { name: '图片题注文字' }), {
      target: { value: 'Architecture' },
    });
    fireEvent.click(screen.getByRole('button', { name: '插入题注' }));
    await waitFor(() => {
      const latest = onChange.mock.lastCall?.[0] as WorkDocumentContent;
      expect(latest.html).toContain('data-document-caption');
      expect(latest.html).toContain('Architecture');
      expect(latest.html).toContain('data-caption-number="1"');
    });

    fireEvent.click(screen.getByRole('button', { name: '插入交叉引用' }));
    expect(await screen.findByRole('textbox', { name: '引用题注' })).toHaveValue('图 1');
    fireEvent.click(screen.getByRole('button', { name: '插入引用' }));
    await waitFor(() => {
      const latest = onChange.mock.lastCall?.[0] as WorkDocumentContent;
      expect(latest.html).toContain('data-document-cross-reference');
      expect(latest.html).toContain('图 1');
    });
  });

  it('inserts and refreshes live document body fields', async () => {
    const onChange = vi.fn();
    const initial: WorkDocumentContent = {
      type: 'document',
      pageSize: 'a4',
      html: '<p>Field workflow</p>',
    };
    function Harness() {
      const [content, setContent] = useState(initial);
      return (
        <DocumentEditor
          content={content}
          preview={false}
          onChange={(next) => {
            onChange(next);
            setContent(next);
          }}
        />
      );
    }

    render(<Harness />);
    await waitFor(() => expect(screen.getByText('Field workflow')).toBeInTheDocument());
    openRibbonTab('插入');
    chooseOfficeOption('插入页码或日期', '总页数');

    await waitFor(() => {
      const latest = onChange.mock.lastCall?.[0] as WorkDocumentContent;
      expect(latest.html).toContain('data-document-field');
      expect(latest.html).toContain('data-field-kind="numPages"');
      expect(latest.html).toContain('data-field-instruction="NUMPAGES"');
    });
    expect(document.querySelector('[data-document-field]')).toHaveTextContent('1');

    openRibbonTab('引用');
    fireEvent.click(screen.getByRole('button', { name: '更新页码和日期' }));
    expect(screen.getByRole('textbox', { name: '文档正文' })).toHaveFocus();
  });

  it('manages bibliography sources and inserts live citations', async () => {
    const onChange = vi.fn();
    const initial: WorkDocumentContent = {
      type: 'document',
      pageSize: 'a4',
      html: '<p>Citation workflow</p>',
    };
    function Harness() {
      const [content, setContent] = useState(initial);
      return (
        <DocumentEditor
          content={content}
          preview={false}
          onChange={(next) => {
            onChange(next);
            setContent(next);
          }}
        />
      );
    }

    render(<Harness />);
    await waitFor(() => expect(screen.getByText('Citation workflow')).toBeInTheDocument());
    openRibbonTab('引用');
    fireEvent.click(screen.getByRole('button', { name: '引用来源' }));
    fireEvent.change(screen.getByLabelText('引用标记'), {
      target: { value: 'Smith2026' },
    });
    fireEvent.change(screen.getByLabelText('文献标题'), {
      target: { value: 'Agent-Native Office Systems' },
    });
    fireEvent.change(screen.getByLabelText('文献年份'), {
      target: { value: '2026' },
    });
    fireEvent.change(screen.getByLabelText('个人作者'), {
      target: { value: 'Smith, Jane' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存文献源' }));

    await waitFor(() => {
      const latest = onChange.mock.lastCall?.[0] as WorkDocumentContent;
      expect(latest.bibliography?.sources[0]).toMatchObject({
        tag: 'Smith2026',
        title: 'Agent-Native Office Systems',
        year: '2026',
      });
    });
    fireEvent.click(screen.getByRole('button', { name: '插入引文' }));
    await waitFor(() => {
      const latest = onChange.mock.lastCall?.[0] as WorkDocumentContent;
      expect(latest.html).toContain('data-document-citation');
      expect(latest.html).toContain('data-citation-tags="Smith2026"');
      expect(latest.html).toContain('(Smith, 2026)');
    });

    fireEvent.click(screen.getByRole('button', { name: '插入参考文献' }));
    await waitFor(() => {
      const latest = onChange.mock.lastCall?.[0] as WorkDocumentContent;
      expect(latest.html).toContain('data-document-bibliography');
      expect(latest.html).toContain('Agent-Native Office Systems');
    });
    expect(screen.getByLabelText('引用状态')).toHaveTextContent('1 条文献 · 1 处引文');

    fireEvent.change(screen.getByLabelText('引用标记'), {
      target: { value: 'Smith2027' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存文献源' }));
    await waitFor(() => {
      const latest = onChange.mock.lastCall?.[0] as WorkDocumentContent;
      expect(latest.bibliography?.sources[0]?.tag).toBe('Smith2027');
      expect(latest.html).toContain('data-citation-tags="Smith2027"');
      expect(latest.html).toContain('CITATION Smith2027');
      expect(latest.html).not.toContain('data-citation-tags="Smith2026"');
    });
  });

  it('edits rich first-page and even-page headers and footers independently', async () => {
    const onChange = vi.fn();
    const initial: WorkDocumentContent = {
      type: 'document',
      pageSize: 'a4',
      html: '<p>Rich page chrome</p>',
    };
    function Harness() {
      const [content, setContent] = useState(initial);
      return (
        <DocumentEditor
          content={content}
          preview={false}
          onChange={(next) => {
            onChange(next);
            setContent(next);
          }}
        />
      );
    }
    render(<Harness />);

    await waitFor(() => expect(screen.getByText('Rich page chrome')).toBeInTheDocument());
    openRibbonTab('页面布局');
    fireEvent.click(screen.getByRole('button', { name: '页面设置' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '首页页眉页脚不同' }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: '首页页眉页脚不同' })).toBeChecked());
    fireEvent.click(screen.getByRole('checkbox', { name: '奇偶页页眉页脚不同' }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: '奇偶页页眉页脚不同' })).toBeChecked());
    chooseOfficeOption('页眉页脚页面类型', '首页');

    const firstHeader = screen.getByRole('textbox', { name: '首页页眉' });
    firstHeader.innerHTML = '<p><strong>Executive report</strong></p>';
    fireEvent.input(firstHeader);
    const firstFooter = screen.getByRole('textbox', { name: '首页页脚' });
    firstFooter.innerHTML = '<p><em>Confidential</em></p>';
    fireEvent.input(firstFooter);

    await waitFor(() => {
      const latest = onChange.mock.lastCall?.[0] as WorkDocumentContent;
      const pageChrome = documentSections(latest)[0].layout.pageChrome;
      expect(pageChrome).toMatchObject({
        differentFirstPage: true,
        differentOddEvenPages: true,
      });
      expect(pageChrome?.first.headerHtml).toContain('<strong>Executive report</strong>');
      expect(pageChrome?.first.footerHtml).toContain('<em>Confidential</em>');
    });
  });

  it('reviews imported tracked changes and persists the revision-mode setting', async () => {
    const onChange = vi.fn();
    const initial: WorkDocumentContent = {
      type: 'document',
      pageSize: 'a4',
      trackChanges: true,
      html: [
        '<p>Keep ',
        '<ins data-document-change="true" data-change-kind="insertion" data-change-id="add-ui"',
        ' data-change-author="Alice" data-change-date="2026-07-20T00:00:00.000Z">added</ins>',
        ' and ',
        '<del data-document-change="true" data-change-kind="deletion" data-change-id="del-ui"',
        ' data-change-author="Bob" data-change-date="2026-07-19T00:00:00.000Z">removed</del>',
        '.</p>',
      ].join(''),
    };
    function Harness() {
      const [content, setContent] = useState(initial);
      return (
        <DocumentEditor
          content={content}
          preview={false}
          onChange={(next) => {
            onChange(next);
            setContent(next);
          }}
        />
      );
    }

    render(<Harness />);
    await waitFor(() => expect(screen.getByText('added')).toBeInTheDocument());
    openRibbonTab('审阅');
    expect(screen.getByRole('button', { name: '修订模式' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: '查看修订（2）' }));
    expect(screen.getByRole('region', { name: '修订审阅' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '接受修订 1' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '拒绝修订 1' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '拒绝修订 1' }));

    await waitFor(() => {
      const latest = onChange.mock.lastCall?.[0] as WorkDocumentContent;
      expect(latest.html).toContain('Keep added and removed.');
      expect(latest.html).not.toContain('data-document-change');
    });

    fireEvent.click(screen.getByRole('button', { name: '修订模式' }));
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ trackChanges: false })));
  });

  it('reviews, replies to, resolves, and deletes imported document comments', async () => {
    const onChange = vi.fn();
    const initial: WorkDocumentContent = {
      type: 'document',
      pageSize: 'a4',
      html: '<p>Review <span data-document-comment="true" data-comment-id="comment-ui">this claim</span>.</p>',
      comments: [
        {
          id: 'comment-ui',
          author: 'Alice',
          date: '2026-07-20T00:00:00.000Z',
          text: 'Please verify the source.',
          resolved: false,
        },
      ],
    };
    function Harness() {
      const [content, setContent] = useState(initial);
      return (
        <DocumentEditor
          content={content}
          preview={false}
          onChange={(next) => {
            onChange(next);
            setContent(next);
          }}
        />
      );
    }

    render(<Harness />);
    await waitFor(() => expect(screen.getByText('this claim')).toBeInTheDocument());
    openRibbonTab('审阅');
    fireEvent.click(screen.getByRole('button', { name: '查看批注（1）' }));
    expect(screen.getByRole('region', { name: '批注审阅' })).toHaveTextContent('Please verify the source.');

    fireEvent.change(screen.getByLabelText('回复批注 1'), { target: { value: 'Verified.' } });
    fireEvent.click(screen.getByRole('button', { name: '发送回复 1' }));
    await waitFor(() => {
      const latest = onChange.mock.lastCall?.[0] as WorkDocumentContent;
      expect(latest.comments?.[0].replies?.[0]).toMatchObject({ text: 'Verified.' });
    });

    fireEvent.click(screen.getByRole('button', { name: '解决批注 1' }));
    await waitFor(() => {
      const latest = onChange.mock.lastCall?.[0] as WorkDocumentContent;
      expect(latest.comments?.[0].resolved).toBe(true);
    });

    fireEvent.click(screen.getByRole('button', { name: '删除批注 1' }));
    await waitFor(() => {
      const latest = onChange.mock.lastCall?.[0] as WorkDocumentContent;
      expect(latest.comments).toEqual([]);
      expect(latest.html).not.toContain('data-document-comment');
    });
  });

  it('extracts the exact TipTap selection and exposes contextual AI actions', () => {
    const textBetween = vi.fn(() => ' Selected paragraph ');
    expect(
      documentEditorSelectionText({
        state: {
          selection: { from: 3, to: 21, empty: false },
          doc: { textBetween },
        },
      } as never)
    ).toBe('Selected paragraph');
    expect(textBetween).toHaveBeenCalledWith(3, 21, '\n');

    const onAgentRequest = vi.fn();
    const applyProposal = vi.fn(() => ({ appliedTargetIds: [], conflicts: [] }));
    render(
      <WorkspaceContextMenu
        label='选中文本 AI 操作'
        x={20}
        y={20}
        items={documentAgentMenuItems('Selected paragraph', onAgentRequest, {
          target: { id: 'document-selection', label: '选中文本', before: 'Selected paragraph' },
          apply: applyProposal,
        })}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByRole('menuitem', { name: '总结选中内容' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '改写得更清晰' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '翻译选中内容' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: '询问 AI 助手' }));
    expect(onAgentRequest).toHaveBeenCalledWith({
      instruction: expect.stringContaining('问题'),
      selection: 'Selected paragraph',
    });

    onAgentRequest.mockClear();
    fireEvent.click(screen.getByRole('menuitem', { name: '改写得更清晰' }));
    expect(onAgentRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        selection: 'Selected paragraph',
        proposal: expect.objectContaining({
          title: '审阅文字改写',
          targets: [{ id: 'document-selection', label: '选中文本', before: 'Selected paragraph' }],
          apply: applyProposal,
        }),
      })
    );
  });
});

function openRibbonTab(name: string) {
  fireEvent.click(screen.getByRole('tab', { name }));
}

function chooseOfficeOption(label: string, option: string) {
  fireEvent.click(screen.getByRole('combobox', { name: label }));
  fireEvent.click(screen.getByRole('option', { name: option }));
}

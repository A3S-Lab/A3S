import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearPresentationClipboard } from '../work-presentation-clipboard';
import { createWorkArtifact } from '../work-templates';
import type { WorkPresentationContent } from '../work-types';
import { PresentationEditor } from './presentation-editor';

describe('Work presentation editor transitions', () => {
  afterEach(() => {
    cleanup();
    clearPresentationClipboard();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('uses the presentation ribbon and shared view, save, and zoom status controls', async () => {
    const artifact = createWorkArtifact('strategy-deck');
    if (artifact.content.type !== 'presentation') return;

    render(
      <PresentationEditor content={artifact.content} preview={false} saveStatus='已保存到 A3S' onChange={vi.fn()} />
    );

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      '开始',
      '插入',
      '设计',
      '切换',
      '幻灯片放映',
      '审阅',
      '视图',
    ]);

    fireEvent.click(screen.getByRole('tab', { name: '插入' }));
    expect(screen.getByRole('button', { name: '图表' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '切换' }));
    expect(screen.getByLabelText('幻灯片切换效果')).toBeInTheDocument();

    expect(screen.getByLabelText('演示保存状态')).toHaveTextContent('已保存到 A3S');
    expect(screen.getByLabelText('演示缩放比例')).toHaveTextContent('90%');
    fireEvent.click(screen.getByRole('button', { name: '幻灯片浏览视图' }));
    expect(screen.getByRole('region', { name: '幻灯片浏览视图' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '放大演示文稿' }));
    await waitFor(() => expect(screen.getByLabelText('演示缩放比例')).toHaveTextContent('100%'));
  });

  it('edits a slide transition and can apply it to every slide', async () => {
    const artifact = createWorkArtifact('strategy-deck');
    if (artifact.content.type !== 'presentation') return;
    const onChange = vi.fn();
    render(<PresentationHarness initial={artifact.content} onChange={onChange} />);

    fireEvent.click(screen.getByRole('tab', { name: '切换' }));
    chooseOfficeOption('幻灯片切换效果', '推进');
    chooseOfficeOption('切换方向', '向右');
    chooseOfficeOption('切换速度', '慢速');
    fireEvent.click(screen.getByLabelText('单击鼠标后换片'));
    fireEvent.click(screen.getByLabelText('自动换片'));
    fireEvent.change(screen.getByLabelText('自动换片秒数'), { target: { value: '3' } });

    await waitFor(() => {
      expect(onChange.mock.lastCall?.[0].slides[0].transition).toEqual({
        type: 'push',
        speed: 'slow',
        direction: 'right',
        advanceOnClick: false,
        advanceAfterMs: 3000,
      });
    });

    fireEvent.click(screen.getByRole('button', { name: '应用切换效果到全部幻灯片' }));
    await waitFor(() => {
      expect(onChange.mock.lastCall?.[0].slides.map((slide: { transition?: unknown }) => slide.transition)).toEqual(
        Array.from({ length: 3 }, () => ({
          type: 'push',
          speed: 'slow',
          direction: 'right',
          advanceOnClick: false,
          advanceAfterMs: 3000,
        }))
      );
    });
  });

  it('replays the incoming slide transition in presentation preview', () => {
    const artifact = createWorkArtifact('strategy-deck');
    if (artifact.content.type !== 'presentation') return;
    artifact.content.slides[1].transition = {
      type: 'wipe',
      speed: 'slow',
      direction: 'right',
      advanceOnClick: true,
    };

    const { container } = render(<PresentationEditor content={artifact.content} preview onChange={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: '下一张' }));

    const transitionLayer = container.querySelector<HTMLElement>('[data-slide-transition="wipe"]');
    expect(transitionLayer).toHaveAttribute('data-transition-direction', 'right');
    expect(transitionLayer).toHaveAttribute('data-transition-speed', 'slow');
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('keeps the file menu available without exposing editing commands in preview', async () => {
    const artifact = createWorkArtifact('strategy-deck');
    if (artifact.content.type !== 'presentation') return;
    const print = vi.fn();
    render(
      <PresentationEditor
        content={artifact.content}
        preview
        fileActions={[{ id: 'print', label: '打印', onSelect: print }]}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole('region', { name: '演示预览工具' })).toHaveTextContent('只读预览3 张幻灯片');
    expect(screen.queryByRole('tablist', { name: '演示功能区' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '文件' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: '打印' }));

    expect(print).toHaveBeenCalledTimes(1);
  });

  it('advances automatically when the current slide has a timed advance', () => {
    vi.useFakeTimers();
    const artifact = createWorkArtifact('strategy-deck');
    if (artifact.content.type !== 'presentation') return;
    artifact.content.slides[0].transition = {
      type: 'fade',
      speed: 'fast',
      advanceOnClick: true,
      advanceAfterMs: 1000,
    };

    render(<PresentationEditor content={artifact.content} preview onChange={() => undefined} />);
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('shows the current notes, next slide, and elapsed time in presenter view', () => {
    vi.useFakeTimers();
    const artifact = createWorkArtifact('strategy-deck');
    if (artifact.content.type !== 'presentation') return;
    artifact.content.slides[0].notes = '先说明本次汇报的业务背景。';
    artifact.content.slides[1].notes = '强调核心判断背后的证据。';

    render(<PresentationEditor content={artifact.content} preview onChange={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: '演讲者视图' }));

    expect(screen.getByRole('region', { name: '演讲者视图' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '当前幻灯片' })).toHaveTextContent('封面');
    expect(screen.getByRole('region', { name: '下一张幻灯片' })).toHaveTextContent('核心判断');
    expect(screen.getByRole('complementary', { name: '演讲者备注' })).toHaveTextContent('先说明本次汇报的业务背景。');

    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByText('00:02')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '演讲者下一张' }));
    expect(screen.getByRole('complementary', { name: '演讲者备注' })).toHaveTextContent('强调核心判断背后的证据。');
  });

  it('prepares a review-only Copilot draft for the selected slide element', () => {
    const artifact = createWorkArtifact('strategy-deck');
    if (artifact.content.type !== 'presentation') return;
    artifact.content.slides[0].elements[0].text = 'A3S Work 发布计划';
    const onAgentRequest = vi.fn();

    render(
      <PresentationEditor
        content={artifact.content}
        preview={false}
        onChange={vi.fn()}
        onAgentRequest={onAgentRequest}
      />
    );
    fireEvent.contextMenu(screen.getByDisplayValue('A3S Work 发布计划'), { clientX: 180, clientY: 210 });
    fireEvent.click(screen.getByRole('menuitem', { name: '改进文案与叙事' }));

    expect(onAgentRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        instruction: expect.stringContaining('可审阅的差异清单'),
        selection: expect.stringContaining('当前选择：形状'),
        proposal: expect.objectContaining({
          title: '审阅演示文案修改',
          targets: [
            expect.objectContaining({
              id: `text:${artifact.content.slides[0].elements[0].id}`,
              before: 'A3S Work 发布计划',
            }),
          ],
        }),
      })
    );
    expect(onAgentRequest.mock.calls[0][0].selection).toContain('A3S Work 发布计划');
  });

  it('adds, edits, locates, and deletes slide comments', async () => {
    const artifact = createWorkArtifact('strategy-deck');
    if (artifact.content.type !== 'presentation') return;
    artifact.content.slides[1].comments = [
      {
        id: 'imported-slide-comment',
        author: 'Alice',
        initials: 'AL',
        date: '2026-07-21T00:00:00.000Z',
        text: 'Verify the supporting evidence.',
        x: 72,
        y: 24,
      },
    ];
    const onChange = vi.fn();
    render(<PresentationHarness initial={artifact.content} onChange={onChange} />);

    fireEvent.click(screen.getByRole('tab', { name: '审阅' }));
    fireEvent.click(screen.getByRole('button', { name: '查看批注（1）' }));
    expect(screen.getByRole('region', { name: '演示批注审阅' })).toHaveTextContent('Verify the supporting evidence.');
    fireEvent.click(screen.getByRole('button', { name: '定位演示批注 1' }));
    expect(screen.getByRole('region', { name: '核心判断编辑画布' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('编辑演示批注 1'), {
      target: { value: 'Evidence verified.' },
    });
    await waitFor(() => expect(onChange.mock.lastCall?.[0].slides[1].comments?.[0].text).toBe('Evidence verified.'));

    fireEvent.click(screen.getByRole('button', { name: '新建批注' }));
    fireEvent.change(await screen.findByRole('textbox', { name: '批注内容' }), {
      target: { value: 'Add the launch owner.' },
    });
    fireEvent.click(screen.getByRole('button', { name: '添加批注' }));
    await waitFor(() => {
      const comments = onChange.mock.lastCall?.[0].slides[1].comments;
      expect(comments).toHaveLength(2);
      expect(comments?.[1]).toMatchObject({
        author: 'A3S Work 用户',
        initials: 'AW',
        text: 'Add the launch owner.',
        x: 50,
        y: 50,
      });
    });
    expect(screen.getByRole('button', { name: '查看批注（2）' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '打开演示批注 2' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '删除演示批注 1' }));
    await waitFor(() => expect(onChange.mock.lastCall?.[0].slides[1].comments).toHaveLength(1));
  });

  it('keeps review comments out of slide-show preview', () => {
    const artifact = createWorkArtifact('blank-presentation');
    if (artifact.content.type !== 'presentation') return;
    artifact.content.slides[0].comments = [
      {
        id: 'preview-comment',
        author: 'Alice',
        date: '2026-07-21T00:00:00.000Z',
        text: 'Internal review note',
        x: 50,
        y: 50,
      },
    ];

    const { container } = render(<PresentationEditor content={artifact.content} preview onChange={() => undefined} />);
    expect(container.querySelector('.work-presentation-comment-pin')).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent('Internal review note');
  });

  it('copies, pastes, cuts, and restores a selected element with standard shortcuts', async () => {
    const artifact = createWorkArtifact('blank-presentation');
    if (artifact.content.type !== 'presentation') return;
    const onChange = vi.fn();
    render(<PresentationHarness initial={artifact.content} onChange={onChange} />);
    const selectedElement = screen.getByRole('group', { name: '单击添加标题' });
    expect(selectedElement).toHaveAttribute('tabindex', '0');
    fireEvent.focus(selectedElement);

    fireEvent.keyDown(selectedElement, { key: 'c', ctrlKey: true });
    fireEvent.keyDown(selectedElement, { key: 'v', ctrlKey: true });
    await waitFor(() => expect(onChange.mock.lastCall?.[0].slides[0].elements).toHaveLength(3));
    const pasted = onChange.mock.lastCall?.[0].slides[0].elements[2];
    expect(pasted).toMatchObject({ text: '单击添加标题', x: 14, y: 27 });
    expect(pasted.id).not.toBe(artifact.content.slides[0].elements[0].id);

    fireEvent.keyDown(selectedElement, { key: 'x', ctrlKey: true });
    await waitFor(() => expect(onChange.mock.lastCall?.[0].slides[0].elements).toHaveLength(2));
    fireEvent.keyDown(selectedElement, { key: 'v', ctrlKey: true });
    await waitFor(() => expect(onChange.mock.lastCall?.[0].slides[0].elements).toHaveLength(3));
  });

  it('uses standard shortcuts for bold text, a new slide, and starting the slide show', async () => {
    const artifact = createWorkArtifact('blank-presentation');
    if (artifact.content.type !== 'presentation') return;
    const onChange = vi.fn();
    const onStartSlideshow = vi.fn();
    render(<PresentationHarness initial={artifact.content} onChange={onChange} onStartSlideshow={onStartSlideshow} />);
    const selectedElement = screen.getByRole('group', { name: '单击添加标题' });
    const initialBold = Boolean(artifact.content.slides[0].elements[0].bold);
    fireEvent.focus(selectedElement);

    expect(fireEvent.keyDown(selectedElement, { key: 'b', ctrlKey: true })).toBe(false);
    await waitFor(() => expect(onChange.mock.lastCall?.[0].slides[0].elements[0].bold).toBe(!initialBold));

    expect(fireEvent.keyDown(selectedElement, { key: 'm', ctrlKey: true })).toBe(false);
    await waitFor(() => expect(onChange.mock.lastCall?.[0].slides).toHaveLength(2));

    expect(fireEvent.keyDown(window, { key: 'n', metaKey: true, shiftKey: true })).toBe(false);
    await waitFor(() => expect(onChange.mock.lastCall?.[0].slides).toHaveLength(3));
    expect(fireEvent.keyDown(window, { key: 'm', metaKey: true })).toBe(true);
    expect(onChange.mock.lastCall?.[0].slides).toHaveLength(3);

    expect(fireEvent.keyDown(window, { key: 'F5' })).toBe(false);
    expect(onStartSlideshow).toHaveBeenCalledTimes(1);
  });

  it('applies bold shortcuts to imported rich-text runs and reports their effective state', async () => {
    const artifact = createWorkArtifact('blank-presentation');
    if (artifact.content.type !== 'presentation') return;
    const title = artifact.content.slides[0].elements[0];
    const content = {
      ...artifact.content,
      slides: [
        {
          ...artifact.content.slides[0],
          elements: [
            {
              ...title,
              text: '导入标题',
              bold: false,
              textRuns: [
                { text: '导入', bold: true, color: '#2563eb', fontSize: 30 },
                { text: '标题', bold: true, color: '#2563eb', fontSize: 30 },
              ],
            },
            ...artifact.content.slides[0].elements.slice(1),
          ],
        },
      ],
    };
    const onChange = vi.fn();
    render(<PresentationHarness initial={content} onChange={onChange} />);
    const selectedElement = screen.getByRole('group', { name: '导入标题' });
    fireEvent.focus(selectedElement);

    expect(screen.getByRole('button', { name: '加粗' })).toHaveAttribute('aria-pressed', 'true');
    expect(fireEvent.keyDown(selectedElement, { key: 'b', metaKey: true })).toBe(false);

    await waitFor(() => {
      const updated = onChange.mock.lastCall?.[0].slides[0].elements[0];
      expect(updated.bold).toBe(false);
      expect(updated.textRuns).toEqual([
        { text: '导入', bold: false, color: '#2563eb', fontSize: 30 },
        { text: '标题', bold: false, color: '#2563eb', fontSize: 30 },
      ]);
    });
    expect(screen.getByRole('button', { name: '加粗' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('undoes and redoes a slide added with the presentation shortcut', async () => {
    const artifact = createWorkArtifact('blank-presentation');
    if (artifact.content.type !== 'presentation') return;
    const onChange = vi.fn();
    render(<PresentationHarness initial={artifact.content} onChange={onChange} />);
    const selectedElement = screen.getByRole('group', { name: '单击添加标题' });
    fireEvent.focus(selectedElement);

    fireEvent.keyDown(selectedElement, { key: 'm', ctrlKey: true });
    await waitFor(() => expect(onChange.mock.lastCall?.[0].slides).toHaveLength(2));
    await waitFor(() => expect(screen.getByRole('button', { name: '撤销' })).toBeEnabled());
    expect(screen.getByRole('button', { name: /幻灯片 2：/ })).toHaveClass('active');

    fireEvent.click(screen.getByRole('button', { name: '撤销' }));
    await waitFor(() => expect(onChange.mock.lastCall?.[0].slides).toHaveLength(1));
    expect(screen.getByRole('button', { name: /幻灯片 1：/ })).toHaveClass('active');
    expect(screen.getByRole('button', { name: '重做' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: '重做' }));
    await waitFor(() => expect(onChange.mock.lastCall?.[0].slides).toHaveLength(2));
    expect(screen.getByRole('button', { name: /幻灯片 2：/ })).toHaveClass('active');
  });

  it('does not add an equivalent persistence echo to presentation history', async () => {
    const artifact = createWorkArtifact('blank-presentation');
    if (artifact.content.type !== 'presentation') return;
    const onChange = vi.fn();
    render(<PresentationPersistenceEchoHarness initial={artifact.content} onChange={onChange} />);
    const selectedElement = screen.getByRole('group', { name: '单击添加标题' });
    fireEvent.focus(selectedElement);

    fireEvent.keyDown(selectedElement, { key: 'm', ctrlKey: true });
    await waitFor(() => expect(onChange.mock.lastCall?.[0].slides).toHaveLength(2));
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 0)));

    fireEvent.click(screen.getByRole('button', { name: '撤销' }));
    await waitFor(() => expect(onChange.mock.lastCall?.[0].slides).toHaveLength(1));
  });

  it('navigates and deletes slide thumbnails without losing keyboard focus', async () => {
    const artifact = createWorkArtifact('strategy-deck');
    if (artifact.content.type !== 'presentation') return;
    const content = artifact.content;
    const onChange = vi.fn();
    render(<PresentationHarness initial={content} onChange={onChange} />);
    const firstSlide = screen.getByRole('button', {
      name: `幻灯片 1：${content.slides[0].name}`,
    });
    fireEvent.focus(firstSlide);

    expect(fireEvent.keyDown(firstSlide, { key: 'ArrowDown' })).toBe(false);
    const secondSlide = screen.getByRole('button', {
      name: `幻灯片 2：${content.slides[1].name}`,
    });
    await waitFor(() => expect(secondSlide).toHaveFocus());

    expect(fireEvent.keyDown(secondSlide, { key: 'Delete' })).toBe(false);
    await waitFor(() => {
      expect(onChange.mock.lastCall?.[0].slides.map((slide: { id: string }) => slide.id)).toEqual([
        content.slides[0].id,
        content.slides[2].id,
      ]);
    });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: `幻灯片 2：${content.slides[2].name}` })).toHaveFocus()
    );

    fireEvent.keyDown(screen.getByRole('button', { name: `幻灯片 2：${content.slides[2].name}` }), {
      key: 'z',
      ctrlKey: true,
    });
    await waitFor(() => expect(onChange.mock.lastCall?.[0].slides).toHaveLength(3));
  });

  it('does not move a selected object while navigating the ribbon with arrow keys', async () => {
    const artifact = createWorkArtifact('blank-presentation');
    if (artifact.content.type !== 'presentation') return;
    const onChange = vi.fn();
    render(<PresentationHarness initial={artifact.content} onChange={onChange} />);
    fireEvent.focus(screen.getByRole('group', { name: '单击添加标题' }));

    fireEvent.keyDown(screen.getByRole('tab', { name: '开始' }), { key: 'ArrowRight' });

    await waitFor(() => expect(screen.getByRole('tab', { name: '插入' })).toHaveFocus());
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.keyDown(screen.getByRole('button', { name: '图片' }), { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not undo the presentation behind an Office dialog', async () => {
    const artifact = createWorkArtifact('blank-presentation');
    if (artifact.content.type !== 'presentation') return;
    const originalX = artifact.content.slides[0].elements[0].x;
    const onChange = vi.fn();
    const onStartSlideshow = vi.fn();
    render(<PresentationHarness initial={artifact.content} onChange={onChange} onStartSlideshow={onStartSlideshow} />);
    const selectedElement = screen.getByRole('group', { name: '单击添加标题' });
    fireEvent.focus(selectedElement);
    fireEvent.keyDown(selectedElement, { key: 'ArrowRight' });
    await waitFor(() => expect(onChange.mock.lastCall?.[0].slides[0].elements[0].x).toBe(originalX + 1));

    fireEvent.click(screen.getByRole('tab', { name: '插入' }));
    fireEvent.click(screen.getByRole('button', { name: '链接' }));
    const link = await screen.findByRole('textbox', { name: '链接地址' });
    const callCount = onChange.mock.calls.length;

    fireEvent.keyDown(link, { key: 'z', ctrlKey: true });
    fireEvent.keyDown(link, { key: 'm', ctrlKey: true });
    expect(fireEvent.keyDown(link, { key: 'n', metaKey: true, shiftKey: true })).toBe(false);
    expect(fireEvent.keyDown(link, { key: 'F5' })).toBe(false);

    expect(onChange).toHaveBeenCalledTimes(callCount);
    expect(onStartSlideshow).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: '链接地址' })).toBeInTheDocument();
  });

  it('nudges a focused element and supports undo and redo from the ribbon and keyboard', async () => {
    const artifact = createWorkArtifact('blank-presentation');
    if (artifact.content.type !== 'presentation') return;
    const originalX = artifact.content.slides[0].elements[0].x;
    const originalY = artifact.content.slides[0].elements[0].y;
    const onChange = vi.fn();
    render(<PresentationHarness initial={artifact.content} onChange={onChange} />);
    const selectedElement = screen.getByRole('group', { name: '单击添加标题' });
    fireEvent.focus(selectedElement);

    fireEvent.keyDown(selectedElement, { key: 'ArrowRight' });
    await waitFor(() => expect(onChange.mock.lastCall?.[0].slides[0].elements[0].x).toBe(originalX + 1));
    await waitFor(() => expect(screen.getByRole('button', { name: '撤销' })).toBeEnabled());

    fireEvent.keyDown(screen.getByRole('group', { name: '单击添加标题' }), {
      key: 'ArrowDown',
      shiftKey: true,
    });
    await waitFor(() => expect(onChange.mock.lastCall?.[0].slides[0].elements[0].y).toBe(originalY + 5));

    fireEvent.keyDown(screen.getByRole('group', { name: '单击添加标题' }), { key: 'z', ctrlKey: true });
    await waitFor(() => expect(onChange.mock.lastCall?.[0].slides[0].elements[0].y).toBe(originalY));
    expect(screen.getByRole('button', { name: '重做' })).toBeEnabled();

    fireEvent.keyDown(screen.getByRole('group', { name: '单击添加标题' }), {
      key: 'z',
      ctrlKey: true,
      shiftKey: true,
    });
    await waitFor(() => expect(onChange.mock.lastCall?.[0].slides[0].elements[0].y).toBe(originalY + 5));

    fireEvent.click(screen.getByRole('button', { name: '撤销' }));
    await waitFor(() => expect(onChange.mock.lastCall?.[0].slides[0].elements[0].y).toBe(originalY));
    fireEvent.keyDown(screen.getByRole('group', { name: '单击添加标题' }), { key: 'y', ctrlKey: true });
    await waitFor(() => expect(onChange.mock.lastCall?.[0].slides[0].elements[0].y).toBe(originalY + 5));

    fireEvent.click(screen.getByRole('button', { name: '撤销' }));
    await waitFor(() => expect(onChange.mock.lastCall?.[0].slides[0].elements[0].y).toBe(originalY));
    fireEvent.click(screen.getByRole('button', { name: '重做' }));
    await waitFor(() => expect(onChange.mock.lastCall?.[0].slides[0].elements[0].y).toBe(originalY + 5));
    expect(onChange.mock.lastCall?.[0].slides[0].elements[0].x).toBe(originalX + 1);
  });

  it('uses presentation history for undo and redo while editing controlled slide text', async () => {
    const artifact = createWorkArtifact('blank-presentation');
    if (artifact.content.type !== 'presentation') return;
    const originalText = artifact.content.slides[0].elements[0].text;
    const onChange = vi.fn();
    render(<PresentationHarness initial={artifact.content} onChange={onChange} />);
    const textEditor = screen.getAllByRole('textbox', { name: '幻灯片文本' })[0];

    fireEvent.focus(textEditor);
    fireEvent.change(textEditor, { target: { value: `${originalText}（已修改）` } });
    await waitFor(() =>
      expect(onChange.mock.lastCall?.[0].slides[0].elements[0].text).toBe(`${originalText}（已修改）`)
    );

    fireEvent.keyDown(textEditor, { key: 'z', ctrlKey: true });
    await waitFor(() => expect(onChange.mock.lastCall?.[0].slides[0].elements[0].text).toBe(originalText));

    fireEvent.keyDown(textEditor, { key: 'z', ctrlKey: true, shiftKey: true });
    await waitFor(() =>
      expect(onChange.mock.lastCall?.[0].slides[0].elements[0].text).toBe(`${originalText}（已修改）`)
    );
  });

  it('copies and pastes a full slide from the toolbar with fresh nested identities', async () => {
    const artifact = createWorkArtifact('strategy-deck');
    if (artifact.content.type !== 'presentation') return;
    artifact.content.slides[0].comments = [
      {
        id: 'comment-original',
        author: 'Alice',
        date: '2026-07-21T00:00:00.000Z',
        text: 'Keep this review note.',
        x: 30,
        y: 40,
      },
    ];
    const onChange = vi.fn();
    render(<PresentationHarness initial={artifact.content} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: '复制' }));
    fireEvent.click(screen.getByRole('button', { name: '粘贴' }));

    await waitFor(() => expect(onChange.mock.lastCall?.[0].slides).toHaveLength(4));
    const pasted = onChange.mock.lastCall?.[0].slides[1];
    expect(pasted.name).toBe('封面 副本');
    expect(pasted.id).not.toBe(artifact.content.slides[0].id);
    expect(pasted.elements[0].id).not.toBe(artifact.content.slides[0].elements[0].id);
    expect(pasted.comments[0].id).not.toBe('comment-original');
  });

  it('creates and edits native presentation chart data without leaving the slide editor', async () => {
    const artifact = createWorkArtifact('blank-presentation');
    if (artifact.content.type !== 'presentation') return;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const onChange = vi.fn();
    render(<PresentationHarness initial={artifact.content} onChange={onChange} />);

    fireEvent.click(screen.getByRole('tab', { name: '插入' }));
    fireEvent.click(screen.getByRole('button', { name: '图表' }));
    expect(screen.getByRole('region', { name: '演示图表数据' })).toBeInTheDocument();

    chooseOfficeOption('演示图表类型', '圆环图');
    fireEvent.change(screen.getByLabelText('圆环孔径'), { target: { value: '68' } });
    fireEvent.change(screen.getByLabelText('演示图表标题'), { target: { value: '区域收入' } });
    fireEvent.change(screen.getByLabelText('演示图表分类'), { target: { value: '华东\n华南\n华北' } });
    fireEvent.change(screen.getByLabelText('演示图表系列 1 名称'), { target: { value: '收入' } });
    fireEvent.change(screen.getByLabelText('演示图表系列 1 数据'), { target: { value: '42, 58, 36' } });
    fireEvent.click(screen.getByRole('button', { name: '添加图表系列' }));
    fireEvent.change(screen.getByLabelText('演示图表系列 2 名称'), { target: { value: '目标' } });
    fireEvent.change(screen.getByLabelText('演示图表系列 2 数据'), { target: { value: '50, 60, 40' } });

    await waitFor(() => {
      const latest = onChange.mock.lastCall?.[0] as WorkPresentationContent;
      expect(latest.slides[0].elements.at(-1)?.chart).toEqual({
        type: 'doughnut',
        title: '区域收入',
        categories: ['华东', '华南', '华北'],
        series: [
          { name: '收入', values: [42, 58, 36] },
          { name: '目标', values: [50, 60, 40] },
        ],
        showLegend: true,
        legendPosition: 'right',
        doughnutHoleSize: 68,
      });
    });
    expect(screen.getAllByRole('img', { name: '区域收入' })[0]).toHaveAttribute(
      'data-presentation-chart-type',
      'doughnut'
    );

    fireEvent.click(screen.getByRole('button', { name: '删除演示图表' }));
    await waitFor(() => {
      const latest = onChange.mock.lastCall?.[0] as WorkPresentationContent;
      expect(latest.slides[0].elements.some((element) => element.type === 'chart')).toBe(false);
    });
  });

  it('edits presentation chart legends and complete primary-axis settings', async () => {
    const artifact = createWorkArtifact('blank-presentation');
    if (artifact.content.type !== 'presentation') return;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const onChange = vi.fn();
    render(<PresentationHarness initial={artifact.content} onChange={onChange} />);

    fireEvent.click(screen.getByRole('tab', { name: '插入' }));
    fireEvent.click(screen.getByRole('button', { name: '图表' }));
    expect(screen.getByLabelText('显示演示图表图例')).toBeChecked();
    chooseOfficeOption('演示图表图例位置', '底部');
    fireEvent.change(screen.getByLabelText('演示图表横轴标题'), { target: { value: '季度' } });
    fireEvent.click(screen.getByLabelText('演示图表横轴逆序'));
    chooseOfficeOption('演示图表横轴标签位置', '高位');
    chooseOfficeOption('演示图表横轴主要刻度线', '向外');
    fireEvent.change(screen.getByLabelText('演示图表横轴标签间隔'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('演示图表纵轴标题'), { target: { value: '收入（万元）' } });
    fireEvent.change(screen.getByLabelText('演示图表纵轴最小值'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('演示图表纵轴最大值'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('演示图表纵轴主单位'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('演示图表纵轴数字格式'), { target: { value: '#,##0' } });
    fireEvent.click(screen.getByLabelText('演示图表纵轴主要网格线'));

    await waitFor(() => {
      const latest = onChange.mock.lastCall?.[0] as WorkPresentationContent;
      expect(latest.slides[0].elements.at(-1)?.chart).toMatchObject({
        showLegend: true,
        legendPosition: 'bottom',
        axes: {
          bottom: {
            title: '季度',
            reverseOrder: true,
            labelPosition: 'high',
            majorTickMark: 'outside',
            labelInterval: 2,
          },
          left: {
            title: '收入（万元）',
            minimum: 0,
            maximum: 100,
            majorUnit: 20,
            showMajorGridlines: false,
            numberFormat: '#,##0',
            numberFormatSourceLinked: false,
          },
        },
      });
    });

    fireEvent.click(screen.getByLabelText('显示演示图表图例'));
    await waitFor(() => {
      const latest = onChange.mock.lastCall?.[0] as WorkPresentationContent;
      expect(latest.slides[0].elements.at(-1)?.chart?.showLegend).toBe(false);
    });
  });

  it('edits presentation chart overlay, plot layout, and per-series appearance', async () => {
    const artifact = createWorkArtifact('blank-presentation');
    if (artifact.content.type !== 'presentation') return;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const onChange = vi.fn();
    render(<PresentationHarness initial={artifact.content} onChange={onChange} />);

    fireEvent.click(screen.getByRole('tab', { name: '插入' }));
    fireEvent.click(screen.getByRole('button', { name: '图表' }));
    fireEvent.click(screen.getByLabelText('演示图表图例叠加在绘图区'));
    chooseOfficeOption('演示图表分组方式', '百分比堆积');
    fireEvent.change(screen.getByLabelText('演示图表分类间距（%）'), { target: { value: '240' } });
    fireEvent.change(screen.getByLabelText('演示图表系列重叠（%）'), { target: { value: '85' } });
    fireEvent.click(screen.getByLabelText('系列 1 使用自定义外观'));
    chooseOfficeColor('系列 1 填充颜色', '#112233');
    fireEvent.change(screen.getByLabelText('系列 1 填充透明度'), { target: { value: '35' } });
    chooseOfficeColor('系列 1 线条颜色', '#445566');
    fireEvent.change(screen.getByLabelText('系列 1 线条宽度'), { target: { value: '3.25' } });
    chooseOfficeOption('系列 1 线条虚线', '点划线');

    await waitFor(() => {
      const latest = onChange.mock.lastCall?.[0] as WorkPresentationContent;
      expect(latest.slides[0].elements.at(-1)?.chart).toMatchObject({
        legendOverlay: true,
        grouping: 'percentStacked',
        gapWidth: 240,
        overlap: 85,
        series: [
          expect.objectContaining({
            style: {
              fillColor: '#112233',
              fillTransparency: 35,
              lineColor: '#445566',
              lineWidth: 3.25,
              lineDash: 'dashDot',
            },
          }),
        ],
      });
    });
  });

  it('edits presentation chart data-label content, placement, and separator', async () => {
    const artifact = createWorkArtifact('blank-presentation');
    if (artifact.content.type !== 'presentation') return;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const onChange = vi.fn();
    render(<PresentationHarness initial={artifact.content} onChange={onChange} />);

    fireEvent.click(screen.getByRole('tab', { name: '插入' }));
    fireEvent.click(screen.getByRole('button', { name: '图表' }));
    expect(screen.getByLabelText('显示演示图表数据标签')).not.toBeChecked();
    fireEvent.click(screen.getByLabelText('显示演示图表数据标签'));
    fireEvent.click(screen.getByLabelText('演示图表数据标签显示分类名称'));
    fireEvent.click(screen.getByLabelText('演示图表数据标签显示系列名称'));
    chooseOfficeOption('演示图表数据标签位置', '外侧末端');
    fireEvent.change(screen.getByLabelText('演示图表数据标签分隔符'), { target: { value: ' / ' } });

    await waitFor(() => {
      const latest = onChange.mock.lastCall?.[0] as WorkPresentationContent;
      expect(latest.slides[0].elements.at(-1)?.chart?.dataLabels).toEqual({
        showValue: true,
        showCategoryName: true,
        showSeriesName: true,
        position: 'outsideEnd',
        separator: ' / ',
      });
    });
  });

  it('edits native presentation scatter and bubble chart data', async () => {
    const artifact = createWorkArtifact('blank-presentation');
    if (artifact.content.type !== 'presentation') return;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const onChange = vi.fn();
    render(<PresentationHarness initial={artifact.content} onChange={onChange} />);

    fireEvent.click(screen.getByRole('tab', { name: '插入' }));
    fireEvent.click(screen.getByRole('button', { name: '图表' }));
    chooseOfficeOption('演示图表类型', '散点图');
    fireEvent.change(screen.getByLabelText('演示图表 X 值'), { target: { value: '1, 2, 4' } });
    fireEvent.change(screen.getByLabelText('演示图表系列 1 Y 值'), { target: { value: '3, 5, 9' } });
    chooseOfficeOption('演示散点图样式', '平滑线和数据标记');

    await waitFor(() => {
      const latest = onChange.mock.lastCall?.[0] as WorkPresentationContent;
      expect(latest.slides[0].elements.at(-1)?.chart).toMatchObject({
        type: 'scatter',
        categories: ['1', '2', '4'],
        series: [{ name: '系列 1', values: [3, 5, 9] }],
        scatterStyle: 'smoothMarker',
      });
    });

    chooseOfficeOption('演示图表类型', '气泡图');
    fireEvent.change(screen.getByLabelText('演示气泡图系列 1 大小'), { target: { value: '9, 16, 25' } });
    fireEvent.change(screen.getByLabelText('演示气泡图缩放'), { target: { value: '140' } });
    chooseOfficeOption('演示气泡大小表示', '宽度');
    fireEvent.click(screen.getByLabelText('显示负气泡'));
    fireEvent.click(screen.getByLabelText('显示演示图表数据标签'));
    fireEvent.click(screen.getByLabelText('演示图表数据标签显示气泡大小'));

    await waitFor(() => {
      const latest = onChange.mock.lastCall?.[0] as WorkPresentationContent;
      expect(latest.slides[0].elements.at(-1)?.chart).toMatchObject({
        type: 'bubble',
        categories: ['1', '2', '4'],
        series: [{ name: '系列 1', values: [3, 5, 9], bubbleSizes: [9, 16, 25] }],
        bubbleScale: 140,
        showNegativeBubbles: true,
        bubbleSizeRepresents: 'width',
        dataLabels: { showValue: true, showBubbleSize: true, position: 'above' },
      });
    });
  });

  it('edits per-series presentation trendlines and error bars', async () => {
    const artifact = createWorkArtifact('blank-presentation');
    if (artifact.content.type !== 'presentation') return;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const onChange = vi.fn();
    render(<PresentationHarness initial={artifact.content} onChange={onChange} />);

    fireEvent.click(screen.getByRole('tab', { name: '插入' }));
    fireEvent.click(screen.getByRole('button', { name: '图表' }));
    expect(screen.getByRole('region', { name: '演示图表系列 1 高级分析' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '添加系列 1 趋势线' }));
    chooseOfficeOption('系列 1 趋势线 1 类型', '多项式');
    fireEvent.change(screen.getByLabelText('系列 1 趋势线 1 阶数'), { target: { value: '3' } });
    fireEvent.click(screen.getByLabelText('系列 1 趋势线 1 显示公式'));
    fireEvent.click(screen.getByLabelText('系列 1 趋势线 1 显示 R 方'));
    fireEvent.click(screen.getByRole('button', { name: '添加系列 1 Y 误差线' }));
    chooseOfficeOption('系列 1 误差线 1 计算方式', '百分比');
    fireEvent.change(screen.getByLabelText('系列 1 误差线 1 数值'), { target: { value: '10' } });
    fireEvent.click(screen.getByLabelText('系列 1 误差线 1 显示端帽'));

    await waitFor(() => {
      const latest = onChange.mock.lastCall?.[0] as WorkPresentationContent;
      expect(latest.slides[0].elements.at(-1)?.chart?.series[0]).toMatchObject({
        trendlines: [{ type: 'polynomial', order: 3, displayEquation: true, displayRSquared: true }],
        errorBars: [
          {
            direction: 'y',
            barType: 'both',
            valueType: 'percentage',
            value: 10,
            showEndCaps: false,
          },
        ],
      });
    });

    chooseOfficeOption('系列 1 误差线 1 计算方式', '自定义范围');
    const plusValues = screen.getByLabelText('系列 1 误差线 1 正误差值');
    fireEvent.change(plusValues, { target: { value: '1, 2, 3' } });
    fireEvent.blur(plusValues);
    const minusValues = screen.getByLabelText('系列 1 误差线 1 负误差值');
    fireEvent.change(minusValues, { target: { value: '0.5, 1, 1.5' } });
    fireEvent.blur(minusValues);

    await waitFor(() => {
      const latest = onChange.mock.lastCall?.[0] as WorkPresentationContent;
      expect(latest.slides[0].elements.at(-1)?.chart?.series[0].errorBars).toEqual([
        {
          direction: 'y',
          barType: 'both',
          valueType: 'custom',
          plusValues: [1, 2, 3],
          minusValues: [0.5, 1, 1.5],
          showEndCaps: false,
        },
      ]);
    });
  });

  it('applies layouts and edits shared layout and master content', async () => {
    const onChange = vi.fn();
    render(<PresentationHarness initial={presentationWithLayouts()} onChange={onChange} />);

    fireEvent.click(screen.getByRole('tab', { name: '设计' }));
    fireEvent.click(screen.getByRole('button', { name: '母版和版式' }));
    chooseOfficeOption('幻灯片布局', 'Title layout');
    await waitFor(() => {
      const latest = onChange.mock.lastCall?.[0] as WorkPresentationContent;
      expect(latest.slides[0]).toMatchObject({ layoutId: 'layout-title' });
      expect(latest.slides[0].elements[0]).toMatchObject({
        text: 'Quarterly Review',
        x: 8,
        y: 10,
        width: 84,
        height: 12,
      });
      expect(latest.slides[0].elements[1]).toMatchObject({
        text: 'Keep this evidence',
        placeholder: undefined,
      });
    });

    fireEvent.click(screen.getByRole('button', { name: '编辑当前布局' }));
    expect(screen.getByRole('region', { name: 'Title layout布局编辑画布' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '添加内容占位符' }));
    await waitFor(() => {
      const latest = onChange.mock.lastCall?.[0] as WorkPresentationContent;
      expect(
        latest.layouts
          ?.find((layout) => layout.id === 'layout-title')
          ?.elements.some((element) => element.placeholder?.type === 'body')
      ).toBe(true);
    });

    fireEvent.click(screen.getByRole('button', { name: '编辑当前母版' }));
    expect(screen.getByRole('region', { name: 'Brand master母版编辑画布' })).toBeInTheDocument();
    chooseOfficeColor('母版背景颜色', '#334455');
    fireEvent.click(screen.getByRole('tab', { name: '插入' }));
    fireEvent.click(screen.getByRole('button', { name: '文本框' }));
    await waitFor(() => {
      const latest = onChange.mock.lastCall?.[0] as WorkPresentationContent;
      expect(latest.masters?.[0].background).toBe('#334455');
      expect(latest.masters?.[0].elements.some((element) => element.text === '输入文字')).toBe(true);
    });

    fireEvent.click(screen.getByRole('button', { name: '返回幻灯片编辑' }));
    expect(screen.getByRole('region', { name: 'Review编辑画布' })).toBeInTheDocument();
  });
});

function PresentationHarness({
  initial,
  onChange,
  onStartSlideshow,
}: {
  initial: WorkPresentationContent;
  onChange: (content: WorkPresentationContent) => void;
  onStartSlideshow?: () => void;
}) {
  const [content, setContent] = useState(initial);
  return (
    <PresentationEditor
      content={content}
      preview={false}
      onStartSlideshow={onStartSlideshow}
      onChange={(next) => {
        setContent(next);
        onChange(next);
      }}
    />
  );
}

function PresentationPersistenceEchoHarness({
  initial,
  onChange,
}: {
  initial: WorkPresentationContent;
  onChange: (content: WorkPresentationContent) => void;
}) {
  const [content, setContent] = useState(initial);
  return (
    <PresentationEditor
      content={content}
      preview={false}
      onChange={(next) => {
        setContent(next);
        onChange(next);
        window.setTimeout(() => setContent(JSON.parse(JSON.stringify(next)) as WorkPresentationContent), 0);
      }}
    />
  );
}

function chooseOfficeOption(label: string, option: string) {
  fireEvent.click(screen.getByRole('combobox', { name: label }));
  fireEvent.click(screen.getByRole('option', { name: option }));
}

function chooseOfficeColor(label: string, value: string) {
  fireEvent.click(screen.getByRole('button', { name: label }));
  fireEvent.change(screen.getByRole('textbox', { name: '自定义颜色值' }), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: '应用' }));
}

function presentationWithLayouts(): WorkPresentationContent {
  return {
    type: 'presentation',
    masters: [
      {
        id: 'master-brand',
        name: 'Brand master',
        background: '#16213d',
        elements: [],
      },
    ],
    layouts: [
      {
        id: 'layout-title',
        name: 'Title layout',
        masterId: 'master-brand',
        elements: [
          {
            id: 'title-definition',
            type: 'text',
            x: 8,
            y: 10,
            width: 84,
            height: 12,
            text: '单击添加标题',
            fontSize: 30,
            color: '#ffffff',
            fill: 'transparent',
            bold: true,
            align: 'left',
            placeholder: { key: 'idx:1', type: 'title', prompt: '单击添加标题' },
          },
        ],
      },
      {
        id: 'layout-content',
        name: 'Content layout',
        masterId: 'master-brand',
        background: '#f7f4ee',
        elements: [
          {
            id: 'content-title-definition',
            type: 'text',
            x: 10,
            y: 8,
            width: 80,
            height: 10,
            text: '单击添加标题',
            fontSize: 28,
            color: '#172033',
            fill: 'transparent',
            bold: true,
            align: 'left',
            placeholder: { key: 'idx:1', type: 'title', prompt: '单击添加标题' },
          },
          {
            id: 'content-body-definition',
            type: 'text',
            x: 10,
            y: 24,
            width: 80,
            height: 58,
            text: '单击添加内容',
            fontSize: 20,
            color: '#172033',
            fill: 'transparent',
            bold: false,
            align: 'left',
            placeholder: { key: 'idx:2', type: 'body', prompt: '单击添加内容' },
          },
        ],
      },
    ],
    slides: [
      {
        id: 'slide-layouts',
        name: 'Review',
        background: '#ffffff',
        layoutId: 'layout-content',
        useLayoutBackground: true,
        elements: [
          {
            id: 'slide-title',
            type: 'text',
            x: 10,
            y: 8,
            width: 80,
            height: 10,
            text: 'Quarterly Review',
            fontSize: 28,
            color: '#172033',
            fill: 'transparent',
            bold: true,
            align: 'left',
            placeholder: { key: 'idx:1', type: 'title' },
          },
          {
            id: 'slide-body',
            type: 'text',
            x: 10,
            y: 24,
            width: 80,
            height: 58,
            text: 'Keep this evidence',
            fontSize: 20,
            color: '#172033',
            fill: 'transparent',
            bold: false,
            align: 'left',
            placeholder: { key: 'idx:2', type: 'body' },
          },
        ],
      },
    ],
  };
}

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkOfficePreviewBar, WorkOfficeRibbon, WorkOfficeRibbonButton } from './work-office-chrome';

afterEach(cleanup);

describe('Work Office ribbon chrome', () => {
  it('opens the file menu once when Enter produces its native click', async () => {
    renderRibbon();
    const trigger = screen.getByRole('button', { name: '文件' });

    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.click(trigger);

    expect(screen.getByRole('menu', { name: '文件菜单' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('menuitem', { name: '另存为' })).toHaveFocus());
  });

  it('opens from either arrow key and focuses the corresponding edge action', async () => {
    renderRibbon();
    const trigger = screen.getByRole('button', { name: '文件' });

    fireEvent.keyDown(trigger, { key: 'ArrowUp' });

    expect(screen.getByRole('menu', { name: '文件菜单' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('menuitem', { name: '打印' })).toHaveFocus());
  });

  it('supports standard menu navigation and closes instead of tabbing through every action', async () => {
    renderRibbon();
    const trigger = screen.getByRole('button', { name: '文件' });
    fireEvent.click(trigger);
    const saveAs = screen.getByRole('menuitem', { name: '另存为' });
    const print = screen.getByRole('menuitem', { name: '打印' });
    await waitFor(() => expect(saveAs).toHaveFocus());

    fireEvent.keyDown(saveAs, { key: 'ArrowDown' });
    expect(print).toHaveFocus();
    fireEvent.keyDown(print, { key: 'ArrowDown' });
    expect(saveAs).toHaveFocus();
    fireEvent.keyDown(saveAs, { key: 'End' });
    expect(print).toHaveFocus();
    fireEvent.keyDown(print, { key: 'Home' });
    expect(saveAs).toHaveFocus();

    fireEvent.keyDown(saveAs, { key: 'Tab' });
    await waitFor(() => expect(screen.queryByRole('menu', { name: '文件菜单' })).not.toBeInTheDocument());
  });

  it('returns focus to the File trigger when Escape closes the menu', async () => {
    renderRibbon();
    const trigger = screen.getByRole('button', { name: '文件' });
    fireEvent.click(trigger);
    const saveAs = screen.getByRole('menuitem', { name: '另存为' });
    await waitFor(() => expect(saveAs).toHaveFocus());

    fireEvent.keyDown(saveAs, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('menu', { name: '文件菜单' })).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it('closes the file menu when keyboard focus leaves it', async () => {
    render(
      <>
        {ribbon()}
        <button type='button'>编辑正文</button>
      </>
    );
    fireEvent.click(screen.getByRole('button', { name: '文件' }));
    const saveAs = screen.getByRole('menuitem', { name: '另存为' });
    await waitFor(() => expect(saveAs).toHaveFocus());

    screen.getByRole('button', { name: '编辑正文' }).focus();

    await waitFor(() => expect(screen.queryByRole('menu', { name: '文件菜单' })).not.toBeInTheDocument());
  });

  it('exposes pressed state only for toggle and selection controls', () => {
    render(
      <>
        <WorkOfficeRibbonButton label='保存'>保存</WorkOfficeRibbonButton>
        <WorkOfficeRibbonButton label='加粗' active={false}>
          B
        </WorkOfficeRibbonButton>
        <WorkOfficeRibbonButton label='居中' active>
          居中
        </WorkOfficeRibbonButton>
      </>
    );

    expect(screen.getByRole('button', { name: '保存' })).not.toHaveAttribute('aria-pressed');
    expect(screen.getByRole('button', { name: '加粗' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '居中' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('adds explicit navigation when ribbon tools overflow horizontally', async () => {
    renderRibbon();
    const toolbar = screen.getByRole('toolbar', { name: '开始工具栏' });
    Object.defineProperties(toolbar, {
      clientWidth: { configurable: true, value: 240 },
      scrollWidth: { configurable: true, value: 600 },
      scrollLeft: { configurable: true, value: 0, writable: true },
    });

    fireEvent(window, new Event('resize'));

    const next = await screen.findByRole('button', { name: '向右查看更多开始工具' });
    expect(screen.queryByRole('button', { name: '向左查看更多开始工具' })).not.toBeInTheDocument();
    fireEvent.click(next);

    expect(toolbar.scrollLeft).toBe(168);
    expect(screen.getByRole('button', { name: '向左查看更多开始工具' })).toBeInTheDocument();
  });

  it('preserves horizontal position while the active panel rerenders and resets it only when the tab changes', async () => {
    const view = render(ribbonWithPanelVersion(1));
    const toolbar = screen.getByRole('toolbar', { name: '开始工具栏' });
    Object.defineProperties(toolbar, {
      clientWidth: { configurable: true, value: 240 },
      scrollWidth: { configurable: true, value: 600 },
      scrollLeft: { configurable: true, value: 168, writable: true },
    });

    view.rerender(ribbonWithPanelVersion(2));

    expect(toolbar.scrollLeft).toBe(168);
    fireEvent.click(screen.getByRole('tab', { name: '插入' }));
    await waitFor(() => expect(toolbar.scrollLeft).toBe(0));
  });

  it('keeps file actions discoverable in a compact preview bar', async () => {
    const print = vi.fn();
    render(
      <WorkOfficePreviewBar
        ariaLabel='文字预览工具'
        label='只读预览'
        detail='3 页'
        fileActions={[{ id: 'print', label: '打印', onSelect: print }]}
      />
    );

    expect(screen.getByRole('region', { name: '文字预览工具' })).toHaveTextContent('只读预览3 页');
    fireEvent.click(screen.getByRole('button', { name: '文件' }));
    const action = await screen.findByRole('menuitem', { name: '打印' });
    fireEvent.click(action);

    expect(print).toHaveBeenCalledTimes(1);
  });
});

function renderRibbon() {
  return render(ribbon());
}

function ribbon() {
  return ribbonWithPanelVersion(1);
}

function ribbonWithPanelVersion(version: number) {
  return (
    <WorkOfficeRibbon
      ariaLabel='测试功能区'
      tabs={[
        { id: 'home', label: '开始' },
        { id: 'insert', label: '插入' },
      ]}
      defaultTab='home'
      panels={{
        home: <button type='button'>加粗 {version}</button>,
        insert: <button type='button'>图片</button>,
      }}
      fileActions={[
        { id: 'save', label: '保存', disabled: true, onSelect: vi.fn() },
        { id: 'save-as', label: '另存为', onSelect: vi.fn() },
        { id: 'print', label: '打印', onSelect: vi.fn() },
      ]}
    />
  );
}

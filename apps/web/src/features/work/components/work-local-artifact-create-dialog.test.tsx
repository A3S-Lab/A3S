import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkLocalArtifactCreateDialog } from './work-local-artifact-create-dialog';

describe('Work local Office creation dialog', () => {
  afterEach(cleanup);

  it('keeps an existing destination safe and creates after the user changes the name', async () => {
    const onCreate = vi.fn().mockResolvedValueOnce('exists').mockResolvedValueOnce('created');
    const onClose = vi.fn();
    render(
      <WorkLocalArtifactCreateDialog
        templateId='blank-document'
        directory='/docs'
        onClose={onClose}
        onCreate={onCreate}
      />
    );

    expect(screen.getByLabelText('本地 Office 文件名')).toHaveValue('新建文字文档.docx');
    fireEvent.click(screen.getByRole('button', { name: '创建文件' }));
    const error = await screen.findByText('当前文件夹中已有同名文件，请使用其他名称。');
    const fileName = screen.getByLabelText('本地 Office 文件名');
    expect(fileName).toHaveAttribute('aria-describedby', error.id);
    expect(fileName).toHaveAttribute('aria-invalid', 'true');
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.change(fileName, { target: { value: '项目计划.docx' } });
    fireEvent.click(screen.getByRole('button', { name: '创建文件' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onCreate).toHaveBeenNthCalledWith(2, '项目计划.docx');
  });
});

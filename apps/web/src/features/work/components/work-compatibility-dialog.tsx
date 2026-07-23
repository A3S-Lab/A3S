import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { Button, Dialog } from '../../../design-system/primitives';
import type { WorkCompatibilityReport } from '../work-types';

export function WorkCompatibilityDialog({
  report,
  mode,
  busy = false,
  onClose,
  onConfirm,
}: {
  report: WorkCompatibilityReport;
  mode: 'import' | 'export' | 'save' | 'review';
  busy?: boolean;
  onClose: () => void;
  onConfirm?: () => void;
}) {
  const [technicalDetailsOpen, setTechnicalDetailsOpen] = useState(false);
  const warnings = report.issues.filter((issue) => issue.severity === 'warning').length;
  const errors = report.issues.filter((issue) => issue.severity === 'error').length;
  const title =
    mode === 'import'
      ? '导入前检查'
      : mode === 'export'
        ? '导出前兼容性检查'
        : mode === 'save'
          ? '保存前兼容性检查'
          : '文件兼容性';
  const description =
    mode === 'import'
      ? '确认后即可继续编辑。'
      : mode === 'export'
        ? '确认后继续导出。'
        : mode === 'save'
          ? '确认后写回本地文件。'
          : `${report.sourceName} 的检查结果`;

  return (
    <Dialog
      title={title}
      description={description}
      onClose={onClose}
      closeDisabled={busy}
      footer={
        mode === 'review' ? undefined : (
          <>
            <Button tone='quiet' disabled={busy} onClick={onClose}>
              取消
            </Button>
            <Button tone='primary' loading={busy} data-autofocus onClick={onConfirm}>
              {mode === 'import' ? '继续导入并保留原文件' : mode === 'save' ? '仍然保存' : '仍然导出'}
            </Button>
          </>
        )
      }
    >
      <section className='work-compatibility-report'>
        <header className={errors ? 'error' : warnings ? 'warning' : 'clear'}>
          <span>
            {errors ? <ShieldAlert size={19} /> : warnings ? <AlertTriangle size={19} /> : <CheckCircle2 size={19} />}
          </span>
          <div>
            <strong>
              {errors
                ? '有些内容无法完整转换，原文件仍会保留。'
                : warnings
                  ? '排版可能有轻微变化，正文和原文件都会保留。'
                  : '文件可以正常编辑，原文件也会保留。'}
            </strong>
          </div>
        </header>
        {report.issues.length > 0 && (
          <Button
            tone='quiet'
            className='work-compatibility-details'
            aria-expanded={technicalDetailsOpen}
            onClick={() => setTechnicalDetailsOpen((open) => !open)}
          >
            {technicalDetailsOpen ? '收起技术详情' : '查看技术详情'}
          </Button>
        )}
        {technicalDetailsOpen && report.issues.length > 0 && (
          <ol>
            {report.issues.map((issue, index) => (
              <li className={issue.severity} key={`${issue.code}-${issue.location ?? ''}-${index}`}>
                <span>{issue.severity === 'info' ? <Info size={14} /> : <AlertTriangle size={14} />}</span>
                <div>
                  <strong>{issue.feature}</strong>
                  <p>{issue.message}</p>
                  {issue.location && <small>{issue.location}</small>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </Dialog>
  );
}

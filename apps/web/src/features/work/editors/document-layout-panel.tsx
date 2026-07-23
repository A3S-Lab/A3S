import { clampDocumentMargin } from '../work-document-layout';
import { Button } from '../../../design-system/primitives';
import { documentPageChromeLegacyFields, normalizeDocumentPageChrome } from '../work-document-page-chrome';
import type { WorkDocumentMargins, WorkDocumentSectionLayout } from '../work-types';
import { DocumentColumnsPanel } from './document-columns-panel';
import { DocumentPageChromePanel } from './document-page-chrome-panel';
import { OfficeNumberField, OfficeSelect } from './office-controls';

export function DocumentLayoutPanel({
  layout,
  sectionIndex,
  sectionCount,
  onChange,
  onInsertSection,
  onMergeSection,
}: {
  layout: WorkDocumentSectionLayout;
  sectionIndex: number;
  sectionCount: number;
  onChange: (layout: WorkDocumentSectionLayout) => void;
  onInsertSection: () => void;
  onMergeSection: () => void;
}) {
  const marginFields: Array<[keyof WorkDocumentMargins, string]> = [
    ['top', '上'],
    ['right', '右'],
    ['bottom', '下'],
    ['left', '左'],
  ];
  const update = (patch: Partial<WorkDocumentSectionLayout>) => onChange({ ...layout, ...patch });
  return (
    <fieldset className='work-document-layout-panel' aria-label='页面设置'>
      <legend>
        第 {sectionIndex + 1} 节 · 共 {sectionCount} 节
      </legend>
      <div className='work-office-field'>
        <span>本节之后</span>
        <OfficeSelect
          ariaLabel='分节方式'
          value={layout.breakAfter}
          options={[
            { value: 'nextPage', label: '下一页' },
            { value: 'continuous', label: '连续' },
            { value: 'evenPage', label: '下一偶数页' },
            { value: 'oddPage', label: '下一奇数页' },
            { value: 'nextColumn', label: '下一栏（预览按连续节）' },
          ]}
          onValueChange={(breakAfter) => update({ breakAfter })}
        />
      </div>
      <div className='work-document-section-actions'>
        <Button size='compact' onClick={onInsertSection}>
          插入新节
        </Button>
        <Button size='compact' disabled={sectionIndex === 0} onClick={onMergeSection}>
          与上一节合并
        </Button>
      </div>
      <div className='work-office-field'>
        <span>纸张</span>
        <OfficeSelect
          ariaLabel='纸张大小'
          value={layout.pageSize}
          options={[
            { value: 'a4', label: 'A4' },
            { value: 'letter', label: 'Letter' },
          ]}
          onValueChange={(pageSize) => update({ pageSize })}
        />
      </div>
      <div className='work-office-field'>
        <span>方向</span>
        <OfficeSelect
          ariaLabel='页面方向'
          value={layout.orientation}
          options={[
            { value: 'portrait', label: '纵向' },
            { value: 'landscape', label: '横向' },
          ]}
          onValueChange={(orientation) => update({ orientation })}
        />
      </div>
      <DocumentColumnsPanel columns={layout.columns} onChange={(columns) => update({ columns })} />
      <fieldset>
        <legend>页边距（毫米）</legend>
        {marginFields.map(([side, label]) => (
          <div className='work-office-field' key={side}>
            <span>{label}</span>
            <OfficeNumberField
              min={5}
              max={60}
              step={1}
              ariaLabel={`${label}页边距`}
              value={layout.margins[side]}
              onValueChange={(value) =>
                update({
                  margins: {
                    ...layout.margins,
                    [side]: clampDocumentMargin(Number(value)),
                  },
                })
              }
            />
          </div>
        ))}
      </fieldset>
      <DocumentPageChromePanel
        pageChrome={normalizeDocumentPageChrome(layout.pageChrome, layout)}
        onChange={(pageChrome) => update({ pageChrome, ...documentPageChromeLegacyFields(pageChrome) })}
      />
      <div className='work-office-field work-document-page-number-option'>
        <span>本节页码从</span>
        <OfficeNumberField
          min={1}
          max={9999}
          ariaLabel='起始页码'
          value={Math.max(1, layout.pageNumberStart ?? 1)}
          onValueChange={(value) =>
            update({
              pageNumberStart: Math.min(9999, Math.max(1, Math.round(Number(value) || 1))),
            })
          }
        />
        <span>开始</span>
      </div>
    </fieldset>
  );
}

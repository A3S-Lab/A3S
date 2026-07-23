import type { EffectiveSpreadsheetPageSetup } from '../work-spreadsheet-page-setup';
import { OfficeCheckbox, OfficeNumberField, OfficeSelect, OfficeTextField } from './office-controls';

export function SpreadsheetHeaderFooterFields({
  pageSetup,
  onChange,
}: {
  pageSetup: EffectiveSpreadsheetPageSetup;
  onChange: (pageSetup: EffectiveSpreadsheetPageSetup) => void;
}) {
  const updateSection = (area: 'header' | 'footer', section: 'left' | 'center' | 'right', value: string) => {
    onChange({ ...pageSetup, [area]: { ...pageSetup[area], [section]: value } });
  };
  return (
    <fieldset className='work-spreadsheet-header-footer-fields'>
      <legend>页眉、页脚与页码</legend>
      <TemplateField
        label='页眉左侧'
        value={pageSetup.header.left}
        onChange={(value) => updateSection('header', 'left', value)}
      />
      <TemplateField
        label='页眉中间'
        value={pageSetup.header.center}
        onChange={(value) => updateSection('header', 'center', value)}
      />
      <TemplateField
        label='页眉右侧'
        value={pageSetup.header.right}
        onChange={(value) => updateSection('header', 'right', value)}
      />
      <TemplateField
        label='页脚左侧'
        value={pageSetup.footer.left}
        onChange={(value) => updateSection('footer', 'left', value)}
      />
      <TemplateField
        label='页脚中间'
        value={pageSetup.footer.center}
        onChange={(value) => updateSection('footer', 'center', value)}
      />
      <TemplateField
        label='页脚右侧'
        value={pageSetup.footer.right}
        onChange={(value) => updateSection('footer', 'right', value)}
      />
      <div className='work-office-field'>
        <span>起始页码</span>
        <OfficeNumberField
          ariaLabel='起始页码'
          min={1}
          max={32767}
          value={pageSetup.pageNumberStart}
          onValueChange={(pageNumberStart) => onChange({ ...pageSetup, pageNumberStart: Number(pageNumberStart) })}
        />
      </div>
      <div className='work-office-field'>
        <span>打印页顺序</span>
        <OfficeSelect
          ariaLabel='打印页顺序'
          value={pageSetup.pageOrder}
          options={[
            { value: 'overThenDown', label: '先向右，再向下' },
            { value: 'downThenOver', label: '先向下，再向右' },
          ]}
          onValueChange={(pageOrder) =>
            onChange({
              ...pageSetup,
              pageOrder: pageOrder as EffectiveSpreadsheetPageSetup['pageOrder'],
            })
          }
        />
      </div>
      <OfficeCheckbox
        className='toggle'
        ariaLabel='页眉页脚随文档缩放'
        checked={pageSetup.scaleWithDocument}
        onCheckedChange={(scaleWithDocument) => onChange({ ...pageSetup, scaleWithDocument })}
      >
        页眉页脚随文档缩放
      </OfficeCheckbox>
      <OfficeCheckbox
        className='toggle'
        ariaLabel='页眉页脚与页边距对齐'
        checked={pageSetup.alignWithMargins}
        onCheckedChange={(alignWithMargins) => onChange({ ...pageSetup, alignWithMargins })}
      >
        页眉页脚与页边距对齐
      </OfficeCheckbox>
      <p className='tokens'>
        可用字段：{'{page}'}、{'{pages}'}、{'{sheet}'}、{'{file}'}、{'{path}'}、{'{date}'}、{'{time}'}
      </p>
    </fieldset>
  );
}

function TemplateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className='work-office-field'>
      <span>{label}</span>
      <OfficeTextField
        aria-label={label}
        value={value}
        placeholder={label.includes('右侧') ? 'Page {page} of {pages}' : ''}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import {
  normalizeDocumentPageChrome,
  sanitizeDocumentPageChromeHtml,
  updateDocumentPageChromeVariant,
} from '../work-document-page-chrome';
import type {
  WorkDocumentPageChrome,
  WorkDocumentPageChromeContent,
  WorkDocumentPageChromeVariant,
} from '../work-types';
import { OfficeCheckbox, OfficeColorPicker, OfficeFileInput, OfficeSelect, useOfficeDialog } from './office-controls';

export function DocumentPageChromePanel({
  pageChrome,
  onChange,
}: {
  pageChrome: WorkDocumentPageChrome;
  onChange: (pageChrome: WorkDocumentPageChrome) => void;
}) {
  const chrome = normalizeDocumentPageChrome(pageChrome);
  const [variant, setVariant] = useState<WorkDocumentPageChromeVariant>('default');
  const label = variant === 'first' ? '首页' : variant === 'even' ? '偶数页' : '默认页';
  const updateVariant = (patch: Partial<WorkDocumentPageChromeContent>) => {
    onChange(updateDocumentPageChromeVariant(chrome, variant, patch));
  };
  const toggleFirstPage = (enabled: boolean) => {
    onChange({
      ...chrome,
      differentFirstPage: enabled,
      first: enabled && emptyPageChrome(chrome.first) ? { ...chrome.default } : chrome.first,
    });
    if (!enabled && variant === 'first') setVariant('default');
  };
  const toggleOddEvenPages = (enabled: boolean) => {
    onChange({
      ...chrome,
      differentOddEvenPages: enabled,
      even: enabled && emptyPageChrome(chrome.even) ? { ...chrome.default } : chrome.even,
    });
    if (!enabled && variant === 'even') setVariant('default');
  };

  return (
    <fieldset className='work-document-page-chrome-panel'>
      <legend>富文本页眉与页脚</legend>
      <div className='work-document-page-chrome-options'>
        <OfficeCheckbox
          ariaLabel='首页页眉页脚不同'
          checked={chrome.differentFirstPage}
          onCheckedChange={toggleFirstPage}
        >
          首页不同
        </OfficeCheckbox>
        <OfficeCheckbox
          ariaLabel='奇偶页页眉页脚不同'
          checked={chrome.differentOddEvenPages}
          onCheckedChange={toggleOddEvenPages}
        >
          奇偶页不同
        </OfficeCheckbox>
        <div className='work-office-field'>
          <span>编辑</span>
          <OfficeSelect
            ariaLabel='页眉页脚页面类型'
            value={variant}
            options={[
              { value: 'default', label: '默认页' },
              { value: 'first', label: '首页', disabled: !chrome.differentFirstPage },
              { value: 'even', label: '偶数页', disabled: !chrome.differentOddEvenPages },
            ]}
            onValueChange={setVariant}
          />
        </div>
      </div>
      <PageChromeRichTextEditor
        key={`${variant}-header`}
        label={`${label}页眉`}
        value={chrome[variant].headerHtml}
        onChange={(headerHtml) => updateVariant({ headerHtml })}
      />
      <PageChromeRichTextEditor
        key={`${variant}-footer`}
        label={`${label}页脚`}
        value={chrome[variant].footerHtml}
        onChange={(footerHtml) => updateVariant({ footerHtml })}
      />
      <OfficeCheckbox
        className='work-document-page-number-option'
        ariaLabel={`${label}显示页码`}
        checked={chrome[variant].showPageNumber}
        onCheckedChange={(showPageNumber) => updateVariant({ showPageNumber })}
      >
        在本页面类型的页脚中显示页码
      </OfficeCheckbox>
    </fieldset>
  );
}

function PageChromeRichTextEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (html: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [textColor, setTextColor] = useState('#4d5668');
  const officeDialog = useOfficeDialog();

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor || editor.innerHTML === value) return;
    editor.innerHTML = value;
  }, [value]);

  const commit = () => {
    const editor = editorRef.current;
    if (editor) onChange(sanitizeDocumentPageChromeHtml(editor.innerHTML));
  };
  const format = (command: string, commandValue?: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    if (typeof document.execCommand === 'function') {
      document.execCommand('styleWithCSS', false, 'true');
      document.execCommand(command, false, commandValue);
    }
    commit();
  };

  return (
    <>
      <section className='work-document-page-chrome-editor' aria-label={label}>
        <div className='work-document-page-chrome-toolbar' role='toolbar' aria-label={`${label}格式`}>
          <ChromeButton label={`${label}加粗`} onClick={() => format('bold')}>
            B
          </ChromeButton>
          <ChromeButton label={`${label}斜体`} onClick={() => format('italic')}>
            I
          </ChromeButton>
          <ChromeButton label={`${label}下划线`} onClick={() => format('underline')}>
            U
          </ChromeButton>
          <ChromeButton label={`${label}左对齐`} onClick={() => format('justifyLeft')}>
            左
          </ChromeButton>
          <ChromeButton label={`${label}居中`} onClick={() => format('justifyCenter')}>
            中
          </ChromeButton>
          <ChromeButton label={`${label}右对齐`} onClick={() => format('justifyRight')}>
            右
          </ChromeButton>
          <ChromeButton
            label={`${label}链接`}
            onClick={() =>
              void officeDialog.prompt({ title: '链接地址', initialValue: 'https://' }).then((href) => {
                if (href?.trim()) format('createLink', href.trim());
              })
            }
          >
            链接
          </ChromeButton>
          <OfficeColorPicker
            compact
            className='work-document-page-chrome-color'
            ariaLabel={`${label}文字颜色`}
            value={textColor}
            onValueChange={(color) => {
              setTextColor(color);
              format('foreColor', color);
            }}
          />
          <ChromeButton label={`${label}插入图片`} onClick={() => imageInputRef.current?.click()}>
            图片
          </ChromeButton>
        </div>
        <OfficeFileInput
          ref={imageInputRef}
          accept='image/*'
          aria-label={`${label}图片文件`}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file || file.size > 4 * 1024 * 1024) return;
            void fileToDataUrl(file).then((source) => {
              const editor = editorRef.current;
              if (!editor) return;
              editor.focus();
              if (typeof document.execCommand === 'function') document.execCommand('insertImage', false, source);
              else editor.insertAdjacentHTML('beforeend', `<img src="${source}" alt="${escapeHtml(file.name)}">`);
              commit();
            });
          }}
        />
        {/* biome-ignore lint/a11y/useSemanticElements: Rich formatted content requires a contenteditable surface. */}
        <div
          ref={editorRef}
          className='work-document-page-chrome-content'
          role='textbox'
          aria-label={label}
          aria-multiline='true'
          tabIndex={0}
          contentEditable
          suppressContentEditableWarning
          data-placeholder={`输入${label}`}
          dangerouslySetInnerHTML={{ __html: value }}
          onInput={commit}
          onBlur={commit}
        />
      </section>
      {officeDialog.dialog}
    </>
  );
}

function ChromeButton({ label, onClick, children }: { label: string; onClick: () => void; children: string }) {
  return (
    <button
      type='button'
      aria-label={label}
      title={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function emptyPageChrome(content: WorkDocumentPageChromeContent): boolean {
  return !content.headerHtml && !content.footerHtml && !content.showPageNumber;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)));
    reader.addEventListener('error', () => reject(reader.error ?? new Error('Image could not be read')));
    reader.readAsDataURL(file);
  });
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

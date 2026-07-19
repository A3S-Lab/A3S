import { code } from '@streamdown/code';
import { Streamdown, type StreamdownTranslations } from 'streamdown';

const translations: StreamdownTranslations = {
  close: '关闭',
  copied: '已复制',
  copyCode: '复制代码',
  copyLink: '复制链接',
  copyTable: '复制表格',
  copyTableAsCsv: '复制为 CSV',
  copyTableAsMarkdown: '复制为 Markdown',
  copyTableAsTsv: '复制为 TSV',
  downloadDiagram: '下载图表',
  downloadDiagramAsMmd: '下载为 MMD',
  downloadDiagramAsPng: '下载为 PNG',
  downloadDiagramAsSvg: '下载为 SVG',
  downloadFile: '下载文件',
  downloadImage: '下载图片',
  downloadTable: '下载表格',
  downloadTableAsCsv: '下载为 CSV',
  downloadTableAsMarkdown: '下载为 Markdown',
  exitFullscreen: '退出全屏',
  externalLinkWarning: '即将打开外部链接',
  imageNotAvailable: '图片不可用',
  mermaidFormatMmd: 'MMD',
  mermaidFormatPng: 'PNG',
  mermaidFormatSvg: 'SVG',
  openExternalLink: '继续打开',
  openLink: '打开链接',
  tableFormatCsv: 'CSV',
  tableFormatMarkdown: 'Markdown',
  tableFormatTsv: 'TSV',
  viewFullscreen: '全屏查看',
};

export default function StreamingMarkdown({ content, streaming }: { content: string; streaming: boolean }) {
  return (
    <Streamdown
      className={`streaming-markdown a3s-document-markdown${streaming ? ' is-streaming' : ''}`}
      dir='auto'
      aria-busy={streaming || undefined}
      mode={streaming ? 'streaming' : 'static'}
      isAnimating={streaming}
      parseIncompleteMarkdown
      normalizeHtmlIndentation
      plugins={{ code }}
      shikiTheme={['github-light', 'github-dark']}
      controls={{
        code: { copy: true, download: false },
        table: { copy: true, download: false, fullscreen: true },
      }}
      lineNumbers
      translations={translations}
    >
      {content}
    </Streamdown>
  );
}

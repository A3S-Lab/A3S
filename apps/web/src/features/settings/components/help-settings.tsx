import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';

const entries = [
  {
    group: '开始使用',
    title: '新任务',
    description: '创建独立任务，并在发送前确认目标、文件上下文和运行配置。',
    keys: ['⌘/Ctrl', 'N'],
  },
  {
    group: '开始使用',
    title: '快速导航',
    description: '搜索页面和操作，无需记忆终端指令。',
    keys: ['⌘/Ctrl', 'K'],
  },
  {
    group: '开始使用',
    title: '设置',
    description: '管理外观、默认模型、A3S OS 账户和版本更新。',
    keys: ['⌘/Ctrl', ','],
  },
  { group: '开始使用', title: '帮助', description: '查看 Web 工作流、安全说明和快捷键。', keys: ['?'] },
  {
    group: '任务',
    title: '任务参数',
    description: '通过 /goal 设置目标，并在输入框内切换模型、Effort、执行模式和上下文用量。',
    keys: [],
  },
  {
    group: '任务',
    title: '执行模式',
    description: '通过输入框左下角的模式图标选择按需确认、只读规划或自动执行。',
    keys: [],
  },
  {
    group: '工作区',
    title: '文件与编辑器',
    description: '浏览、创建、复制、重命名、删除、搜索和编辑项目文件。',
    keys: [],
  },
  { group: '工作区', title: 'Git 工作流', description: '查看差异、暂存更改并在确认后创建提交。', keys: [] },
  {
    group: '安全',
    title: '有影响的操作',
    description: '文件删除、全局替换、Git 提交和版本更新都会说明范围并要求确认。',
    keys: [],
  },
  {
    group: '安全',
    title: '本地优先',
    description: '工作区、任务记录和凭据由本机 A3S CLI 持有，浏览器不保存密钥。',
    keys: [],
  },
];

export function HelpSettings() {
  const [query, setQuery] = useState('');
  const visible = useMemo(
    () =>
      entries.filter((entry) =>
        `${entry.group} ${entry.title} ${entry.description} ${entry.keys.join(' ')}`
          .toLowerCase()
          .includes(query.trim().toLowerCase())
      ),
    [query]
  );
  const groups = [...new Set(visible.map((entry) => entry.group))];

  return (
    <section className='help-settings' aria-label='帮助内容'>
      <label className='help-search'>
        <Search size={15} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder='搜索功能、安全策略或快捷键'
          aria-label='搜索帮助'
        />
      </label>
      <div className='help-content'>
        {groups.map((group) => (
          <section key={group}>
            <h3>{group}</h3>
            {visible
              .filter((entry) => entry.group === group)
              .map((entry) => (
                <article key={entry.title}>
                  <div>
                    <strong>{entry.title}</strong>
                    <p>{entry.description}</p>
                  </div>
                  {entry.keys.length > 0 && (
                    <span>
                      {entry.keys.map((key) => (
                        <kbd key={key}>{key}</kbd>
                      ))}
                    </span>
                  )}
                </article>
              ))}
          </section>
        ))}
        {!visible.length && <div className='help-empty'>没有匹配的帮助内容</div>}
      </div>
    </section>
  );
}

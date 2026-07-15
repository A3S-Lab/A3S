import { Check, Laptop, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useSnapshot } from 'valtio';
import { appState, setTheme, type ThemePreference } from '../../../state/app-state';

const themeOptions: Array<{
  id: ThemePreference;
  label: string;
  icon: LucideIcon;
  hint: string;
}> = [
  { id: 'system', label: '跟随系统', icon: Laptop, hint: '自动适配设备外观' },
  { id: 'light', label: '浅色', icon: Sun, hint: '明亮、专注的工作台' },
  { id: 'dark', label: '深色', icon: Moon, hint: '适合低光环境' },
];

export function AppearanceSettings() {
  const state = useSnapshot(appState);
  return (
    <div className='settings-section'>
      <div className='setting-heading'>
        <h3>主题</h3>
        <p>界面会立即应用到所有工作区区域。</p>
      </div>
      <div className='theme-grid'>
        {themeOptions.map(({ id, label, icon: Icon, hint }) => (
          <button
            type='button'
            className={`theme-card ${state.theme === id ? 'active' : ''}`}
            aria-pressed={state.theme === id}
            key={id}
            onClick={() => setTheme(id)}
          >
            <span>
              <Icon size={19} />
            </span>
            <strong>{label}</strong>
            <small>{hint}</small>
            {state.theme === id && (
              <i>
                <Check size={13} />
              </i>
            )}
          </button>
        ))}
      </div>
      <div className='setting-row'>
        <div>
          <strong>工作区</strong>
          <span>当前 A3S Code 的默认项目根目录</span>
        </div>
        <code>{state.workspaceRoot}</code>
      </div>
    </div>
  );
}

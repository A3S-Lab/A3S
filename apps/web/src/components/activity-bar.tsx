import {
  BookOpen,
  BrainCircuit,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  Code2,
  Database,
  FileText,
  FlaskConical,
  Globe2,
  type LucideIcon,
  Puzzle,
  Search,
  Settings,
  Store,
} from 'lucide-react';
import { useSnapshot } from 'valtio';
import {
  appState,
  navigateKnowledge,
  navigateMemory,
  navigatePlugin,
  navigatePlugins,
  navigateProduct,
  navigateSettings,
  navigateTask,
} from '../state/app-state';

const pluginIcons: Record<string, LucideIcon> = {
  'book-open': BookOpen,
  'chart-no-axes-combined': ChartNoAxesCombined,
  database: Database,
  'file-text': FileText,
  'flask-conical': FlaskConical,
  globe: Globe2,
  search: Search,
};

export function ActivityBar() {
  const state = useSnapshot(appState);
  const plugins = [...state.pluginCatalog.items]
    .filter((item) => item.enabled)
    .sort(
      (left, right) =>
        left.order - right.order || left.title.localeCompare(right.title) || left.key.localeCompare(right.key)
    );

  return (
    <nav className='activity-bar' aria-label='A3S 产品'>
      <div className='activity-brand' role='img' aria-label='A3S'>
        <img src='/logo.png' alt='' />
      </div>
      <div className='activity-products'>
        <ActivityButton
          label='编码'
          tooltip='编码'
          active={state.activeProduct === 'code' && state.codeSurface === 'tasks'}
          icon={Code2}
          onClick={() => {
            appState.sidebarOpen = true;
            navigateTask('conversation');
          }}
        />
        <ActivityButton
          label='办公'
          tooltip='办公'
          active={state.activeProduct === 'work'}
          icon={BriefcaseBusiness}
          onClick={() => {
            appState.sidebarOpen = true;
            navigateProduct('work');
          }}
        />
        <ActivityButton
          label='知识'
          tooltip='知识'
          active={state.activeProduct === 'knowledge'}
          icon={BookOpen}
          onClick={() => {
            appState.sidebarOpen = true;
            navigateKnowledge();
          }}
        />
        {plugins.map((plugin) => (
          <ActivityButton
            key={plugin.key}
            label={plugin.title}
            tooltip={plugin.title}
            active={state.activeProduct === 'plugin' && state.activePluginKey === plugin.key}
            icon={pluginIcons[plugin.icon] ?? Puzzle}
            onClick={() => navigatePlugin(plugin.key)}
          />
        ))}
      </div>
      <div className='activity-system'>
        <ActivityButton
          label='记忆'
          tooltip='记忆'
          active={state.activeProduct === 'code' && state.codeSurface === 'memory'}
          icon={BrainCircuit}
          onClick={navigateMemory}
        />
        <ActivityButton
          label='市场'
          tooltip='市场'
          active={state.activeProduct === 'plugins'}
          icon={Store}
          onClick={navigatePlugins}
        />
        <ActivityButton
          label='设置'
          tooltip='设置'
          active={state.settingsOpen}
          expanded={state.settingsOpen}
          icon={Settings}
          onClick={() => navigateSettings('general')}
        />
      </div>
    </nav>
  );
}

function ActivityButton({
  label,
  tooltip,
  active,
  expanded,
  icon: Icon,
  onClick,
}: {
  label: string;
  tooltip: string;
  active: boolean;
  expanded?: boolean;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button
      type='button'
      className={`activity-button ${active ? 'active' : ''}`}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      aria-expanded={expanded}
      data-activity-tooltip={tooltip}
      onClick={onClick}
    >
      <Icon size={20} />
    </button>
  );
}

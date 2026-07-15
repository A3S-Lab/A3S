import { BriefcaseBusiness, Code2, FlaskConical, Settings } from 'lucide-react';
import { useSnapshot } from 'valtio';
import { appState, navigateSettings, navigateTask, showToast } from '../state/app-state';

const products = [
  { id: 'work', name: '办公', icon: BriefcaseBusiness, available: false },
  { id: 'code', name: '编码', icon: Code2, available: true },
  { id: 'science', name: '科学', icon: FlaskConical, available: false },
] as const;

export function ActivityBar() {
  const state = useSnapshot(appState);
  return (
    <nav className='activity-bar' aria-label='A3S 产品'>
      <div className='activity-brand' role='img' aria-label='A3S'>
        <img src='/logo.png' alt='' />
      </div>
      <div className='activity-products'>
        {products.map(({ id, name, icon: Icon, available }) => (
          <button
            type='button'
            className={`activity-button ${id === 'code' ? 'active' : ''}`}
            aria-label={available ? name : `${name}，敬请期待`}
            aria-current={id === 'code' ? 'page' : undefined}
            data-coming-soon={!available || undefined}
            data-activity-tooltip={name}
            key={id}
            onClick={() => {
              if (available) {
                appState.sidebarOpen = true;
                navigateTask('conversation');
              } else {
                showToast(`${name}敬请期待`, 'info');
              }
            }}
          >
            <Icon size={20} />
            {!available && <span className='coming-dot' aria-hidden='true' />}
          </button>
        ))}
      </div>
      <div className='activity-system'>
        <button
          type='button'
          className={`activity-button ${state.settingsOpen ? 'active' : ''}`}
          aria-label='设置'
          aria-expanded={state.settingsOpen}
          data-activity-tooltip='设置'
          onClick={() => navigateSettings('general')}
        >
          <Settings size={20} />
        </button>
      </div>
    </nav>
  );
}

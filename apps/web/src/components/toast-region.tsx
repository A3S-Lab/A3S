import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useTimeout } from 'ahooks';
import { useSnapshot } from 'valtio';
import { IconButton } from '../design-system/primitives';
import { appState, clearToast } from '../state/app-state';

export function ToastRegion() {
  const state = useSnapshot(appState);
  return (
    <div className='toast-region' aria-live='polite' aria-atomic='true'>
      {state.toast && <ToastItem key={state.toast.id} toast={state.toast} />}
    </div>
  );
}

function ToastItem({ toast }: { toast: { id: number; tone: 'info' | 'success' | 'error'; message: string } }) {
  useTimeout(() => clearToast(toast.id), toast.tone === 'error' ? 8000 : 4000);
  const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? XCircle : Info;
  return (
    <div className={`toast ${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'}>
      <Icon size={18} />
      <span>{toast.message}</span>
      <IconButton label='关闭通知' onClick={() => clearToast(toast.id)}>
        <X size={15} />
      </IconButton>
    </div>
  );
}

import { LoaderCircle } from 'lucide-react';
import { StateView } from '../../../design-system/primitives';

export function WorkEditorLoadingState({ title }: { title: string }) {
  return (
    <StateView
      className='work-editor-loading'
      size='compact'
      role='status'
      icon={<LoaderCircle className='spin' size={20} />}
      title={title}
    />
  );
}

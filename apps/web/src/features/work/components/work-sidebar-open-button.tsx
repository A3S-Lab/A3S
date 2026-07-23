import { SidebarProductOpenButton } from '../../../components/sidebar-product-header';

export function WorkSidebarOpenButton({ onOpen }: { onOpen: () => void }) {
  return <SidebarProductOpenButton title='办公' className='work-sidebar-open-button' onOpen={onOpen} />;
}

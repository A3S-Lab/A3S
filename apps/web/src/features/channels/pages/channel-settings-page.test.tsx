import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appState } from '../../../state/app-state';
import type { WeixinRemoteActions } from '../../weixin-remote/use-weixin-remote-controller';
import { createWeixinRemoteState } from '../../weixin-remote/weixin-remote-state';
import { ChannelSettingsPage } from './channel-settings-page';

const weixinActions: WeixinRemoteActions = {
  refresh: vi.fn(async () => undefined),
  refreshTargets: vi.fn(async () => undefined),
  startLogin: vi.fn(async () => true),
  submitVerification: vi.fn(async () => true),
  retryLoginPolling: vi.fn(),
  cancelLogin: vi.fn(async () => undefined),
  dismissLogin: vi.fn(),
  pause: vi.fn(async () => undefined),
  resume: vi.fn(async () => undefined),
  disconnect: vi.fn(async () => undefined),
};

describe('ChannelSettingsPage', () => {
  beforeEach(() => {
    Object.assign(appState, createWeixinRemoteState(), {
      settingsOpen: true,
      settingsTab: 'channels',
      settingsChannel: 'weixin',
    });
    appState.weixinCapabilityStatus = 'unavailable';
    appState.weixinCapability = {
      schemaVersion: 2,
      state: 'unavailable',
      protocolMode: 'disabled',
      supportedScopes: [],
      releaseBlockers: [{ code: 'ilink_channel_disabled', message: 'Channel disabled.' }],
    };
    window.history.replaceState(null, '', '#settings/channels/weixin');
  });

  afterEach(() => {
    cleanup();
    Object.assign(appState, createWeixinRemoteState(), {
      settingsOpen: false,
      settingsTab: 'general',
      settingsChannel: 'weixin',
    });
    window.history.replaceState(null, '', '#code/conversation');
  });

  it('switches internal channel tabs without changing the outer Settings page', async () => {
    render(<ChannelSettingsPage weixinActions={weixinActions} />);

    expect(screen.getByRole('tab', { name: '微信' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: '微信渠道尚未就绪' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '飞书' }));

    expect(appState.settingsTab).toBe('channels');
    expect(appState.settingsChannel).toBe('feishu');
    expect(window.location.hash).toBe('#settings/channels/feishu');
    await waitFor(() => expect(screen.getByRole('tab', { name: '飞书' })).toHaveAttribute('aria-selected', 'true'));
    expect(screen.getByRole('heading', { name: '飞书渠道' })).toBeInTheDocument();
    expect(screen.getByText('敬请期待')).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('tab', { name: '飞书' }), { key: 'ArrowLeft' });

    expect(appState.settingsTab).toBe('channels');
    expect(appState.settingsChannel).toBe('weixin');
    expect(window.location.hash).toBe('#settings/channels/weixin');
    await waitFor(() => expect(screen.getByRole('tab', { name: '微信' })).toHaveAttribute('aria-selected', 'true'));
    expect(screen.getByRole('tab', { name: '微信' })).toHaveFocus();
  });
});

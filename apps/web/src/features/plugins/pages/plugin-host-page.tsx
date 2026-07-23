import { AlertTriangle, Box, LoaderCircle, RefreshCw, ShieldCheck, Store } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSnapshot } from 'valtio';
import { Button, Dialog, PageHeader, StateView, StatusBadge } from '../../../design-system/primitives';
import { appState, navigatePlugins } from '../../../state/app-state';
import { buildPluginDocument } from '../plugin-document';
import { activityHostInit, parsePluginMessage } from '../plugin-protocol';
import type { PluginActions } from '../use-plugin-controller';

type FrameStatus = 'loading' | 'ready' | 'error';

export function PluginHostPage({ actions }: { actions: PluginActions }) {
  const state = useSnapshot(appState);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [frameStatus, setFrameStatus] = useState<FrameStatus>('loading');
  const [frameGeneration, setFrameGeneration] = useState(0);
  const key = state.activePluginKey;
  const contribution = state.pluginCatalog.items.find((item) => item.key === key && item.enabled);
  const content = key ? state.pluginContentByKey[key] : undefined;
  const document = useMemo(
    () => (content ? buildPluginDocument(content.html, [...content.styles], [...content.scripts]) : ''),
    [content]
  );
  const contentToken = content ? `${content.registryRevision}:${content.sha256}:${frameGeneration}` : '';

  useEffect(() => {
    if (key && contribution) void actions.loadActivityContent(key);
  }, [actions.loadActivityContent, contribution, key, state.pluginCatalog.revision]);

  useEffect(() => {
    setFrameStatus('loading');
    appState.pluginRuntimeError = null;
  }, [contentToken, key]);

  useEffect(() => {
    if (!key || !contribution) return;
    const receiveMessage = (event: MessageEvent<unknown>) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const message = parsePluginMessage(event.data, key);
      if (!message) return;
      if (message.type === 'ready') {
        setFrameStatus('ready');
        appState.pluginRuntimeError = null;
      } else if (message.type === 'context') {
        actions.proposeContext(message.proposal);
      } else {
        setFrameStatus('error');
        appState.pluginRuntimeError = message.message;
      }
    };
    window.addEventListener('message', receiveMessage);
    return () => window.removeEventListener('message', receiveMessage);
  }, [actions.proposeContext, contribution, key]);

  if (!key || !contribution) {
    return (
      <PluginStateView
        icon={<LoaderCircle className='spin' size={22} />}
        title='正在解析插件…'
        message={state.pluginCatalogError ?? '正在核对已安装插件及其资产摘要。'}
        role='status'
      />
    );
  }

  const retryFrame = () => {
    appState.pluginRuntimeError = null;
    setFrameStatus('loading');
    setFrameGeneration((value) => value + 1);
  };

  return (
    <section className='plugin-host-page' aria-label={`${contribution.title} 插件`}>
      <PageHeader
        className='plugin-page-header'
        icon={<Box size={17} />}
        title={contribution.title}
        description={contribution.description || `${contribution.packageId} 提供的工作台视图`}
        actions={
          <>
            <StatusBadge tone='success'>
              <ShieldCheck size={13} /> 已校验 · {contribution.version}
            </StatusBadge>
            <Button tone='quiet' onClick={navigatePlugins}>
              <Store size={14} />
              市场
            </Button>
          </>
        }
      />

      <div className='plugin-frame-shell'>
        {state.pluginContentStatus === 'loading' && !content && (
          <PluginStateView
            icon={<LoaderCircle className='spin' size={22} />}
            title='正在加载插件资产'
            message='宿主正在核对注册表 revision、包归属和 SHA-256 摘要。'
            role='status'
          />
        )}
        {state.pluginContentStatus === 'error' && !content && (
          <PluginStateView
            icon={<AlertTriangle size={22} />}
            title='无法加载插件资产'
            message={state.pluginContentError ?? '插件内容不可用。'}
            tone='danger'
            role='alert'
            action={
              <Button tone='primary' onClick={() => void actions.loadActivityContent(key, true)}>
                <RefreshCw size={14} />
                重试
              </Button>
            }
          />
        )}
        {content && (
          <>
            <iframe
              key={contentToken}
              ref={iframeRef}
              className='plugin-frame'
              title={`${contribution.title} 插件内容`}
              sandbox='allow-scripts'
              referrerPolicy='no-referrer'
              srcDoc={document}
              onLoad={() => {
                setFrameStatus('ready');
                const theme = documentElementTheme();
                iframeRef.current?.contentWindow?.postMessage(
                  activityHostInit(theme, navigator.language || 'zh-CN', contribution.packageId, key),
                  '*'
                );
              }}
            />
            {frameStatus === 'loading' && (
              <StateView
                className='plugin-frame-overlay'
                size='compact'
                role='status'
                icon={<LoaderCircle className='spin' size={20} />}
                title='正在启动隔离视图…'
              />
            )}
            {(frameStatus === 'error' || state.pluginRuntimeError) && (
              <StateView
                className='plugin-frame-overlay'
                size='compact'
                tone='danger'
                role='alert'
                icon={<AlertTriangle size={22} />}
                title='插件视图报告了错误'
                description={state.pluginRuntimeError ?? '插件未能完成初始化。'}
                actions={
                  <Button onClick={retryFrame}>
                    <RefreshCw size={14} />
                    重新启动视图
                  </Button>
                }
              />
            )}
          </>
        )}
      </div>

      {state.pluginContextProposal?.sourceKey === key && (
        <ContextReviewDialog actions={actions} contributionTitle={contribution.title} skill={contribution.skill} />
      )}
    </section>
  );
}

function ContextReviewDialog({
  actions,
  contributionTitle,
  skill,
}: {
  actions: PluginActions;
  contributionTitle: string;
  skill: string;
}) {
  const state = useSnapshot(appState);
  const proposal = state.pluginContextProposal;
  if (!proposal) return null;
  return (
    <Dialog
      title={proposal.title}
      description={`${contributionTitle} 请求将以下内容交给 Code。`}
      onClose={actions.dismissContextProposal}
      footer={
        <>
          <Button onClick={actions.dismissContextProposal}>取消</Button>
          <Button tone='primary' onClick={actions.acceptContextProposal}>
            在 Code 中使用
          </Button>
        </>
      }
      className='plugin-review-dialog'
    >
      <div className='plugin-context-review'>
        <div className='plugin-review-assurance'>
          <ShieldCheck size={15} />
          {proposal.usePackageSkill ? (
            <span>
              只会附加你确认的上下文，以及宿主从同一签名包验证的 <code>{skill}</code> Skill。
            </span>
          ) : (
            <span>只会附加你确认的上下文，不会附加该包的专业 Skill；Code 将使用当前可用的通用能力。</span>
          )}
        </div>
        <section>
          <h3>摘要</h3>
          <p>{proposal.summary}</p>
        </section>
        {proposal.fields.length > 0 && (
          <dl>
            {proposal.fields.map((field) => (
              <div key={`${field.label}:${field.value}`}>
                <dt>{field.label}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <section>
          <h3>将加入输入框的指令</h3>
          <pre>{proposal.prompt}</pre>
        </section>
      </div>
    </Dialog>
  );
}

function PluginStateView({
  icon,
  title,
  message,
  action,
  tone = 'info',
  role,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
  action?: React.ReactNode;
  tone?: 'info' | 'danger';
  role?: 'alert' | 'status';
}) {
  return (
    <StateView
      className='plugin-state-view'
      icon={icon}
      title={title}
      description={message}
      actions={action}
      tone={tone}
      role={role}
    />
  );
}

function documentElementTheme(): 'light' | 'dark' {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

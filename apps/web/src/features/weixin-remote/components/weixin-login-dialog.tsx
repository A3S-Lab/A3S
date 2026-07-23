import { AlertTriangle, Check, LoaderCircle, QrCode, RotateCw, ScanLine } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { type FormEvent, useEffect, useState } from 'react';
import { useSnapshot } from 'valtio';
import { Button, Dialog, Field, InlineNotice } from '../../../design-system/primitives';
import { appState } from '../../../state/app-state';
import type { WeixinLoginAttempt, WeixinLoginState } from '../../../types/api';
import type { WeixinRemoteActions } from '../use-weixin-remote-controller';

const MAX_VERIFICATION_SUBMISSIONS = 3;

export function WeixinLoginDialog({ actions }: { actions: WeixinRemoteActions }) {
  const state = useSnapshot(appState);
  const attempt = state.weixinLoginAttempt as WeixinLoginAttempt | null;
  const [code, setCode] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(attempt?.expiresInSeconds ?? 0);

  useEffect(() => {
    setRemainingSeconds(attempt?.expiresInSeconds ?? 0);
    if (!attempt || isTerminal(attempt.state)) return;
    const timer = window.setInterval(() => {
      setRemainingSeconds((value) => Math.max(0, value - 1));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [attempt?.attemptId, attempt?.expiresInSeconds, attempt?.state]);

  useEffect(() => {
    if (attempt?.state !== 'verificationRequired') setCode('');
  }, [attempt?.state]);

  if (!attempt) return null;

  const busy = state.weixinOperation !== 'idle';
  const terminal = isTerminal(attempt.state);
  const handleClose = () => {
    if (terminal) actions.dismissLogin();
    else void actions.cancelLogin();
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await actions.submitVerification(code)) setCode('');
  };

  return (
    <Dialog
      title='扫码绑定微信'
      description='二维码只在本次绑定期间保留，不会写入浏览器存储。'
      className='weixin-login-dialog'
      closeDisabled={busy}
      onClose={handleClose}
      footer={
        <>
          <Button disabled={busy} onClick={handleClose}>
            {terminal ? '关闭' : '取消绑定'}
          </Button>
          {(attempt.state === 'expired' || attempt.state === 'verificationBlocked') && (
            <Button
              tone='primary'
              loading={state.weixinOperation === 'startingLogin'}
              onClick={() => void actions.startLogin(true)}
            >
              <RotateCw size={14} />
              重新生成二维码
            </Button>
          )}
        </>
      }
    >
      <div className='weixin-login-content'>
        <LoginStatus state={attempt.state} polling={state.weixinLoginPolling} />

        {attempt.qrContent && !terminal && !isVerificationState(attempt.state) && (
          <div className={`weixin-qr-frame ${attempt.state === 'scanned' ? 'scanned' : ''}`}>
            <QrContent value={attempt.qrContent} />
            {attempt.state === 'scanned' && (
              <span className='weixin-qr-overlay'>
                <Check size={26} />
                已扫码
              </span>
            )}
          </div>
        )}

        {!terminal && (
          <p className='weixin-login-countdown' aria-live='polite'>
            {isVerificationState(attempt.state) ? '本次绑定' : '二维码'}剩余 {formatCountdown(remainingSeconds)}
          </p>
        )}

        {attempt.state === 'verificationRequired' && (
          <form className='weixin-verification-form' onSubmit={submit}>
            <Field
              label='微信要求输入配对验证码'
              description='请填写手机微信页面显示的数字验证码。本机最多允许提交 3 次。'
            >
              {(controlProps) => (
                <div className='weixin-verification-control'>
                  <input
                    {...controlProps}
                    data-autofocus
                    inputMode='numeric'
                    autoComplete='one-time-code'
                    pattern='[0-9]*'
                    maxLength={12}
                    placeholder='输入数字验证码'
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 12))}
                  />
                  <Button
                    tone='primary'
                    loading={state.weixinOperation === 'submittingVerification'}
                    disabled={!code || busy}
                    type='submit'
                  >
                    提交验证码
                  </Button>
                </div>
              )}
            </Field>
            <small>还可提交 {Math.max(0, MAX_VERIFICATION_SUBMISSIONS - attempt.verifySubmissions)} 次</small>
          </form>
        )}

        {state.weixinLoginError && (
          <InlineNotice
            className='weixin-inline-notice'
            tone='danger'
            role='alert'
            icon={<AlertTriangle size={16} />}
            title='绑定状态更新失败'
            actions={
              !terminal && (
                <Button tone='quiet' disabled={busy || state.weixinLoginPolling} onClick={actions.retryLoginPolling}>
                  重试
                </Button>
              )
            }
          >
            {state.weixinLoginError}
          </InlineNotice>
        )}

        <div className='weixin-login-assurance'>
          <QrCode size={16} />
          <p>确认后仅在当前机器保存绑定凭据。页面不会接收令牌、消息游标、Owner 原始 ID 或 iLink 地址。</p>
        </div>
      </div>
    </Dialog>
  );
}

function QrContent({ value }: { value: string }) {
  if (/^data:image\/(?:png|jpeg|webp);base64,/i.test(value)) {
    return <img src={value} alt='微信绑定二维码' />;
  }
  return <QRCodeSVG value={value} size={216} level='M' bgColor='#ffffff' fgColor='#111111' title='微信绑定二维码' />;
}

function LoginStatus({ state, polling }: { state: WeixinLoginState; polling: boolean }) {
  const copy = loginStateCopy(state);
  return (
    <output className={`weixin-login-status ${copy.tone}`}>
      <span>
        {copy.icon === 'scan' ? (
          <ScanLine size={17} />
        ) : copy.icon === 'success' ? (
          <Check size={17} />
        ) : copy.icon === 'error' ? (
          <AlertTriangle size={17} />
        ) : (
          <LoaderCircle className={polling ? 'spin' : undefined} size={17} />
        )}
      </span>
      <div>
        <strong>{copy.title}</strong>
        <p>{copy.description}</p>
      </div>
    </output>
  );
}

function loginStateCopy(state: WeixinLoginState): {
  title: string;
  description: string;
  tone: 'info' | 'success' | 'warning' | 'danger';
  icon: 'loading' | 'scan' | 'success' | 'error';
} {
  switch (state) {
    case 'waitingForScan':
      return { title: '等待扫码', description: '请使用手机微信扫描下方二维码。', tone: 'info', icon: 'scan' };
    case 'scanned':
      return { title: '已扫码', description: '请在手机微信中确认绑定。', tone: 'success', icon: 'success' };
    case 'verificationRequired':
      return { title: '需要验证码', description: '微信要求完成一次额外身份确认。', tone: 'warning', icon: 'error' };
    case 'verificationSubmitted':
      return { title: '正在校验验证码', description: '请稍候，不要重复提交。', tone: 'info', icon: 'loading' };
    case 'redirected':
      return {
        title: '正在切换安全节点',
        description: 'A3S 已验证微信返回的节点，正在继续绑定。',
        tone: 'info',
        icon: 'loading',
      };
    case 'connected':
      return { title: '绑定成功', description: '本机已安全保存微信绑定。', tone: 'success', icon: 'success' };
    case 'alreadyBound':
      return { title: '已恢复绑定', description: '微信确认本机已有可用绑定。', tone: 'success', icon: 'success' };
    case 'expired':
      return { title: '二维码已过期', description: '请重新生成二维码后再扫码。', tone: 'warning', icon: 'error' };
    case 'verificationBlocked':
      return {
        title: '验证码已被锁定',
        description: '本次绑定已停止，请重新生成二维码。',
        tone: 'danger',
        icon: 'error',
      };
  }
}

function isTerminal(state: WeixinLoginState): boolean {
  return state === 'connected' || state === 'alreadyBound' || state === 'expired' || state === 'verificationBlocked';
}

function isVerificationState(state: WeixinLoginState): boolean {
  return state === 'verificationRequired' || state === 'verificationSubmitted';
}

function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link'
import { LegalLinks } from '@/components/LegalPage';
import { useRouter } from 'next/navigation';
import { Fingerprint } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { usePasskeySupport } from '@/lib/usePasskeySupport';
import { ProviderIcon } from './ProviderIcon';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useT } from '@/lib/i18n/client';

type Mode = 'login' | 'signup';
type Notice = { text: string; error: boolean } | null;
export type Provider = 'google' | 'microsoft' | 'github';

const INPUT = 'w-full px-4 py-3 bg-surface-container rounded-xl border border-outline-variant/30 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 text-sm transition-all text-on-surface placeholder:text-on-surface-variant';
const LABEL = 'block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider';
const LINK = 'text-[11px] font-bold text-on-surface-variant hover:text-primary transition-colors py-2 uppercase tracking-wide disabled:opacity-50';
const SECONDARY = 'w-full flex items-center justify-center gap-3 py-2.5 rounded-xl border border-outline-variant/30 text-sm font-semibold text-on-surface hover:border-primary hover:text-primary transition-colors disabled:opacity-60';

const PROVIDER_LABEL: Record<Provider, string> = { google: 'Google', microsoft: 'Microsoft (Outlook)', github: 'GitHub' };

export function LoginForm({
  providers,
  next = '/board',
  invited = false,
  initialError = null,
}: {
  providers: Provider[];
  next?: string;
  invited?: boolean;
  initialError?: string | null;
}) {
  const router = useRouter();
  const t = useT();
  const [mode, setMode] = useState<Mode>(invited ? 'signup' : 'login');
  const [notice, setNotice] = useState<Notice>(initialError ? { text: initialError, error: true } : null);
  const [busy, setBusy] = useState(false);
  const supportsPasskeys = usePasskeySupport();

  const run = async (fn: () => Promise<{ error?: { message?: string } | null }>) => {
    setBusy(true);
    setNotice(null);
    try {
      const { error } = await fn();
      if (error) setNotice({ text: error.message || t('login.failed'), error: true });
      return !error;
    } catch {
      setNotice({ text: t('login.network'), error: true });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get('email') || '').trim();
    const password = String(data.get('password') || '');

    if (mode === 'login') {
      if (await run(() => authClient.signIn.email({ email, password }))) router.replace(next);
    } else {
      const name = String(data.get('full_name') || '').trim();
      if (!name) return setNotice({ text: 'El nombre completo es obligatorio para registrarse.', error: true });
      if (await run(() => authClient.signUp.email({ email, password, name }))) router.replace(next);
    }
  };

  const onProvider = (provider: Provider) =>
    run(() => authClient.signIn.social({ provider, callbackURL: next, errorCallbackURL: '/login' }));

  const onPasskey = async () => {
    if (await run(() => authClient.signIn.passkey())) router.replace(next);
  };

  return (
    <div className="w-full max-w-sm p-8 bg-surface-container-low rounded-2xl border border-surface-container-high text-center shadow-[0_20px_40px_rgba(0,0,0,0.4)] backdrop-blur-xl">
      {notice && (
        <div role={notice.error ? 'alert' : 'status'} className={`mb-4 px-4 py-3 rounded-lg border text-sm font-medium text-left ${notice.error ? 'bg-error/10 border-error/30 text-error' : 'bg-tertiary/10 border-tertiary/30 text-tertiary'}`}>
          {notice.text}
        </div>
      )}

      <div className="w-20 h-20 rounded-3xl bg-white mx-auto mb-8 shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex items-center justify-center relative overflow-hidden p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-mark.png" alt="Serenboard Logo" className="w-full h-full object-contain relative z-10" />
      </div>

      <h1 className="text-2xl font-bold mb-2 text-on-surface tracking-tight">
        {mode === 'login' ? t('login.title.login') : invited ? t('login.title.invited') : t('login.title.signup')}
      </h1>
      <p className="text-sm text-on-surface-variant mb-6">
        {mode === 'login' ? t('login.sub.login') : t('login.sub.signup')}
      </p>

      {providers.length > 0 && (
        <div className="flex flex-col gap-2 mb-5">
          {providers.map((p) => (
            <button key={p} type="button" disabled={busy} onClick={() => onProvider(p)} className={SECONDARY}>
              <ProviderIcon provider={p} />
              {t('login.continueWith', { provider: PROVIDER_LABEL[p] })}
            </button>
          ))}
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-on-surface-variant/60 mt-2">
            <span className="flex-1 h-px bg-outline-variant/20" /> {t('login.orEmail').trim()} <span className="flex-1 h-px bg-outline-variant/20" />
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-4 text-left">
        {mode === 'signup' && (
          <div>
            <label className={LABEL} htmlFor="full_name">{t('login.fullName')}</label>
            <input id="full_name" name="full_name" type="text" required autoComplete="name" className={INPUT} placeholder={t('login.fullNamePh')} />
          </div>
        )}
        <div>
          <label className={LABEL} htmlFor="email">{t('login.email')}</label>
          <input id="email" name="email" type="email" required autoComplete="email webauthn" className={INPUT} placeholder="ejemplo@email.com" />
        </div>
        <div className="mb-2">
          <label className={LABEL} htmlFor="password">{t('login.password')}</label>
          <input id="password" name="password" type="password" required minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className={INPUT} placeholder="••••••••" />
        </div>

        <div className="flex flex-col gap-3 mt-2">
          <button type="submit" disabled={busy} className="w-full flex justify-center items-center gap-2 bg-gradient-to-br from-primary to-primary-dim text-black font-semibold py-3 px-4 rounded-xl shadow-[0_0_20px_rgba(151,169,255,0.2)] hover:shadow-[0_0_30px_rgba(151,169,255,0.4)] transition-all disabled:opacity-60">
            {busy ? t('login.busy') : mode === 'login' ? t('login.submit') : t('login.create')}
          </button>

          {mode === 'login' && supportsPasskeys && (
            <button type="button" disabled={busy} onClick={onPasskey} className={SECONDARY}>
              <Fingerprint className="w-5 h-5 shrink-0" aria-hidden />
              {t('login.passkey')}
            </button>
          )}

          <div className="flex items-center justify-center mt-1 px-1">
            {mode === 'login' ? (
              <button type="button" onClick={() => { setNotice(null); setMode('signup'); }} className={LINK}>{t('login.haveInvite')}</button>
            ) : (
              <button type="button" onClick={() => { setNotice(null); setMode('login'); }} className={LINK}>{t('login.haveAccount')}</button>
            )}
          </div>
        </div>
      </form>

      <p className="mt-4 text-[11px] leading-relaxed text-on-surface-variant/70">
        {mode === 'signup'
          ? t('login.hint.signup')
          : t('login.hint.login')}
      </p>
      <Link href="/instalar" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary">
        {t('login.install')}
      </Link>
      <div className="mt-4 flex justify-center"><LanguageSwitcher /></div>
      <LegalLinks className="mt-4 justify-center text-xs text-on-surface-variant" />
    </div>
  );
}

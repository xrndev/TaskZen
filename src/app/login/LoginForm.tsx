'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Fingerprint } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { usePasskeySupport } from '@/lib/usePasskeySupport';
import { ProviderIcon } from './ProviderIcon';

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
  const [mode, setMode] = useState<Mode>(invited ? 'signup' : 'login');
  const [notice, setNotice] = useState<Notice>(initialError ? { text: initialError, error: true } : null);
  const [busy, setBusy] = useState(false);
  const supportsPasskeys = usePasskeySupport();

  const run = async (fn: () => Promise<{ error?: { message?: string } | null }>) => {
    setBusy(true);
    setNotice(null);
    try {
      const { error } = await fn();
      if (error) setNotice({ text: error.message || 'No se pudo completar la operación.', error: true });
      return !error;
    } catch {
      setNotice({ text: 'Error de conexión. Inténtalo de nuevo.', error: true });
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
        <img src="/logo.png" alt="TaskZen Logo" className="w-full h-full object-contain relative z-10" />
      </div>

      <h1 className="text-2xl font-bold mb-2 text-on-surface tracking-tight">
        {mode === 'login' ? 'Acceso Espacio de Trabajo' : invited ? 'Te han invitado a TaskZen' : 'Crear nueva cuenta'}
      </h1>
      <p className="text-sm text-on-surface-variant mb-6">
        {mode === 'login' ? 'Inicia sesión para ver tus tableros' : 'Crea tu cuenta con un proveedor o con una contraseña'}
      </p>

      {providers.length > 0 && (
        <div className="flex flex-col gap-2 mb-5">
          {providers.map((p) => (
            <button key={p} type="button" disabled={busy} onClick={() => onProvider(p)} className={SECONDARY}>
              <ProviderIcon provider={p} />
              Continuar con {PROVIDER_LABEL[p]}
            </button>
          ))}
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-on-surface-variant/60 mt-2">
            <span className="flex-1 h-px bg-outline-variant/20" /> o con tu correo <span className="flex-1 h-px bg-outline-variant/20" />
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-4 text-left">
        {mode === 'signup' && (
          <div>
            <label className={LABEL} htmlFor="full_name">Nombre Completo</label>
            <input id="full_name" name="full_name" type="text" required autoComplete="name" className={INPUT} placeholder="Tu nombre completo" />
          </div>
        )}
        <div>
          <label className={LABEL} htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email webauthn" className={INPUT} placeholder="ejemplo@email.com" />
        </div>
        <div className="mb-2">
          <label className={LABEL} htmlFor="password">Contraseña</label>
          <input id="password" name="password" type="password" required minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className={INPUT} placeholder="••••••••" />
        </div>

        <div className="flex flex-col gap-3 mt-2">
          <button type="submit" disabled={busy} className="w-full flex justify-center items-center gap-2 bg-gradient-to-br from-primary to-primary-dim text-black font-semibold py-3 px-4 rounded-xl shadow-[0_0_20px_rgba(151,169,255,0.2)] hover:shadow-[0_0_30px_rgba(151,169,255,0.4)] transition-all disabled:opacity-60">
            {busy ? 'Un momento…' : mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </button>

          {mode === 'login' && supportsPasskeys && (
            <button type="button" disabled={busy} onClick={onPasskey} className={SECONDARY}>
              <Fingerprint className="w-5 h-5 shrink-0" aria-hidden />
              Entrar con passkey
            </button>
          )}

          <div className="flex items-center justify-center mt-1 px-1">
            {mode === 'login' ? (
              <button type="button" onClick={() => { setNotice(null); setMode('signup'); }} className={LINK}>Tengo una invitación</button>
            ) : (
              <button type="button" onClick={() => { setNotice(null); setMode('login'); }} className={LINK}>Ya tengo una cuenta, entrar</button>
            )}
          </div>
        </div>
      </form>

      <p className="mt-4 text-[11px] leading-relaxed text-on-surface-variant/70">
        {mode === 'signup'
          ? 'El registro es solo por invitación: abre el enlace que te enviaron antes de crear la cuenta.'
          : '¿Sin acceso? Entra con tu proveedor o con un passkey, o pide ayuda a quien administra tu equipo. Puedes cambiar la contraseña desde tu perfil.'}
      </p>
    </div>
  );
}

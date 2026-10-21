'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Fingerprint, KeyRound, Trash2 } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { usePasskeySupport } from '@/lib/usePasskeySupport';
import { toast } from '@/lib/toast';
import { setPasswordAction } from '@/server/actions/profile';

interface PasskeyRow { id: string; name?: string | null; createdAt?: string | Date | null }

const PROVIDER_LABEL: Record<string, string> = { google: 'Google', microsoft: 'Microsoft', github: 'GitHub' };
const INPUT = 'w-full px-3 py-2.5 bg-surface-container rounded-lg border border-outline-variant/30 text-sm text-on-surface focus:outline-none focus:border-primary';
const BTN = 'w-full py-2.5 rounded-lg text-[11px] font-extrabold uppercase tracking-widest transition-all disabled:opacity-50';

export function SecuritySettings() {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [providers, setProviders] = useState<string[]>([]);
  const [passkeys, setPasskeys] = useState<PasskeyRow[]>([]);
  const [busy, setBusy] = useState(false);
  const supportsPasskeys = usePasskeySupport();

  const load = useCallback(async () => {
    const [accounts, keys] = await Promise.all([authClient.listAccounts(), authClient.passkey.listUserPasskeys()]);
    const list = accounts.data ?? [];
    setHasPassword(list.some(a => a.providerId === 'credential'));
    setProviders(list.map(a => a.providerId).filter(p => p in PROVIDER_LABEL));
    setPasskeys((keys.data ?? []) as PasskeyRow[]);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de la cuenta al abrir el perfil
    load();
  }, [load]);

  const onPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const current = String(data.get('current') || '');
    const next = String(data.get('next') || '');
    setBusy(true);
    if (hasPassword) {
      const { error } = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
      if (error) toast.error(error.message || 'No se pudo cambiar la contraseña.');
      else { toast.success('Contraseña cambiada. Se cerró la sesión en tus otros dispositivos.'); form.reset(); }
    } else {
      const r = await setPasswordAction(next);
      if (!r.ok) toast.error(r.error);
      else { toast.success('Contraseña creada.'); form.reset(); load(); }
    }
    setBusy(false);
  };

  const addPasskey = async () => {
    setBusy(true);
    const { error } = await authClient.passkey.addPasskey();
    setBusy(false);
    if (error) return toast.error(error.message || 'No se pudo registrar el passkey.');
    toast.success('Passkey añadido. Ya puedes entrar con él.');
    load();
  };

  const removePasskey = async (id: string) => {
    if (!window.confirm('¿Eliminar este passkey? Ya no podrás entrar con él.')) return;
    const { error } = await authClient.passkey.deletePasskey({ id });
    if (error) toast.error(error.message || 'No se pudo eliminar.');
    else load();
  };

  return (
    <div className="mt-6 pt-4 border-t border-outline-variant/10 flex flex-col gap-5">
      <section>
        <h3 className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-widest text-on-surface-variant mb-3">
          <KeyRound className="w-4 h-4 text-primary" /> {hasPassword === false ? 'Crear contraseña' : 'Cambiar contraseña'}
        </h3>
        {hasPassword === false && (
          <p className="text-xs text-on-surface-variant mb-3">
            Ahora entras con {providers.map(p => PROVIDER_LABEL[p]).join(' / ') || 'tu proveedor'}. Si quieres, crea también una contraseña.
          </p>
        )}
        <form onSubmit={onPassword} className="flex flex-col gap-2">
          {hasPassword && (
            <input id="sec-current" name="current" type="password" required autoComplete="current-password" placeholder="Contraseña actual" className={INPUT} />
          )}
          <input id="sec-next" name="next" type="password" required minLength={8} autoComplete="new-password" placeholder="Nueva contraseña (mínimo 8)" className={INPUT} />
          <button type="submit" disabled={busy || hasPassword === null} className={`${BTN} bg-primary text-black`}>
            {hasPassword === false ? 'Crear contraseña' : 'Cambiar contraseña'}
          </button>
        </form>
      </section>

      <section>
        <h3 className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-widest text-on-surface-variant mb-3">
          <Fingerprint className="w-4 h-4 text-primary" /> Passkeys
        </h3>
        {passkeys.length > 0 && (
          <ul className="flex flex-col gap-2 mb-3">
            {passkeys.map(p => (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-container px-3 py-2 text-xs text-on-surface-variant">
                <span className="truncate">{p.name || 'Passkey'}{p.createdAt ? ` · ${new Date(p.createdAt).toLocaleDateString()}` : ''}</span>
                <button type="button" onClick={() => removePasskey(p.id)} aria-label="Eliminar passkey" className="text-error hover:opacity-80"><Trash2 className="w-4 h-4" /></button>
              </li>
            ))}
          </ul>
        )}
        {supportsPasskeys ? (
          <button type="button" onClick={addPasskey} disabled={busy} className={`${BTN} border border-outline-variant/30 text-on-surface hover:border-primary hover:text-primary`}>
            Añadir un passkey a este dispositivo
          </button>
        ) : (
          <p className="text-xs text-on-surface-variant">Este navegador no admite passkeys.</p>
        )}
        <p className="mt-2 text-[11px] text-on-surface-variant/70">Entras con tu huella, tu cara o el PIN del dispositivo, sin escribir la contraseña. Registra uno en cada dispositivo que uses.</p>
      </section>
    </div>
  );
}

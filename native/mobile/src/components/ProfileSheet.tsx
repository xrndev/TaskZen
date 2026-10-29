import { Check, Image as ImageIcon, LogOut } from 'lucide-react-native'
import { useState } from 'react'
import { View } from 'react-native'
import type { Profile } from '@domain/types'
import { authClient } from '@/lib/auth-client'
import { apiClient } from '@/lib/client'
import { pickImage } from '@/lib/files'
import { alpha, usePalette } from '@/lib/theme'
import { BottomSheet } from './BottomSheet'
import { NotificationSettings } from './NotificationSettings'
import { PlanSettings } from './PlanSettings'
import { Avatar, Btn, Field, Label, Txt, useToast } from './ui'

/** Perfil: nombre, avatar (enlace o foto de la galería), contraseña y cierre de sesión. */
export function ProfileSheet({ open, onClose, profile, onUpdated, onLogout }: { open: boolean; onClose: () => void; profile: Profile; onUpdated: (p: Profile) => void; onLogout: () => void }) {
  const p = usePalette()
  const toast = useToast()
  const [name, setName] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [photo, setPhoto] = useState<{ uri: string; name: string; mimeType?: string | null } | null>(null)
  const [busy, setBusy] = useState(false)

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [pwBusy, setPwBusy] = useState(false)

  const shownName = name ?? profile.full_name ?? ''
  const nameChanged = shownName.trim() !== (profile.full_name ?? '').trim()
  const avatarChanged = !!photo || !!avatarUrl.trim()

  const saveProfile = async () => {
    setBusy(true)
    try {
      const changes: { full_name?: string; avatar_url?: string } = {}
      if (nameChanged) changes.full_name = shownName.trim()
      if (photo) changes.avatar_url = await apiClient.uploadAvatar(photo)
      else if (avatarUrl.trim()) changes.avatar_url = avatarUrl.trim()
      onUpdated(await apiClient.updateProfile(changes))
      toast('¡Perfil actualizado!')
      setName(null); setAvatarUrl(''); setPhoto(null)
      onClose()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally { setBusy(false) }
  }

  const choosePhoto = async () => {
    try { const f = await pickImage(); if (f) setPhoto(f) } catch (e) { toast((e as Error).message, 'error') }
  }

  /** Cambia la contraseña; si la cuenta entró con un proveedor y no tiene, la crea (como `SecuritySettings` en la web). */
  const savePassword = async () => {
    if (next.length < 8) return toast('La contraseña debe tener al menos 8 caracteres.', 'error')
    setPwBusy(true)
    try {
      if (current) {
        const { error } = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true })
        if (error) throw new Error(error.message || 'No se pudo cambiar la contraseña.')
      } else {
        await apiClient.setPassword(next)
      }
      setCurrent(''); setNext('')
      toast('Contraseña guardada.')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally { setPwBusy(false) }
  }

  const preview = photo?.uri ?? (avatarUrl.trim() || profile.avatar_url)

  return (
    <BottomSheet open={open} onClose={onClose} title="Mi perfil">
      <View style={{ gap: 24, paddingBottom: 8 }}>
        <View style={{ alignItems: 'center', gap: 12 }}>
          <Avatar id={profile.id} name={profile.full_name} uri={preview} size={96} border />
          <View style={{ alignSelf: 'stretch', paddingHorizontal: 16 }}>
            <Field value={shownName} onChangeText={setName} placeholder="Tu nombre completo" maxLength={80} style={{ textAlign: 'center', fontFamily: 'Geist_900Black', fontSize: 20, borderWidth: 0, borderBottomWidth: 1, borderRadius: 0, backgroundColor: 'transparent' }} />
          </View>
          <Txt w="600" size={12} upper track={1.5} color={p.onSurfaceVariant}>{profile.email}</Txt>
        </View>

        <View style={{ gap: 12, paddingTop: 16, borderTopWidth: 1, borderColor: alpha(p.outline, 0.1) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><ImageIcon size={16} color={p.onSurfaceVariant} /><Label>Personalizador de avatar</Label></View>
          <Field value={avatarUrl} onChangeText={(v) => { setAvatarUrl(v); setPhoto(null) }} placeholder="https://…" keyboardType="url" autoCapitalize="none" autoCorrect={false} />
          <Btn label={photo ? 'Cambiar foto' : 'Elegir foto de la galería'} variant="soft" onPress={choosePhoto} />
          <Btn label="Aplicar cambios" icon={Check} onPress={saveProfile} loading={busy} disabled={!nameChanged && !avatarChanged} />
        </View>

        <View style={{ gap: 12, paddingTop: 16, borderTopWidth: 1, borderColor: alpha(p.outline, 0.1) }}>
          <Label>Contraseña</Label>
          <Txt size={12} color={p.onSurfaceVariant}>Si entraste con GitHub, Google o Microsoft, déjala en blanco la actual y crea una nueva para poder entrar también con correo.</Txt>
          <Field value={current} onChangeText={setCurrent} placeholder="Contraseña actual (si tienes)" secureTextEntry autoCapitalize="none" />
          <Field value={next} onChangeText={setNext} placeholder="Nueva contraseña (mín. 8)" secureTextEntry autoCapitalize="none" />
          <Btn label="Guardar contraseña" variant="outline" onPress={savePassword} loading={pwBusy} disabled={!next} />
        </View>

        <PlanSettings />

        <NotificationSettings />

        <View style={{ paddingTop: 16, borderTopWidth: 1, borderColor: alpha(p.outline, 0.1) }}>
          <Btn label="Cerrar tu sesión" variant="danger" icon={LogOut} onPress={() => { onClose(); onLogout() }} />
        </View>
      </View>
    </BottomSheet>
  )
}

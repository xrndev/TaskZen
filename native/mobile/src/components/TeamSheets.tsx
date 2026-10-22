import { Copy, Link2, Shield, ShieldCheck, Trash2, User, UserPlus } from 'lucide-react-native'
import * as Clipboard from 'expo-clipboard'
import { useCallback, useEffect, useState } from 'react'
import { Alert, Pressable, View } from 'react-native'
import type { Team, TeamMember, TeamRole } from '@domain/types'
import { API_URL } from '@/lib/api'
import { apiClient, type InviteInfo } from '@/lib/client'
import { fmtDate, parseDate } from '@/lib/dates'
import { alpha, usePalette } from '@/lib/theme'
import { BottomSheet } from './BottomSheet'
import { Avatar, Btn, Chip, Field, IconBtn, Label, Txt, useToast } from './ui'

const ROLE_LABEL: Record<TeamRole, string> = { admin: 'Admin', product_owner: 'Product Owner', member: 'Miembro' }

export function CreateTeamSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (team: Team) => void }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    try {
      onCreated(await apiClient.createTeam(name.trim()))
      setName('')
      onClose()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally { setBusy(false) }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Crear nuevo equipo">
      <View style={{ gap: 16, paddingBottom: 8 }}>
        <Field label="Nombre del equipo" value={name} onChangeText={setName} placeholder="Ej. Proyecto Alpha, Familia, Marketing…" autoFocus maxLength={80} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Btn label="Cancelar" variant="outline" onPress={onClose} disabled={busy} style={{ flex: 1 }} />
          <Btn label="Crear equipo" onPress={submit} loading={busy} disabled={!name.trim()} style={{ flex: 1 }} />
        </View>
      </View>
    </BottomSheet>
  )
}

/** Ajustes de equipo (solo administración): enlaces de invitación, alta por correo, miembros y roles. */
export function TeamSettingsSheet({ open, onClose, team, role, onMembers, onDeleted }: {
  open: boolean; onClose: () => void; team: Team | null; role: TeamRole; onMembers: (m: TeamMember[]) => void; onDeleted: (teamId: string) => void
}) {
  const p = usePalette()
  const toast = useToast()
  const canManage = role === 'admin'

  const [members, setMembers] = useState<TeamMember[]>([])
  const [invites, setInvites] = useState<InviteInfo[]>([])
  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<TeamRole>('member')
  const [linkRole, setLinkRole] = useState<'member' | 'product_owner'>('member')
  const [link, setLink] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const teamId = team?.id
  const loadMembers = useCallback(async () => {
    if (!teamId) return
    const data = await apiClient.members(teamId)
    setMembers(data)
    onMembers(data)
  }, [teamId, onMembers])
  const loadInvites = useCallback(async () => {
    if (teamId && canManage) setInvites(await apiClient.invites(teamId).catch(() => []))
  }, [teamId, canManage])

  useEffect(() => {
    if (open) { void loadMembers().catch(() => undefined); void loadInvites(); setLink(null); setError(null) }
  }, [open, loadMembers, loadInvites])

  const guard = async (fn: () => Promise<void>) => {
    try { await fn() } catch (e) { toast((e as Error).message, 'error') }
  }

  const createLink = () => guard(async () => {
    if (!teamId) return
    const { token } = await apiClient.createInvite(teamId, linkRole)
    const url = `${API_URL}/invite/${token}`
    setLink(url)
    await Clipboard.setStringAsync(url)
    toast('Enlace copiado. Caduca en 7 días.')
    await loadInvites()
  })

  const addByEmail = async () => {
    if (!teamId || !email.trim()) return
    setBusy(true); setError(null)
    try {
      await apiClient.addMember(teamId, email.trim(), inviteRole)
      setEmail('')
      await loadMembers()
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const confirm = (msg: string, action: () => void, verb = 'Eliminar') =>
    Alert.alert('Confirmar', msg, [{ text: 'Cancelar', style: 'cancel' }, { text: verb, style: 'destructive', onPress: action }])

  const removeMember = (m: TeamMember) => confirm('¿Eliminar a este miembro del equipo?', () => guard(async () => { await apiClient.removeMember(team!.id, m.user_id); await loadMembers() }))
  const deleteTeam = () => confirm(`¿Borrar el equipo "${team?.name}" con todas sus tareas? No se puede deshacer.`, () => guard(async () => { await apiClient.deleteTeam(team!.id); onClose(); onDeleted(team!.id) }), 'Borrar equipo')

  const section = { borderRadius: 16, borderWidth: 1, borderColor: alpha(p.outline, 0.2), backgroundColor: p.container, padding: 16, gap: 12 }

  return (
    <BottomSheet open={open && !!team} onClose={onClose} title={`Ajustes de equipo: ${team?.name ?? ''}`}>
      <View style={{ gap: 20, paddingBottom: 8 }}>
        {canManage && !team?.is_personal && (
          <View style={section}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Link2 size={16} color={p.primary} /><Label>Invitar con un enlace</Label></View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Chip label="Miembro" on={linkRole === 'member'} onPress={() => setLinkRole('member')} /></View>
              <View style={{ flex: 1.3 }}><Chip label="Product Owner" on={linkRole === 'product_owner'} onPress={() => setLinkRole('product_owner')} /></View>
            </View>
            <Btn label="Generar y copiar enlace" icon={Copy} onPress={createLink} />
            {link && <Field value={link} editable={false} selectTextOnFocus style={{ fontSize: 12 }} />}
            {invites.map((i) => (
              <View key={i.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8, backgroundColor: p.lowest, paddingLeft: 12, minHeight: 44 }}>
                <Txt size={12} color={p.onSurfaceVariant}>{ROLE_LABEL[i.role]} · caduca el {fmtDate(parseDate(i.expires_at) ?? new Date())}</Txt>
                <Pressable onPress={() => guard(async () => { await apiClient.revokeInvite(i.id); setLink(null); await loadInvites() })} accessibilityRole="button" style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' }}><Txt w="700" size={12} color={p.error}>Revocar</Txt></Pressable>
              </View>
            ))}
            <Txt size={11} color={alpha(p.onSurfaceVariant, 0.8)}>Quien tenga el enlace podrá unirse hasta que caduque o lo revoques. Los enlaces nunca dan rol de administrador.</Txt>
          </View>
        )}

        {canManage && (
          <View style={section}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><UserPlus size={16} color={p.primary} /><Label>Invitar nuevo miembro</Label></View>
            <Field value={email} onChangeText={setEmail} placeholder="Email del usuario…" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['member', 'product_owner', 'admin'] as const).map((r) => <View key={r} style={{ flex: 1 }}><Chip label={r === 'product_owner' ? 'P. Owner' : ROLE_LABEL[r]} on={inviteRole === r} onPress={() => setInviteRole(r)} /></View>)}
            </View>
            <Btn label="Invitar" onPress={addByEmail} loading={busy} disabled={!email.trim()} />
            {error && <Txt w="700" size={12} color={p.error}>{error}</Txt>}
          </View>
        )}

        <View style={{ gap: 12 }}>
          <Label style={{ marginLeft: 4 }}>Miembros del equipo ({members.length})</Label>
          {members.map((m) => (
            <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: alpha(p.outline, 0.1), backgroundColor: p.low }}>
              <Avatar id={m.user_id} name={m.profile?.full_name} uri={m.profile?.avatar_url} size={40} />
              <View style={{ flex: 1 }}>
                <Txt w="700" size={14} numberOfLines={1}>{m.profile?.full_name || 'Sin nombre'}</Txt>
                <Txt size={11} color={p.onSurfaceVariant} numberOfLines={1}>{m.profile?.email}</Txt>
              </View>
              {canManage && m.role !== 'admin' ? (
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Pressable onPress={() => guard(async () => { await apiClient.changeMemberRole(team!.id, m.user_id, m.role === 'member' ? 'product_owner' : 'member'); await loadMembers() })} accessibilityRole="button" accessibilityLabel="Cambiar rol" style={{ minHeight: 36, justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: alpha(p.primary, 0.2), paddingHorizontal: 8 }}>
                    <Txt w="700" size={10} upper track={0.8} color={p.primary}>{ROLE_LABEL[m.role]}</Txt>
                  </Pressable>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: m.role === 'admin' ? alpha(p.primary, 0.2) : m.role === 'product_owner' ? alpha(p.secondary, 0.2) : p.highest }}>
                  {m.role === 'admin' ? <Shield size={10} color={p.primary} /> : m.role === 'product_owner' ? <ShieldCheck size={10} color={p.secondary} /> : <User size={10} color={p.onSurfaceVariant} />}
                  <Txt w="900" size={9} upper color={m.role === 'admin' ? p.primary : m.role === 'product_owner' ? p.secondary : p.onSurfaceVariant}>{m.role}</Txt>
                </View>
              )}
              {canManage && m.role !== 'admin' && <IconBtn icon={Trash2} label="Eliminar miembro" onPress={() => removeMember(m)} color={alpha(p.error, 0.8)} size={18} />}
            </View>
          ))}
        </View>

        {canManage && !team?.is_personal && <Btn label="Borrar equipo" variant="danger" icon={Trash2} onPress={deleteTeam} />}
      </View>
    </BottomSheet>
  )
}

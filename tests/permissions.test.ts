import { describe, expect, it } from 'vitest'
import { can } from '@/lib/permissions'

describe('can()', () => {
  it('deniega todo a quien no es miembro', () => {
    expect(can('u1', null, 'team:view')).toBe(false)
    expect(can('u1', null, 'task:create')).toBe(false)
  })
  it('un member solo edita sus tareas o las asignadas', () => {
    expect(can('u1', 'member', 'task:edit', { ownerId: 'u1' })).toBe(true)
    expect(can('u1', 'member', 'task:edit', { ownerId: 'u2', assignedTo: 'u1' })).toBe(true)
    expect(can('u1', 'member', 'task:edit', { ownerId: 'u2' })).toBe(false)
  })
  it('un member no borra tareas ajenas ni aunque se las asignen', () => {
    expect(can('u1', 'member', 'task:delete', { ownerId: 'u2', assignedTo: 'u1' })).toBe(false)
    expect(can('u1', 'member', 'task:delete', { ownerId: 'u1' })).toBe(true)
  })
  it('product_owner gestiona tareas y etiquetas pero no miembros', () => {
    expect(can('u1', 'product_owner', 'task:delete', { ownerId: 'u2' })).toBe(true)
    expect(can('u1', 'product_owner', 'tag:manage', { ownerId: 'u2' })).toBe(true)
    expect(can('u1', 'product_owner', 'team:manage_members')).toBe(false)
  })
  it('solo admin gestiona miembros y borra el equipo', () => {
    expect(can('u1', 'admin', 'team:manage_members')).toBe(true)
    expect(can('u1', 'admin', 'team:delete')).toBe(true)
    expect(can('u1', 'member', 'team:manage_members')).toBe(false)
  })
  it('un member crea etiquetas pero solo gestiona las suyas', () => {
    expect(can('u1', 'member', 'tag:create')).toBe(true)
    expect(can('u1', 'member', 'tag:manage', { ownerId: 'u1' })).toBe(true)
    expect(can('u1', 'member', 'tag:manage', { ownerId: 'u2' })).toBe(false)
  })
})

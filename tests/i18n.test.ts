import { describe, expect, it } from 'vitest'
import { en } from '@/lib/i18n/en'
import { es } from '@/lib/i18n/es'
import { makeT, pickLang } from '@/lib/i18n/core'
import { localizeTemplate, BOARD_TEMPLATES } from '@/lib/templates'

describe('idioma de la interfaz', () => {
  it('la cookie manda sobre el navegador, y un valor inválido se ignora', () => {
    expect(pickLang('en', 'es-ES,es;q=0.9')).toBe('en')
    expect(pickLang('es', 'en-US')).toBe('es')
    expect(pickLang('fr', 'en-US')).toBe('en')
  })

  it('sin cookie elige por las preferencias del navegador, por prioridad, y cae al español', () => {
    expect(pickLang(undefined, 'en-US,en;q=0.9,es;q=0.8')).toBe('en')
    expect(pickLang(undefined, 'es-ES,es;q=0.9,en;q=0.8')).toBe('es')
    expect(pickLang(undefined, 'fr-FR,fr;q=0.9,en;q=0.5')).toBe('en')
    expect(pickLang(undefined, 'fr-FR,de;q=0.9')).toBe('es')
    expect(pickLang(undefined, 'en;q=0,es;q=0.1')).toBe('es') // q=0 = «no lo quiero»
    expect(pickLang(null, null)).toBe('es')
  })

  it('traduce, sustituye parámetros y deja intacto el marcador que no recibe valor', () => {
    expect(makeT('es')('status.pending')).toBe('Pendiente')
    expect(makeT('en')('status.pending')).toBe('To do')
    expect(makeT('en')('subtasks.badge', { done: 2, total: 5 })).toBe('2 of 5 subtasks done')
    expect(makeT('es')('subtasks.badge', { done: 2 })).toBe('2 de {total} subtareas hechas')
  })

  it('ambos idiomas tienen exactamente las mismas claves, ninguna vacía, y los mismos marcadores', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort())
    for (const key of Object.keys(es) as (keyof typeof es)[]) {
      expect(en[key].trim(), key).not.toBe('')
      const marks = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort()
      expect(marks(en[key]), key).toEqual(marks(es[key]))
    }
  })

  it('las plantillas se traducen por posición y cada tarea mantiene su etiqueta', () => {
    for (const tpl of BOARD_TEMPLATES) {
      const t = localizeTemplate(tpl, 'en')
      expect(t.tags).toHaveLength(tpl.tags.length)
      const names = t.tags.map((x) => x.name)
      for (const task of t.tasks) {
        expect(task.title).not.toBe('')
        if ('tag' in task && task.tag) expect(names).toContain(task.tag)
      }
      expect(localizeTemplate(tpl, 'es')).toBe(tpl)
    }
  })
})

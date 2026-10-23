// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { legalInfo } from '@/lib/legal'

describe('legalInfo', () => {
  it('lee la identidad del responsable del entorno y descarta los valores vacíos', () => {
    expect(legalInfo({})).toEqual({ owner: null, email: null, taxId: null, address: null, site: 'este sitio' })
    expect(
      legalInfo({ LEGAL_OWNER_NAME: '  Ana Pérez ', LEGAL_CONTACT_EMAIL: 'privacidad@example.com', LEGAL_OWNER_TAX_ID: '', LEGAL_ADDRESS: 'Calle Mayor 1, Logroño' }),
    ).toMatchObject({ owner: 'Ana Pérez', email: 'privacidad@example.com', taxId: null, address: 'Calle Mayor 1, Logroño' })
  })

  it('deduce la dirección pública de BETTER_AUTH_URL y tolera una mal escrita', () => {
    expect(legalInfo({ BETTER_AUTH_URL: 'https://taskzen.duckdns.org' }).site).toBe('taskzen.duckdns.org')
    expect(legalInfo({ BETTER_AUTH_URL: 'no es una url' }).site).toBe('este sitio')
  })
})

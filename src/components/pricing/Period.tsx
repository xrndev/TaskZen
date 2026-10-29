'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { formatPrice } from '@/lib/plans'

/** Mensual o anual: un solo interruptor para todas las tarjetas de la página. */
type Period = 'monthly' | 'yearly'
const PeriodContext = createContext<{ period: Period; setPeriod: (p: Period) => void }>({ period: 'monthly', setPeriod: () => {} })

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<Period>('monthly')
  return <PeriodContext.Provider value={{ period, setPeriod }}>{children}</PeriodContext.Provider>
}

export function PeriodToggle() {
  const { period, setPeriod } = useContext(PeriodContext)
  const option = (value: Period, label: string, extra?: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={period === value}
      onClick={() => setPeriod(value)}
      className={`min-h-10 rounded-full px-5 text-sm font-bold transition-colors ${period === value ? 'bg-primary text-black' : 'text-on-surface-variant hover:text-on-surface'}`}
    >
      {label}
      {extra && <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${period === value ? 'bg-black/15' : 'bg-tertiary/15 text-tertiary'}`}>{extra}</span>}
    </button>
  )
  return (
    <div role="radiogroup" aria-label="Periodo de facturación" className="mx-auto mb-12 flex w-fit items-center gap-1 rounded-full border border-outline-variant/30 bg-surface-container-low p-1">
      {option('monthly', 'Mensual')}
      {option('yearly', 'Anual', '2 meses gratis')}
    </div>
  )
}

/** Precio de una tarjeta según el periodo elegido. */
export function Price({ monthly, yearly }: { monthly: number | null; yearly: number | null }) {
  const { period } = useContext(PeriodContext)
  if (monthly === null || yearly === null) {
    return (
      <>
        <p className="mt-5 flex items-baseline gap-1"><span className="text-4xl font-black tracking-tight text-on-surface">0 €</span></p>
        <p className="mt-1 min-h-5 text-xs text-on-surface-variant">Sin caducidad, sin tarjeta</p>
      </>
    )
  }
  const yearlyView = period === 'yearly'
  return (
    <>
      <p className="mt-5 flex items-baseline gap-1">
        <span className="text-4xl font-black tracking-tight text-on-surface">{formatPrice(yearlyView ? yearly : monthly)}</span>
        <span className="text-sm text-on-surface-variant">{yearlyView ? '/ año' : '/ mes'}</span>
      </p>
      <p className="mt-1 min-h-5 text-xs text-on-surface-variant">
        {yearlyView ? `equivale a ${formatPrice(Math.round((yearly / 12) * 100) / 100)} al mes` : `o ${formatPrice(yearly)} al año · 2 meses gratis`}
      </p>
    </>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { subscribeToasts, type ToastMessage } from '@/lib/toast'

const STYLE = {
  error: 'bg-error/10 border-error/30 text-error',
  success: 'bg-tertiary/10 border-tertiary/30 text-tertiary',
  info: 'bg-primary/10 border-primary/30 text-primary',
} as const

export function Toaster() {
  const [items, setItems] = useState<ToastMessage[]>([])

  useEffect(
    () =>
      subscribeToasts((t) => {
        setItems((prev) => [...prev.slice(-3), t])
        setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), 5000)
      }),
    [],
  )

  return (
    <div aria-live="polite" className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-md pointer-events-none">
      {items.map((t) => (
        <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'} className={`px-4 py-3 rounded-lg border backdrop-blur-md shadow-lg text-sm font-medium pointer-events-auto ${STYLE[t.kind]}`}>
          {t.text}
        </div>
      ))}
    </div>
  )
}

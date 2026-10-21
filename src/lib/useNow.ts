'use client'

import { useEffect, useState } from 'react'

/** Hora actual que se refresca sola: permite calcular "vencida" o "por vencer" sin ser impuro en el render. */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

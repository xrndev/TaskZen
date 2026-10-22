import { useEffect, useState } from 'react'

/** Reloj que se refresca cada `intervalMs` (por defecto, cada minuto): mantiene al día "vencida" y los avisos. */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

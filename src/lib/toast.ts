export type ToastKind = 'error' | 'success' | 'info'
export interface ToastMessage {
  id: number
  kind: ToastKind
  text: string
}

type Listener = (t: ToastMessage) => void

const listeners = new Set<Listener>()
let seq = 0

function emit(kind: ToastKind, text: string) {
  const t = { id: ++seq, kind, text }
  listeners.forEach((fn) => fn(t))
}

export const toast = {
  error: (text: string) => emit('error', text),
  success: (text: string) => emit('success', text),
  info: (text: string) => emit('info', text),
}

export function subscribeToasts(fn: Listener) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

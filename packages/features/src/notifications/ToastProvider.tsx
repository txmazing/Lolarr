import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { ToastStack, type ToastItem, type ToastKind } from '@lolarr/ui'

const TOAST_TTL_MS = 5000

type ToastContextValue = {
  show: (toast: { kind: ToastKind; title: string }) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback(
    ({ kind, title }: { kind: ToastKind; title: string }) => {
      counter.current += 1
      const id = `toast-${counter.current}`
      setToasts((current) => [...current, { id, kind, title }])
      setTimeout(() => dismiss(id), TOAST_TTL_MS)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <ToastStack toasts={toasts} />
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- hook co-located with its provider, matches api.tsx
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

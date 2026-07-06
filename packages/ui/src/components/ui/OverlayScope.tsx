import { createContext, useContext, type ComponentType, type ReactNode } from 'react'

// A platform-provided wrapper around overlay (dialog) content. On web it is a
// passthrough — no extra element, layout unchanged. On TV the app injects a
// Norigin focus boundary (isFocusBoundary) so the D-pad cannot navigate out of
// an open dialog to the elements behind it. This is the "trap" for the remote,
// implemented in the same focus system (Norigin) the TV app already uses,
// rather than fighting Base UI's Tab/inert-based modal trap.
export type OverlayScopeComponent = ComponentType<{ children: ReactNode }>

function PassthroughOverlayScope({ children }: { children: ReactNode }) {
  return <>{children}</>
}

const OverlayScopeContext = createContext<OverlayScopeComponent>(PassthroughOverlayScope)

export const OverlayScopeProvider = OverlayScopeContext.Provider

export function useOverlayScope(): OverlayScopeComponent {
  return useContext(OverlayScopeContext)
}

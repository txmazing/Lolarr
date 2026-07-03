import { create } from 'zustand'
import type { MediaItem } from '@lolarr/domain'

export type Screen =
  | { name: 'home' }
  | { name: 'detail'; item: MediaItem }
  | { name: 'libraryDetail'; itemId: string }
  | { name: 'player'; itemId: string; resumeTicks?: number; seriesId?: string }

type ScreenState = {
  stack: Screen[]
  push: (screen: Screen) => void
  pop: () => void
  replace: (screen: Screen) => void
  reset: () => void
}

export const useScreenStore = create<ScreenState>((set) => ({
  stack: [{ name: 'home' }],
  push: (screen) => set((state) => ({ stack: [...state.stack, screen] })),
  pop: () =>
    set((state) => ({
      stack: state.stack.length > 1 ? state.stack.slice(0, -1) : state.stack,
    })),
  replace: (screen) =>
    set((state) => ({ stack: [...state.stack.slice(0, -1), screen] })),
  reset: () => set({ stack: [{ name: 'home' }] }),
}))

export function useCurrentScreen(): Screen {
  return useScreenStore((state) => state.stack[state.stack.length - 1] ?? { name: 'home' })
}

import { create } from 'zustand';
import type { Row } from './data/useRows';

type FocusState = {
  railIndex: number;
  cardIndex: Record<string, number>; // per-rail memory
  moveLeft(rows: Row[]): void;
  moveRight(rows: Row[]): void; // inkl. forward snake am Rail-Ende
  moveUp(): void;
  moveDown(rows: Row[]): void;
};

export const useFocusStore = create<FocusState>((set) => ({
  railIndex: 0,
  cardIndex: {},
  moveLeft: (rows) =>
    set((s) => {
      const rail = rows[s.railIndex];
      const cur = s.cardIndex[rail.id] ?? 0;
      return cur > 0 ? { cardIndex: { ...s.cardIndex, [rail.id]: cur - 1 } } : s;
    }),
  moveRight: (rows) =>
    set((s) => {
      const rail = rows[s.railIndex];
      const cur = s.cardIndex[rail.id] ?? 0;
      if (cur < rail.items.length - 1) {
        return { cardIndex: { ...s.cardIndex, [rail.id]: cur + 1 } };
      }
      // forward snake: letzte Karte + Rechts → erste Karte der nächsten Rail
      if (s.railIndex < rows.length - 1) {
        const next = rows[s.railIndex + 1];
        return { railIndex: s.railIndex + 1, cardIndex: { ...s.cardIndex, [next.id]: 0 } };
      }
      return s;
    }),
  moveUp: () => set((s) => (s.railIndex > 0 ? { railIndex: s.railIndex - 1 } : s)),
  moveDown: (rows) =>
    set((s) => (s.railIndex < rows.length - 1 ? { railIndex: s.railIndex + 1 } : s)),
}));

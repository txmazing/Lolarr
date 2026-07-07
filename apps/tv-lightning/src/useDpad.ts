import { useEffect } from 'react';
import { useFocusStore } from './store';
import type { Row } from './data/useRows';

export function useDpad(rows: Row[] | undefined) {
  useEffect(() => {
    if (!rows) return;
    const onKey = (e: KeyboardEvent) => {
      const s = useFocusStore.getState();
      if (e.key === 'ArrowLeft') s.moveLeft(rows);
      else if (e.key === 'ArrowRight') s.moveRight(rows);
      else if (e.key === 'ArrowUp') s.moveUp();
      else if (e.key === 'ArrowDown') s.moveDown(rows);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rows]);
}

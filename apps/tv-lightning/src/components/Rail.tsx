import type { Row } from '../data/useRows';
import { Card } from './Card';

const DUR = { duration: 400 };

export const Rail = ({ row, y, focusedCard, railFocused }: {
  row: Row; y: number; focusedCard: number; railFocused: boolean;
}) => {
  const scrollX = railFocused ? -Math.max(0, focusedCard * 260 - 520) : 0;
  return (
    <lng-view style={{ x: 60, y, w: 1800, h: 420, clipping: true }}>
      <lng-text style={{ x: 0, y: 0, fontSize: 28, fontFamily: 'sans-serif' }}>{row.title}</lng-text>
      <lng-view style={{ x: scrollX, y: 48, w: 20 * 260 + 400, h: 360 }} transition={{ x: DUR }}>
        {row.items.map((item, i) => {
          const shifted = railFocused && i > focusedCard ? 400 : 0;
          return (
            <Card key={item.id} item={item} x={i * 260 + shifted}
              focused={railFocused && i === focusedCard} />
          );
        })}
      </lng-view>
    </lng-view>
  );
};

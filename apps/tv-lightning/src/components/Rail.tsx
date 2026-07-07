import type { Row } from '../data/useRows';
import { Card } from './Card';

export const Rail = ({ row, y, focusedCard, railFocused }: {
  row: Row; y: number; focusedCard: number; railFocused: boolean;
}) => (
  <lng-view style={{ x: 60, y, w: 1800, h: 420 }}>
    <lng-text style={{ x: 0, y: 0, fontSize: 28, fontFamily: 'sans-serif' }}>{row.title}</lng-text>
    <lng-view style={{ x: 0, y: 48, w: 20 * 260, h: 360 }}>
      {row.items.map((item, i) => (
        <Card key={item.id} item={item} x={i * 260} focused={railFocused && i === focusedCard} />
      ))}
    </lng-view>
  </lng-view>
);

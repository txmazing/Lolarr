import { View, Text } from 'react-native';

import type { Row } from '../data/useRows';
import { Card } from './Card';

// Same ease-out-expo curve as Card.tsx — natively supported by the installed
// @lightningjs/renderer beta20 cubic-bezier() parser.
const DUR = { duration: 400, easing: 'cubic-bezier(0.16,1,0.3,1)' };

// RN Gate 1 conversion: the card row is `flexDirection: 'row'` + `gap: 20` —
// Yoga now computes each card's x from the flex flow; there's no manual
// `i * 260 + shifted` math anymore (compare to the pre-RN baseline). The
// focused card's animated `width` cascades into a per-frame Yoga relayout of
// every sibling to its right — that per-frame relayout cost is exactly what
// Gate 1 measures.
//
// The horizontal scroll (`scrollX`) still uses the plain Lightning `x`
// transition on a raw <lng-view> wrapper rather than an RN `transform:
// [{translateX}]`: the css-transform plugin maps CSS `transform` to a
// separate Lightning `transform` node prop (matrix-style), not `x`, and
// that path isn't confirmed safe to animate through the same `transition`
// mechanism this spike relies on elsewhere. Keeping it raw preserves the
// exact tween semantics of the pre-RN baseline (mixing core lng-* elements
// into an RN tree is supported by the renderer).
export const Rail = ({ row, focusedCard, railFocused }: {
  row: Row; focusedCard: number; railFocused: boolean;
}) => {
  const scrollX = railFocused ? -Math.max(0, focusedCard * 260 - 520) : 0;
  return (
    <View style={{ marginLeft: 60, width: 1800, height: 420, overflow: 'hidden' }}>
      <Text style={{ fontSize: 28, fontFamily: 'sans-serif', color: '#ffffff' }}>{row.title}</Text>
      <lng-view style={{ x: scrollX, y: 48 }} transition={{ x: DUR }}>
        <View style={{ flexDirection: 'row', gap: 20 }}>
          {row.items.map((item, i) => (
            <Card key={item.id} item={item} focused={railFocused && i === focusedCard} />
          ))}
        </View>
      </lng-view>
    </View>
  );
};

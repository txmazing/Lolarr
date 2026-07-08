import { View, Text } from 'react-native';

import type { Row } from '../data/useRows';
import { Card } from './Card';

// Same ease-out-expo curve as Card.tsx — natively supported by the installed
// @lightningjs/renderer beta20 cubic-bezier() parser.
const DUR = { duration: 400, easing: 'cubic-bezier(0.16,1,0.3,1)' };

// RN Gate 1 conversion, ROOT-CAUSE FIX: the card row originally used
// `flexDirection: 'row'` + `gap: 20`, letting Yoga compute each card's x from
// the flex flow. That reproducibly broke rendering (the whole row of a
// FOCUSED rail goes fully blank — title still renders, zero pixels drawn for
// every card, no console error) once the focused card's flex-flow position
// advanced far enough into the rail (empirically: focusedCard index >= 8 out
// of 20, confirmed index-dependent and NOT speed-dependent — reproduces with
// slow, deliberately-spaced key presses just as reliably as with rapid ones).
// Bisection (temporarily stripping the focus ring, disabling every `w`
// transition, dropping `overflow: hidden` on both Rail and Card) ruled out
// animation/clipping causes; only removing the cards from Yoga's flex flow
// fixed it. This points to a layout bug/limitation in the beta
// react-lightning-plugin-flexbox's synchronous (useWebWorker: false, see
// index.tsx) per-frame relayout of ~20 flex-row siblings, not anything in
// this app's own code.
//
// Fix: cards are positioned with manual `left` math instead (same
// `i * 260 + shifted` shape as the pre-RN baseline), each wrapped in a
// `position: 'absolute'` View so Yoga never has to relayout the row's
// siblings on every focus change. This trades away the per-frame Yoga
// relayout cascade that Gate 1 originally wanted to measure — but a
// correctness bug (rail goes blank) outweighs the benchmark's own inputs.
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
        <View style={{ position: 'relative' }}>
          {row.items.map((item, i) => {
            const left = i * 260 + (i > focusedCard ? 400 : 0);
            return (
              <View key={item.id} style={{ position: 'absolute', top: 0, left }}>
                <Card item={item} focused={railFocused && i === focusedCard} />
              </View>
            );
          })}
        </View>
      </lng-view>
    </View>
  );
};

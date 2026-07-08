import { View, Text } from 'react-native';
// Reanimated mini-spike: the morph runs through the reanimated dialect.
// 'react-native-reanimated' resolves to @plextv/react-lightning-plugin-
// reanimated here (see vite configs) — withTiming descriptors get compiled
// into Lightning renderer tweens, NOT per-frame JS. Known 0.4.2 limitation
// (source-verified): createTimingAnimation hardcodes easing 'linear', the
// Easing.bezier below is currently ignored on this backend.
import Animated, { Easing, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import type { Item } from '../data/useRows';

const EXPO_BEZIER = Easing.bezier(0.16, 1, 0.3, 1);
const MORPH = { duration: 400, easing: EXPO_BEZIER };
const FRAME = { duration: 200 };
const CARD_H = 360;
const CARD_W_FOCUSED = 640;
const CARD_W_REST = 240;
const RING_OUTER = '#f5f5f7';
const RING_INNER = '#0a0a0c';
const RING_T = 3; // border width per ring, and inset of the inner ring
const RING_RADIUS_OUTER = 12; // matches the card's own borderRadius
const RING_RADIUS_INNER = 10; // slightly tighter so the inset ring nests visually
// Epsilon alpha: keeps a node "renderable" (alpha > 0) so its texture loads
// eagerly at mount instead of only when focus raises alpha to 1 — avoids the
// late crossfade pop. Visually indistinguishable from fully transparent.
const ALPHA_EPS = 0.004;

// Rail.tsx positions each card with manual `left` math on a wrapping absolute
// View (Yoga flex-row hot-path bug, see Rail.tsx). Within a single card the
// focused width still animates; all overlapping layers use
// `position: 'absolute'` so Yoga excludes them from flex flow.
export const Card = ({ item, focused }: { item: Item; focused: boolean }) => {
  const w = focused ? CARD_W_FOCUSED : CARD_W_REST;

  const widthStyle = useAnimatedStyle(() => ({ width: withTiming(w, MORPH) }), [w]);
  const innerRingStyle = useAnimatedStyle(
    () => ({ width: withTiming(w - 2 * RING_T, MORPH) }),
    [w],
  );
  const posterStyle = useAnimatedStyle(
    () => ({ opacity: withTiming(focused ? ALPHA_EPS : 1, MORPH) }),
    [focused],
  );
  const landscapeStyle = useAnimatedStyle(
    () => ({ opacity: withTiming(focused ? 1 : ALPHA_EPS, MORPH) }),
    [focused],
  );
  const overlayStyle = useAnimatedStyle(
    () => ({ opacity: withTiming(focused ? 1 : 0, MORPH) }),
    [focused],
  );
  const frameStyle = useAnimatedStyle(
    () => ({ opacity: withTiming(focused ? 1 : 0, FRAME) }),
    [focused],
  );

  return (
    <Animated.View
      style={[{ height: CARD_H, overflow: 'hidden', zIndex: focused ? 10 : 1 }, widthStyle]}
    >
      {/* fallback rect underneath — texture loads swap in above it */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            height: CARD_H,
            backgroundColor: '#1a1a1e',
            borderRadius: 12,
          },
          widthStyle,
        ]}
      />

      {/* Portrait poster — fixed size, never tweened. Crossfades out on focus
          (ALPHA_EPS instead of 0 keeps the texture resident). */}
      <Animated.Image
        source={{ uri: item.posterUrl }}
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            width: CARD_W_REST,
            height: CARD_H,
            borderRadius: 12,
          },
          posterStyle,
        ]}
      />

      {/* Landscape crop — fixed size, crossfades in on focus. */}
      <Animated.Image
        source={{ uri: item.landscapeUrl }}
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            width: CARD_W_FOCUSED,
            height: CARD_H,
            borderRadius: 12,
          },
          landscapeStyle,
        ]}
      />

      {/* Gradient title overlay — fades in with the landscape image. */}
      <Animated.View
        style={[
          { position: 'absolute', top: 0, left: 0, width: CARD_W_FOCUSED, height: CARD_H },
          overlayStyle,
        ]}
      >
        {/*
          colorTop/colorBottom + 4-corner borderRadius array are Lightning-only
          node props (no RN style equivalent) — stays a raw lng-view with the
          Lightning-native transition prop for its width.
        */}
        <lng-view
          style={{
            x: 0,
            y: 260,
            w,
            h: 100,
            colorTop: 0x00000000,
            colorBottom: 0x000000d9,
            borderRadius: [0, 0, 12, 12],
          }}
          transition={{ w: { duration: 400, easing: 'cubic-bezier(0.16,1,0.3,1)' } }}
        />
        <Text style={{ position: 'absolute', top: 280, left: 20, fontSize: 26, fontFamily: 'sans-serif', color: '#ffffff' }}>
          {item.title}
        </Text>
        <Text
          style={{ position: 'absolute', top: 316, left: 20, fontSize: 18, fontFamily: 'sans-serif', color: '#ffffff', opacity: 0.7 }}
        >
          2026 · Details
        </Text>
      </Animated.View>

      {/* Focus frame — two nested rounded+bordered views (RoundedWithBorder
          shader, registered in src/index.tsx); group opacity toggles. */}
      <Animated.View
        style={[
          { position: 'absolute', top: 0, left: 0, height: CARD_H },
          widthStyle,
          frameStyle,
        ]}
      >
        {/* outer ring — near-white */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              height: CARD_H,
              borderRadius: RING_RADIUS_OUTER,
              borderWidth: RING_T,
              borderColor: RING_OUTER,
            },
            widthStyle,
          ]}
        />
        {/* inner ring — dark, inset by RING_T */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: RING_T,
              left: RING_T,
              height: CARD_H - 2 * RING_T,
              borderRadius: RING_RADIUS_INNER,
              borderWidth: RING_T,
              borderColor: RING_INNER,
            },
            innerRingStyle,
          ]}
        />
      </Animated.View>
    </Animated.View>
  );
};

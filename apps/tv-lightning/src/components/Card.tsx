import { View, Image, Text } from 'react-native';

import type { Item } from '../data/useRows';

// ease-out-expo — verified against the installed @lightningjs/renderer
// timing-function parser (src/core/utils.js: getTimingFunction/parseCubicBezier),
// which regex-extracts the 4 numbers from a `cubic-bezier(a,b,c,d)` string, so
// this literal is natively supported (no runtime rejection / fallback needed).
const EASING = 'cubic-bezier(0.16,1,0.3,1)';
const DUR = { duration: 400, easing: EASING };
const FRAME_DUR = { duration: 200 };
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
// Tradeoff: both the poster and landscape textures for every rendered card
// (60 rows worth in this spike) stay resident in the texture cache instead of
// only loading on focus — fine at this scale, would need eviction at prod scale.
const ALPHA_EPS = 0.004;

// RN Gate 1 conversion: no more manual `x` prop — the parent Rail's flex row
// (Yoga) positions cards; the focused card's animated `width` pushes its
// siblings via relayout instead of the old neighbor-shift math. All
// overlapping layers below (fallback rect / poster / landscape / gradient /
// focus rings) use `position: 'absolute'` so Yoga excludes them from normal
// flex flow and they stack at (0,0) like the original lng-view tree did.
export const Card = ({ item, focused }: { item: Item; focused: boolean }) => {
  const w = focused ? CARD_W_FOCUSED : CARD_W_REST;
  return (
    <View
      style={{ width: w, height: CARD_H, overflow: 'hidden', zIndex: focused ? 10 : 1 }}
      transition={{ w: DUR }}
    >
      {/* fallback rect underneath — texture loads swap in above it */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: w,
          height: CARD_H,
          backgroundColor: '#1a1a1e',
          borderRadius: 12,
        }}
        transition={{ w: DUR }}
      />

      {/*
        Portrait poster — fixed size, never tweened. Crossfades out on focus.
        opacity uses ALPHA_EPS instead of 0 when focused: alpha === 0 makes the
        node non-renderable, which defers texture load until alpha next rises
        above 0 — i.e. only when focus returns, causing a visible pop. A tiny
        nonzero alpha keeps it renderable (texture stays loaded) while reading
        as invisible.
      */}
      <Image
        source={{ uri: item.posterUrl }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: CARD_W_REST,
          height: CARD_H,
          borderRadius: 12,
          opacity: focused ? ALPHA_EPS : 1,
        }}
        transition={{ alpha: DUR }}
      />

      {/*
        Landscape crop — fixed size, never tweened. Crossfades in on focus.
        Same ALPHA_EPS eager-load trick while unfocused, so the backdrop
        texture is already decoded by the time focus lands (no late pop).
      */}
      <Image
        source={{ uri: item.landscapeUrl }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: CARD_W_FOCUSED,
          height: CARD_H,
          borderRadius: 12,
          opacity: focused ? 1 : ALPHA_EPS,
        }}
        transition={{ alpha: DUR }}
      />

      {/* Gradient title overlay — fades in with the landscape image (same group alpha). */}
      <View
        style={{ position: 'absolute', top: 0, left: 0, width: w, height: CARD_H, opacity: focused ? 1 : 0 }}
        transition={{ alpha: DUR }}
      >
        {/*
          colorTop/colorBottom + a 4-corner borderRadius array are Lightning-only
          node props with no React Native style equivalent (RN has no gradient
          fill and no per-corner borderRadius array shorthand) — stays a raw
          lng-view. Everything else in this file goes through RN View/Image/Text.
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
          transition={{ w: DUR }}
        />
        <Text style={{ position: 'absolute', top: 280, left: 20, fontSize: 26, fontFamily: 'sans-serif', color: '#ffffff' }}>
          {item.title}
        </Text>
        <Text
          style={{ position: 'absolute', top: 316, left: 20, fontSize: 18, fontFamily: 'sans-serif', color: '#ffffff', opacity: 0.7 }}
        >
          2026 · Details
        </Text>
      </View>

      {/*
        Focus frame — two nested, always-mounted rounded+bordered views whose
        parent group toggles opacity. borderWidth/borderColor/borderRadius are
        plain RN style props here; the css-transform plugin folds them into
        the same `border: { w, color }` + `borderRadius` shape the
        'RoundedWithBorder' shader (registered in src/index.tsx) expects, so
        this still renders as a proper rounded ring instead of a flat
        rectangular strip. Outer ring sits at the card bounds; inner ring is
        inset by RING_T on all sides with a tighter radius to fake the gap
        between the two rings. Both track the animated card width via the `w`
        transition (Lightning-native key — the transition prop is matched
        against node prop names post-style-conversion, not the RN style keys
        used to author it).
      */}
      <View
        style={{ position: 'absolute', top: 0, left: 0, width: w, height: CARD_H, opacity: focused ? 1 : 0 }}
        transition={{ alpha: FRAME_DUR }}
      >
        {/* outer ring — near-white */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: w,
            height: CARD_H,
            borderRadius: RING_RADIUS_OUTER,
            borderWidth: RING_T,
            borderColor: RING_OUTER,
          }}
          transition={{ w: DUR }}
        />
        {/* inner ring — dark, inset by RING_T to fake the gap between card edge and ring */}
        <View
          style={{
            position: 'absolute',
            top: RING_T,
            left: RING_T,
            width: w - 2 * RING_T,
            height: CARD_H - 2 * RING_T,
            borderRadius: RING_RADIUS_INNER,
            borderWidth: RING_T,
            borderColor: RING_INNER,
          }}
          transition={{ w: DUR }}
        />
      </View>
    </View>
  );
};

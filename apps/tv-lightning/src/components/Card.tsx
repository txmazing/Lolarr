import type { Item } from '../data/useRows';

// ease-out-expo — verified against the installed @lightningjs/renderer beta20
// timing-function parser (src/core/utils.js: getTimingFunction/parseCubicBezier),
// which regex-extracts the 4 numbers from a `cubic-bezier(a,b,c,d)` string, so
// this literal is natively supported (no runtime rejection / fallback needed).
const EASING = 'cubic-bezier(0.16,1,0.3,1)';
const DUR = { duration: 400, easing: EASING };
const FRAME_DUR = { duration: 200 };
const CARD_H = 360;
const CARD_W_FOCUSED = 640;
const CARD_W_REST = 240;
const RING_OUTER = 0xf5f5f7ff;
const RING_INNER = 0x0a0a0cff;
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

export const Card = ({ item, x, focused }: { item: Item; x: number; focused: boolean }) => {
  const w = focused ? CARD_W_FOCUSED : CARD_W_REST;
  return (
    <lng-view
      style={{ x, y: 0, w, h: CARD_H, zIndex: focused ? 10 : 1, clipping: true }}
      transition={{ x: DUR, w: DUR }}
    >
      {/* fallback rect underneath — texture loads swap in above it */}
      <lng-view style={{ w, h: CARD_H, color: 0x1a1a1eff, borderRadius: 12 }} transition={{ w: DUR }} />

      {/*
        Portrait poster — fixed size, never tweened. Crossfades out on focus.
        alpha uses ALPHA_EPS instead of 0 when focused: alpha === 0 makes the
        node non-renderable, which defers texture load until alpha next rises
        above 0 — i.e. only when focus returns, causing a visible pop. A tiny
        nonzero alpha keeps it renderable (texture stays loaded) while reading
        as invisible.
      */}
      <lng-image
        src={item.posterUrl}
        style={{ x: 0, y: 0, w: CARD_W_REST, h: CARD_H, borderRadius: 12, alpha: focused ? ALPHA_EPS : 1 }}
        transition={{ alpha: DUR }}
      />

      {/*
        Landscape crop — fixed size, never tweened. Crossfades in on focus.
        Same ALPHA_EPS eager-load trick while unfocused, so the backdrop
        texture is already decoded by the time focus lands (no late pop).
      */}
      <lng-image
        src={item.landscapeUrl}
        style={{ x: 0, y: 0, w: CARD_W_FOCUSED, h: CARD_H, borderRadius: 12, alpha: focused ? 1 : ALPHA_EPS }}
        transition={{ alpha: DUR }}
      />

      {/*
        Gradient title overlay — fades in with the landscape image (same group alpha).
        colorTop/colorBottom are real INodeProps (see @lightningjs/renderer
        CoreNode.d.ts) and pass straight through the react-lightning style prop
        (LightningViewElementStyle extends Partial<INodeProps>, only omitting
        parent/src/shader/data/texture) — no stacked-views fallback needed here.
      */}
      <lng-view style={{ x: 0, y: 0, w, h: CARD_H, alpha: focused ? 1 : 0 }} transition={{ alpha: DUR }}>
        {/*
          borderRadius accepts `number | [number, number?, number?, number?]`
          (order [top-left, top-right, bottom-right, bottom-left] — see
          react-lightning's jsx-CNsTDz-X.d.ts and the renderer's
          RoundedTemplate.js prop setters top-left/top-right/bottom-right/
          bottom-left). Round only the bottom corners so the gradient doesn't
          blunt the card's own top rounding.
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
        <lng-text style={{ x: 20, y: 280, fontSize: 26, fontFamily: 'sans-serif' }}>{item.title}</lng-text>
        <lng-text style={{ x: 20, y: 316, fontSize: 18, fontFamily: 'sans-serif', alpha: 0.7 }}>
          2026 · Details
        </lng-text>
      </lng-view>

      {/*
        Focus frame — two nested, always-mounted rounded+bordered views whose
        parent group toggles alpha. Each uses style.border + style.borderRadius,
        which LightningViewElement._getShaderFromStyle resolves to the
        'RoundedWithBorder' shader (registered in src/index.tsx) instead of the
        old flat rectangular strip stand-in, so the ring now follows the card's
        own corner rounding instead of squaring it off. Outer ring sits at the
        card bounds; inner ring is inset by RING_T on all sides with a tighter
        radius to fake the gap between the two rings. Both track the animated
        card width via the `w` transition.
      */}
      <lng-view style={{ x: 0, y: 0, w, h: CARD_H, alpha: focused ? 1 : 0 }} transition={{ alpha: FRAME_DUR }}>
        {/* outer ring — near-white */}
        <lng-view
          style={{
            x: 0,
            y: 0,
            w,
            h: CARD_H,
            color: 0x00000000,
            borderRadius: RING_RADIUS_OUTER,
            border: { w: RING_T, color: RING_OUTER },
          }}
          transition={{ w: DUR }}
        />
        {/* inner ring — dark, inset by RING_T to fake the gap between card edge and ring */}
        <lng-view
          style={{
            x: RING_T,
            y: RING_T,
            w: w - 2 * RING_T,
            h: CARD_H - 2 * RING_T,
            color: 0x00000000,
            borderRadius: RING_RADIUS_INNER,
            border: { w: RING_T, color: RING_INNER },
          }}
          transition={{ w: DUR }}
        />
      </lng-view>
    </lng-view>
  );
};

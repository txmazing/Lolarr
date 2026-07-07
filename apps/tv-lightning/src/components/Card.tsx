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
const RING_T = 3; // strip thickness per ring

export const Card = ({ item, x, focused }: { item: Item; x: number; focused: boolean }) => {
  const w = focused ? CARD_W_FOCUSED : CARD_W_REST;
  return (
    <lng-view style={{ x, y: 0, w, h: CARD_H, zIndex: focused ? 10 : 1 }} transition={{ x: DUR, w: DUR }}>
      {/* fallback rect underneath — texture loads swap in above it */}
      <lng-view style={{ w, h: CARD_H, color: 0x1a1a1eff, borderRadius: 12 }} transition={{ w: DUR }} />

      {/* Portrait poster — fixed size, never tweened. Crossfades out on focus. */}
      <lng-image
        src={item.posterUrl}
        style={{ x: 0, y: 0, w: CARD_W_REST, h: CARD_H, borderRadius: 12, alpha: focused ? 0 : 1 }}
        transition={{ alpha: DUR }}
      />

      {/* Landscape crop — fixed size, never tweened. Crossfades in on focus. */}
      <lng-image
        src={item.landscapeUrl}
        style={{ x: 0, y: 0, w: CARD_W_FOCUSED, h: CARD_H, borderRadius: 12, alpha: focused ? 1 : 0 }}
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
        <lng-view
          style={{ x: 0, y: 260, w, h: 100, colorTop: 0x00000000, colorBottom: 0x000000d9 }}
          transition={{ w: DUR }}
        />
        <lng-text style={{ x: 20, y: 280, fontSize: 26, fontFamily: 'sans-serif' }}>{item.title}</lng-text>
        <lng-text style={{ x: 20, y: 316, fontSize: 18, fontFamily: 'sans-serif', alpha: 0.7 }}>
          2026 · Details
        </lng-text>
      </lng-view>

      {/*
        Focus frame — controller override: the brief's border-shader ring does not render
        visually in this environment (known shader/z-order issue, not debugged here).
        Replaced with an always-mounted group of thin strips whose parent group toggles
        alpha. Double-ring look: 3px near-white outer strips at the card bounds, plus 3px
        dark inner strips inset by 3px (creates the gap illusion). Strips track the
        animated card width: top/bottom tween `w`, the right strip tweens `x` (its
        position depends on w), the left strip is fixed at x=0.
      */}
      <lng-view style={{ x: 0, y: 0, w, h: CARD_H, alpha: focused ? 1 : 0 }} transition={{ alpha: FRAME_DUR }}>
        {/* outer ring — near-white */}
        <lng-view style={{ x: 0, y: 0, w, h: RING_T, color: RING_OUTER }} transition={{ w: DUR }} />
        <lng-view
          style={{ x: 0, y: CARD_H - RING_T, w, h: RING_T, color: RING_OUTER }}
          transition={{ w: DUR }}
        />
        <lng-view style={{ x: 0, y: 0, w: RING_T, h: CARD_H, color: RING_OUTER }} />
        <lng-view
          style={{ x: w - RING_T, y: 0, w: RING_T, h: CARD_H, color: RING_OUTER }}
          transition={{ x: DUR }}
        />
        {/* inner ring — dark, inset by RING_T to fake the gap between card edge and ring */}
        <lng-view
          style={{ x: RING_T, y: RING_T, w: w - 2 * RING_T, h: RING_T, color: RING_INNER }}
          transition={{ w: DUR }}
        />
        <lng-view
          style={{ x: RING_T, y: CARD_H - 2 * RING_T, w: w - 2 * RING_T, h: RING_T, color: RING_INNER }}
          transition={{ w: DUR }}
        />
        <lng-view style={{ x: RING_T, y: RING_T, w: RING_T, h: CARD_H - 2 * RING_T, color: RING_INNER }} />
        <lng-view
          style={{ x: w - 2 * RING_T, y: RING_T, w: RING_T, h: CARD_H - 2 * RING_T, color: RING_INNER }}
          transition={{ x: DUR }}
        />
      </lng-view>
    </lng-view>
  );
};

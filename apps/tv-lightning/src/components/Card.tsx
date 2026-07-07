import type { Item } from '../data/useRows';

const DUR = { duration: 400 };
const FRAME_DUR = { duration: 200 };
const CARD_H = 360;
const FRAME_COLOR = 0xf5f5f7ff;

export const Card = ({ item, x, focused }: { item: Item; x: number; focused: boolean }) => {
  const w = focused ? 640 : 240;
  return (
    <lng-view style={{ x, y: 0, w, h: CARD_H, zIndex: focused ? 10 : 1 }} transition={{ x: DUR, w: DUR }}>
      {/* fallback rect underneath — texture loads swap in above it */}
      <lng-view style={{ w, h: CARD_H, color: 0x1a1a1eff, borderRadius: 12 }} transition={{ w: DUR }} />
      <lng-image src={item.posterUrl} style={{ w, h: CARD_H, borderRadius: 12 }} transition={{ w: DUR }} />
      <lng-view
        style={{ x: 0, y: 280, w, h: 80, color: 0x000000aa, alpha: focused ? 1 : 0, borderRadius: 12 }}
        transition={{ alpha: DUR, w: DUR }}
      >
        <lng-text style={{ x: 20, y: 20, fontSize: 26, fontFamily: 'sans-serif' }}>{item.title}</lng-text>
      </lng-view>

      {/*
        Focus frame — controller override: the brief's border-shader ring does not render
        visually in this environment (known shader/z-order issue, not debugged here).
        Replaced with an always-mounted group of 4 thin strips whose parent group toggles
        alpha. Strips track the animated card width: top/bottom tween `w`, the right strip
        tweens `x` (its position depends on w), the left strip is fixed at x=0.
      */}
      <lng-view style={{ x: 0, y: 0, w, h: CARD_H, alpha: focused ? 1 : 0 }} transition={{ alpha: FRAME_DUR }}>
        <lng-view style={{ x: 0, y: 0, w, h: 4, color: FRAME_COLOR }} transition={{ w: DUR }} />
        <lng-view style={{ x: 0, y: CARD_H - 4, w, h: 4, color: FRAME_COLOR }} transition={{ w: DUR }} />
        <lng-view style={{ x: 0, y: 0, w: 4, h: CARD_H, color: FRAME_COLOR }} />
        <lng-view style={{ x: w - 4, y: 0, w: 4, h: CARD_H, color: FRAME_COLOR }} transition={{ x: DUR }} />
      </lng-view>
    </lng-view>
  );
};

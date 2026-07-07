import type { Item } from '../data/useRows';

export const Card = ({ item, x, focused }: { item: Item; x: number; focused: boolean }) => (
  <lng-view style={{ x, y: 0, w: 240, h: 360 }}>
    {/* fallback rect underneath — texture loads swap in above it */}
    <lng-view style={{ w: 240, h: 360, color: 0x1a1a1eff, borderRadius: 12 }} />
    <lng-image src={item.posterUrl} style={{ w: 240, h: 360, borderRadius: 12 }} />
    {focused ? (
      <lng-view style={{ w: 240, h: 360, borderRadius: 12, color: 0x00000000, border: { w: 4, color: 0xf5f5f7ff } }} />
    ) : null}
  </lng-view>
);

import { View } from 'react-native';

import { useRows } from './data/useRows';
import { useFocusStore } from './store';
import { useDpad } from './useDpad';
import { Rail } from './components/Rail';
import { FPSMonitor } from './components/FPSMonitor';

// RN Gate 1 conversion: root is a flex column instead of manually-offset
// rails (`y: 120 + idx * 440`) — `gap: 20` plus each Rail's own fixed
// height: 420 reproduces the original 440px row rhythm via Yoga instead of
// arithmetic. useRows/useDpad/store/probe/FPSMonitor are untouched per the
// brief; FPSMonitor keeps rendering a raw lng-text with explicit x/y and
// still reads correctly as a fixed top-right overlay, since it — like the
// other raw lng-* elements in this app — has no flex-triggering style props
// of its own and isn't pulled into the Yoga tree just for being a child of
// one.
export const App = () => {
  const { data: rows, isLoading } = useRows();
  const { railIndex, cardIndex } = useFocusStore();
  useDpad(rows);

  if (isLoading || !rows) {
    return (
      <lng-view style={{ w: 1920, h: 1080 }}>
        <lng-text style={{ x: 60, y: 40, fontSize: 32, fontFamily: 'sans-serif' }}>
          Loading…
        </lng-text>
        <FPSMonitor />
      </lng-view>
    );
  }

  // Gate 2: no backgroundColor on the root — every pixel the rails/cards
  // don't paint stays transparent so the AVPlay plane shows through.
  return (
    <View style={{ width: 1920, height: 1080, flexDirection: 'column', paddingTop: 120, gap: 20 }}>
      {rows.map((row, idx) => (
        <Rail
          key={row.id}
          row={row}
          focusedCard={cardIndex[row.id] ?? 0}
          railFocused={railIndex === idx}
        />
      ))}
      <FPSMonitor />
    </View>
  );
};

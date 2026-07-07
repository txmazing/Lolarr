import { useRows } from './data/useRows';
import { useFocusStore } from './store';
import { Rail } from './components/Rail';

export const App = () => {
  const { data: rows, isLoading } = useRows();
  const { railIndex, cardIndex } = useFocusStore();

  if (isLoading || !rows) {
    return (
      <lng-view style={{ w: 1920, h: 1080, color: 0x0a0a0cff }}>
        <lng-text style={{ x: 60, y: 40, fontSize: 32, fontFamily: 'sans-serif' }}>
          Loading…
        </lng-text>
      </lng-view>
    );
  }

  return (
    <lng-view style={{ w: 1920, h: 1080, color: 0x0a0a0cff }}>
      {rows.map((row, idx) => (
        <Rail
          key={row.id}
          row={row}
          y={120 + idx * 440}
          focusedCard={cardIndex[row.id] ?? 0}
          railFocused={railIndex === idx}
        />
      ))}
    </lng-view>
  );
};

import { useEffect, useRef, useState } from 'react';

const WINDOW_SIZE = 60; // last N frame deltas kept for the rolling stat
const UPDATE_MS = 500; // ~2x/s — state updates are cheap, not per-frame

// Permanent on-canvas FPS readout, top-right. Accumulates frame deltas via
// rAF but only calls setState twice a second so it doesn't itself become a
// render-cost outlier while measuring one.
export const FPSMonitor = () => {
  const [label, setLabel] = useState('… fps');
  const deltas = useRef<number[]>([]);
  const lastFrame = useRef(0);
  const lastUpdate = useRef(0);

  useEffect(() => {
    let raf = 0;

    const tick = (now: number) => {
      if (lastFrame.current) {
        const dt = now - lastFrame.current;
        deltas.current.push(dt);
        if (deltas.current.length > WINDOW_SIZE) deltas.current.shift();
      }
      lastFrame.current = now;

      if (!lastUpdate.current) lastUpdate.current = now;
      if (now - lastUpdate.current >= UPDATE_MS && deltas.current.length > 0) {
        lastUpdate.current = now;
        // per-frame instantaneous fps, then avg + worst (min) over the window
        const fpsSamples = deltas.current.map((dt) => (dt > 0 ? 1000 / dt : 0));
        const avgFps = fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length;
        const minFps = Math.min(...fpsSamples);
        setLabel(`${avgFps.toFixed(0)} fps avg / ${minFps.toFixed(0)} min`);
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <lng-text style={{ x: 1600, y: 20, fontSize: 24, fontFamily: 'sans-serif', color: 0x9adf6bff }}>
      {label}
    </lng-text>
  );
};

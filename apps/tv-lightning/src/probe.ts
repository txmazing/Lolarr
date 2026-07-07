// Auto measurement probe — spike-only, throwaway.
//
// Starts 15s after module load: records rAF frame deltas into named
// scenario buckets while synthesizing d-pad key presses, then POSTs
// the resulting stats to the dev listener(s). See task-5 brief.

type FrameStats = {
  n: number;
  avg: number;
  max: number;
  p95: number;
  over17: number;
};

const REPORT_URLS = ['http://192.168.1.221:9099/report', 'http://192.168.1.151:9099/report'];

function report(body: unknown): void {
  const json = JSON.stringify(body);
  for (const url of REPORT_URLS) {
    fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: json,
    }).catch(() => {});
  }
}

function stats(deltas: number[]): FrameStats {
  const n = deltas.length;
  if (n === 0) return { n: 0, avg: 0, max: 0, p95: 0, over17: 0 };
  const sorted = [...deltas].sort((a, b) => a - b);
  const sum = deltas.reduce((a, b) => a + b, 0);
  return {
    n,
    avg: sum / n,
    max: sorted[n - 1],
    p95: sorted[Math.floor(0.95 * n)] ?? sorted[n - 1],
    over17: deltas.filter((d) => d > 17).length,
  };
}

// Records rAF frame deltas between start() and stop(); returns the stats
// for the recorded window.
function recordFrames(durationMs: number): Promise<FrameStats> {
  return new Promise((resolve) => {
    const deltas: number[] = [];
    let last = performance.now();
    let raf = 0;
    const startedAt = last;

    const tick = (now: number) => {
      deltas.push(now - last);
      last = now;
      if (now - startedAt >= durationMs) {
        cancelAnimationFrame(raf);
        resolve(stats(deltas));
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
}

function press(key: string): void {
  const keyCodes: Record<string, number> = {
    ArrowLeft: 37,
    ArrowUp: 38,
    ArrowRight: 39,
    ArrowDown: 40,
  };
  window.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      keyCode: keyCodes[key],
      which: keyCodes[key],
      bubbles: true,
    }),
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fires `count` presses of `key`, spaced `intervalMs` apart, while
// recording frame stats for the whole span.
async function scenario(
  presses: Array<{ key: string; delayMs: number }>,
  settleMs = 0,
): Promise<FrameStats> {
  const totalMs = presses.reduce((a, p) => a + p.delayMs, 0) + settleMs;
  const recordingDone = recordFrames(totalMs);
  for (const p of presses) {
    press(p.key);
    await wait(p.delayMs);
  }
  if (settleMs) await wait(settleMs);
  return recordingDone;
}

async function runAutoScenario(): Promise<void> {
  report({ probe: 'start' });

  // idle: 3s, no input, baseline frame cadence
  const idle = await recordFrames(3000);

  // settleAnim: 5 focus changes alternating right/left @1200ms
  const settleAnimPresses = Array.from({ length: 5 }, (_, i) => ({
    key: i % 2 === 0 ? 'ArrowRight' : 'ArrowLeft',
    delayMs: 1200,
  }));
  const settleAnim = await scenario(settleAnimPresses);

  // rattle: 12x ArrowRight @60ms — stresses rapid re-focus/animation restarts
  const rattlePresses = Array.from({ length: 12 }, () => ({ key: 'ArrowRight', delayMs: 60 }));
  const rattle = await scenario(rattlePresses);

  // railSwitch: 2x down + 2x up @900ms — rail-to-rail transitions
  const railSwitchPresses = [
    { key: 'ArrowDown', delayMs: 900 },
    { key: 'ArrowDown', delayMs: 900 },
    { key: 'ArrowUp', delayMs: 900 },
    { key: 'ArrowUp', delayMs: 900 },
  ];
  const railSwitch = await scenario(railSwitchPresses);

  report({ probe: 'result', idle, settleAnim, rattle, railSwitch });
}

export function startProbe(): void {
  setTimeout(() => {
    runAutoScenario().catch(() => {});
  }, 15000);
}

// Gate 2 (AVPlay-Koexistenz) — spike-only, throwaway.
//
// Creates the <object type="application/avplayer"> hole-punch element
// fullscreen behind the Lightning canvas and plays a public test video via
// webapis.avplay (same lifecycle as packages/player/src/avplayPlayer.ts:
// open → setDisplayRect → setListener → prepareAsync → play). Every state
// transition is beaconed to the dev listener, because the gate must be
// verified in a normal launch (no debugger attached).

import { report } from './report';

// Ambient Tizen global — only present on-device. Declared inline instead of
// referencing packages/player/src/tizen.d.ts to keep the spike self-contained.
declare const webapis:
  | {
      avplay: {
        open(url: string): void;
        setDisplayRect(x: number, y: number, width: number, height: number): void;
        setListener(listener: {
          onbufferingstart?: () => void;
          onbufferingcomplete?: () => void;
          oncurrentplaytime?: (currentTime: number) => void;
          onstreamcompleted?: () => void;
          onerror?: (eventType: string) => void;
          onerrormsg?: (eventType: string, errorMsg: string) => void;
        }): void;
        prepareAsync(onSuccess: () => void, onError: (error?: unknown) => void): void;
        play(): void;
        getState(): string;
        getCurrentTime(): number;
        getDuration(): number;
      };
    }
  | undefined;

// LAN-hosted H.264/AAC progressive MP4 (3 min, ffmpeg testsrc2 + timecode),
// served with Range support from the dev host — matches the production
// topology (Jellyfin on LAN). The classic gtv-videos-bucket sample URL now
// returns HTTP 403 (verified from the host), which AVPlay surfaces as
// PLAYER_ERROR_CONNECTION_FAILED.
const TEST_VIDEO_URL = 'http://192.168.1.221:9098/test.mp4';

export function sampleAvplay(): { state: string; timeMs: number } | null {
  if (typeof webapis === 'undefined' || !webapis) return null;
  return { state: webapis.avplay.getState(), timeMs: webapis.avplay.getCurrentTime() };
}

export function startAvplay(): void {
  if (typeof webapis === 'undefined' || !webapis) {
    report({ gate2: 'skipped', reason: 'no webapis (dev browser)' });
    return;
  }
  const av = webapis.avplay;

  // Hole-punch placeholder: position:fixed keeps it out of the flow so #app
  // stays at the top, and being the first body child keeps it visually
  // behind the canvas. The compositor shows the video plane wherever the
  // pixels above the <object> are transparent (clearColor 0x00000000 + no
  // opaque root background, see index.tsx / App.tsx).
  const el = document.createElement('object');
  el.type = 'application/avplayer';
  el.style.position = 'fixed';
  el.style.left = '0';
  el.style.top = '0';
  el.style.width = '100%';
  el.style.height = '100%';
  document.body.insertBefore(el, document.body.firstChild);

  const prepareAndPlay = () => {
    av.prepareAsync(
      () => {
        report({ gate2: 'prepared', state: av.getState(), durationMs: av.getDuration() });
        av.play();
        report({ gate2: 'play-called', state: av.getState() });
      },
      (error) => report({ gate2: 'prepare-failed', error: String(error) }),
    );
  };

  // Loop forever so the punch-through stays visually checkable on the TV
  // long after launch (the test clip is only 3 min). After stream end the
  // player must go through stop → open → prepare again.
  const restart = () => {
    report({ gate2: 'stream-completed, looping' });
    try {
      av.stop();
      av.open(TEST_VIDEO_URL);
      av.setDisplayRect(0, 0, 1920, 1080);
      prepareAndPlay();
    } catch (error) {
      report({ gate2: 'loop-restart-failed', error: String(error) });
    }
  };

  try {
    av.open(TEST_VIDEO_URL);
    av.setDisplayRect(0, 0, 1920, 1080);
    av.setListener({
      onbufferingstart: () => report({ gate2: 'buffering-start' }),
      onbufferingcomplete: () => report({ gate2: 'buffering-complete', ...sampleAvplay() }),
      onstreamcompleted: restart,
      onerror: (eventType) => report({ gate2: 'error', eventType }),
      onerrormsg: (eventType, errorMsg) => report({ gate2: 'error-msg', eventType, errorMsg }),
    });
    report({ gate2: 'open-ok', state: av.getState() });
    prepareAndPlay();
  } catch (error) {
    report({ gate2: 'exception', error: String(error) });
  }
}

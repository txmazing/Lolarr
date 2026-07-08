// Dev-listener beacon — spike-only, throwaway. Shared by probe.ts (Gate 1
// frame stats) and avplay.ts (Gate 2 player state) so neither imports the
// other's module graph.

const REPORT_URLS = ['http://192.168.1.221:9099/report', 'http://192.168.1.151:9099/report'];

export function report(body: unknown): void {
  const json = JSON.stringify(body);
  for (const url of REPORT_URLS) {
    fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      body: json,
    }).catch(() => {});
  }
}

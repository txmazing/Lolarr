export {}

declare global {
  type AVPlayState = 'NONE' | 'IDLE' | 'READY' | 'PLAYING' | 'PAUSED'

  interface AVPlayListener {
    onbufferingstart?: () => void
    onbufferingprogress?: (percent: number) => void
    onbufferingcomplete?: () => void
    oncurrentplaytime?: (currentTime: number) => void
    onstreamcompleted?: () => void
    onevent?: (eventType: string, eventData: string) => void
    onerror?: (eventType: string) => void
    onerrormsg?: (eventType: string, errorMsg: string) => void
  }

  interface AVPlay {
    open(url: string): void
    close(): void
    stop(): void
    setListener(listener: AVPlayListener): void
    setDisplayRect(x: number, y: number, width: number, height: number): void
    prepareAsync(onSuccess: () => void, onError: (error?: unknown) => void): void
    play(): void
    pause(): void
    seekTo(ms: number, onSuccess?: () => void, onError?: (error?: unknown) => void): void
    getState(): AVPlayState
    getCurrentTime(): number
    getDuration(): number
    setStreamingProperty(type: string, value: string): void
  }

  interface ProductInfo {
    getRealModel(): string
    getFirmware(): string
  }

  interface TvInputDeviceKey {
    name: string
    code: number
  }

  interface TvInputDevice {
    getSupportedKeys(): TvInputDeviceKey[]
    registerKey(name: string): void
    unregisterKey(name: string): void
  }

  interface TizenSystemInfo {
    getCapability(key: string): string
  }

  const webapis: { avplay: AVPlay; productinfo: ProductInfo }
  const tizen: { tvinputdevice: TvInputDevice; systeminfo: TizenSystemInfo }
}

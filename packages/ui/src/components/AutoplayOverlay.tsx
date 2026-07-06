import type { ActionComponent } from './types.js'

export function AutoplayOverlay({
  Action,
  title,
  secondsLeft,
  onPlayNow,
  onCancel,
}: {
  Action: ActionComponent
  title: string
  secondsLeft: number
  onPlayNow: () => void
  onCancel: () => void
}) {
  return (
    <div className="glass-controls absolute right-8 bottom-10 max-w-xs rounded-md p-5">
      <p className="text-sm text-muted-foreground">Next episode in {secondsLeft}s</p>
      <p className="mt-1 mb-3 font-semibold">{title}</p>
      <div className="flex gap-3">
        <Action variant="primary" onPress={onPlayNow} focusKey="autoplay-now">
          Play now
        </Action>
        <Action onPress={onCancel} focusKey="autoplay-cancel">
          Cancel
        </Action>
      </div>
    </div>
  )
}

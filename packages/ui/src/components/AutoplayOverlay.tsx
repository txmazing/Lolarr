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
    <div className="autoplay-overlay">
      <p className="autoplay-label">Next episode in {secondsLeft}s</p>
      <p className="autoplay-title">{title}</p>
      <div className="autoplay-actions">
        <Action onPress={onPlayNow} focusKey="autoplay-now">
          Play now
        </Action>
        <Action onPress={onCancel} focusKey="autoplay-cancel">
          Cancel
        </Action>
      </div>
    </div>
  )
}

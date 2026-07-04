import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PlayerControls } from '../src/components/PlayerControls.js'
import { DefaultAction } from '../src/components/DefaultAction.js'

function markup(showVolume: boolean) {
  return renderToStaticMarkup(
    <PlayerControls
      Action={DefaultAction}
      visible
      isPaused={false}
      position={0}
      duration={100}
      volume={1}
      showVolume={showVolume}
      onTogglePause={() => {}}
      onSeekTo={() => {}}
      onSeekBy={() => {}}
      onVolume={() => {}}
      onFullscreen={() => {}}
      onBack={() => {}}
    />,
  )
}

describe('PlayerControls showVolume', () => {
  it('renders the volume slider when showVolume is true', () => {
    expect(markup(true)).toContain('player-volume')
  })

  it('omits the volume slider when showVolume is false', () => {
    expect(markup(false)).not.toContain('player-volume')
  })
})

import { useEffect, useState } from 'react'
import {
  FocusContext,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation-react'
import { Button, GlassDialog, PillTabs, cn, type ActionProps } from '@lolarr/ui'

function SpikeButton({ label, onPress }: { label: string; onPress?: () => void }) {
  const { ref, focused } = useFocusable({ onEnterPress: onPress })
  return (
    <Button ref={ref} className={cn(focused && 'focused')} onClick={onPress}>
      {label}
    </Button>
  )
}

// Norigin-registered ActionComponent for PillTabs — mirrors how the real app
// injects TvAction (e.g. into SeasonSelector), which is what this gate tests.
function SpikeAction({
  ariaLabel,
  children,
  className,
  disabled,
  focusKey,
  onPress,
  size,
  type = 'button',
  variant,
}: ActionProps) {
  const { ref, focused } = useFocusable({
    focusKey,
    focusable: !disabled,
    onEnterPress: onPress,
  })
  return (
    <Button
      ref={ref}
      type={type}
      variant={variant}
      size={size}
      aria-label={ariaLabel}
      className={cn(className, focused && 'focused')}
      disabled={disabled}
      onClick={onPress}
    >
      {children}
    </Button>
  )
}

export function SpikeScreen() {
  const { ref, focusKey, focusSelf } = useFocusable({ isFocusBoundary: true })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [tab, setTab] = useState('s1')

  // Seed initial Norigin focus like TvShell does — without it, D-Pad input is
  // dead on the device (norigin aborts navigation when nothing is focused).
  useEffect(() => {
    focusSelf()
  }, [focusSelf])

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className="min-h-screen bg-background p-16 flex flex-col gap-8">
        <h1 className="text-3xl font-semibold">UI-Spike (Phase 0)</h1>
        <p className="text-muted-foreground text-sm break-all">{navigator.userAgent}</p>
        <div className="flex gap-4">
          <SpikeButton label="Dialog öffnen" onPress={() => setDialogOpen(true)} />
          <SpikeButton label="Fokus-Test B" />
          <SpikeButton label="Fokus-Test C" />
        </div>
        <PillTabs
          ariaLabel="Spike tabs"
          Action={SpikeAction}
          items={[
            { id: 's1', label: 'Staffel 1' },
            { id: 's2', label: 'Staffel 2' },
          ]}
          selectedId={tab}
          onSelect={setTab}
        />
        <GlassDialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Glass-Dialog">
          <p className="text-muted-foreground">Fokus-Trap-Test: Pfeiltasten müssen zwischen den zwei Buttons wechseln.</p>
          <div className="flex gap-4">
            <SpikeButton label="Bestätigen" onPress={() => setDialogOpen(false)} />
            <SpikeButton label="Abbrechen" onPress={() => setDialogOpen(false)} />
          </div>
        </GlassDialog>
      </div>
    </FocusContext.Provider>
  )
}

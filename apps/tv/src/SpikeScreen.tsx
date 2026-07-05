import { useState } from 'react'
import {
  FocusContext,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation-react'
import { Button, GlassDialog, PillTabs, cn } from '@lolarr/ui'

function SpikeButton({ label, onPress }: { label: string; onPress?: () => void }) {
  const { ref, focused } = useFocusable({ onEnterPress: onPress })
  return (
    <Button ref={ref} className={cn(focused && 'focused')} onClick={onPress}>
      {label}
    </Button>
  )
}

export function SpikeScreen() {
  const { ref, focusKey } = useFocusable({ isFocusBoundary: true })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [tab, setTab] = useState('s1')

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

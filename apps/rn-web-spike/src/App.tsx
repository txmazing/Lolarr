// Gate 3: abyss morph card + glass dialog rebuilt with RN primitives on
// react-native-web. Every literal below is the shipped abyss reference value
// from packages/ui/src/theme.css + MediaPosterButton.tsx + GlassDialog.tsx —
// the gate compares computed styles/screenshots against these, so keep them
// byte-identical to the reference, do not "improve" them.
import { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

const FONT = "'Inter Variable', ui-sans-serif, system-ui, sans-serif";
const EASE_OUT_EXPO = 'cubic-bezier(0.16, 1, 0.3, 1)';
const BACKGROUND = '#0a0a0c';
const FOREGROUND = '#f5f5f7';

const CARD_W = 240;
const CARD_H = 360;
const CARD_W_EXPANDED = 640;

const RING_REST =
  'inset 0 0 3px rgba(200, 200, 200, 0.35), 0 0 0 3px transparent, 0 0 0 5px transparent';
const RING_FOCUSED = `inset 0 0 3px rgba(200, 200, 200, 0.35), 0 0 0 3px ${BACKGROUND}, 0 0 0 5px ${FOREGROUND}`;

type Item = { id: number; title: string; meta: string };

const ITEMS: Item[] = Array.from({ length: 6 }, (_, i) => ({
  id: i,
  title: `Sample Title ${i + 1}`,
  meta: '2026 · Film',
}));

function posterUrl(id: number) {
  return `https://picsum.photos/seed/lolarr-p${id}/400/600`;
}
function backdropUrl(id: number) {
  return `https://picsum.photos/seed/lolarr-b${id}/800/450`;
}

// Portrait morph card: slot stays in-flow and animates ONLY width
// (240→640 @400ms ease-out-expo); the card fills the slot absolutely.
// Focus ring is the layered box-shadow (3px background gap + ring to 5px).
function MorphCard({ item, focused, onFocus }: { item: Item; focused: boolean; onFocus: () => void }) {
  return (
    <View
      // @ts-expect-error RNW dataSet → data-* attribute
      dataSet={{ testid: `card-slot-${item.id}` }}
      style={{
        position: 'relative',
        flexShrink: 0,
        flexGrow: 0,
        width: focused ? CARD_W_EXPANDED : CARD_W,
        height: CARD_H,
        // @ts-expect-error RNW web-only transition props
        transitionProperty: 'width',
        transitionDuration: '400ms',
        transitionTimingFunction: EASE_OUT_EXPO,
      }}
    >
      <Pressable
        onHoverIn={onFocus}
        onFocus={onFocus}
        // @ts-expect-error RNW dataSet → data-* attribute
        dataSet={{ testid: `card-${item.id}` }}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          overflow: 'hidden',
          borderRadius: 12,
          // @ts-expect-error RNW boxShadow string + transition props
          boxShadow: focused ? RING_FOCUSED : RING_REST,
          transitionProperty: 'box-shadow',
          transitionDuration: '300ms',
          transitionTimingFunction: EASE_OUT_EXPO,
        }}
      >
        <Image
          source={{ uri: posterUrl(item.id) }}
          resizeMode="cover"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            opacity: focused ? 0 : 1,
            // @ts-expect-error RNW web-only transition props
            transitionProperty: 'opacity',
            transitionDuration: '400ms',
            transitionTimingFunction: EASE_OUT_EXPO,
          }}
        />
        <Image
          source={{ uri: backdropUrl(item.id) }}
          resizeMode="cover"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            opacity: focused ? 1 : 0,
            // @ts-expect-error RNW web-only transition props
            transitionProperty: 'opacity',
            transitionDuration: '400ms',
            transitionTimingFunction: EASE_OUT_EXPO,
          }}
        />
        {/* Overlay: bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4 pt-12 */}
        <View
          // @ts-expect-error RNW dataSet → data-* attribute
          dataSet={{ testid: `overlay-${item.id}` }}
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            left: 0,
            padding: 16,
            paddingTop: 48,
            gap: 4,
            opacity: focused ? 1 : 0,
            // @ts-expect-error RNW web-only props (gradient + transition)
            backgroundImage:
              'linear-gradient(to top, rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0))',
            transitionProperty: 'opacity',
            transitionDuration: '400ms',
            transitionTimingFunction: EASE_OUT_EXPO,
          }}
        >
          <Text
            numberOfLines={1}
            style={{ fontFamily: FONT, fontSize: 16, fontWeight: '600', color: '#ffffff' }}
          >
            {item.title}
          </Text>
          <Text style={{ fontFamily: FONT, fontSize: 12, color: 'rgba(255, 255, 255, 0.7)' }}>
            {item.meta}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

// GlassDialog: frost rgb(42 42 42 / 0.72) + blur(20px), 1px border
// rgb(245 245 247 / 0.16), radius 24, shadow 0 24px 64px rgba(0,0,0,0.48),
// scrim black/60, open anim fade-in + zoom-in-95 (~150ms).
function GlassDialog({ onClose }: { onClose: () => void }) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <View
      style={{
        // @ts-expect-error RNW position:fixed
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 50,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Pressable
        onPress={onClose}
        style={{
          // @ts-expect-error RNW position:fixed
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          opacity: entered ? 1 : 0,
          transitionProperty: 'opacity',
          transitionDuration: '150ms',
        }}
      />
      <View
        // Tag for the computed-style probe.
        // @ts-expect-error RNW dataSet → data-* attribute
        dataSet={{ testid: 'glass-panel' }}
        style={{
          width: '100%',
          maxWidth: 512,
          padding: 20,
          gap: 16,
          borderRadius: 24,
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: 'rgba(245, 245, 247, 0.16)',
          backgroundColor: 'rgba(42, 42, 42, 0.72)',
          opacity: entered ? 1 : 0,
          transform: [{ scale: entered ? 1 : 0.95 }],
          // @ts-expect-error RNW web-only props (backdrop blur, shadow string, transitions)
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.48)',
          transitionProperty: 'opacity, transform',
          transitionDuration: '150ms',
        }}
      >
        <Text style={{ fontFamily: FONT, fontSize: 20, fontWeight: '600', color: FOREGROUND }}>
          Request seasons
        </Text>
        <Text style={{ fontFamily: FONT, fontSize: 14, color: 'rgba(245, 245, 247, 0.7)' }}>
          Pick the seasons to request. This panel must frost the moving cards
          behind it — that is the whole point of the gate.
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
          <Pressable
            onPress={onClose}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: 'rgba(255, 255, 255, 0.07)',
            }}
          >
            <Text style={{ fontFamily: FONT, fontSize: 14, fontWeight: '500', color: FOREGROUND }}>
              Cancel
            </Text>
          </Pressable>
          <Pressable
            onPress={onClose}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
            }}
          >
            <Text style={{ fontFamily: FONT, fontSize: 14, fontWeight: '600', color: BACKGROUND }}>
              Request
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function App() {
  const [focusedCard, setFocusedCard] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <View style={{ minHeight: '100vh' as never, backgroundColor: BACKGROUND, paddingVertical: 48, gap: 12 }}>
      <Text
        style={{
          fontFamily: FONT,
          fontSize: 18,
          fontWeight: '500',
          color: FOREGROUND,
          paddingHorizontal: 48,
        }}
      >
        Weiter ansehen
      </Text>
      <View
        style={{
          flexDirection: 'row',
          gap: 20,
          paddingHorizontal: 48,
          paddingTop: 16,
          paddingBottom: 24,
          // @ts-expect-error RNW overflow-x
          overflowX: 'auto',
        }}
      >
        {ITEMS.map((item, i) => (
          <MorphCard key={item.id} item={item} focused={focusedCard === i} onFocus={() => setFocusedCard(i)} />
        ))}
      </View>
      <View style={{ paddingHorizontal: 48 }}>
        <Pressable
          onPress={() => setDialogOpen(true)}
          // @ts-expect-error RNW dataSet → data-* attribute
          dataSet={{ testid: 'open-dialog' }}
          style={{
            alignSelf: 'flex-start',
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: 'rgba(255, 255, 255, 0.07)',
          }}
        >
          <Text style={{ fontFamily: FONT, fontSize: 14, fontWeight: '500', color: FOREGROUND }}>
            Open glass dialog
          </Text>
        </Pressable>
      </View>
      {dialogOpen ? <GlassDialog onClose={() => setDialogOpen(false)} /> : null}
    </View>
  );
}

import { useEffect, useState, type ReactNode } from 'react'
import {
  FocusContext,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation-react'
import {
  LolarrHome,
  type InteractiveControlProps,
} from '@lolarr/ui'

function TvLink({ children, className = '', href }: InteractiveControlProps) {
  const { ref, focused } = useFocusable({
    onEnterPress: () => {
      if (href) {
        window.location.href = href
      }
    },
  })

  return (
    <a
      ref={ref}
      className={focused ? `${className} focused` : className}
      href={href}
      target="_blank"
    >
      {children}
    </a>
  )
}

function TvAction({
  children,
  className = '',
  onPress,
}: InteractiveControlProps) {
  const { ref, focused } = useFocusable({ onEnterPress: onPress })

  return (
    <button
      ref={ref}
      type="button"
      className={focused ? `${className} focused` : className}
      onClick={onPress}
    >
      {children}
    </button>
  )
}

function TvShell({ children }: { children: ReactNode }) {
  const { ref, focusKey, focusSelf } = useFocusable({
    focusKey: 'APP',
    trackChildren: true,
  })

  useEffect(() => {
    focusSelf()
  }, [focusSelf])

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className="app-shell">
        {children}
      </div>
    </FocusContext.Provider>
  )
}

function App() {
  const [count, setCount] = useState(0)

  const increment = () => {
    setCount((count) => count + 1)
  }

  return (
    <LolarrHome
      count={count}
      onIncrement={increment}
      Action={TvAction}
      Link={TvLink}
      Shell={TvShell}
    />
  )
}

export default App

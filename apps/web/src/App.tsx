import { useState } from 'react'
import {
  LolarrHome,
  type InteractiveControlProps,
} from '@lolarr/ui'

function WebAction({ children, className, onPress }: InteractiveControlProps) {
  return (
    <button type="button" className={className} onClick={onPress}>
      {children}
    </button>
  )
}

function WebLink({ children, className, href }: InteractiveControlProps) {
  return (
    <a className={className} href={href} target="_blank">
      {children}
    </a>
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
      Action={WebAction}
      Link={WebLink}
    />
  )
}

export default App

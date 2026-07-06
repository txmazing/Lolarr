import { LolarrApp } from '@lolarr/features'
import { WebAction } from './focus/WebAction'
import { WebShell } from './focus/WebShell'

function App() {
  return <LolarrApp Action={WebAction} Shell={WebShell} />
}

export default App

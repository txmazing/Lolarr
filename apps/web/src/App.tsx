import { LolarrApp } from '@lolarr/features'
import { WebAction } from './focus/WebAction'
import { WebShell } from './focus/WebShell'
import { WebTextInput } from './focus/WebTextInput'

function App() {
  return <LolarrApp Action={WebAction} Shell={WebShell} TextInput={WebTextInput} />
}

export default App

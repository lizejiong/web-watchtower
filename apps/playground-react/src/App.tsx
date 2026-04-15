import { useState } from "react"
import {
  sendFailedRequest,
  simulateOffline,
  throwRuntimeError,
  triggerPromiseRejection,
} from "./api"

export function App() {
  const [inputValue, setInputValue] = useState("")

  return (
    <main>
      <h1>Web Monitoring Playground</h1>
      <p>Manual controls for exercising the Phase 1 browser SDK flow.</p>

      <button onClick={throwRuntimeError} type="button">
        Throw Runtime Error
      </button>
      <button onClick={triggerPromiseRejection} type="button">
        Trigger Promise Rejection
      </button>
      <button
        onClick={() => {
          void sendFailedRequest()
        }}
        type="button"
      >
        Send Failed Request
      </button>
      <button onClick={simulateOffline} type="button">
        Simulate Offline
      </button>

      <label>
        Search Input
        <input
          aria-label="Search Input"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
        />
      </label>
    </main>
  )
}

import { startTransition, useState } from "react"
import {
  capturePromiseRejection,
  captureRuntimeError,
  sendFailedRequest,
  simulateOffline,
} from "./api"

export function App() {
  const [inputValue, setInputValue] = useState("")
  const [lastFlushStatus, setLastFlushStatus] = useState("idle")

  function updateFlushStatus(status: string) {
    startTransition(() => {
      setLastFlushStatus(status)
    })
  }

  return (
    <main>
      <h1>Web Monitoring Playground</h1>
      <p>Manual controls for exercising the Phase 1 browser SDK flow.</p>
      <p>Last flush: {lastFlushStatus}</p>

      <button
        onClick={() => {
          void captureRuntimeError().then(updateFlushStatus)
        }}
        type="button"
      >
        Throw Runtime Error
      </button>
      <button
        onClick={() => {
          void capturePromiseRejection().then(updateFlushStatus)
        }}
        type="button"
      >
        Trigger Promise Rejection
      </button>
      <button
        onClick={() => {
          void sendFailedRequest().then(updateFlushStatus)
        }}
        type="button"
      >
        Send Failed Request
      </button>
      <button
        onClick={() => {
          updateFlushStatus(simulateOffline())
        }}
        type="button"
      >
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

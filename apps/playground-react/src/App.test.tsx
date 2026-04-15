import "@testing-library/jest-dom/vitest"
import { render, screen } from "@testing-library/react"
import { App } from "./App"

it("shows controls for manual telemetry triggers", () => {
  render(<App />)

  expect(screen.getByRole("button", { name: "Throw Runtime Error" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Send Failed Request" })).toBeInTheDocument()
})

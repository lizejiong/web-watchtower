import ReactDOM from "react-dom/client"
import { StrictMode } from "react"
import { bootstrapMonitoring } from "./api"
import { AppRoutes } from "./routes"

bootstrapMonitoring()

const rootElement = document.getElementById("root")

if (!rootElement) {
  throw new Error("playground root element is missing")
}

ReactDOM.createRoot(rootElement).render(
  <StrictMode>
    <AppRoutes />
  </StrictMode>,
)

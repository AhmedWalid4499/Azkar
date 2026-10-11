import { Navigate, Route, Routes } from 'react-router-dom'
import { LogPage } from './LogPage'

/** Routed under `/log/*`: history, calendar and statistics. */
export function LogRoutes() {
  return (
    <Routes>
      <Route index element={<LogPage />} />
      <Route path="*" element={<Navigate to="/log" replace />} />
    </Routes>
  )
}

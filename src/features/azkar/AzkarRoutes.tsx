import { Navigate, Route, Routes } from 'react-router-dom'
import { PickerPage } from './PickerPage'
import { ReaderPage } from './reader/ReaderPage'

/** Routed under `/azkar/*`: the session picker and the reader. */
export function AzkarRoutes() {
  return (
    <Routes>
      <Route index element={<PickerPage />} />
      <Route path=":collection" element={<ReaderPage />} />
      <Route path="*" element={<Navigate to="/azkar" replace />} />
    </Routes>
  )
}

import { Navigate, Route, Routes } from 'react-router-dom'
import { PickerPage } from './PickerPage'
import { AfterPrayerReaderPage } from './reader/AfterPrayerReaderPage'
import { ReaderPage } from './reader/ReaderPage'
import { TasbihPage } from './tasbih/TasbihPage'

/** Routed under `/azkar/*`: the picker, the reader of a session or of the azkar after a prayer, and the tasbih counter. */
export function AzkarRoutes() {
  return (
    <Routes>
      <Route index element={<PickerPage />} />
      <Route path="tasbih" element={<TasbihPage />} />
      <Route path="after/:prayer" element={<AfterPrayerReaderPage />} />
      <Route path="after/:prayer/:dateKey" element={<AfterPrayerReaderPage />} />
      <Route path=":collection" element={<ReaderPage />} />
      <Route path="*" element={<Navigate to="/azkar" replace />} />
    </Routes>
  )
}

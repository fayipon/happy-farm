import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Farm from './pages/Farm'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/index" element={<Home />} />
      <Route path="/farm" element={<Farm />} />
    </Routes>
  )
}

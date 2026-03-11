import { useNavigate } from 'react-router-dom'
import './Home.css'

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className="home">
      <h1>Story#1585</h1>
      <button className="play-btn" onClick={() => navigate('/farm')}>
        Play Now
      </button>
    </div>
  )
}

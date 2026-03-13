import { useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import { createGameConfig } from '../game/config'
import DevTools from './DevTools'
import './Farm.css'

export default function Farm() {
  const gameRef = useRef<Phaser.Game | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [debug, setDebug] = useState(import.meta.env.DEV)

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return

    const config = createGameConfig(containerRef.current)
    gameRef.current = new Phaser.Game(config)

    return () => {
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F9') setDebug(d => !d)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="farm-wrapper">
      <div className="farm" ref={containerRef}></div>
      {debug && <DevTools />}
    </div>
  )
}

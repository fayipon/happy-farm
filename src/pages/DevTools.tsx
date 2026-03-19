import { useState, useEffect, useCallback } from 'react'
import { fetchFarm, plantCrop, waterPlot, harvestPlot, clearAll, setVip, getApiSettings, setApiSettings, type FarmData } from '../game/api'
import './DevTools.css'

const CROPS = ['carrot', 'tomato', 'corn', 'pumpkin', 'cabbage', 'radish', 'wheat', 'berry']

export default function DevTools() {
  const [open, setOpen] = useState(true)
  const [farm, setFarm] = useState<FarmData | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [selectedCrop, setSelectedCrop] = useState('carrot')
  const [plotId, setPlotId] = useState(1)
  const [apiDomain, setApiDomain] = useState(() => getApiSettings().domain)
  const [authHeader, setAuthHeader] = useState(() => getApiSettings().auth)
  const [originHeader, setOriginHeader] = useState(() => getApiSettings().origin)
  const [xHostHeader, setXHostHeader] = useState(() => getApiSettings().xHost)

  const addLog = useCallback((msg: string) => {
    setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50))
  }, [])

  const refresh = useCallback(async () => {
    try {
      const data = await fetchFarm()
      setFarm(data)
      addLog('Refreshed farm data')
    } catch (e) {
      addLog(`Error: ${e}`)
    }
  }, [addLog])

  useEffect(() => { refresh() }, [refresh])

  // Listen for game actions to stay in sync
  useEffect(() => {
    const onFarmUpdated = () => { refresh() }
    window.addEventListener('farm-updated', onFarmUpdated)
    return () => window.removeEventListener('farm-updated', onFarmUpdated)
  }, [refresh])

  const notifyGame = () => {
    window.dispatchEvent(new CustomEvent('devtools-updated'))
  }

  const doPlant = async () => {
    try {
      const data = await plantCrop(plotId, selectedCrop)
      setFarm(data)
      addLog(`Planted ${selectedCrop} on plot #${plotId}`)
      notifyGame()
    } catch (e) {
      addLog(`Plant failed: ${e}`)
    }
  }

  const doWater = async () => {
    try {
      const data = await waterPlot(plotId)
      setFarm(data)
      addLog(`Watered plot #${plotId}`)
      notifyGame()
    } catch (e) {
      addLog(`Water failed: ${e}`)
    }
  }

  const doHarvest = async () => {
    try {
      const data = await harvestPlot(plotId)
      setFarm(data)
      addLog(`Harvested plot #${plotId}`)
      notifyGame()
    } catch (e) {
      addLog(`Harvest failed: ${e}`)
    }
  }

  const doClear = async () => {
    try {
      const data = await clearAll()
      setFarm(data)
      addLog('Cleared all plots')
      notifyGame()
      window.location.reload()
    } catch (e) {
      addLog(`Clear failed: ${e}`)
    }
  }

  if (!open) {
    return (
      <button className="devtools-toggle" onClick={() => setOpen(true)}>
        🛠 Dev
      </button>
    )
  }

  return (
    <div className="devtools">
      <div className="devtools-header">
        <span>🛠 Dev Tools</span>
        <button onClick={() => setOpen(false)}>✕</button>
      </div>

      {/* API Settings */}
      <section>
        <h3>API Settings</h3>
        <div className="devtools-row">
          <label>Domain</label>
          <input
            type="text"
            placeholder="e.g. https://api.example.com"
            value={apiDomain}
            onChange={e => {
              setApiDomain(e.target.value)
              setApiSettings({ domain: e.target.value, auth: authHeader, origin: originHeader, xHost: xHostHeader })
              addLog(`API domain → ${e.target.value || '(default)'}`)
            }}
          />
        </div>
        <div className="devtools-row">
          <label>Auth</label>
          <input
            type="text"
            placeholder="Authorization header"
            value={authHeader}
            onChange={e => {
              setAuthHeader(e.target.value)
              setApiSettings({ domain: apiDomain, auth: e.target.value, origin: originHeader, xHost: xHostHeader })
              addLog(`Auth header updated`)
            }}
          />
        </div>
        <div className="devtools-row">
          <label>Origin</label>
          <input
            type="text"
            placeholder="Origin header"
            value={originHeader}
            onChange={e => {
              setOriginHeader(e.target.value)
              setApiSettings({ domain: apiDomain, auth: authHeader, origin: e.target.value, xHost: xHostHeader })
              addLog(`Origin header → ${e.target.value || '(empty)'}`)
            }}
          />
        </div>
        <div className="devtools-row">
          <label>X-Host</label>
          <input
            type="text"
            placeholder="X-Host header"
            value={xHostHeader}
            onChange={e => {
              setXHostHeader(e.target.value)
              setApiSettings({ domain: apiDomain, auth: authHeader, origin: originHeader, xHost: e.target.value })
              addLog(`X-Host header → ${e.target.value || '(empty)'}`)
            }}
          />
        </div>
      </section>

      {/* State */}
      <section>
        <h3>State</h3>
        <div className="devtools-row">
          <span>Coins:</span>
          <strong>{farm?.coins ?? '—'}</strong>
          <button className="btn-sm" onClick={refresh}>↻</button>
        </div>
        <div className="devtools-row">
          <span>VIP:</span>
          <strong>{farm?.vipLevel ?? '—'}</strong>
          <select
            value={farm?.vipLevel ?? 1}
            onChange={async (e) => {
              try {
                const data = await setVip(Number(e.target.value))
                setFarm(data)
                addLog(`Set VIP to ${e.target.value}`)
                notifyGame()
              } catch (err) {
                addLog(`Set VIP failed: ${err}`)
              }
            }}
          >
            {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>VIP {v}</option>)}
          </select>
        </div>
        <div className="devtools-row">
          <span>Gender:</span>
          <select
            defaultValue="female"
            onChange={(e) => {
              window.dispatchEvent(new CustomEvent('gender-changed', { detail: e.target.value }))
              addLog(`Gender → ${e.target.value}`)
            }}
          >
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </div>
        <div className="devtools-row">
          <span>Pet:</span>
          <select
            defaultValue="cat"
            onChange={(e) => {
              window.dispatchEvent(new CustomEvent('pet-changed', { detail: e.target.value }))
              addLog(`Pet → ${e.target.value}`)
            }}
          >
            <option value="cat">🐱 Cat</option>
            <option value="dog">🐶 Dog</option>
            <option value="chicken">🐔 Chicken</option>
            <option value="pig">🐷 Pig</option>
          </select>
        </div>
      </section>

      {/* Actions */}
      <section>
        <h3>Actions</h3>
        <div className="devtools-row">
          <label>Plot ID</label>
          <input
            type="number"
            min={1}
            max={16}
            value={plotId}
            onChange={e => setPlotId(Number(e.target.value))}
          />
        </div>
        <div className="devtools-row">
          <label>Crop</label>
          <select value={selectedCrop} onChange={e => setSelectedCrop(e.target.value)}>
            {CROPS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="devtools-actions">
          <button onClick={doPlant}>🌱 Plant</button>
          <button onClick={doWater}>💧 Water</button>
          <button onClick={doHarvest}>🧺 Harvest</button>
          <button onClick={doClear}>🗑 Clear</button>
        </div>
      </section>

      {/* Plots Grid */}
      <section>
        <h3>Plots</h3>
        <div className="devtools-grid">
          {farm?.plots.map(p => (
            <div
              key={p.id}
              className={`devtools-plot stage-${p.status}`}
              onClick={() => setPlotId(p.id)}
              title={`#${p.id} ${p.crop ?? 'empty'} status:${p.status}`}
            >
              <span className="plot-id">{p.id}</span>
              {p.crop && <span className="plot-crop">{p.crop.slice(0, 3)}</span>}
              <span className="plot-stage">{'●'.repeat(p.status)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Log */}
      <section>
        <h3>Log</h3>
        <div className="devtools-log">
          {log.map((msg, i) => <div key={i}>{msg}</div>)}
        </div>
      </section>
    </div>
  )
}

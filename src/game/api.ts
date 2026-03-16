export interface Plot {
  id: number
  crop: string | null
  stage: number
  plantedAt?: number
  wateredAt?: number
  locked: boolean
}

export interface FarmData {
  username: string
  coins: number
  vipLevel: number
  pet: string | null
  plots: Plot[]
}

const API_BASE = '/api'

export async function fetchFarm(): Promise<FarmData> {
  const res = await fetch(`${API_BASE}/farm`)
  if (!res.ok) throw new Error(`GET /api/farm failed: ${res.status}`)
  return res.json()
}

export async function plantCrop(plotId: number, crop: string): Promise<FarmData> {
  const res = await fetch(`${API_BASE}/plant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plotId, crop }),
  })
  if (!res.ok) throw new Error(`POST /api/plant failed: ${res.status}`)
  return res.json()
}

export async function waterPlot(plotId: number): Promise<FarmData> {
  const res = await fetch(`${API_BASE}/water`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plotId }),
  })
  if (!res.ok) throw new Error(`POST /api/water failed: ${res.status}`)
  return res.json()
}

export async function harvestPlot(plotId: number): Promise<FarmData> {
  const res = await fetch(`${API_BASE}/harvest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plotId }),
  })
  if (!res.ok) throw new Error(`POST /api/harvest failed: ${res.status}`)
  return res.json()
}

export async function clearAll(): Promise<FarmData> {
  const res = await fetch(`${API_BASE}/clear`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error(`POST /api/clear failed: ${res.status}`)
  return res.json()
}

export async function upgradeVip(): Promise<FarmData> {
  const res = await fetch(`${API_BASE}/upgrade-vip`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error(`POST /api/upgrade-vip failed: ${res.status}`)
  return res.json()
}

export async function setVip(level: number): Promise<FarmData> {
  const res = await fetch(`${API_BASE}/set-vip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level }),
  })
  if (!res.ok) throw new Error(`POST /api/set-vip failed: ${res.status}`)
  return res.json()
}

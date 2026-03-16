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

const API_BASE = '/api/farm'

export async function fetchFarm(): Promise<FarmData> {
  const res = await fetch(`${API_BASE}`)
  if (!res.ok) throw new Error(`GET /api/farm failed: ${res.status}`)
  return res.json()
}

export async function plantCrop(plotId: number, crop: string): Promise<FarmData> {
  const res = await fetch(`${API_BASE}/plant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plotId, crop }),
  })
  if (!res.ok) throw new Error(`POST /api/farm/plant failed: ${res.status}`)
  return res.json()
}

export async function waterPlot(plotId: number): Promise<FarmData> {
  const res = await fetch(`${API_BASE}/water`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plotId }),
  })
  if (!res.ok) throw new Error(`POST /api/farm/water failed: ${res.status}`)
  return res.json()
}

export async function harvestPlot(plotId: number): Promise<FarmData> {
  const res = await fetch(`${API_BASE}/harvest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plotId }),
  })
  if (!res.ok) throw new Error(`POST /api/farm/harvest failed: ${res.status}`)
  return res.json()
}

export async function clearAll(): Promise<FarmData> {
  const res = await fetch(`${API_BASE}/clear`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error(`POST /api/farm/clear failed: ${res.status}`)
  return res.json()
}

export type SeedsData = Record<string, number>

export async function fetchSeeds(): Promise<SeedsData> {
  const res = await fetch(`${API_BASE}/seeds`)
  if (!res.ok) throw new Error(`GET /api/farm/seeds failed: ${res.status}`)
  return res.json()
}

export async function setVip(level: number): Promise<FarmData> {
  const res = await fetch(`${API_BASE}/set-vip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level }),
  })
  if (!res.ok) throw new Error(`POST /api/farm/set-vip failed: ${res.status}`)
  return res.json()
}

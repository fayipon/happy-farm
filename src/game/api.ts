export interface Plot {
  id: number
  crop: string | null
  status: number
  plantedAt: number | null
  wateredAt: number | null
  locked: boolean
}

export interface FarmData {
  username: string
  coins: number
  vipLevel: number
  skin_id: number
  pet: number | null
  plots: Plot[]
}

interface ApiResponse<T> {
  data: T
  code: number
  message: string
}

const API_ERROR_CODES: Record<number, string> = {
  3057: '田地已鎖定',
  3058: '田地不是空的',
  3059: '作物尚未成熟',
  3060: '未達澆水存款門檻',
  3061: '未達澆水投注門檻',
  3062: '餘額不足',
  3063: '作物尚未解鎖',
  3064: '田地是空的',
  3065: '作物不需要澆水',
  3066: '作物已經澆過水了',
}

function unwrapResponse<T>(json: ApiResponse<T>): T {
  if (json.code !== 1000) {
    const msg = API_ERROR_CODES[json.code] || json.message || `Unknown error`
    throw new Error(`[${json.code}] ${msg}`)
  }
  return json.data
}

export interface ApiSettings {
  domain: string
  auth: string
  origin: string
  xHost: string
}

const STORAGE_KEY = 'devtools-api-settings'

export function getApiSettings(): ApiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { domain: '', auth: '', origin: '', xHost: '' }
}

export function setApiSettings(settings: ApiSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

function getApiBase(): string {
  const { domain } = getApiSettings()
  if (domain) return `${domain}/api/farm`
  return '/api/farm'
}

function getCustomHeaders(): Record<string, string> {
  const { auth, origin, xHost } = getApiSettings()
  const headers: Record<string, string> = {}
  if (auth) headers['Authorization'] = auth
  if (origin) headers['Origin'] = origin
  if (xHost) headers['X-Host'] = xHost
  return headers
}

export async function fetchFarm(): Promise<FarmData> {
  const res = await fetch(getApiBase(), { headers: getCustomHeaders() })
  if (!res.ok) throw new Error(`GET /api/farm failed: ${res.status}`)
  const json: ApiResponse<FarmData> = await res.json()
  console.log('[API] fetchFarm response:', JSON.stringify(json, null, 2))
  return unwrapResponse(json)
}

export async function plantCrop(plotId: number, crop: string): Promise<FarmData> {
  const res = await fetch(`${getApiBase()}/plant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getCustomHeaders() },
    body: JSON.stringify({ plotId, crop }),
  })
  if (!res.ok) throw new Error(`POST /api/farm/plant failed: ${res.status}`)
  const json: ApiResponse<FarmData> = await res.json()
  return unwrapResponse(json)
}

export async function waterPlot(plotId: number): Promise<FarmData> {
  const res = await fetch(`${getApiBase()}/water`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getCustomHeaders() },
    body: JSON.stringify({ plotId }),
  })
  if (!res.ok) throw new Error(`POST /api/farm/water failed: ${res.status}`)
  const json: ApiResponse<FarmData> = await res.json()
  return unwrapResponse(json)
}

export interface HarvestData extends FarmData {
  harvest: Record<string, number>
}

export async function harvestPlot(plotId: number): Promise<HarvestData> {
  const res = await fetch(`${getApiBase()}/harvest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getCustomHeaders() },
    body: JSON.stringify({ plotId }),
  })
  if (!res.ok) throw new Error(`POST /api/farm/harvest failed: ${res.status}`)
  const json: ApiResponse<HarvestData> = await res.json()
  console.log('[API] harvestPlot raw response:', JSON.stringify(json, null, 2))
  return unwrapResponse(json)
}

export async function clearAll(): Promise<FarmData> {
  const res = await fetch(`${getApiBase()}/clear`, {
    method: 'POST',
    headers: getCustomHeaders(),
  })
  if (!res.ok) throw new Error(`POST /api/farm/clear failed: ${res.status}`)
  const json: ApiResponse<FarmData> = await res.json()
  return unwrapResponse(json)
}

export type SeedsData = Record<string, number>

export async function fetchSeeds(): Promise<SeedsData> {
  const res = await fetch(`${getApiBase()}/seeds`, { headers: getCustomHeaders() })
  if (!res.ok) throw new Error(`GET /api/farm/seeds failed: ${res.status}`)
  const json: ApiResponse<{ seeds: SeedsData }> = await res.json()
  const data = unwrapResponse(json)
  return data.seeds
}

export async function setVip(level: number): Promise<FarmData> {
  const res = await fetch(`${getApiBase()}/set-vip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getCustomHeaders() },
    body: JSON.stringify({ level }),
  })
  if (!res.ok) throw new Error(`POST /api/farm/set-vip failed: ${res.status}`)
  const json: ApiResponse<FarmData> = await res.json()
  return unwrapResponse(json)
}

export async function queryFortuneWheel(cropName: string): Promise<number | null> {
  const { domain } = getApiSettings()
  const base = domain || ''
  const conditions = JSON.stringify({ name: cropName })
  const params = new URLSearchParams({
    conditions,
    current_page: '1',
    page_size: '1',
  })
  const res = await fetch(`${base}/api/fortune-wheels?${params}`, {
    headers: getCustomHeaders(),
  })
  if (!res.ok) throw new Error(`GET /api/fortune-wheels failed: ${res.status}`)
  const json = await res.json()
  console.log('[FortuneWheel] query response:', JSON.stringify(json, null, 2))
  // Extract ID from response: data.data[0].id
  const items = json?.data?.data
  if (Array.isArray(items) && items.length > 0 && items[0].id) {
    return items[0].id as number
  }
  return null
}

export async function applyFortuneWheel(wheelId: number): Promise<number> {
  const { domain } = getApiSettings()
  const base = domain || ''
  const res = await fetch(`${base}/api/fortune-wheel/${wheelId}/apply-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getCustomHeaders() },
    body: JSON.stringify({ applyCount: 1 }),
  })
  if (!res.ok) throw new Error(`POST /api/fortune-wheel/${wheelId}/apply-batch failed: ${res.status}`)
  const json = await res.json()
  console.log('[FortuneWheel] apply-batch response:', JSON.stringify(json, null, 2))
  // Extract reward amount from sum[0].amount
  const sum = json?.data?.sum
  if (Array.isArray(sum) && sum.length > 0 && typeof sum[0].amount === 'number') {
    return sum[0].amount
  }
  return 0
}

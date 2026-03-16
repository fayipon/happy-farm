# Happy Farm API 文件

Base URL: `/api/farm`

所有成功的寫入操作都會回傳最新的 `FarmResponse`。

---

## 資料模型

### FarmResponse

| 欄位 | 型別 | 說明 |
|------|------|------|
| `username` | `string` | 玩家名稱 |
| `coins` | `number` | 持有金幣數 |
| `vipLevel` | `number` | VIP 等級 (1-5) |
| `pet` | `string \| null` | 寵物名稱，無寵物時為 `null` |
| `plots` | `Plot[]` | 農田陣列 (16 格) |

### Plot

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | `number` | 農田 ID (1-16) |
| `crop` | `string \| null` | 作物種類，空地時為 `null` |
| `stage` | `number` | 生長階段：`0`=空地, `1`=種子, `2`=成長中, `3`=可收穫 |
| `plantedAt` | `number?` | 種植時間 (Unix timestamp)，空地時省略 |
| `wateredAt` | `number?` | 澆水時間 (Unix timestamp)，未澆水時省略 |
| `locked` | `boolean` | 是否鎖定（由 VIP 等級決定） |

### 作物種類 (CropType)

`carrot`, `tomato`, `corn`, `pumpkin`, `cabbage`, `radish`, `wheat`, `berry`

### VIP 等級解鎖

| VIP 等級 | 解鎖農田數 | 解鎖作物數 |
|----------|-----------|-----------|
| 1 | 2 | 1 (carrot) |
| 2 | 4 | 2 (+tomato) |
| 3 | 8 | 4 (+corn, pumpkin) |
| 4 | 12 | 6 (+cabbage, radish) |
| 5 | 16 | 8 (+wheat, berry) |

### 生長機制

- **Stage 1 → 2**：種植後 **10 秒**自動成長
- **Stage 2**：暫停成長，等待澆水
- **Stage 2 → 3**：澆水後 **15 秒**成長完成，可收穫
- **收穫獎勵**：每次 +100 金幣

---

## API 端點

### `GET /api/health`

健康檢查。

**Response** `200`
```json
{ "status": "ok" }
```

---

### `GET /api/farm`

取得農場完整狀態。

**Response** `200`
```json
{
  "username": "Player",
  "coins": 5000,
  "vipLevel": 1,
  "pet": null,
  "plots": [
    {
      "id": 1,
      "crop": "carrot",
      "stage": 2,
      "plantedAt": 1742100000,
      "wateredAt": 1742100010,
      "locked": false
    },
    {
      "id": 2,
      "crop": null,
      "stage": 0,
      "locked": false
    }
  ]
}
```

---

### `POST /api/farm/plant`

在空農田上種植作物。

**Request Body**
```json
{
  "plotId": 1,
  "crop": "carrot"
}
```

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `plotId` | `number` | ✅ | 農田 ID (1-16) |
| `crop` | `string` | ✅ | 作物種類 |

**Response** `200` — 回傳更新後的 `FarmResponse`

**Error** `400` — 缺少必要欄位
**Error** `409`
- `"invalid plot id"` — 無效的農田 ID
- `"invalid crop type"` — 無效的作物種類
- `"crop not unlocked at current VIP level"` — VIP 等級不足
- `"plot is locked"` — 農田未解鎖
- `"no seeds left"` — 種子不足
- `"plot is not empty"` — 農田已有作物

---

### `GET /api/farm/seeds`

取得所有作物的種子庫存數量。

**Response** `200`
```json
{
  "seed_carrot": 99,
  "seed_tomato": 99,
  "seed_corn": 99,
  "seed_pumpkin": 99,
  "seed_cabbage": 99,
  "seed_radish": 99,
  "seed_wheat": 99,
  "seed_berry": 99
}
```

---

### `POST /api/farm/water`

對成長中 (stage 2) 的作物澆水。

**Request Body**
```json
{
  "plotId": 1
}
```

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `plotId` | `number` | ✅ | 農田 ID (1-16) |

**Response** `200` — 回傳更新後的 `FarmResponse`

**Error** `409`
- `"invalid plot id"` — 無效的農田 ID
- `"plot is locked"` — 農田未解鎖
- `"plot is empty"` — 農田無作物
- `"crop does not need water"` — 作物不在 stage 2
- `"crop is already watered"` — 已經澆過水

---

### `POST /api/farm/harvest`

收穫成熟 (stage 3) 的作物，獲得 +100 金幣。

**Request Body**
```json
{
  "plotId": 1
}
```

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `plotId` | `number` | ✅ | 農田 ID (1-16) |

**Response** `200` — 回傳更新後的 `FarmResponse`

**Error** `409`
- `"invalid plot id"` — 無效的農田 ID
- `"plot is locked"` — 農田未解鎖
- `"crop is not ready"` — 作物尚未成熟

---

### `POST /api/farm/clear`

清除所有農田上的作物（不給予金幣獎勵）。

**Request Body** — 無

**Response** `200` — 回傳更新後的 `FarmResponse`

---

### `POST /api/farm/set-vip`

強制設定 VIP 等級（開發/除錯用）。

**Request Body**
```json
{
  "level": 3
}
```

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `level` | `number` | ✅ | VIP 等級 (1-5) |

**Response** `200` — 回傳更新後的 `FarmResponse`

**Error** `409`
- `"vip level must be 1-5"` — 等級範圍錯誤

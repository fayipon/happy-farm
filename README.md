# Happy Farm 🌾

一款以 Phaser 3 + React + TypeScript 打造的農場經營遊戲，搭配 Go 後端 API Server。

## 專案結構

```
happy-farm/
├── index.html
├── package.json
├── vite.config.ts
├── public/
├── src/                    # 前端 (React + Phaser)
│   ├── App.tsx
│   ├── main.tsx
│   ├── assets/             # 遊戲素材 (音效、角色、作物、地圖、UI)
│   │   ├── crops/seed2.jpg # 作物 spritesheet (8 種 × 3 階段)
│   │   └── items/farm.png  # 農地 spritesheet (乾涸/濕潤/未解鎖)
│   ├── game/
│   │   ├── api.ts          # API 服務層
│   │   └── config.ts       # Phaser 遊戲設定
│   ├── pages/
│   │   ├── Home.tsx         # 首頁
│   │   ├── Farm.tsx         # 農場頁面 (含 DevTools)
│   │   ├── DevTools.tsx     # 開發者工具面板
│   │   └── DevTools.css
│   └── scenes/
│       ├── BootScene.ts     # 資源載入場景 (含色鍵處理)
│       └── FarmScene.ts     # 農場主場景 (4×4 等距農田)
└── server/                  # 後端 (Go API Server)
    ├── main.go              # 入口，路由設定，監聽 :8080
    ├── go.mod
    ├── handler/
    │   └── handler.go       # API handlers
    ├── middleware/
    │   └── middleware.go     # Logger + CORS middleware
    ├── model/
    │   └── model.go         # 資料模型 (Plot, CropType, FarmResponse)
    └── store/
        └── store.go         # 記憶體資料存儲 + 狀態機邏輯
```

## 快速開始

### 前端

```bash
npm install
npm run dev
```

前端預設啟動於 `http://localhost:5173`

### 後端

```bash
cd server
go run .
```

API Server 預設啟動於 `http://localhost:8080`

> Vite 開發代理已設定 `/api` → `http://localhost:8080`

## 遊戲玩法

### 操作流程

1. **選擇作物** — 底部 4×2 作物選擇區，選取要種植的作物
2. **點擊空農地** — 自動種植所選作物
3. **等待成長** — Tier 1 → Tier 2 (10 秒)，農地顯示濕潤
4. **澆水** — Tier 2 時生長暫停，點擊農地澆水恢復
5. **等待成熟** — Tier 2 → Tier 3 (15 秒，從澆水後計算)
6. **收穫** — 點擊成熟作物自動收穫，獲得 100 金幣

### 智慧點擊

點擊農地會根據狀態自動判斷操作：
- 空地 → 種植
- Tier 2 未澆水 → 澆水
- Tier 3 → 收穫
- 其他 → 無動作（自然生長中）

### 農地狀態

| 狀態 | 農地外觀 | 說明 |
|------|----------|------|
| 乾涸 | frame 0 | 空地、等待澆水、已成熟 |
| 濕潤 | frame 1 | Tier 1、澆水後的 Tier 2 |
| 未解鎖 | frame 2 | 需要提升 VIP 等級 |

### VIP 等級系統

| VIP | 總格數 | 解鎖 Plot IDs | 升級費用 |
|-----|--------|---------------|----------|
| 1 | 2 | 1-2 | — |
| 2 | 4 | 1-4 | 500 |
| 3 | 8 | 1-8 | 1,000 |
| 4 | 12 | 1-12 | 2,000 |
| 5 | 16 | 1-16 | 5,000 |

### 作物種類

carrot、tomato、corn、pumpkin、cabbage、radish、wheat、berry

## API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/health` | 健康檢查 |
| GET | `/api/farm` | 取得農田狀態 (含 VIP 等級) |
| POST | `/api/plant` | 種植作物 `{ "plotId": 1, "crop": "carrot" }` |
| POST | `/api/water` | 澆水 `{ "plotId": 1 }` |
| POST | `/api/harvest` | 收穫作物 `{ "plotId": 1 }` |
| POST | `/api/clear` | 清除所有作物 |
| POST | `/api/upgrade-vip` | 升級 VIP (消耗金幣) |
| POST | `/api/set-vip` | 強制設定 VIP 等級 (開發用) `{ "level": 3 }` |

### 後端狀態機

- **Plant** — 驗證作物類型、農地未鎖定、農地為空
- **Water** — 驗證農地未鎖定、作物在 Tier 2、尚未澆水
- **Harvest** — 驗證農地未鎖定、作物在 Tier 3
- **成長計算** — 服務端基於時間戳計算，`plantedAt` (Tier 1→2)、`wateredAt` (Tier 2→3)

## DevTools (開發者工具)

按 F9 開啟。功能：
- 顯示金幣、VIP 等級
- 直接切換 VIP 1-5
- 手動執行種植/澆水/收穫/清除
- 4×4 農田狀態視覺化
- 操作日誌

## 技術棧

- **前端**：React + TypeScript + Vite + Phaser 3
- **後端**：Go (標準庫 `net/http`，無第三方框架)
- **遊戲引擎**：Phaser 3 (等距視角 4×4 農田)
- **資料存儲**：記憶體存儲 (`sync.RWMutex`)

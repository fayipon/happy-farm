package model

type CropType string

const (
	CropCarrot  CropType = "carrot"
	CropTomato  CropType = "tomato"
	CropCorn    CropType = "corn"
	CropPumpkin CropType = "pumpkin"
	CropCabbage CropType = "cabbage"
	CropRadish  CropType = "radish"
	CropWheat   CropType = "wheat"
	CropBerry   CropType = "berry"
)

var ValidCrops = map[CropType]bool{
	CropCarrot: true, CropTomato: true, CropCorn: true, CropPumpkin: true,
	CropCabbage: true, CropRadish: true, CropWheat: true, CropBerry: true,
}

// VipCropCount returns how many crops are unlocked at each VIP level.
// VIP1:1, VIP2:2, VIP3:4, VIP4:6, VIP5:8
var VipCropCount = []int{1, 2, 4, 6, 8}

// CropOrder defines the crop unlock order (index-based).
var CropOrder = []CropType{
	CropCarrot, CropTomato, CropCorn, CropPumpkin,
	CropCabbage, CropRadish, CropWheat, CropBerry,
}

// Plot represents a single farm plot.
// Stage: 0=empty, 1=seed, 2=growing, 3=ready to harvest
type Plot struct {
	ID        int       `json:"id"`
	Crop      *CropType `json:"crop"`      // null when empty
	Stage     int       `json:"stage"`
	PlantedAt *int64    `json:"plantedAt,omitempty"` // unix timestamp, omitted when empty
	WateredAt *int64    `json:"wateredAt,omitempty"` // unix timestamp, set when watered at tier 2
	Locked    bool      `json:"locked"`              // true if plot is not unlocked by VIP level
}

// FarmResponse is the GET /api/farm response.
type FarmResponse struct {
	Coins    int    `json:"coins"`
	VipLevel int    `json:"vipLevel"`
	Plots    []Plot `json:"plots"`
}

// PlantRequest is the POST /api/plant request body.
type PlantRequest struct {
	PlotID int      `json:"plotId"`
	Crop   CropType `json:"crop"`
}

// WaterRequest is the POST /api/water request body.
type WaterRequest struct {
	PlotID int `json:"plotId"`
}

// HarvestRequest is the POST /api/harvest request body.
type HarvestRequest struct {
	PlotID int `json:"plotId"`
}

// ClearRequest is kept for compatibility but POST /api/clear takes no body.

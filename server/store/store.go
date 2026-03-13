package store

import (
	"sync"
	"time"

	"happy-farm/server/model"
)

const plotCount = 16

var (
	mu    sync.RWMutex
	coins    = 5000
	vipLevel = 1
	plots    [plotCount]model.Plot
)

// UnlockOrder defines which plot IDs unlock at each VIP level (row by row).
// VIP1: 2, VIP2: +2=4, VIP3: +4=8, VIP4: +4=12, VIP5: +4=16
var UnlockOrder = []int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16}
var VipUnlockCount = []int{2, 4, 8, 12, 16} // cumulative unlock count per VIP level

func init() {
	for i := range plots {
		plots[i] = model.Plot{ID: i + 1, Crop: nil, Stage: 0}
	}
}

func idx(plotID int) (int, bool) {
	i := plotID - 1
	if i < 0 || i >= plotCount {
		return 0, false
	}
	return i, true
}

// computeStage returns the current growth stage based on elapsed time.
// stage 1 -> 2: 10 seconds. At stage 2, growth pauses until watered.
// After watering, stage 2 -> 3: 15 seconds.
func computeStage(plantedAt *int64, wateredAt *int64) int {
	if plantedAt == nil {
		return 0
	}
	now := time.Now().Unix()
	elapsed := now - *plantedAt
	if elapsed < 10 {
		return 1
	}
	// Reached tier 2 — check if watered
	if wateredAt == nil {
		return 2 // paused, waiting for water
	}
	waterElapsed := now - *wateredAt
	if waterElapsed >= 15 {
		return 3
	}
	return 2
}

// unlockedPlots returns the set of unlocked plot IDs for the current VIP level.
func unlockedPlots() map[int]bool {
	count := 0
	if vipLevel >= 1 && vipLevel <= 5 {
		count = VipUnlockCount[vipLevel-1]
	}
	m := make(map[int]bool, count)
	for i := 0; i < count && i < len(UnlockOrder); i++ {
		m[UnlockOrder[i]] = true
	}
	return m
}

// GetFarm returns the full farm state with computed growth stages.
func GetFarm() model.FarmResponse {
	mu.RLock()
	defer mu.RUnlock()
	unlocked := unlockedPlots()
	snap := make([]model.Plot, plotCount)
	for i, p := range plots {
		snap[i] = p
		if p.Crop != nil {
			snap[i].Stage = computeStage(p.PlantedAt, p.WateredAt)
		}
		snap[i].Locked = !unlocked[p.ID]
	}
	return model.FarmResponse{Coins: coins, VipLevel: vipLevel, Plots: snap}
}

// Plant puts a crop into an empty plot (stage -> 1).
func Plant(plotID int, crop model.CropType) (string, bool) {
	mu.Lock()
	defer mu.Unlock()
	i, ok := idx(plotID)
	if !ok {
		return "invalid plot id", false
	}
	if !model.ValidCrops[crop] {
		return "invalid crop type", false
	}
	// Check crop is unlocked at current VIP level
	cropCount := 0
	if vipLevel >= 1 && vipLevel <= 5 {
		cropCount = model.VipCropCount[vipLevel-1]
	}
	cropAllowed := false
	for j := 0; j < cropCount && j < len(model.CropOrder); j++ {
		if model.CropOrder[j] == crop {
			cropAllowed = true
			break
		}
	}
	if !cropAllowed {
		return "crop not unlocked at current VIP level", false
	}
	unlocked := unlockedPlots()
	if !unlocked[plots[i].ID] {
		return "plot is locked", false
	}
	if plots[i].Crop != nil {
		return "plot is not empty", false
	}
	now := time.Now().Unix()
	plots[i].Crop = &crop
	plots[i].Stage = 1
	plots[i].PlantedAt = &now
	plots[i].WateredAt = nil
	return "", true
}

// Water resumes growth at tier 2. Only works when crop is at tier 2 and not yet watered.
func Water(plotID int) (string, bool) {
	mu.Lock()
	defer mu.Unlock()
	i, ok := idx(plotID)
	if !ok {
		return "invalid plot id", false
	}
	unlocked := unlockedPlots()
	if !unlocked[plots[i].ID] {
		return "plot is locked", false
	}
	if plots[i].Crop == nil {
		return "plot is empty", false
	}
	currentStage := computeStage(plots[i].PlantedAt, plots[i].WateredAt)
	if currentStage != 2 {
		return "crop does not need water", false
	}
	if plots[i].WateredAt != nil {
		return "crop is already watered", false
	}
	now := time.Now().Unix()
	plots[i].WateredAt = &now
	return "", true
}

// Harvest collects a ready crop (stage 3) and awards coins.
func Harvest(plotID int) (string, bool) {
	mu.Lock()
	defer mu.Unlock()
	i, ok := idx(plotID)
	if !ok {
		return "invalid plot id", false
	}
	unlocked := unlockedPlots()
	if !unlocked[plots[i].ID] {
		return "plot is locked", false
	}
	if plots[i].Crop == nil || computeStage(plots[i].PlantedAt, plots[i].WateredAt) != 3 {
		return "crop is not ready", false
	}
	plots[i].Crop = nil
	plots[i].Stage = 0
	plots[i].PlantedAt = nil
	plots[i].WateredAt = nil
	coins += 100
	return "", true
}

// Clear removes all crops from every plot without reward.
func Clear() {
	mu.Lock()
	defer mu.Unlock()
	for i := range plots {
		plots[i].Crop = nil
		plots[i].Stage = 0
		plots[i].PlantedAt = nil
		plots[i].WateredAt = nil
	}
}

// VipUpgradeCost returns the coin cost to upgrade to the next VIP level.
var VipUpgradeCost = []int{0, 500, 1000, 2000, 5000} // cost to go from level 1→2, 2→3, 3→4, 4→5

// UpgradeVip upgrades VIP level if player has enough coins.
func UpgradeVip() (string, bool) {
	mu.Lock()
	defer mu.Unlock()
	if vipLevel >= 5 {
		return "already max VIP level", false
	}
	cost := VipUpgradeCost[vipLevel-1]
	if coins < cost {
		return "not enough coins", false
	}
	coins -= cost
	vipLevel++
	return "", true
}

// SetVip forcefully sets VIP level (for dev/debug use).
func SetVip(level int) (string, bool) {
	if level < 1 || level > 5 {
		return "vip level must be 1-5", false
	}
	mu.Lock()
	defer mu.Unlock()
	vipLevel = level
	return "", true
}

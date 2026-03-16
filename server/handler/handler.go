package handler

import (
	"encoding/json"
	"net/http"

	"happy-farm/server/model"
	"happy-farm/server/store"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func errJSON(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// GET /api/health
func Health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// GET /api/farm — returns coins + all 16 plots
func GetFarm(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, store.GetFarm())
}

// POST /api/plant — plant a crop on an empty plot
func Plant(w http.ResponseWriter, r *http.Request) {
	var req model.PlantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errJSON(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Crop == "" {
		errJSON(w, http.StatusBadRequest, "crop is required")
		return
	}
	if msg, ok := store.Plant(req.PlotID, req.Crop); !ok {
		errJSON(w, http.StatusConflict, msg)
		return
	}
	writeJSON(w, http.StatusOK, store.GetFarm())
}

// POST /api/water — water a planted crop to advance its stage
func Water(w http.ResponseWriter, r *http.Request) {
	var req model.WaterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errJSON(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if msg, ok := store.Water(req.PlotID); !ok {
		errJSON(w, http.StatusConflict, msg)
		return
	}
	writeJSON(w, http.StatusOK, store.GetFarm())
}

// POST /api/harvest — harvest a ready crop (stage 3)
func Harvest(w http.ResponseWriter, r *http.Request) {
	var req model.HarvestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errJSON(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if msg, ok := store.Harvest(req.PlotID); !ok {
		errJSON(w, http.StatusConflict, msg)
		return
	}
	writeJSON(w, http.StatusOK, store.GetFarm())
}

// GET /api/seeds — returns seed inventory
func GetSeeds(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, store.GetSeeds())
}

// POST /api/clear — remove all crops from every plot
func Clear(w http.ResponseWriter, r *http.Request) {
	store.Clear()
	writeJSON(w, http.StatusOK, store.GetFarm())
}

// POST /api/set-vip — force set VIP level (dev/debug)
func SetVip(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Level int `json:"level"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errJSON(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if msg, ok := store.SetVip(req.Level); !ok {
		errJSON(w, http.StatusConflict, msg)
		return
	}
	writeJSON(w, http.StatusOK, store.GetFarm())
}

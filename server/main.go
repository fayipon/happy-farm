package main

import (
	"log"
	"net/http"

	"happy-farm/server/handler"
	"happy-farm/server/middleware"
)

func main() {
	mux := http.NewServeMux()

	// API routes
	mux.HandleFunc("GET /api/health", handler.Health)
	mux.HandleFunc("GET /api/farm", handler.GetFarm)
	mux.HandleFunc("POST /api/plant", handler.Plant)
	mux.HandleFunc("POST /api/water", handler.Water)
	mux.HandleFunc("POST /api/harvest", handler.Harvest)
	mux.HandleFunc("POST /api/clear", handler.Clear)
	mux.HandleFunc("POST /api/upgrade-vip", handler.UpgradeVip)
	mux.HandleFunc("POST /api/set-vip", handler.SetVip)

	// Apply middleware
	wrapped := middleware.Logger(middleware.CORS(mux))

	log.Println("Server starting on :8083")
	if err := http.ListenAndServe(":8083", wrapped); err != nil {
		log.Fatal(err)
	}
}

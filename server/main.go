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
	mux.HandleFunc("GET /api/farm/seeds", handler.GetSeeds)
	mux.HandleFunc("POST /api/farm/plant", handler.Plant)
	mux.HandleFunc("POST /api/farm/water", handler.Water)
	mux.HandleFunc("POST /api/farm/harvest", handler.Harvest)
	mux.HandleFunc("POST /api/farm/clear", handler.Clear)
	mux.HandleFunc("POST /api/farm/set-vip", handler.SetVip)

	// Apply middleware
	wrapped := middleware.Logger(middleware.CORS(mux))

	log.Println("Server starting on :8083")
	if err := http.ListenAndServe(":8083", wrapped); err != nil {
		log.Fatal(err)
	}
}

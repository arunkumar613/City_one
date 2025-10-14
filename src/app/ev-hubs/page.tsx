"use client";

import React, { useState, useEffect, useRef } from "react";
import Map, { MapRef, Source, Layer, Popup, NavigationControl, GeolocateControl } from "react-map-gl";
import { MapLayerMouseEvent } from "mapbox-gl";
import { Calendar, MapPin, X, Battery, Clock } from "lucide-react";
import Link from "next/link";
import type { GeoJSON } from "geojson";

// Define the EV Hub type
type EVHub = {
  id: string;
  name: string;
  status: string;
  chargers_available: number;
  chargers_total: number;
  power_level: string;
  mood: string;
  wait_time: string;
  location: {
    type: string;
    coordinates: [number, number];
  };
};

export default function EVHubsPage() {
  const [evHubs, setEVHubs] = useState<EVHub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedHub, setSelectedHub] = useState<EVHub | null>(null);
  const [popupLngLat, setPopupLngLat] = useState<[number, number] | null>(null);
  const mapRef = React.useRef<MapRef>(null);

  // Mapbox token from environment variables
  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Initial map view state
  const initialViewState = {
    longitude: 80.2785,
    latitude: 13.06,
    zoom: 12,
    pitch: 45,
  };

  // Fetch EV hubs data
  useEffect(() => {
    const fetchEVHubs = async () => {
      try {
        setLoading(true);
        const response = await fetch("/data/ev-hubs.json");
        if (!response.ok) {
          throw new Error("Failed to fetch EV hubs data");
        }
        const data = await response.json();
        
        // Transform GeoJSON to our EVHub type
        const transformedData = data.features.map((feature: any) => ({
          id: feature.properties.id,
          name: feature.properties.name,
          status: feature.properties.status,
          chargers_available: feature.properties.chargers_available,
          chargers_total: feature.properties.chargers_total,
          power_level: feature.properties.power_level,
          mood: feature.properties.mood,
          wait_time: feature.properties.wait_time,
          location: {
            type: "Point",
            coordinates: feature.geometry.coordinates as [number, number],
          },
        }));

        setEVHubs(transformedData);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching EV hubs:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        setLoading(false);
      }
    };

    fetchEVHubs();
  }, []);

  // Convert EV hubs to GeoJSON for map display
  const evHubsSource = React.useMemo(() => {
    return {
      type: "FeatureCollection" as const,
      features: evHubs.map((hub) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: hub.location.coordinates,
        },
        properties: {
          ...hub,
        },
      })),
    };
  }, [evHubs]);

  // Handle map click to close popup
  const handleMapClick = (event: MapLayerMouseEvent) => {
    if (event.features && event.features.length === 0) {
      setSelectedHub(null);
      setPopupLngLat(null);
    }
  };

  // Handle EV hub click to show popup
  const handleHubClick = (event: MapLayerMouseEvent) => {
    console.log("Map click event:", event);

    if (event.features && event.features.length > 0) {
      const feature = event.features[0];
      console.log("Clicked feature:", feature);

      if (
        feature.layer?.id === "ev-hub-points" ||
        feature.layer?.id === "ev-hub-circles"
      ) {
        const hubData = feature.properties as EVHub;
        const coordinates = (feature.geometry as GeoJSON.Point).coordinates as [
          number,
          number
        ];

        setSelectedHub(hubData);
        setPopupLngLat(coordinates);

        // Center map on the hub with smooth animation
        if (mapRef.current) {
          mapRef.current.flyTo({
            center: coordinates,
            essential: true,
            duration: 1500,
          });
        }
      }
    }
  };

  // Close popup
  const closePopup = () => {
    setSelectedHub(null);
    setPopupLngLat(null);
  };

  // Get color based on mood
  const getMoodColor = (mood: string) => {
    switch (mood.toLowerCase()) {
      case "super happy":
        return "#22c55e"; // Green
      case "happy":
        return "#3b82f6"; // Blue
      case "sad":
        return "#f59e0b"; // Amber
      case "angry":
        return "#ef4444"; // Red
      default:
        return "#8B5CF6"; // Purple (default)
    }
  };

  // Get color based on status
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "#22c55e"; // Green
      case "busy":
        return "#f59e0b"; // Amber
      case "maintenance":
        return "#ef4444"; // Red
      default:
        return "#6b7280"; // Gray (default)
    }
  };

  // Loading state
  if (!MAPBOX_TOKEN) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="text-center p-6 bg-white rounded-lg shadow-lg">
          <h2 className="text-xl font-bold text-red-600 mb-2">
            Map Configuration Needed
          </h2>
          <p className="text-gray-600">
            Please add your Mapbox Access Token to the environment variables.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-black/80 backdrop-blur-md z-10">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500 mx-auto mb-3"></div>
          <p className="text-cyan-100 font-medium">Loading EV hubs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <h2 className="text-xl font-bold text-red-700 mb-2">Error</h2>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full relative">
      {/* EV Hubs counter badge */}
      {!loading && (
        <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md rounded-lg p-3 shadow-lg border border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="font-semibold text-white">
              {evHubs.length} EV Charging Hubs
            </span>
          </div>
        </div>
      )}

      {/* EV Hubs Sidebar */}
      <div className="absolute top-24 right-4 z-10 bg-black/80 backdrop-blur-md rounded-xl shadow-2xl border border-gray-800 w-80 max-h-[calc(100vh-140px)] overflow-hidden">
        <div className="p-4 border-b border-gray-800 bg-gradient-to-r from-green-900/50 to-blue-900/50">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Battery className="w-5 h-5 text-green-400" />
            EV Charging Hubs
          </h2>
        </div>
        <div className="overflow-y-auto max-h-[calc(100vh-200px)]">
          {evHubs.length === 0 ? (
            <div className="p-4 text-center text-gray-400">No EV hubs found</div>
          ) : (
            evHubs.map((hub) => (
              <div
                key={hub.id}
                className={`p-4 border-b border-gray-800 hover:bg-gray-900/50 cursor-pointer transition-all duration-200 ${
                  selectedHub?.id === hub.id
                    ? "bg-gray-800/70 border-l-4 border-l-green-500"
                    : ""
                }`}
                onClick={() => {
                  setSelectedHub(hub);
                  setPopupLngLat(hub.location.coordinates);
                  if (mapRef.current && hub.location?.coordinates) {
                    mapRef.current.flyTo({
                      center: hub.location.coordinates,
                      duration: 1500,
                    });
                  }
                }}
              >
                <div className="flex items-start gap-3">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg"
                    style={{ 
                      background: `linear-gradient(to bottom right, ${getStatusColor(hub.status)}, rgba(0,0,0,0.5))`,
                      boxShadow: `0 0 10px ${getStatusColor(hub.status)}40`
                    }}
                  >
                    <Battery className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate">
                      {hub.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span 
                        className="text-xs px-2 py-0.5 rounded-full" 
                        style={{ backgroundColor: getStatusColor(hub.status) }}
                      >
                        {hub.status}
                      </span>
                      <span className="text-xs text-gray-400">
                        {hub.chargers_available}/{hub.chargers_total} Available
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-300">
                      <Clock className="w-3 h-3" />
                      <span>Wait: {hub.wait_time}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Map */}
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={initialViewState}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        interactiveLayerIds={["ev-hub-points", "ev-hub-circles", "ev-hub-pulse"]}
        onClick={(e) => {
          handleMapClick(e);
          handleHubClick(e);
        }}
      >
        <GeolocateControl position="bottom-right" />
        <NavigationControl position="bottom-right" />

        {/* EV Hubs Layer with improved styling */}
        {evHubs.length > 0 && (
          <Source id="ev-hubs" type="geojson" data={evHubsSource}>
            {/* Pulsing effect */}
            <Layer
              id="ev-hub-pulse"
              type="circle"
              source="ev-hubs"
              paint={{
                "circle-radius": [
                  "interpolate",
                  ["linear"],
                  ["get", "chargers_available"],
                  0,
                  10,
                  10,
                  25,
                ],
                "circle-color": [
                  "match",
                  ["get", "status"],
                  "Active",
                  "#22c55e",
                  "Busy",
                  "#f59e0b",
                  "Maintenance",
                  "#ef4444",
                  "#6b7280"
                ],
                "circle-opacity": 0.2,
                "circle-stroke-width": 0,
              }}
            />

            {/* Outer circle */}
            <Layer
              id="ev-hub-circles"
              type="circle"
              source="ev-hubs"
              paint={{
                "circle-radius": 12,
                "circle-color": [
                  "match",
                  ["get", "status"],
                  "Active",
                  "#22c55e",
                  "Busy",
                  "#f59e0b",
                  "Maintenance",
                  "#ef4444",
                  "#6b7280"
                ],
                "circle-opacity": 0.8,
                "circle-stroke-width": 2,
                "circle-stroke-color": "#FFFFFF",
              }}
            />

            {/* Main marker */}
            <Layer
              id="ev-hub-points"
              type="symbol"
              source="ev-hubs"
              layout={{
                "icon-image": "marker-15",
                "icon-size": 1.6,
                "icon-allow-overlap": true,
                "icon-anchor": "bottom",
              }}
              paint={{
                "icon-color": [
                  "match",
                  ["get", "status"],
                  "Active",
                  "#22c55e",
                  "Busy",
                  "#f59e0b",
                  "Maintenance",
                  "#ef4444",
                  "#6b7280"
                ],
                "icon-halo-color": "#FFFFFF",
                "icon-halo-width": 2,
                "icon-halo-blur": 1,
              }}
            />
          </Source>
        )}

        {/* EV Hub Popup */}
        {selectedHub && popupLngLat && (
          <div
            className="absolute z-50 pointer-events-auto"
            style={{
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            <div className="bg-black/90 backdrop-blur-md rounded-xl shadow-2xl border border-gray-800 max-w-sm overflow-hidden">
              {/* Header with gradient */}
              <div 
                className="p-4 text-white"
                style={{ 
                  background: `linear-gradient(to right, ${getStatusColor(selectedHub.status)}, rgba(0,0,0,0.7))` 
                }}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg leading-tight">
                      {selectedHub.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span 
                        className="text-xs px-2 py-0.5 rounded-full bg-black/30" 
                      >
                        {selectedHub.status}
                      </span>
                      <span className="text-xs">
                        {selectedHub.power_level}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={closePopup}
                    className="flex-shrink-0 w-6 h-6 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center transition-all duration-200"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-800/50 p-3 rounded-lg">
                    <div className="text-xs text-gray-400">Available Chargers</div>
                    <div className="text-xl font-bold text-white">
                      {selectedHub.chargers_available}/{selectedHub.chargers_total}
                    </div>
                  </div>
                  <div className="bg-gray-800/50 p-3 rounded-lg">
                    <div className="text-xs text-gray-400">Wait Time</div>
                    <div className="text-xl font-bold text-white">
                      {selectedHub.wait_time}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-800">
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <MapPin className="w-4 h-4 text-green-500" />
                    <span>Hub Location</span>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => {
                        if (
                          mapRef.current &&
                          selectedHub.location?.coordinates
                        ) {
                          mapRef.current.flyTo({
                            center: selectedHub.location.coordinates,
                            zoom: 16,
                            duration: 2000,
                          });
                        }
                      }}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors duration-200"
                    >
                      Zoom In
                    </button>
                    <button
                      onClick={closePopup}
                      className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors duration-200"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Map>

      {/* Footer navigation */}
      <footer className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/80 backdrop-blur-md rounded-full px-2 py-1 shadow-lg border border-gray-800">
        <div className="flex items-center space-x-1">
          <Link
            href="/"
            className="px-3 py-1 text-sm rounded hover:bg-gray-800 text-gray-200"
          >
            Live View
          </Link>
          <Link
            href="/events"
            className="px-3 py-1 text-sm rounded hover:bg-gray-800 text-gray-200"
          >
            Events
          </Link>
          <Link
            href="/ev-hubs"
            className="px-3 py-1 text-sm rounded bg-green-900/50 hover:bg-green-800/70 text-white"
          >
            EV Hubs
          </Link>
        </div>
      </footer>
    </div>
  );
}
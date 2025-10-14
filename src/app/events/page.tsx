// src/app/events/page.tsx
"use client";

import { useEffect, useState } from "react";
import * as React from "react";
import Map, {
  Layer,
  MapLayerMouseEvent,
  Source,
  ViewState,
  NavigationControl,
  GeolocateControl,
} from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { MapRef } from "react-map-gl";
import { supabase } from "@/lib/supabaseClient";
import { Calendar, MapPin, Clock, X } from "lucide-react";
import Link from "next/link";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

interface Event {
  id: string;
  title: string;
  description: string;
  type: "event";
  location: {
    type: "Point";
    coordinates: [number, number];
  };
  created_at: string;
  event_name: string;
  event_description: string;
}

interface SupabaseEvent {
  id: string;
  created_at: string;
  event_name: string;
  event_description: string;
  location?: any;
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [popupLngLat, setPopupLngLat] = useState<[number, number] | null>(null);
  const mapRef = React.useRef<MapRef>(null);

  // Generate random coordinates around Chennai
  const getRandomChennaiCoordinates = (): [number, number] => {
    const baseLng = 80.2785;
    const baseLat = 13.06;
    const variation = 0.02;

    return [
      baseLng + (Math.random() - 0.5) * variation,
      baseLat + (Math.random() - 0.5) * variation,
    ];
  };

  // Fetch events from Supabase
  useEffect(() => {
    async function fetchEvents() {
      try {
        console.log("Fetching events from Supabase...");

        const { data, error } = await supabase
          .from("city-one-events")
          .select("id, created_at, event_name, event_description, location")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Supabase error:", error);
          setError(error.message);
          return;
        }

        console.log("Raw events data from Supabase:", data);

        // Transform the data with better location handling
        const transformedEvents: Event[] = (data || []).map(
          (event: SupabaseEvent, index: number) => {
            console.log(`Processing event ${index}:`, event);

            // Handle location data - ensure we always have valid coordinates
            let coordinates: [number, number];

            if (event.location && event.location.coordinates) {
              coordinates = event.location.coordinates;
              console.log(
                `Event ${index}: Using existing coordinates:`,
                coordinates
              );
            } else if (event.location && Array.isArray(event.location)) {
              coordinates = event.location as [number, number];
              console.log(
                `Event ${index}: Using direct array coordinates:`,
                coordinates
              );
            } else if (event.location && typeof event.location === "string") {
              try {
                const parsedLocation = JSON.parse(event.location);
                coordinates =
                  parsedLocation.coordinates || getRandomChennaiCoordinates();
                console.log(
                  `Event ${index}: Parsed string coordinates:`,
                  coordinates
                );
              } catch (e) {
                console.error(
                  `Event ${index}: Error parsing location string:`,
                  e
                );
                coordinates = getRandomChennaiCoordinates();
              }
            } else {
              coordinates = getRandomChennaiCoordinates();
              console.log(
                `Event ${index}: Using random coordinates:`,
                coordinates
              );
            }

            // Ensure coordinates are valid numbers
            if (
              !coordinates ||
              !Array.isArray(coordinates) ||
              coordinates.length !== 2
            ) {
              coordinates = getRandomChennaiCoordinates();
              console.log(
                `Event ${index}: Invalid coordinates, using random:`,
                coordinates
              );
            }

            if (
              typeof coordinates[0] !== "number" ||
              typeof coordinates[1] !== "number"
            ) {
              coordinates = getRandomChennaiCoordinates();
              console.log(
                `Event ${index}: Non-number coordinates, using random:`,
                coordinates
              );
            }

            const transformedEvent: Event = {
              id: event.id,
              title: event.event_name,
              description: event.event_description,
              type: "event",
              location: {
                type: "Point",
                coordinates: coordinates,
              },
              created_at: event.created_at,
              event_name: event.event_name,
              event_description: event.event_description,
            };

            console.log(`Event ${index} transformed:`, transformedEvent);
            return transformedEvent;
          }
        );

        console.log("All transformed events:", transformedEvents);
        setEvents(transformedEvents);
      } catch (err) {
        console.error("Error fetching events:", err);
        setError("Failed to load events");
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
  }, []);

  // Convert events to GeoJSON
  const eventsSource = React.useMemo(() => {
    console.log("Creating events source with", events.length, "events");

    const features = events.map((event) => {
      const feature = {
        type: "Feature" as const,
        geometry: event.location,
        properties: {
          ...event,
          id: event.id,
        },
      };
      return feature;
    });

    const source = {
      type: "FeatureCollection" as const,
      features: features,
    };

    console.log("Final GeoJSON source:", source);
    return source;
  }, [events]);

  const initialViewState: Partial<ViewState> = {
    longitude: 80.2785,
    latitude: 13.06,
    zoom: 12,
    pitch: 45,
  };

  const handleEventClick = (event: MapLayerMouseEvent) => {
    console.log("Map click event:", event);

    if (event.features && event.features.length > 0) {
      const feature = event.features[0];
      console.log("Clicked feature:", feature);

      if (
        feature.layer?.id === "event-points" ||
        feature.layer?.id === "event-circles"
      ) {
        const eventData = feature.properties as Event;
        const coordinates = (feature.geometry as GeoJSON.Point).coordinates as [
          number,
          number
        ];

        setSelectedEvent(eventData);
        setPopupLngLat(coordinates);

        // Center map on the event with smooth animation
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

  const handleMapClick = (event: MapLayerMouseEvent) => {
    if (event.features && event.features.length === 0) {
      setSelectedEvent(null);
      setPopupLngLat(null);
    }
  };

  const closePopup = () => {
    setSelectedEvent(null);
    setPopupLngLat(null);
  };

  const onMapLoad = () => {
    console.log("Map loaded with events:", events.length);

    // Fit bounds to show all events
    if (mapRef.current && events.length > 0) {
      const coordinates = events
        .filter((event) => event.location && event.location.coordinates)
        .map((event) => event.location.coordinates);

      console.log("Coordinates for bounds:", coordinates);

      if (coordinates.length > 0) {
        try {
          // Calculate bounds from coordinates
          const lngs = coordinates.map((c) => c[0]);
          const lats = coordinates.map((c) => c[1]);
          const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];
          const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];

          mapRef.current.getMap().fitBounds([sw, ne], {
            padding: { top: 120, bottom: 50, left: 50, right: 350 },
            duration: 2000,
          });
        } catch (e) {
          console.error("Error fitting bounds:", e);
        }
      }
    }
  };

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
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading events...</p>
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
      {/* Events Sidebar */}
      <div className="absolute top-24 left-4 z-10 bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-200 w-80 max-h-[calc(100vh-140px)] overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-600" />
            Upcoming Events
          </h2>
        </div>
        <div className="overflow-y-auto max-h-[calc(100vh-200px)]">
          {events.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No events found</div>
          ) : (
            events.map((event) => (
              <div
                key={event.id}
                className={`p-4 border-b border-gray-100 hover:bg-purple-50 cursor-pointer transition-colors ${
                  selectedEvent?.id === event.id
                    ? "bg-purple-100 border-l-4 border-l-purple-600"
                    : ""
                }`}
                onClick={() => {
                  setSelectedEvent(event);
                  setPopupLngLat(event.location.coordinates);
                  if (mapRef.current && event.location?.coordinates) {
                    mapRef.current.flyTo({
                      center: event.location.coordinates,
                      duration: 1500,
                    });
                  }
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-800 truncate">
                      {event.event_name}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {event.event_description}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(event.created_at).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        Location
                      </div>
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
        interactiveLayerIds={["event-points", "event-circles", "event-pulse"]}
        onClick={(e) => {
          handleMapClick(e);
          handleEventClick(e);
        }}
        onLoad={onMapLoad}
      >
        <GeolocateControl position="bottom-right" />
        <NavigationControl position="bottom-right" />

        {/* Events Layer with improved styling */}
        {events.length > 0 && (
          <Source id="events" type="geojson" data={eventsSource}>
            {/* Pulsing effect */}
            <Layer
              id="event-pulse"
              type="circle"
              source="events"
              paint={{
                "circle-radius": [
                  "interpolate",
                  ["linear"],
                  ["number", ["get", "pulse"], 0],
                  0,
                  8,
                  1,
                  20,
                ],
                "circle-color": "#8B5CF6",
                "circle-opacity": 0.2,
                "circle-stroke-width": 0,
              }}
            />

            {/* Outer circle */}
            <Layer
              id="event-circles"
              type="circle"
              source="events"
              paint={{
                "circle-radius": 12,
                "circle-color": "#8B5CF6",
                "circle-opacity": 0.8,
                "circle-stroke-width": 2,
                "circle-stroke-color": "#FFFFFF",
              }}
            />

            {/* Main marker */}
            <Layer
              id="event-points"
              type="symbol"
              source="events"
              layout={{
                "icon-image": "marker-15",
                "icon-size": 1.6,
                "icon-allow-overlap": true,
                "icon-anchor": "bottom",
              }}
              paint={{
                "icon-color": "#8B5CF6",
                "icon-halo-color": "#FFFFFF",
                "icon-halo-width": 2,
                "icon-halo-blur": 1,
              }}
            />
          </Source>
        )}

        {/* Event Popup */}
        {selectedEvent && popupLngLat && (
          <div
            className="absolute z-50 pointer-events-auto"
            style={{
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 max-w-sm overflow-hidden">
              {/* Header with gradient */}
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-4 text-white">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg leading-tight">
                      {selectedEvent.event_name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-purple-100">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">
                        {new Date(selectedEvent.created_at).toLocaleDateString(
                          "en-US",
                          {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          }
                        )}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={closePopup}
                    className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <p className="text-gray-700 leading-relaxed">
                  {selectedEvent.event_description}
                </p>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="w-4 h-4 text-purple-600" />
                    <span>Event Location</span>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => {
                        if (
                          mapRef.current &&
                          selectedEvent.location?.coordinates
                        ) {
                          mapRef.current.flyTo({
                            center: selectedEvent.location.coordinates,
                            zoom: 15,
                            duration: 1500,
                          });
                        }
                      }}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1"
                    >
                      <MapPin className="w-4 h-4" />
                      Zoom In
                    </button>
                    <button
                      onClick={closePopup}
                      className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 px-3 rounded-lg text-sm font-medium transition-colors"
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

      {/* Debug info - remove in production */}
      {process.env.NODE_ENV === "development" && (
        <div className="absolute bottom-4 right-4 z-10 bg-black/80 text-white p-3 rounded-lg text-xs max-w-md">
          <div className="font-mono">
            <strong>Debug Info:</strong>
            <div>Events loaded: {events.length}</div>
            <div>Selected event: {selectedEvent?.event_name || "None"}</div>
            <div>
              Location: {JSON.stringify(selectedEvent?.location?.coordinates)}
            </div>
          </div>
        </div>
      )}

      {/* Bottom navbar */}
      <footer className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
        <div className="bg-gray-900/80 backdrop-blur rounded-full px-4 py-2 flex items-center gap-4 shadow-lg">
          <Link
            href="/"
            className="px-3 py-1 text-sm rounded hover:bg-gray-800 text-gray-200"
          >
            Live View
          </Link>
          <Link
            href="/mood"
            className="px-3 py-1 text-sm rounded hover:bg-gray-800 text-gray-200"
          >
            Mood Map
          </Link>
        </div>
      </footer>
    </div>
  );
}

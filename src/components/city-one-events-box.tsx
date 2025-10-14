"use client";

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
import type { Event } from "@/lib/types";
import { supabase } from "@/lib/supabaseClient";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

interface SupabaseEvent {
  id: string;
  created_at: string;
  event_name: string;
  event_description: string;
  location?: any;
}

export function MapComponent() {
  const mapRef = React.useRef<MapRef>(null);
  const [events, setEvents] = React.useState<Event[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedEvent, setSelectedEvent] = React.useState<Event | null>(null);

  // Fetch events from Supabase
  React.useEffect(() => {
    async function fetchEvents() {
      try {
        const { data, error } = await supabase
          .from("city-one-events")
          .select("id, created_at, event_name, event_description, location")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching events:", error);
          return;
        }

        console.log("Fetched events from Supabase:", data);

        // Transform Supabase data to Event format
        const transformedEvents: Event[] = (data || []).map(
          (event: SupabaseEvent) => ({
            id: event.id,
            title: event.event_name,
            description: event.event_description,
            type: "event",
            location: event.location || {
              type: "Point",
              coordinates: getRandomChennaiCoordinates(),
            },
            created_at: event.created_at,
            event_name: event.event_name,
            event_description: event.event_description,
          })
        );

        setEvents(transformedEvents);
      } catch (error) {
        console.error("Error in fetchEvents:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
  }, []);

  // Generate random coordinates around Chennai
  const getRandomChennaiCoordinates = (): [number, number] => {
    const baseLng = 80.2785;
    const baseLat = 13.06;
    const variation = 0.02; // ~2km variation

    return [
      baseLng + (Math.random() - 0.5) * variation,
      baseLat + (Math.random() - 0.5) * variation,
    ];
  };

  // Convert events to GeoJSON
  const eventsSource = React.useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: events.map((event) => ({
        type: "Feature" as const,
        geometry: event.location || {
          type: "Point" as const,
          coordinates: getRandomChennaiCoordinates(),
        },
        properties: event,
      })),
    }),
    [events]
  );

  const initialViewState: Partial<ViewState> = {
    longitude: 80.2785,
    latitude: 13.06,
    zoom: 12,
    pitch: 45,
  };

  const handleEventClick = (event: MapLayerMouseEvent) => {
    if (event.features && event.features.length > 0) {
      const feature = event.features[0];

      if (feature.layer?.id === "event-points") {
        const eventData = feature.properties as Event;
        setSelectedEvent(eventData);

        // Center map on the event
        if (mapRef.current) {
          mapRef.current.flyTo({
            center: (feature.geometry as GeoJSON.Point).coordinates as [
              number,
              number
            ],
            essential: true,
            duration: 1000,
          });
        }
      }
    }
  };

  const handleMapClick = (event: MapLayerMouseEvent) => {
    if (event.features && event.features.length === 0) {
      setSelectedEvent(null);
    }
  };

  if (!MAPBOX_TOKEN) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-20">
        <div className="max-w-md mx-4 text-center p-6 bg-white rounded-lg shadow-lg">
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

  return (
    <div className="relative w-full h-full">
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
            <p>Loading events...</p>
          </div>
        </div>
      )}

      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={initialViewState}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        interactiveLayerIds={["event-points"]}
        onClick={(e) => {
          handleMapClick(e);
          handleEventClick(e);
        }}
        onLoad={() => console.log("Map loaded with events:", events.length)}
      >
        <GeolocateControl position="bottom-right" />
        <NavigationControl position="bottom-right" />

        {/* Events Layer */}
        {events.length > 0 && (
          <Source id="events" type="geojson" data={eventsSource}>
            <Layer
              id="event-points"
              type="symbol"
              source="events"
              layout={{
                "icon-image": "marker-15",
                "icon-size": 1.5,
                "icon-allow-overlap": true,
                "icon-anchor": "bottom",
              }}
              paint={{
                "icon-color": "#FF6B6B",
                "icon-halo-color": "#FFFFFF",
                "icon-halo-width": 2,
                "icon-halo-blur": 1,
              }}
            />
          </Source>
        )}

        {/* Popup for Selected Event */}
        {selectedEvent && (
          <div className="mapboxgl-popup mapboxgl-popup-anchor-bottom">
            <div className="bg-white rounded-lg shadow-lg p-4 border-2 border-purple-200 max-w-xs">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse"></div>
                <h3 className="font-bold text-lg text-purple-800">
                  {selectedEvent.event_name}
                </h3>
              </div>

              {selectedEvent.event_description && (
                <p className="text-gray-700 mb-2">
                  {selectedEvent.event_description}
                </p>
              )}

              <div className="flex justify-between items-center text-sm text-gray-500">
                <span>Event</span>
                {selectedEvent.created_at && (
                  <span>
                    {new Date(selectedEvent.created_at).toLocaleDateString()}
                  </span>
                )}
              </div>

              <div className="mt-2 pt-2 border-t border-gray-200">
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-xs text-purple-600 hover:text-purple-800"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </Map>

      {/* Events counter badge */}
      {!loading && (
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span className="font-semibold text-gray-700">
              {events.length} Events
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

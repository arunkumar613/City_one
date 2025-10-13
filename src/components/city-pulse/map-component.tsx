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
import type {
  Incident,
  CivicIssue,
  Event,
  MapLayerId,
  TrafficData,
  SentimentData,
} from "@/lib/types";
import { MOOD_COLORS } from "@/lib/useAreaMood";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

// It's recommended to store this in an environment variable
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

type GeoJSONSourceData = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  Incident | CivicIssue | Event
>;
type TrafficGeoJSON = GeoJSON.FeatureCollection<
  GeoJSON.LineString,
  { congestionLevel: number }
>;
type SentimentGeoJSON = GeoJSON.FeatureCollection<
  GeoJSON.Polygon,
  { score: number; area: string; sentiment: string }
>;

interface MapComponentProps {
  incidents: Incident[];
  civicIssues: CivicIssue[];
  events: Event[];
  traffic: TrafficData[];
  sentiment: SentimentData[];
  areaMoods?: {
    id: string;
    area: string;
    sentiment: string;
    description?: string;
    polygon?: number[][][];
  }[];
  activeLayers: Set<MapLayerId>;
  onFeatureClick: (feature: any) => void;
  onMapLoad: (map: MapRef) => void;
}

const severityColorMap = {
  Critical: "hsl(var(--destructive))",
  Major: "#FF7F50",
  Minor: "#FFD166",
  Info: "hsl(var(--primary))",
};

// This converts your data into a GeoJSON format that Mapbox can read
const toGeoJSON = (
  items: (Incident | CivicIssue | Event)[]
): GeoJSONSourceData => ({
  type: "FeatureCollection",
  features: items.map((item) => ({
    type: "Feature",
    geometry: item.location || { type: "Point", coordinates: [80.2785, 13.06] },
    properties: item,
  })),
});

const trafficToGeoJSON = (items: TrafficData[]): TrafficGeoJSON => ({
  type: "FeatureCollection",
  features: items.map((item) => ({
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: item.coordinates || [],
    },
    properties: {
      congestionLevel: item.congestionLevel || 0,
    },
  })),
});

const sentimentToGeoJSON = (items: SentimentData[]): SentimentGeoJSON => ({
  type: "FeatureCollection",
  features: items.map((item) => ({
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: item.polygon || getDefaultPolygonForArea(item.area),
    },
    properties: {
      score: item.score || 0,
      area: item.area,
      sentiment: item.sentiment,
    },
  })),
});

// Generate default polygons for areas based on their names
function getDefaultPolygonForArea(area: string): number[][][] {
  // Simple hash function to generate consistent coordinates based on area name
  const hash = area.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  const baseLng = 80.2785 + (hash % 100) / 1000;
  const baseLat = 13.06 + (hash % 100) / 1000;
  
  return [[
    [baseLng - 0.01, baseLat - 0.01],
    [baseLng + 0.01, baseLat - 0.01],
    [baseLng + 0.01, baseLat + 0.01],
    [baseLng - 0.01, baseLat + 0.01],
    [baseLng - 0.01, baseLat - 0.01],
  ]];
}

export function MapComponent({
  incidents,
  civicIssues,
  events,
  traffic,
  sentiment,
  areaMoods = [],
  activeLayers,
  onFeatureClick,
  onMapLoad,
}: MapComponentProps) {
  const mapRef = React.useRef<MapRef>(null);

  // Convert area moods with polygons to GeoJSON for map rendering
  const areaMoodsGeoJSON = React.useMemo(() => ({
    type: "FeatureCollection",
    features: (areaMoods || [])
      .filter((a) => Array.isArray(a.polygon))
      .map((a) => ({
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: a.polygon,
        },
        properties: {
          id: a.id,
          area: a.area,
          sentiment: a.sentiment,
        },
      })),
  }), [areaMoods]);

  if (!MAPBOX_TOKEN || MAPBOX_TOKEN === "YOUR_MAPBOX_TOKEN_HERE") {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-20">
        <Card className="max-w-md mx-4 text-center">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              <AlertTriangle className="text-destructive" />
              Map Configuration Needed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Please add your Mapbox Access Token to the{" "}
              <code className="bg-muted px-1 py-0.5 rounded-sm">
                .env.local
              </code>{" "}
              file to enable map functionality.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const initialViewState: Partial<ViewState> = {
    longitude: 80.2785,
    latitude: 13.06,
    zoom: 12,
    pitch: 45,
  };

  const incidentsSource = React.useMemo(
    () => toGeoJSON(incidents),
    [incidents]
  );
  const civicIssuesSource = React.useMemo(
    () => toGeoJSON(civicIssues),
    [civicIssues]
  );
  const eventsSource = React.useMemo(() => toGeoJSON(events), [events]);
  const trafficSource = React.useMemo(
    () => trafficToGeoJSON(traffic),
    [traffic]
  );

  const handleFeatureClick = (event: MapLayerMouseEvent) => {
    if (event.features && event.features.length > 0) {
      const feature = event.features[0];
      const map = mapRef.current?.getMap();
      if (!map) return;

      if (feature.properties?.cluster) {
        const clusterId = feature.properties.cluster_id;
        const source = map.getSource("incidents") as
          | mapboxgl.GeoJSONSource
          | undefined;
        if (!source) return;

        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err || zoom == null) return;
          map.easeTo({
            center: (feature.geometry as GeoJSON.Point).coordinates as [
              number,
              number
            ],
            zoom: zoom + 1,
          });
        });
      } else {
        const properties = feature.properties;
        // Mapbox stringifies nested properties, so we need to parse them.
        // This is a common issue when passing complex objects as properties.
        const featureData = properties?.type
          ? properties
          : JSON.parse(properties?.data || "{}");
        onFeatureClick(featureData);
      }
    }
  };

  const onInternalLoad = () => {
    const map = mapRef.current?.getMap();
    if (map) {
      onMapLoad(mapRef.current!);

      // Setup Mapbox vector tiles traffic source + layer for real-time traffic
      try {
        if (activeLayers.has("traffic")) {
          if (!map.getSource("mapbox-traffic")) {
            map.addSource("mapbox-traffic", {
              type: "vector",
              url: "mapbox://mapbox.mapbox-traffic-v1",
            } as any);
          }

          if (!map.getLayer("mapbox-traffic-layer")) {
            map.addLayer({
              id: "mapbox-traffic-layer",
              type: "line",
              source: "mapbox-traffic",
              "source-layer": "traffic",
              layout: {
                "line-join": "round",
                "line-cap": "round",
              },
              paint: {
                "line-color": [
                  "match",
                  ["get", "congestion"],
                  "low",
                  "#28a745",
                  "moderate",
                  "#ffc107",
                  "heavy",
                  "#fd7e14",
                  "severe",
                  "#dc3545",
                  "#cccccc",
                ],
                "line-width": 3,
              },
            } as any);
          }
        } else {
          if (map.getLayer("mapbox-traffic-layer")) {
            map.removeLayer("mapbox-traffic-layer");
          }
          if (map.getSource("mapbox-traffic")) {
            map.removeSource("mapbox-traffic");
          }
        }
      } catch (err) {
        console.warn("Error setting up Mapbox traffic layer:", err);
      }
    }
  };

  // Helper function to convert sentiment to numerical score
  function getSentimentScore(sentiment: string): number {
    const scoreMap: Record<string, number> = {
      "super happy": 1.0,
      "happy": 0.7,
      "neutral": 0.0,
      "sad": -0.7,
      "super sad": -1.0,
      "angry": -0.5,
      "super angry": -0.9
    };
    
    return scoreMap[sentiment] || 0.0;
  }

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={MAPBOX_TOKEN}
      initialViewState={initialViewState}
      style={{ width: "100%", height: "100%" }}
      mapStyle="mapbox://styles/mapbox/dark-v11"
      interactiveLayerIds={[
        "unclustered-incidents",
        "clusters",
        "civic-issue-points",
        "event-points",
        "sentiment-fill",
      ]}
      onClick={handleFeatureClick}
      onLoad={onInternalLoad}
    >
      <GeolocateControl position="bottom-right" />
      <NavigationControl position="bottom-right" />

      {/* Incidents Layer with Clustering */}
      {activeLayers.has("incidents") && (
        <Source
          id="incidents"
          type="geojson"
          data={incidentsSource}
          cluster={true}
          clusterMaxZoom={14}
          clusterRadius={50}
        >
          <Layer
            id="clusters"
            type="circle"
            source="incidents"
            filter={["has", "point_count"]}
            paint={{
              "circle-color": [
                "step",
                ["get", "point_count"],
                "#51bbd6",
                100,
                "#f1f075",
                750,
                "#f28cb1",
              ],
              "circle-radius": [
                "step",
                ["get", "point_count"],
                20,
                100,
                30,
                750,
                40,
              ],
              "circle-stroke-width": 2,
              "circle-stroke-color": "#1E3A8A",
            }}
          />
          <Layer
            id="cluster-count"
            type="symbol"
            source="incidents"
            filter={["has", "point_count"]}
            layout={{
              "text-field": "{point_count_abbreviated}",
              "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
              "text-size": 12,
            }}
            paint={{
              "text-color": "hsl(var(--background))",
            }}
          />
          <Layer
            id="unclustered-incidents"
            type="circle"
            source="incidents"
            filter={["!", ["has", "point_count"]]}
            paint={{
              "circle-color": [
                "match",
                ["get", "severity"],
                "Critical",
                severityColorMap.Critical,
                "Major",
                severityColorMap.Major,
                "Minor",
                severityColorMap.Minor,
                severityColorMap.Info,
              ],
              "circle-radius": 8,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#ffffff",
              "circle-opacity": 0.8,
            }}
          />
        </Source>
      )}

      {/* Civic Issues Layer */}
      {activeLayers.has("civic-issues") && (
        <Source id="civic-issues" type="geojson" data={civicIssuesSource}>
          <Layer
            id="civic-issue-points"
            type="symbol"
            source="civic-issues"
            layout={{
              "icon-image": [
                "match",
                ["get", "category"],
                "Pothole",
                "roadblock",
                "Garbage",
                "waste-basket",
                "Water",
                "water",
                "Electricity",
                "danger",
                "circle-15",
              ],
              "icon-size": 0.8,
              "icon-allow-overlap": true,
            }}
            paint={{
              "icon-color": "hsl(var(--primary))",
            }}
          />
        </Source>
      )}

      {/* Events Layer */}
      {activeLayers.has("events") && (
        <Source id="events" type="geojson" data={eventsSource}>
          <Layer
            id="event-points"
            type="symbol"
            source="events"
            layout={{
              "icon-image": "star",
              "icon-size": 1,
              "icon-allow-overlap": true,
            }}
            paint={{
              "icon-color": "#FFD166",
            }}
          />
        </Source>
      )}

      {/* Traffic Layer */}
      {activeLayers.has("traffic") && (
        <Source id="traffic" type="geojson" data={trafficSource}>
          <Layer
            id="traffic-lines"
            type="line"
            source="traffic"
            layout={{
              "line-join": "round",
              "line-cap": "round",
            }}
            paint={{
              "line-width": 4,
              "line-color": [
                "interpolate",
                ["linear"],
                ["get", "congestionLevel"],
                0,
                "#39FF14",
                0.5,
                "#FFFF00",
                1,
                "#FF4500",
              ],
              "line-opacity": 0.7,
            }}
          />
        </Source>
      )}

      {/* Sentiment Layer */}
      {activeLayers.has("sentiment") && (
        <Source id="area-moods" type="geojson" data={areaMoodsGeoJSON}>
          <Layer
            id="area-moods-fill"
            type="fill"
            source="area-moods"
            paint={{
              "fill-color": [
                "match",
                ["get", "sentiment"],
                ...Object.entries(MOOD_COLORS).flat(),
                "#95a5a6",
              ],
              "fill-opacity": 0.5,
              "fill-outline-color": "#ffffff",
            }}
          />
          <Layer
            id="area-moods-labels"
            type="symbol"
            source="area-moods"
            layout={{
              "text-field": ["get", "area"],
              "text-size": 12,
              "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
            }}
            paint={{
              "text-color": "#ffffff",
              "text-halo-color": "#000000",
              "text-halo-width": 1,
            }}
          />
        </Source>
      )}
    </Map>
  );
}
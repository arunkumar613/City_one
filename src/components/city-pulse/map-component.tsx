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

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

type GeoJSONSourceData = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  Incident | CivicIssue | Event
>;
type TrafficGeoJSON = GeoJSON.FeatureCollection<
  GeoJSON.LineString,
  { congestionLevel: number }
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
    polygon?: any;
  }[];
  activeLayers: Set<MapLayerId>;
  onFeatureClick: (feature: any) => void;
  onMapLoad: (map: MapRef) => void;
  mapMode: 'Live' | 'Mood' | 'Events';
}

const severityColorMap = {
  Critical: "hsl(var(--destructive))",
  Major: "#FF7F50",
  Minor: "#FFD166",
  Info: "hsl(var(--primary))",
};

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
  mapMode,
}: MapComponentProps) {
  const mapRef = React.useRef<MapRef>(null);
  const [debugInfo, setDebugInfo] = React.useState<string>("");

  // Debug: Log the areaMoods data
  React.useEffect(() => {
    console.log("=== AREA MOODS DEBUG ===");
    console.log("Total Area Moods:", areaMoods.length);
    console.log("Full Area Moods Data:", areaMoods);

    areaMoods.forEach((mood, idx) => {
      console.log(`\n[${idx}] ${mood.area}:`);
      console.log("  - ID:", mood.id);
      console.log("  - Sentiment:", mood.sentiment);
      console.log("  - Has polygon:", !!mood.polygon);
      console.log("  - Polygon type:", typeof mood.polygon);
      console.log("  - Polygon value:", mood.polygon);

      if (mood.polygon) {
        if (typeof mood.polygon === "string") {
          console.log("  - Polygon is STRING, length:", mood.polygon.length);
          console.log("  - First 100 chars:", mood.polygon.substring(0, 100));
        } else if (typeof mood.polygon === "object") {
          console.log(
            "  - Polygon is OBJECT, keys:",
            Object.keys(mood.polygon)
          );
          console.log("  - First key:", Object.keys(mood.polygon)[0]);
          console.log(
            "  - First key value type:",
            typeof mood.polygon[Object.keys(mood.polygon)[0]]
          );
          console.log("  - Is array:", Array.isArray(mood.polygon));
          console.log(
            "  - Full polygon object:",
            JSON.stringify(mood.polygon).substring(0, 200)
          );
        }
      } else {
        console.log("  - ⚠️ NO POLYGON DATA");
      }
    });

    console.log("\nSentiment values found:", [
      ...new Set(areaMoods.map((m) => m.sentiment)),
    ]);
    console.log(
      "Areas WITH polygons:",
      areaMoods.filter((m) => m.polygon).map((m) => m.area)
    );
    console.log(
      "Areas WITHOUT polygons:",
      areaMoods.filter((m) => !m.polygon).map((m) => m.area)
    );

    const info = `Total areas: ${areaMoods.length}, With polygons: ${
      areaMoods.filter((m) => m.polygon).length
    }`;
    setDebugInfo(info);
  }, [areaMoods]);

  // Convert area moods to GeoJSON with extensive validation
  const areaMoodsGeoJSON = React.useMemo(() => {
    console.log("Converting to GeoJSON...");

    const features = areaMoods
      .map((mood, index) => {
        console.log(`Processing mood ${index}:`, {
          id: mood.id,
          area: mood.area,
          hasPolygon: !!mood.polygon,
          polygonType: typeof mood.polygon,
          isArray: Array.isArray(mood.polygon),
        });

        if (!mood.polygon) {
          console.log(`  → Skipping ${mood.area}: no polygon`);
          return null;
        }

        let polygonData = mood.polygon;

        // Parse if string
        if (typeof mood.polygon === "string") {
          try {
            polygonData = JSON.parse(mood.polygon);
            console.log(`  → Parsed string polygon for ${mood.area}`);
          } catch (e) {
            console.error(`  → Failed to parse for ${mood.area}:`, e);
            return null;
          }
        }

        // Extract from nested object structure
        if (
          polygonData &&
          typeof polygonData === "object" &&
          !Array.isArray(polygonData)
        ) {
          console.log(
            `  → Polygon is object, checking structure:`,
            Object.keys(polygonData)
          );

          if (polygonData.polygon && Array.isArray(polygonData.polygon)) {
            polygonData = polygonData.polygon;
            console.log(
              `  → Extracted from .polygon property for ${mood.area}`
            );
          } else if (
            polygonData.coordinates &&
            Array.isArray(polygonData.coordinates)
          ) {
            polygonData = polygonData.coordinates;
            console.log(`  → Extracted from .coordinates for ${mood.area}`);
          } else if (
            polygonData.type === "Polygon" &&
            polygonData.coordinates
          ) {
            polygonData = polygonData.coordinates;
            console.log(`  → Extracted from GeoJSON format for ${mood.area}`);
          } else {
            console.log(`  → Unknown structure for ${mood.area}`);
            return null;
          }
        }

        // Validate array structure
        if (!Array.isArray(polygonData)) {
          console.log(`  → Skipping ${mood.area}: not an array after parsing`);
          return null;
        }

        if (polygonData.length === 0) {
          console.log(`  → Skipping ${mood.area}: empty array`);
          return null;
        }

        const firstRing = polygonData[0];
        if (!Array.isArray(firstRing) || firstRing.length < 4) {
          console.log(`  → Skipping ${mood.area}: invalid ring structure`);
          return null;
        }

        const firstCoord = firstRing[0];
        if (!Array.isArray(firstCoord) || firstCoord.length !== 2) {
          console.log(`  → Skipping ${mood.area}: invalid coordinate format`);
          return null;
        }

        console.log(`  ✓ Valid polygon for ${mood.area}`);

        return {
          type: "Feature" as const,
          geometry: {
            type: "Polygon" as const,
            coordinates: polygonData,
          },
          properties: {
            id: mood.id,
            area: mood.area,
            sentiment: mood.sentiment,
            description: mood.description || "",
          },
        };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null);

    console.log(`Created ${features.length} valid features`);
    features.forEach((f) => {
      console.log(
        `Feature: ${f.properties.area} | Sentiment: "${
          f.properties.sentiment
        }" | Has Color: ${!!MOOD_COLORS[f.properties.sentiment]}`
      );
    });

    return {
      type: "FeatureCollection" as const,
      features,
    };
  }, [areaMoods]);

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
              file.
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
        const featureData = properties?.type
          ? properties
          : JSON.parse(properties?.data || "{}");
        onFeatureClick(featureData);
      }
    }
  };

  // Effect to update layers when mode changes
  React.useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    const shouldShowTraffic = mapMode === 'Live';
    
    // Clean up existing traffic layers
    if (map.getLayer("mapbox-traffic-layer")) {
      map.removeLayer("mapbox-traffic-layer");
    }
    if (map.getSource("mapbox-traffic")) {
      map.removeSource("mapbox-traffic");
    }

    // Add traffic layers if in Live mode
    if (shouldShowTraffic) {
      try {
        map.addSource("mapbox-traffic", {
          type: "vector",
          url: "mapbox://mapbox.mapbox-traffic-v1",
        } as any);

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
      } catch (err) {
        console.warn("Error setting up Mapbox traffic layer:", err);
      }
    }

    // Update layer visibilities based on mode
    ['incidents', 'civic-issues', 'events'].forEach(layerId => {
      const layer = map.getLayer(layerId);
      if (layer) {
        if (mapMode === 'Events') {
          // Only show events layer in Events mode
          map.setLayoutProperty(layerId, 'visibility', 
            layerId === 'events' ? 'visible' : 'none');
        } else if (mapMode === 'Live') {
          // Show incidents and civic issues in Live mode
          map.setLayoutProperty(layerId, 'visibility', 
            layerId === 'events' ? 'none' : 'visible');
        } else {
          // Hide all these layers in Mood mode
          map.setLayoutProperty(layerId, 'visibility', 'none');
        }
      }
    });
  }, [mapMode]);

  const onInternalLoad = () => {
    console.log("Map loaded!");
    const map = mapRef.current?.getMap();
    if (map) {
      onMapLoad(mapRef.current!);
      console.log("Map reference passed to parent");

      // Initial map setup is now handled by the mapMode effect
    }
  };

  const showSentimentLayer = activeLayers.has("sentiment") && mapMode === 'Mood';
  const showTrafficLayer = activeLayers.has("traffic") && mapMode === 'Live';
  const showEventsLayer = activeLayers.has("events") && mapMode === 'Events';
  const hasValidPolygons = areaMoodsGeoJSON.features.length > 0;

  return (
    <div className="relative w-full h-full">
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
          ...(showSentimentLayer ? ["area-moods-fill"] : []),
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
              paint={{ "text-color": "hsl(var(--background))" }}
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
              paint={{ "icon-color": "hsl(var(--primary))" }}
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
              paint={{ "icon-color": "#FFD166" }}
            />
          </Source>
        )}

        {/* Traffic Layer */}
        {showTrafficLayer && (
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

        {/* Sentiment/Area Moods Layer with Polygons */}
        {showSentimentLayer && hasValidPolygons && (
          <Source id="area-moods" type="geojson" data={areaMoodsGeoJSON}>
            <Layer
              id="area-moods-fill"
              type="fill"
              source="area-moods"
              paint={{
                "fill-color": [
                  "case",
                  ["==", ["get", "sentiment"], "Positive"],
                  "#2ecc71", // Green
                  ["==", ["get", "sentiment"], "positive"],
                  "#2ecc71",
                  ["==", ["get", "sentiment"], "Neutral"],
                  "#95a5a6", // Gray
                  ["==", ["get", "sentiment"], "neutral"],
                  "#95a5a6",
                  ["==", ["get", "sentiment"], "Negative"],
                  "#e74c3c", // Red
                  ["==", ["get", "sentiment"], "negative"],
                  "#e74c3c",
                  ["==", ["get", "sentiment"], "happy"],
                  MOOD_COLORS["happy"],
                  ["==", ["get", "sentiment"], "sad"],
                  MOOD_COLORS["sad"],
                  ["==", ["get", "sentiment"], "angry"],
                  MOOD_COLORS["angry"],
                  ["==", ["get", "sentiment"], "super happy"],
                  MOOD_COLORS["super happy"],
                  ["==", ["get", "sentiment"], "super sad"],
                  MOOD_COLORS["super sad"],
                  ["==", ["get", "sentiment"], "super angry"],
                  MOOD_COLORS["super angry"],
                  "#FFFFFF", // White default to make it obvious when no match
                ],
                "fill-opacity": 0.6,
              }}
            />
            <Layer
              id="area-moods-outline"
              type="line"
              source="area-moods"
              paint={{
                "line-color": "#00FF00",
                "line-width": 3,
                "line-opacity": 1.0,
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


    </div>
  );
}

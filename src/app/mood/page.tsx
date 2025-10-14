"use client";

import { useEffect, useState } from "react";
import { Map } from "mapbox-gl";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAreaMood } from "@/lib/useAreaMood";

// Set your Mapbox token here
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

export default function MoodMapPage() {
  const [map, setMap] = useState<Map | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { areaMoods } = useAreaMood();

  // Initialize map
  useEffect(() => {
    if (map) return; // Initialize map only once

    try {
      const mapInstance = new mapboxgl.Map({
        container: "mood-map",
        style: "mapbox://styles/mapbox/dark-v11",
        center: [80.2707, 13.0827], // Chennai coordinates
        zoom: 11,
      });

      mapInstance.on("load", () => {
        setMap(mapInstance);
        setLoading(false);
      });

      // Add navigation controls
      mapInstance.addControl(new mapboxgl.NavigationControl(), "top-right");

      // Cleanup on unmount
      return () => {
        mapInstance.remove();
      };
    } catch (err) {
      console.error("Error initializing map:", err);
      setError("Failed to load map. Please try again later.");
      setLoading(false);
    }
  }, [map]);

  // Add sentiment polygons when map and data are loaded
  useEffect(() => {
    if (!map || !areaMoods || areaMoods.length === 0) return;

    // Add source if it doesn't exist
    if (!map.getSource("sentiment-data")) {
      map.addSource("sentiment-data", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: areaMoods.map((area) => ({
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: area.polygon,
            },
            properties: {
              score: area.score,
              mood: area.mood,
            },
          })),
        },
      });

      // Add fill layer
      map.addLayer({
        id: "sentiment-fill",
        type: "fill",
        source: "sentiment-data",
        paint: {
          "fill-color": [
            "match",
            ["get", "mood"],
            "angry",
            "#FF5252",
            "sad",
            "#FFA726",
            "neutral",
            "#FFEE58",
            "happy",
            "#66BB6A",
            "super happy",
            "#26C6DA",
            "#BBDEFB", // default color
          ],
          "fill-opacity": 0.6,
        },
      });

      // Add outline layer
      map.addLayer({
        id: "sentiment-outline",
        type: "line",
        source: "sentiment-data",
        paint: {
          "line-color": "#FFFFFF",
          "line-width": 1,
        },
      });
    }
  }, [map, areaMoods]);

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <Skeleton className="h-[600px] w-full" />
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <Card>
              <CardContent className="pt-6">
                <p className="text-destructive">{error}</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            <div id="mood-map" className="w-full h-full" />
            <div className="absolute top-4 left-4 z-10">
              <Card className="w-[300px]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Mood Map</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      This map shows the mood across different areas based on sentiment analysis.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Badge className="bg-[#FF5252]">Angry</Badge>
                      <Badge className="bg-[#FFA726]">Sad</Badge>
                      <Badge className="bg-[#FFEE58] text-black">Neutral</Badge>
                      <Badge className="bg-[#66BB6A]">Happy</Badge>
                      <Badge className="bg-[#26C6DA]">Super Happy</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
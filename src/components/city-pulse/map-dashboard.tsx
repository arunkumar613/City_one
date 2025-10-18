"use client";

import * as React from "react";
import type { MapRef } from "react-map-gl";
import { createClient } from "@supabase/supabase-js";

import { MapComponent } from "./map-component";
import { IncidentSheet } from "./incident-sheet";
import { useAreaMood, MOOD_COLORS } from "@/lib/useAreaMood";
import { getAllData } from "@/lib/data";
import type {
  Incident,
  CivicIssue,
  Event,
  EvHub,
  MapLayer,
  MapLayerId,
  MapMode,
  Severity,
  TrafficData,
  SentimentData,
} from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Layers,
  SlidersHorizontal,
  User,
  Plus,
  Compass,
  Share2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import ChatBot from "./chatbot";
import CommunityHelp from "./community-help";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const ALL_LAYERS: MapLayer[] = [
  { id: "incidents", name: "Incidents" },
  { id: "civic-issues", name: "Civic Issues" },
  { id: "events", name: "Events" },
  { id: "ev-hubs", name: "EV Hubs" },
  { id: "traffic", name: "Traffic" },
  { id: "sentiment", name: "Sentiment" },
];

// add Community to MapMode
type MapMode = "Live" | "Events" | "Mood" | "EVHubs" | "Community";

const SEVERITIES: Severity[] = ["Info", "Minor", "Major", "Critical"];

type Feature = Incident | CivicIssue | Event;

// Main Dashboard Component
export function MapDashboard() {
  // Fetch all data from Supabase using custom hooks
  const {
    areas: areaMoods,
    loading: areaLoading,
    error: areaError,
  } = useAreaMood();

  const [mapRef, setMapRef] = React.useState<MapRef | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isSearching, setIsSearching] = React.useState(false);

  // State Management
  const [mapMode, setMapMode] = React.useState<MapMode>("Live");
  // activeLayers is state now so UI controls can toggle it
  const [activeLayers, setActiveLayers] = React.useState<Set<MapLayerId>>(
    () => {
      switch ("Live" as MapMode) {
        case "Live":
          return new Set<MapLayerId>(["traffic"]);
        case "Events":
          return new Set<MapLayerId>(["events"]);
        case "Mood":
          return new Set<MapLayerId>(["sentiment"]);
        case "EVHubs":
          return new Set<MapLayerId>(["ev-hubs"]);
        default:
          return new Set<MapLayerId>();
      }
    }
  );

  // Keep active layer defaults in sync when mapMode changes
  React.useEffect(() => {
    switch (mapMode) {
      case "Live":
        setActiveLayers(new Set<MapLayerId>(["traffic"]));
        break;
      case "Events":
        setActiveLayers(new Set<MapLayerId>(["events"]));
        break;
      case "Mood":
        setActiveLayers(new Set<MapLayerId>(["sentiment"]));
        break;
      case "EVHubs":
        setActiveLayers(new Set<MapLayerId>(["ev-hubs"]));
        break;
      default:
        setActiveLayers(new Set<MapLayerId>());
    }
  }, [mapMode]);
  const [selectedFeature, setSelectedFeature] = React.useState<Feature | null>(
    null
  );
  const [isSheetOpen, setSheetOpen] = React.useState(false);
  const [isSearchFocused, setSearchFocused] = React.useState(false);

  // Filters
  const [severityFilter, setSeverityFilter] = React.useState<Set<Severity>>(
    () => new Set(SEVERITIES)
  );
  const { toast } = useToast();

  // Handle errors
  React.useEffect(() => {
    if (areaError) {
      toast({
        title: "Data loading error",
        description: `Failed to load area mood data: ${
          areaError.message || "Unknown error"
        }`,
        variant: "destructive",
      });
    }
  }, [areaError, toast]);

  // Only area moods are used now

  // Combine area moods with sentiment data for display
  const displayAreaMoods = React.useMemo(() => {
    return areaMoods.map((mood) => ({
      ...mood,
      description: mood.description || `Area mood: ${mood.sentiment}`,
    }));
  }, [areaMoods]);

  // EV Hubs from OpenChargeMap
  const [evHubs, setEvHubs] = React.useState<any[]>([]);
  const [evLoading, setEvLoading] = React.useState<boolean>(false);
  const [evError, setEvError] = React.useState<string | null>(null);
  React.useEffect(() => {
    const key = process.env.NEXT_PUBLIC_OPENCHARGEMAP_KEY;
    if (!key) {
      console.warn(
        "OPENCHARGEMAP key missing: set NEXT_PUBLIC_OPENCHARGEMAP_KEY"
      );
      return;
    }
    let cancelled = false;

    async function fetchEvHubs() {
      setEvLoading(true);
      setEvError(null);
      try {
        const url = `https://api.openchargemap.io/v3/poi/?output=json&countrycode=IN&maxresults=100&compact=true&verbose=false&key=${encodeURIComponent(
          key
        )}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`OCM fetch failed: ${res.status}`);
        const data = await res.json();

        const mapped = (data || []).map((item: any) => {
          const addr = item.AddressInfo || {};
          const lat = addr.Latitude ?? 13.06;
          const lng = addr.Longitude ?? 80.2785;

          return {
            id: String(item.ID ?? `${lng}-${lat}`),
            name: addr.Title ?? item.Name ?? "EV Hub",
            location: { type: "Point", coordinates: [lng, lat] },
            address: [addr.AddressLine1, addr.Town, addr.StateOrProvince]
              .filter(Boolean)
              .join(", "),
            operator: item.OperatorInfo?.Title ?? null,
            type:
              item.UsageType?.Title ??
              item.Connections?.[0]?.ConnectionType?.Title ??
              null,
            raw: item,
          };
        });

        if (!cancelled) setEvHubs(mapped);
      } catch (err: any) {
        console.error("Failed to load EV hubs:", err);
        if (!cancelled) setEvError(err?.message ?? String(err));
      } finally {
        if (!cancelled) setEvLoading(false);
      }
    }

    fetchEvHubs();
    return () => {
      cancelled = true;
    };
  }, []);

  // Community reports (fetched from Supabase)
  const [communityFeatures, setCommunityFeatures] =
    React.useState<GeoJSON.FeatureCollection | null>(null);
  const [selectedCommunity, setSelectedCommunity] = React.useState<any | null>(
    null
  );
  const [communityLoading, setCommunityLoading] = React.useState(false);

  // helper: approximate circle polygon around a lat/lng (meters -> degrees)
  function createCirclePolygon(lat: number, lng: number, radiusMeters = 150) {
    const points: [number, number][] = [];
    const steps = 24;
    const earthCircumference = 40075000; // meters
    const latDegreeMeters = 111320; // approx
    for (let i = 0; i < steps; i++) {
      const ang = (i / steps) * Math.PI * 2;
      const dLat = (radiusMeters * Math.cos(ang)) / latDegreeMeters;
      const dLng =
        (radiusMeters * Math.sin(ang)) /
        (latDegreeMeters * Math.cos((lat * Math.PI) / 180));
      points.push([lng + dLng, lat + dLat]);
    }
    // close polygon
    points.push(points[0]);
    return points;
  }

  React.useEffect(() => {
    let cancelled = false;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      console.warn("Supabase client env not set. Skipping community fetch.");
      return;
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    async function fetchCommunity() {
      try {
        const { data, error } = await supabase
          .from("city-one-community")
          .select("id,created_at,title,description,area,response,lat,lng");

        // log raw rows for debugging
        console.log("Supabase community rows:", data, "error:", error);

        if (error) {
          console.error("Supabase community fetch error", error);
          return;
        }
        if (cancelled) return;
        // build GeoJSON FeatureCollection of polygons (small circles) from lat/lng
        const features = (data || [])
          .filter((r: any) => r.lat != null && r.lng != null)
          .map((r: any) => {
            const lat = Number(r.lat);
            const lng = Number(r.lng);
            const polygon = createCirclePolygon(lat, lng, 100); // 100m radius
            return {
              type: "Feature",
              geometry: { type: "Polygon", coordinates: [polygon] },
              properties: {
                id: r.id,
                title: r.title,
                description: r.description,
                area: r.area,
                response: r.response,
                created_at: r.created_at,
                lat,
                lng,
              },
            };
          });
        setCommunityFeatures({
          type: "FeatureCollection",
          features,
        });
      } catch (err) {
        console.error("Failed to fetch community data", err);
      }
    }

    fetchCommunity();
    return () => {
      cancelled = true;
    };
  }, []);

  // Handlers
  const handleFeatureClick = React.useCallback((feature: any) => {
    if (feature.score) return; // Don't open sheet for sentiment polygons
    setSelectedFeature(feature);
    setSheetOpen(true);
  }, []);

  const handleMapLoad = React.useCallback((map: MapRef) => {
    setMapRef(map);
  }, []);

  const geocodeAndFly = React.useCallback(
    async (query: string) => {
      const q = query.trim();
      if (!q) return;
      if (!MAPBOX_TOKEN) {
        toast({
          title: "Mapbox token missing",
          description: "Set NEXT_PUBLIC_MAPBOX_TOKEN in .env.local",
          variant: "destructive",
        });
        return;
      }
      try {
        setIsSearching(true);
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          q
        )}.json?access_token=${MAPBOX_TOKEN}&limit=1&types=place,poi,locality,neighborhood,address&proximity=80.2785,13.06`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to search");
        const data = await res.json();
        const feature = data?.features?.[0];
        if (!feature?.center) {
          toast({
            title: "No results",
            description: "Try a different place or address.",
          });
          return;
        }
        const [lng, lat] = feature.center as [number, number];
        const map = mapRef?.getMap();
        map?.flyTo({ center: [lng, lat], zoom: 14, essential: true });
      } catch (err) {
        toast({
          title: "Search failed",
          description: "Please try again in a moment.",
          variant: "destructive",
        });
      } finally {
        setIsSearching(false);
      }
    },
    [mapRef, toast]
  );

  const toggleLayer = (layerId: MapLayerId) => {
    setActiveLayers((prev) => {
      const newLayers = new Set(prev);
      if (newLayers.has(layerId)) {
        newLayers.delete(layerId);
      } else {
        newLayers.add(layerId);
      }
      return newLayers;
    });
  };

  const toggleSeverity = (severity: Severity) => {
    setSeverityFilter((prev) => {
      const newSeverities = new Set(prev);
      if (newSeverities.has(severity)) {
        newSeverities.delete(severity);
      } else {
        newSeverities.add(severity);
      }
      return newSeverities;
    });
  };

  const loading = areaLoading;

  React.useEffect(() => {
    console.log("MapDashboard state:", {
      mapMode,
      activeLayers: Array.from(activeLayers),
      evHubsLength: evHubs?.length,
    });
  }, [mapMode, activeLayers, evHubs]);

  return (
    <TooltipProvider>
      <div className="relative h-screen w-screen bg-background text-foreground">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-50">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading map data...</p>
            </div>
          </div>
        ) : (
          <MapComponent
            incidents={getAllData().incidents}
            civicIssues={getAllData().civicIssues}
            events={getAllData().events}
            evHubs={evHubs} // <-- pass real data here
            traffic={getAllData().traffic}
            sentiment={getAllData().sentiment}
            areaMoods={displayAreaMoods}
            activeLayers={activeLayers}
            communityFeatures={communityFeatures}
            onFeatureClick={handleFeatureClick}
            onMapLoad={handleMapLoad}
            onCommunityClick={(f: any) => {
              setSelectedCommunity(f);
            }}
            mapMode={mapMode}
          />
        )}

        {/* Top Header Controls */}
        <header
          className={cn(
            "fixed top-0 left-0 right-0 p-3 sm:p-4 z-10 flex items-start justify-between gap-4 transition-all duration-300",
            isSearchFocused &&
              "bg-background/80 backdrop-blur-sm flex-col sm:flex-row"
          )}
        >
          {/* Search Bar */}
          <div
            className={cn(
              "relative transition-all duration-300 w-full max-w-xs sm:max-w-sm",
              isSearchFocused && "max-w-full"
            )}
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search areas, roads, wards..."
              className="pl-10 h-11 rounded-full bg-card/80 backdrop-blur-sm border-border/50 shadow-lg focus:bg-card/95 focus:ring-primary"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  geocodeAndFly(searchQuery);
                }
              }}
            />
          </div>

          {/* Right Controls */}
          <div
            className={cn(
              "flex items-center gap-2",
              isSearchFocused && "self-end"
            )}
          >
            <ProfileControl />
          </div>
        </header>

        {/* Bottom Center Context Switcher */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-background/10 backdrop-blur-md p-1.5 rounded-2xl shadow-xl border border-white/10 relative overflow-hidden">
            <ToggleGroup
              type="single"
              value={mapMode}
              onValueChange={(value: MapMode) => value && setMapMode(value)}
              className="relative z-10 flex gap-1"
            >
              <ToggleGroupItem
                value="Live"
                className="relative px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 
                                data-[state=on]:bg-primary/20 data-[state=on]:text-primary-foreground data-[state=on]:shadow-inner
                                data-[state=off]:text-muted-foreground hover:text-primary-foreground flex items-center gap-2"
              >
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                Live View
              </ToggleGroupItem>
              <ToggleGroupItem
                value="Events"
                className="relative px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                                data-[state=on]:bg-primary/20 data-[state=on]:text-primary-foreground data-[state=on]:shadow-inner
                                data-[state=off]:text-muted-foreground hover:text-primary-foreground"
              >
                Events
              </ToggleGroupItem>
              <ToggleGroupItem
                value="Mood"
                className="relative px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                                data-[state=on]:bg-primary/20 data-[state=on]:text-primary-foreground data-[state=on]:shadow-inner
                                data-[state=off]:text-muted-foreground hover:text-primary-foreground"
              >
                Mood Map
              </ToggleGroupItem>
              <ToggleGroupItem
                value="EVHubs"
                className="relative px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                                data-[state=on]:bg-primary/20 data-[state=on]:text-primary-foreground data-[state=on]:shadow-inner
                                data-[state=off]:text-muted-foreground hover:text-primary-foreground"
              >
                EV Hubs
              </ToggleGroupItem>

              <ToggleGroupItem
                value="Community"
                className="relative px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                                data-[state=on]:bg-primary/20 data-[state=on]:text-primary-foreground data-[state=on]:shadow-inner
                                data-[state=off]:text-muted-foreground hover:text-primary-foreground"
              >
                Community
              </ToggleGroupItem>
            </ToggleGroup>
            <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent opacity-50"></div>
          </div>
        </div>

        {/* Bottom Right Quick Actions */}

        {/* Area Moods List: Only show in Mood mode */}
        {mapMode === "Mood" && displayAreaMoods.length > 0 && (
          <div className="fixed right-4 top-36 z-20 bg-card/80 backdrop-blur-sm p-3 rounded-lg border border-border/50 shadow-md max-w-xs">
            <h5 className="text-xs font-medium mb-2">Area Moods</h5>
            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
              {displayAreaMoods.map((area) => (
                <div
                  key={area.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span
                      style={{ background: MOOD_COLORS[area.sentiment] }}
                      className="w-3 h-3 rounded-sm inline-block border"
                    />
                    <span className="font-medium">{area.area}</span>
                  </div>
                  <span className="text-muted-foreground capitalize text-xs">
                    {area.sentiment}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Events Panel (top-right) */}
        {mapMode === "Events" && (
          <div className="fixed right-4 top-20 z-20 bg-card/80 backdrop-blur-sm p-3 rounded-lg border border-border/50 shadow-md w-80 max-h-[calc(100vh-160px)] overflow-hidden">
            <h5 className="text-sm font-medium mb-2">Events</h5>
            <div className="overflow-y-auto max-h-[calc(100vh-200px)] space-y-3">
              {/* Events Section */}
              <div>
                <div className="text-xs text-muted-foreground mb-2">Events</div>
                <div className="space-y-2">
                  {getAllData().events.length === 0 ? (
                    <div className="text-xs text-muted-foreground">
                      No events
                    </div>
                  ) : (
                    getAllData().events.map((ev: any) => {
                      const name =
                        ev.event_name ?? ev.name ?? ev.title ?? "Event";
                      const desc =
                        ev.event_description ??
                        ev.description ??
                        ev.venue ??
                        "";
                      const coords = ev.location?.coordinates;
                      return (
                        <div
                          key={ev.id}
                          className="p-2 border border-border/10 rounded-md hover:bg-accent/5 cursor-pointer"
                          onClick={() => {
                            const m = mapRef?.getMap?.();
                            if (m && coords) {
                              m.flyTo({
                                center: coords,
                                zoom: 14,
                                essential: true,
                              });
                            }
                          }}
                        >
                          <div className="font-medium text-sm">{name}</div>
                          {desc && (
                            <div className="text-xs text-muted-foreground truncate">
                              {desc}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* EV Hubs Panel (top-right) */}
        {mapMode === "EVHubs" && (
          <div className="fixed right-4 top-20 z-20 bg-card/80 backdrop-blur-sm p-3 rounded-lg border border-border/50 shadow-md w-80 max-h-[calc(100vh-160px)] overflow-hidden">
            <h5 className="text-sm font-medium mb-2">EV Charging Hubs</h5>
            <div className="overflow-y-auto max-h-[calc(100vh-200px)] space-y-3">
              {evLoading ? (
                <div className="text-xs text-muted-foreground">
                  Loading EV hubs...
                </div>
              ) : evError ? (
                <div className="text-xs text-destructive">
                  Failed to load: {evError}
                </div>
              ) : evHubs.length === 0 ? (
                <div className="text-xs text-muted-foreground">No EV hubs</div>
              ) : (
                evHubs.map((hub: any) => {
                  const coords = hub.location?.coordinates;
                  return (
                    <div
                      key={hub.id}
                      className="p-2 border border-border/10 rounded-md hover:bg-accent/5 cursor-pointer"
                      onClick={() => {
                        const m = mapRef?.getMap?.();
                        if (m && coords) {
                          m.flyTo({
                            center: coords,
                            zoom: 15,
                            essential: true,
                          });
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">{hub.name}</div>
                          {hub.address && (
                            <div className="text-xs text-muted-foreground">
                              {hub.address}
                            </div>
                          )}
                          {hub.operator && (
                            <div className="text-xs text-muted-foreground">
                              Operator: {hub.operator}
                            </div>
                          )}
                          {hub.type && (
                            <div className="text-xs text-muted-foreground">
                              Type: {hub.type}
                            </div>
                          )}
                        </div>
                        {/* availability/status removed */}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Details Sheet */}
        <IncidentSheet
          feature={selectedFeature}
          isOpen={isSheetOpen}
          onOpenChange={setSheetOpen}
        />

        {/* ensure chat is mounted in all views */}
        <ChatBot />

        {/* show inline community help panel when community mode is active */}
        {mapMode === "Community" && (
          <CommunityHelp
            mapRef={mapRef}
            open={true}
            onClose={() => setMapMode("Live")}
            inline
          />
        )}

        {/* COMMUNITY: bottom-right/side list of reports (visible in Community mode) */}
        {mapMode === "Community" && (
          <div className="fixed left-4 top-20 z-30 bg-card/90 backdrop-blur-sm p-3 rounded-lg border border-border/60 shadow-md w-80 max-h-[calc(100vh-160px)] overflow-hidden">
            <h5 className="text-sm font-medium mb-2">Community Requests</h5>

            <div className="overflow-y-auto max-h-[calc(100vh-220px)] space-y-2">
              {communityLoading ? (
                <div className="text-xs text-muted-foreground">Loading...</div>
              ) : !communityFeatures ||
                communityFeatures.features.length === 0 ? (
                <div className="text-xs text-muted-foreground">No requests</div>
              ) : (
                communityFeatures.features.map((f: any) => {
                  const p = f.properties || {};
                  return (
                    <div
                      key={p.id ?? JSON.stringify(p)}
                      className="p-2 border border-border/10 rounded-md hover:bg-accent/5 cursor-pointer"
                      onClick={() => {
                        setSelectedCommunity(p);
                        // fly to the report on the map if mapRef available
                        try {
                          const m =
                            mapRef?.getMap?.() ||
                            (mapRef as any)?.current?.getMap?.();
                          if (m && p.lng != null && p.lat != null) {
                            m.flyTo({
                              center: [Number(p.lng), Number(p.lat)],
                              zoom: 15,
                              essential: true,
                            });
                          }
                        } catch (e) {
                          console.warn("FlyTo failed", e);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium text-sm">
                            {p.title ?? "Untitled"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {p.area ?? ""}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {p.description}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {p.created_at
                            ? new Date(p.created_at).toLocaleString()
                            : ""}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Sidebar: details shown when a community polygon / item is selected */}
        {selectedCommunity && (
          <div className="fixed left-96 top-20 z-40 bg-card/95 backdrop-blur-sm p-4 rounded-lg border border-border/60 shadow-md w-80 max-h-[calc(100vh-160px)] overflow-auto">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-semibold text-lg">
                  {selectedCommunity.title}
                </h4>
                <div className="text-xs text-muted-foreground">
                  {selectedCommunity.area}
                </div>
              </div>
              <button
                onClick={() => setSelectedCommunity(null)}
                className="text-sm text-muted-foreground"
              >
                Close
              </button>
            </div>

            <div className="mt-3 text-sm">
              <div className="text-xs text-muted-foreground">Description</div>
              <div className="mt-1">{selectedCommunity.description}</div>

              <div className="mt-3 text-xs text-muted-foreground">Response</div>
              <div className="mt-1">{selectedCommunity.response ?? "—"}</div>

              <div className="mt-3 text-xs text-muted-foreground">Reported</div>
              <div className="mt-1">
                {selectedCommunity.created_at
                  ? new Date(selectedCommunity.created_at).toLocaleString()
                  : "—"}
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

// Sub-components for controls
const LayerControls = ({
  activeLayers,
  onToggle,
}: {
  activeLayers: Set<MapLayerId>;
  onToggle: (id: MapLayerId) => void;
}) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        size="icon"
        className="rounded-full h-11 w-11 bg-card/80 backdrop-blur-sm border-border/50 shadow-lg hover:bg-accent/80"
      >
        <Layers />
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-60 mr-4 bg-popover/80 backdrop-blur-sm border-border/50">
      <div className="grid gap-4">
        <div className="space-y-2">
          <h4 className="font-medium leading-none">Map Layers</h4>
          <p className="text-sm text-muted-foreground">
            Toggle layers visibility.
          </p>
        </div>
        <Separator />
        <div className="grid gap-2">
          {ALL_LAYERS.map((layer) => (
            <div key={layer.id} className="flex items-center space-x-2">
              <Checkbox
                id={layer.id}
                checked={activeLayers.has(layer.id)}
                onCheckedChange={() => onToggle(layer.id)}
              />
              <Label htmlFor={layer.id} className="font-normal">
                {layer.name}
              </Label>
            </div>
          ))}
        </div>
      </div>
    </PopoverContent>
  </Popover>
);

const FilterControls = ({
  severityFilter,
  onToggleSeverity,
}: {
  severityFilter: Set<Severity>;
  onToggleSeverity: (s: Severity) => void;
}) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        size="icon"
        className="rounded-full h-11 w-11 bg-card/80 backdrop-blur-sm border-border/50 shadow-lg hover:bg-accent/80"
      >
        <SlidersHorizontal />
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-60 mr-4 bg-popover/80 backdrop-blur-sm border-border/50">
      <div className="grid gap-4">
        <div className="space-y-2">
          <h4 className="font-medium leading-none">Filters</h4>
          <p className="text-sm text-muted-foreground">
            Refine visible incidents.
          </p>
        </div>
        <Separator />
        <div className="space-y-2">
          <h5 className="text-xs font-medium text-muted-foreground">
            SEVERITY
          </h5>
          {SEVERITIES.map((severity) => (
            <div key={severity} className="flex items-center space-x-2">
              <Checkbox
                id={severity}
                checked={severityFilter.has(severity)}
                onCheckedChange={() => onToggleSeverity(severity)}
              />
              <Label htmlFor={severity} className="font-normal">
                {severity}
              </Label>
            </div>
          ))}
        </div>
      </div>
    </PopoverContent>
  </Popover>
);

const ProfileControl = () => (
  <Popover>
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        size="icon"
        className="rounded-full h-11 w-11 bg-card/80 backdrop-blur-sm border-border/50 shadow-lg hover:bg-accent/80"
      >
        <User />
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-60 mr-4 bg-popover/80 backdrop-blur-sm border-border/50">
      <div className="grid gap-2 text-sm">
        <Button variant="ghost" className="justify-start">
          Saved Areas
        </Button>
        <Button variant="ghost" className="justify-start">
          Preferences
        </Button>
        <Separator />
        <Button variant="ghost" className="justify-start">
          About City Pulse
        </Button>
      </div>
    </PopoverContent>
  </Popover>
);

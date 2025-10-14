"use client";

import * as React from 'react';
import type { MapRef } from 'react-map-gl';

import { MapComponent } from './map-component';
import { IncidentSheet } from './incident-sheet';
import { useAreaMood, MOOD_COLORS } from '@/lib/useAreaMood';
import type { Incident, CivicIssue, Event, MapLayer, MapLayerId, MapMode, Severity, TrafficData, SentimentData, AreaMood } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Search, Layers, SlidersHorizontal, User, Plus, Compass, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TooltipProvider } from '@/components/ui/tooltip';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const ALL_LAYERS: MapLayer[] = [
    { id: 'incidents', name: 'Incidents' },
    { id: 'civic-issues', name: 'Civic Issues' },
    { id: 'events', name: 'Events' },
    { id: 'traffic', name: 'Traffic' },
    { id: 'sentiment', name: 'Sentiment' },
];

const SEVERITIES: Severity[] = ['Info', 'Minor', 'Major', 'Critical'];

type Feature = Incident | CivicIssue | Event;

// Main Dashboard Component
export function MapDashboard() {
    // Fetch all data from Supabase using custom hooks
    const { areas: areaMoods, loading: areaLoading, error: areaError } = useAreaMood();

    const [mapRef, setMapRef] = React.useState<MapRef | null>(null);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [isSearching, setIsSearching] = React.useState(false);

    // State Management with localStorage persistence
    const [mapMode, setMapMode] = React.useState<MapMode>(() => {
        if (typeof window !== 'undefined') {
            const savedMode = localStorage.getItem('mapMode');
            return (savedMode as MapMode) || 'Live';
        }
        return 'Live';
    });
    
    // Save mapMode to localStorage when it changes
    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('mapMode', mapMode);
        }
    }, [mapMode]);
    
    const [manualActiveLayers, setManualActiveLayers] = React.useState<Set<MapLayerId>>(() => {
        if (typeof window !== 'undefined') {
            const savedLayers = localStorage.getItem('activeLayers');
            return savedLayers ? new Set(JSON.parse(savedLayers)) : new Set<MapLayerId>();
        }
        return new Set<MapLayerId>();
    });
    
    // Save activeLayers to localStorage when it changes
    React.useEffect(() => {
        if (typeof window !== 'undefined' && manualActiveLayers.size > 0) {
            localStorage.setItem('activeLayers', JSON.stringify(Array.from(manualActiveLayers)));
        }
    }, [manualActiveLayers]);
    
    const activeLayers = React.useMemo(() => {
        // If we have manually toggled layers, use those
        if (manualActiveLayers.size > 0) {
            return manualActiveLayers;
        }
        
        // Otherwise use defaults based on mode
        switch (mapMode) {
            case 'Live':
                return new Set<MapLayerId>(['traffic']);
            case 'Events':
                return new Set<MapLayerId>(['events']);
            case 'Mood':
                return new Set<MapLayerId>(['sentiment']);
            default:
                return new Set<MapLayerId>();
        }
    }, [mapMode, manualActiveLayers]);
    const [selectedFeature, setSelectedFeature] = React.useState<Feature | null>(null);
    const [isSheetOpen, setSheetOpen] = React.useState(false);
    const [isSearchFocused, setSearchFocused] = React.useState(false);

    // Filters
    const [severityFilter, setSeverityFilter] = React.useState<Set<Severity>>(() => new Set(SEVERITIES));
    const { toast } = useToast();

    // Handle errors
    React.useEffect(() => {
        if (areaError) {
            toast({
                title: "Data loading error",
                description: `Failed to load area mood data: ${areaError.message || 'Unknown error'}`,
                variant: "destructive"
            });
        }
    }, [areaError, toast]);

    // Only area moods are used now

    // Combine area moods with sentiment data for display
    const displayAreaMoods = React.useMemo(() => {
        return areaMoods.map(mood => ({
            ...mood,
            description: mood.description || `Area mood: ${mood.sentiment}`
        }));
    }, [areaMoods]);

    // Handlers
    const handleFeatureClick = React.useCallback((feature: any) => {
        if (feature.score) return; // Don't open sheet for sentiment polygons
        setSelectedFeature(feature);
        setSheetOpen(true);
    }, []);
    
    const handleMapLoad = React.useCallback((map: MapRef) => {
        setMapRef(map);
    }, []);

    const geocodeAndFly = React.useCallback(async (query: string) => {
        const q = query.trim();
        if (!q) return;
        if (!MAPBOX_TOKEN) {
            toast({ title: 'Mapbox token missing', description: 'Set NEXT_PUBLIC_MAPBOX_TOKEN in .env.local', variant: 'destructive' });
            return;
        }
        try {
            setIsSearching(true);
            const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX_TOKEN}&limit=1&types=place,poi,locality,neighborhood,address&proximity=80.2785,13.06`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('Failed to search');
            const data = await res.json();
            const feature = data?.features?.[0];
            if (!feature?.center) {
                toast({ title: 'No results', description: 'Try a different place or address.' });
                return;
            }
            const [lng, lat] = feature.center as [number, number];
            const map = mapRef?.getMap();
            map?.flyTo({ center: [lng, lat], zoom: 14, essential: true });
        } catch (err) {
            toast({ title: 'Search failed', description: 'Please try again in a moment.', variant: 'destructive' });
        } finally {
            setIsSearching(false);
        }
    }, [mapRef, toast]);

    const toggleLayer = (layerId: MapLayerId) => {
        setManualActiveLayers(prev => {
            // Start with current active layers if this is first manual toggle
            const newLayers = prev.size === 0 ? new Set(activeLayers) : new Set(prev);
            
            if (newLayers.has(layerId)) {
                newLayers.delete(layerId);
            } else {
                newLayers.add(layerId);
            }
            return newLayers;
        });
    };

    const toggleSeverity = (severity: Severity) => {
        setSeverityFilter(prev => {
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
                        incidents={[]}
                        civicIssues={[]}
                        events={[]}
                        traffic={[]}
                        sentiment={[]}
                        areaMoods={displayAreaMoods}
                        activeLayers={activeLayers}
                        onFeatureClick={handleFeatureClick}
                        onMapLoad={handleMapLoad}
                        mapMode={mapMode}
                    />
                )}

                {/* Top Header Controls */}
                <header className={cn("fixed top-0 left-0 right-0 p-3 sm:p-4 z-10 flex items-start justify-between gap-4 transition-all duration-300",
                    isSearchFocused && "bg-background/80 backdrop-blur-sm flex-col sm:flex-row")}>
                    
                    {/* Search Bar */}
                    <div className={cn("relative transition-all duration-300 w-full max-w-xs sm:max-w-sm", isSearchFocused && "max-w-full")}> 
                         <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                            placeholder="Search areas, roads, wards..."
                            className="pl-10 h-11 rounded-full bg-card/80 backdrop-blur-sm border-border/50 shadow-lg focus:bg-card/95 focus:ring-primary"
                            onFocus={() => setSearchFocused(true)}
                            onBlur={() => setSearchFocused(false)}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    geocodeAndFly(searchQuery);
                                }
                            }}
                        />
                    </div>
                    
                    {/* Right Controls */}
                    <div className={cn("flex items-center gap-2", isSearchFocused && "self-end")}>
                        <ProfileControl />
                    </div>
                </header>

                {/* Bottom Center Context Switcher */}
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-10">
                    <div className="bg-background/10 backdrop-blur-md p-1.5 rounded-2xl shadow-xl border border-white/10 relative overflow-hidden">
                        <ToggleGroup
                            type="single"
                            value={mapMode}
                            onValueChange={(value: MapMode) => {
                                if (value) {
                                    setMapMode(value);
                                    // Reset manual layers when changing modes
                                    setManualActiveLayers(new Set());
                                }
                            }}
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
                        </ToggleGroup>
                        <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent opacity-50"></div>
                    </div>
                </div>

                {/* Bottom Right Quick Actions */}
                <QuickActionsFab toast={toast} />

                {/* Area Moods List: Only show in Mood mode */}
                {mapMode === 'Mood' && displayAreaMoods.length > 0 && (
                    <div className="fixed right-4 top-36 z-20 bg-card/80 backdrop-blur-sm p-3 rounded-lg border border-border/50 shadow-md max-w-xs">
                        <h5 className="text-xs font-medium mb-2">Area Moods</h5>
                        <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                            {displayAreaMoods.map((area) => (
                                <div key={area.id} className="flex items-center justify-between text-sm">
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

                {/* Details Sheet */}
                <IncidentSheet
                    feature={selectedFeature}
                    isOpen={isSheetOpen}
                    onOpenChange={setSheetOpen}
                />
            </div>
        </TooltipProvider>
    );
}

// Sub-components for controls
const LayerControls = ({ activeLayers, onToggle }: { activeLayers: Set<MapLayerId>, onToggle: (id: MapLayerId) => void }) => (
    <Popover>
        <PopoverTrigger asChild>
             <Button variant="outline" size="icon" className="rounded-full h-11 w-11 bg-card/80 backdrop-blur-sm border-border/50 shadow-lg hover:bg-accent/80"><Layers /></Button>
        </PopoverTrigger>
        <PopoverContent className="w-60 mr-4 bg-popover/80 backdrop-blur-sm border-border/50">
            <div className="grid gap-4">
                <div className="space-y-2">
                    <h4 className="font-medium leading-none">Map Layers</h4>
                    <p className="text-sm text-muted-foreground">Toggle layers visibility.</p>
                </div>
                <Separator />
                <div className="grid gap-2">
                    {ALL_LAYERS.map(layer => (
                        <div key={layer.id} className="flex items-center space-x-2">
                            <Checkbox id={layer.id} checked={activeLayers.has(layer.id)} onCheckedChange={() => onToggle(layer.id)} />
                            <Label htmlFor={layer.id} className="font-normal">{layer.name}</Label>
                        </div>
                    ))}
                </div>
            </div>
        </PopoverContent>
    </Popover>
);

const FilterControls = ({ severityFilter, onToggleSeverity }: { severityFilter: Set<Severity>, onToggleSeverity: (s: Severity) => void}) => (
     <Popover>
        <PopoverTrigger asChild>
             <Button variant="outline" size="icon" className="rounded-full h-11 w-11 bg-card/80 backdrop-blur-sm border-border/50 shadow-lg hover:bg-accent/80"><SlidersHorizontal /></Button>
        </PopoverTrigger>
        <PopoverContent className="w-60 mr-4 bg-popover/80 backdrop-blur-sm border-border/50">
            <div className="grid gap-4">
                <div className="space-y-2">
                    <h4 className="font-medium leading-none">Filters</h4>
                    <p className="text-sm text-muted-foreground">Refine visible incidents.</p>
                </div>
                <Separator />
                <div className="space-y-2">
                    <h5 className="text-xs font-medium text-muted-foreground">SEVERITY</h5>
                    {SEVERITIES.map(severity => (
                         <div key={severity} className="flex items-center space-x-2">
                            <Checkbox id={severity} checked={severityFilter.has(severity)} onCheckedChange={() => onToggleSeverity(severity)} />
                            <Label htmlFor={severity} className="font-normal">{severity}</Label>
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
             <Button variant="outline" size="icon" className="rounded-full h-11 w-11 bg-card/80 backdrop-blur-sm border-border/50 shadow-lg hover:bg-accent/80"><User /></Button>
        </PopoverTrigger>
        <PopoverContent className="w-60 mr-4 bg-popover/80 backdrop-blur-sm border-border/50">
            <div className="grid gap-2 text-sm">
                <Button variant="ghost" className="justify-start">Saved Areas</Button>
                <Button variant="ghost" className="justify-start">Preferences</Button>
                <Separator />
                <Button variant="ghost" className="justify-start">About City Pulse</Button>
            </div>
        </PopoverContent>
    </Popover>
);

const QuickActionsFab = ({ toast }: { toast: any }) => (
    <div className="fixed bottom-4 right-4 z-10 flex flex-col items-end gap-3">
        <Popover>
            <PopoverTrigger asChild>
                 <Button size="icon" className="rounded-full h-14 w-14 shadow-lg shadow-primary/30"><Plus className="h-6 w-6" /></Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-auto p-2 mb-2 flex flex-col gap-2 bg-transparent border-none shadow-none">
                 <Tooltip>
                    <TooltipTrigger asChild>
                        <Button 
                          variant="secondary" 
                          size="icon" 
                          className="rounded-full h-12 w-12"
                          onClick={() => toast({ title: "Snapshot shared!", description: "A link to the current map view has been copied." })}
                        >
                            <Share2 />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left"><p>Share Snapshot</p></TooltipContent>
                </Tooltip>
                 <Tooltip>
                    <TooltipTrigger asChild>
                         <Button 
                            variant="secondary" 
                            size="icon" 
                            className="rounded-full h-12 w-12"
                            onClick={() => toast({ title: "Area saved!", description: "Current map view has been saved to your areas." })}
                        >
                            <Compass />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left"><p>Save Area</p></TooltipContent>
                </Tooltip>
            </PopoverContent>
        </Popover>
    </div>
);
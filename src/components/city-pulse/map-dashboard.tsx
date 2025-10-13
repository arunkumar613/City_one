"use client";

import * as React from 'react';
import type { MapRef } from 'react-map-gl';

import { MapComponent } from './map-component';
import { IncidentSheet } from './incident-sheet';
import { getAllData } from '@/lib/data';
import type { Incident, CivicIssue, Event, MapLayer, MapLayerId, MapMode, Severity } from '@/lib/types';

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
import { TooltipProvider } from '@radix-ui/react-tooltip';

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
    const [data] = React.useState(getAllData());
    const [filteredData, setFilteredData] = React.useState(data);
    const [mapRef, setMapRef] = React.useState<MapRef | null>(null);

    // State Management
    const [activeLayers, setActiveLayers] = React.useState<Set<MapLayerId>>(() => new Set(['incidents', 'civic-issues']));
    const [mapMode, setMapMode] = React.useState<MapMode>('Live');
    const [selectedFeature, setSelectedFeature] = React.useState<Feature | null>(null);
    const [isSheetOpen, setSheetOpen] = React.useState(false);
    const [isSearchFocused, setSearchFocused] = React.useState(false);

    // Filters
    const [severityFilter, setSeverityFilter] = React.useState<Set<Severity>>(() => new Set(SEVERITIES));
    const { toast } = useToast();

    // Handlers
    const handleFeatureClick = React.useCallback((feature: any) => {
        setSelectedFeature(feature);
        setSheetOpen(true);
    }, []);
    
    const handleMapLoad = React.useCallback((map: MapRef) => {
        setMapRef(map);
    }, []);

    const toggleLayer = (layerId: MapLayerId) => {
        setActiveLayers(prev => {
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

    // Effect for filtering data
    React.useEffect(() => {
        const incidents = data.incidents.filter(inc => severityFilter.has(inc.severity));
        setFilteredData({ ...data, incidents });
    }, [severityFilter, data]);

    return (
        <TooltipProvider>
            <div className="relative h-screen w-screen bg-background text-foreground">
                <MapComponent
                    incidents={filteredData.incidents}
                    civicIssues={filteredData.civicIssues}
                    events={filteredData.events}
                    activeLayers={activeLayers}
                    onFeatureClick={handleFeatureClick}
                    onMapLoad={handleMapLoad}
                />

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
                        />
                    </div>
                    
                    {/* Right Controls */}
                    <div className={cn("flex items-center gap-2", isSearchFocused && "self-end")}>
                        <LayerControls activeLayers={activeLayers} onToggle={toggleLayer} />
                        <FilterControls severityFilter={severityFilter} onToggleSeverity={toggleSeverity} />
                        <ProfileControl />
                    </div>
                </header>

                {/* Bottom Center Context Switcher */}
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-10">
                    <ToggleGroup
                        type="single"
                        defaultValue="Live"
                        value={mapMode}
                        onValueChange={(value: MapMode) => value && setMapMode(value)}
                        className="bg-card/80 backdrop-blur-sm p-1 rounded-full shadow-lg border border-border/50"
                    >
                        <ToggleGroupItem value="Live" className="rounded-full px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Live</ToggleGroupItem>
                        <ToggleGroupItem value="Predict" className="rounded-full px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Predict</ToggleGroupItem>
                        <ToggleGroupItem value="Mood" className="rounded-full px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Mood</ToggleGroupItem>
                    </ToggleGroup>
                </div>

                {/* Bottom Right Quick Actions */}
                <QuickActionsFab toast={toast} />

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

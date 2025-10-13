"use client";

import * as React from 'react';
import Map, { Layer, MapLayerMouseEvent, Source, ViewState, NavigationControl, GeolocateControl } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { MapRef } from 'react-map-gl';
import type { Incident, CivicIssue, Event, MapLayerId } from '@/lib/types';
import { LngLatBounds } from 'mapbox-gl';

// It's recommended to store this in an environment variable
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

type GeoJSONSourceData = GeoJSON.FeatureCollection<GeoJSON.Point, Incident | CivicIssue | Event>;

interface MapComponentProps {
  incidents: Incident[];
  civicIssues: CivicIssue[];
  events: Event[];
  activeLayers: Set<MapLayerId>;
  onFeatureClick: (feature: any) => void;
  onMapLoad: (map: MapRef) => void;
}

const severityColorMap = {
    'Critical': 'hsl(var(--destructive))',
    'Major': '#FF7F50',
    'Minor': '#FFD166',
    'Info': 'hsl(var(--primary))',
};

// This converts your data into a GeoJSON format that Mapbox can read
const toGeoJSON = (items: (Incident | CivicIssue | Event)[], idPrefix: string): GeoJSONSourceData => ({
    type: 'FeatureCollection',
    features: items.map(item => ({
        type: 'Feature',
        geometry: item.location,
        properties: { ...item, id: `${idPrefix}-${item.id}` },
    })),
});

export function MapComponent({ incidents, civicIssues, events, activeLayers, onFeatureClick, onMapLoad }: MapComponentProps) {
    const mapRef = React.useRef<MapRef>(null);

    React.useEffect(() => {
        if (!MAPBOX_TOKEN) {
            console.error("Mapbox token is not set. Please set NEXT_PUBLIC_MAPBOX_TOKEN in your environment variables.");
        }
    }, []);

    const initialViewState: Partial<ViewState> = {
        longitude: 80.2785,
        latitude: 13.06,
        zoom: 12,
        pitch: 45,
    };

    const incidentsSource = React.useMemo(() => toGeoJSON(incidents, 'inc'), [incidents]);
    const civicIssuesSource = React.useMemo(() => toGeoJSON(civicIssues, 'civ'), [civicIssues]);
    const eventsSource = React.useMemo(() => toGeoJSON(events, 'evt'), [events]);

    const handleFeatureClick = (event: MapLayerMouseEvent) => {
        if (event.features && event.features.length > 0) {
            const feature = event.features[0];
            if (feature.properties?.cluster) {
                const clusterId = feature.properties.cluster_id;
                const map = mapRef.current?.getMap();
                const source = map?.getSource('incidents') as mapboxgl.GeoJSONSource | undefined;
                if (!source) return;

                source.getClusterExpansionZoom(clusterId, (err, zoom) => {
                    if (err) return;
                    map.easeTo({
                        center: (feature.geometry as GeoJSON.Point).coordinates as [number, number],
                        zoom: zoom + 1,
                    });
                });
            } else {
                onFeatureClick(JSON.parse(feature.properties?.data || '{}'));
            }
        }
    };
    
    const onInternalLoad = () => {
      if (mapRef.current) {
        onMapLoad(mapRef.current);
      }
    };
    
    return (
        <Map
            ref={mapRef}
            mapboxAccessToken={MAPBOX_TOKEN}
            initialViewState={initialViewState}
            style={{ width: '100%', height: '100%' }}
            mapStyle="mapbox://styles/mapbox/dark-v11"
            interactiveLayerIds={['unclustered-incidents', 'clusters', 'civic-issue-points', 'event-points']}
            onClick={handleFeatureClick}
            onLoad={onInternalLoad}
        >
            <GeolocateControl position="bottom-right" />
            <NavigationControl position="bottom-right" />

            {/* Incidents Layer with Clustering */}
            {activeLayers.has('incidents') && (
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
                        filter={['has', 'point_count']}
                        paint={{
                            'circle-color': [
                                'step',
                                ['get', 'point_count'],
                                '#51bbd6',
                                100,
                                '#f1f075',
                                750,
                                '#f28cb1'
                            ],
                            'circle-radius': ['step', ['get', 'point_count'], 20, 100, 30, 750, 40],
                            'circle-stroke-width': 2,
                            'circle-stroke-color': 'hsl(var(--border))',
                        }}
                    />
                    <Layer
                        id="cluster-count"
                        type="symbol"
                        source="incidents"
                        filter={['has', 'point_count']}
                        layout={{
                            'text-field': '{point_count_abbreviated}',
                            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
                            'text-size': 12
                        }}
                        paint={{
                            "text-color": "hsl(var(--background))"
                        }}
                    />
                    <Layer
                        id="unclustered-incidents"
                        type="circle"
                        source="incidents"
                        filter={['!', ['has', 'point_count']]}
                        paint={{
                            'circle-color': [
                                'match',
                                ['get', 'severity', ['get', 'properties']],
                                'Critical', severityColorMap.Critical,
                                'Major', severityColorMap.Major,
                                'Minor', severityColorMap.Minor,
                                severityColorMap.Info
                            ],
                            'circle-radius': 8,
                            'circle-stroke-width': 2,
                            'circle-stroke-color': '#ffffff',
                            'circle-opacity': 0.8
                        }}
                    />
                     <Layer
                        id="unclustered-incidents-fresh-glow"
                        type="circle"
                        source="incidents"
                        filter={['all', ['!', ['has', 'point_count']], ['==', ['get', 'isFresh', ['get', 'properties']], true]]}
                        paint={{
                            'circle-radius': 16,
                            'circle-color': [
                                'match',
                                ['get', 'severity', ['get', 'properties']],
                                'Critical', severityColorMap.Critical,
                                'Major', severityColorMap.Major,
                                'Minor', severityColorMap.Minor,
                                severityColorMap.Info
                            ],
                            'circle-opacity': 0.3,
                            'circle-blur': 0.8
                        }}
                    />
                </Source>
            )}

            {activeLayers.has('civic-issues') && (
                <Source id="civic-issues" type="geojson" data={civicIssuesSource}>
                    <Layer
                        id="civic-issue-points"
                        type="symbol"
                        source="civic-issues"
                        layout={{
                            'icon-image': [
                                'match',
                                ['get', 'category', ['get', 'properties']],
                                'Pothole', 'roadblock',
                                'Garbage', 'waste-basket',
                                'Water', 'water',
                                'Electricity', 'danger',
                                'circle-15'
                            ],
                            'icon-size': 0.8,
                            'icon-allow-overlap': true,
                        }}
                        paint={{
                           'icon-color': "hsl(var(--primary))"
                        }}
                    />
                </Source>
            )}

            {activeLayers.has('events') && (
                 <Source id="events" type="geojson" data={eventsSource}>
                    <Layer
                        id="event-points"
                        type="symbol"
                        source="events"
                        layout={{
                            'icon-image': 'star',
                            'icon-size': 1,
                            'icon-allow-overlap': true,
                        }}
                        paint={{
                           'icon-color': "#FFD166" // Minor severity color
                        }}
                    />
                </Source>
            )}
        </Map>
    );
}

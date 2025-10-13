export type Severity = 'Info' | 'Minor' | 'Major' | 'Critical';

export interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface Incident {
  id: string;
  type: string;
  severity: Severity;
  timestamp: string;
  location: GeoJSONPoint;
  description: string;
  mediaUrls: string[];
  ward: string;
}

export interface CivicIssue {
  id: string;
  category: 'Pothole' | 'Garbage' | 'Water' | 'Electricity';
  status: 'Reported' | 'In-Progress' | 'Resolved';
  severity: Severity;
  location: GeoJSONPoint;
  updatedAt: string;
  description: string;
}

export interface Event {
  id: string;
  name: string;
  venue: string;
  startTime: string;
  predictedDensity: number; // 0-1
  location: GeoJSONPoint;
}

export interface TrafficData {
  roadId: string;
  congestionLevel: number; // 0-1
  coordinates: number[][];
}

export interface SentimentData {
  gridId: string;
  score: number; // -1 to 1
  polygon: number[][][];
}

export type MapLayerId = 'traffic' | 'incidents' | 'civic-issues' | 'events' | 'sentiment';

export type MapLayer = {
  id: MapLayerId;
  name: string;
};

export type MapMode = 'Live' | 'Mood';

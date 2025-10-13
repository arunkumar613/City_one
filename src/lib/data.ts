import incidentsData from './mock/incidents.json';
import civicIssuesData from './mock/civic-issues.json';
import eventsData from './mock/events.json';
import trafficData from './mock/traffic.json';
import sentimentData from './mock/sentiment.json';

import type { Incident, CivicIssue, Event, TrafficData, SentimentData } from './types';

// In a real app, these would be API calls.
// For this frontend-only demo, we're importing JSON files.

export const getIncidents = (): Incident[] => {
    // Add a 'freshness' property for glowing effect
    const now = Date.now();
    return incidentsData.map(incident => ({
        ...incident,
        location: { type: 'Point', coordinates: incident.location.coordinates as [number, number] },
        isFresh: (now - new Date(incident.timestamp).getTime()) < 10 * 60 * 1000 // < 10 minutes old
    })) as Incident[];
};

export const getCivicIssues = (): CivicIssue[] => civicIssuesData as CivicIssue[];

export const getEvents = (): Event[] => eventsData as Event[];

export const getTrafficData = (): TrafficData[] => trafficData as TrafficData[];

export const getSentimentData = (): SentimentData[] => sentimentData as SentimentData[];

export const getAllData = () => ({
    incidents: getIncidents(),
    civicIssues: getCivicIssues(),
    events: getEvents(),
    traffic: getTrafficData(),
    sentiment: getSentimentData(),
});

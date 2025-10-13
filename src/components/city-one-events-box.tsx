"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface CityOneEvent {
  id: string;
  created_at: string;
  event_name: string;
  event_description: string;
}

export default function CityOneEventsBox() {
  const [events, setEvents] = useState<CityOneEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rawData, setRawData] = useState<any>(null);

  useEffect(() => {
    async function fetchEvents() {
      const { data, error } = await supabase
        .from("city-one-events")
        .select("id, created_at, event_name, event_description")
        .order("created_at", { ascending: false });
      setRawData(data);
      if (error) {
        setErrorMsg(error.message);
        console.error("Error fetching events:", error);
      } else {
        setEvents(data || []);
        console.log("Fetched events data from Supabase:", data);
      }
      setLoading(false);
    }
    fetchEvents();
  }, []);

  return (
    <div style={{
      position: "fixed",
      top: 24,
      right: 24,
      zIndex: 1000,
      background: "#fff",
      borderRadius: 8,
      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
      padding: 16,
      minWidth: 320,
      maxHeight: "60vh",
      overflowY: "auto"
    }}>
      <h3 style={{ marginBottom: 12 }}>City One Events</h3>
      {loading ? (
        <div>Loading...</div>
      ) : errorMsg ? (
        <div style={{ color: 'red' }}>Error: {errorMsg}</div>
      ) : events.length === 0 ? (
        <div>No events found.</div>
      ) : (
        events.map(event => (
          <div key={event.id} style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: "bold" }}>{event.event_name}</div>
            <div style={{ fontSize: 12, color: "#888" }}>{new Date(event.created_at).toLocaleString()}</div>
            <div>{event.event_description}</div>
          </div>
        ))
      )}
      {rawData && (
        <details style={{ marginTop: 16 }}>
          <summary>Raw Supabase Data</summary>
          <pre style={{ fontSize: 12 }}>{JSON.stringify(rawData, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}

import * as React from "react";
import { supabase } from "./supabaseClient";

export type AreaMood = {
  id: string;
  area: string;
  sentiment:
    | "happy"
    | "sad"
    | "angry"
    | "neutral"
    | "super happy"
    | "super sad"
    | "super angry";
  description?: string;
  polygon?: number[][][];
};

// Color map for moods
export const MOOD_COLORS: Record<AreaMood["sentiment"], string> = {
  happy: "#2ecc71",
  sad: "#3498db",
  angry: "#e74c3c",
  neutral: "#95a5a6",
  "super happy": "#7bed9f",
  "super sad": "#1e3a8a",
  "super angry": "#8b0000",
};

export function useAreaMood(tableName = "city-one-table") {
  const [areas, setAreas] = React.useState<AreaMood[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<any>(null);

  React.useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        // Fetch all columns needed from city-one-table
        const { data, error } = await supabase
          .from(tableName)
          .select("id, area, sentiment, description, polygon, created_at")
          .order("created_at", { ascending: false });

        if (error) throw error;
        if (!isMounted) return;

        // Parse polygons if present
        const parsed = (data || []).map((row: any) => ({
          id: String(row.id),
          area: row.area,
          sentiment: (row.sentiment || "neutral") as AreaMood["sentiment"],
          description: row.description,
          polygon: row.polygon ? (typeof row.polygon === "string" ? JSON.parse(row.polygon) : row.polygon) : undefined,
          created_at: row.created_at,
        }));
        setAreas(parsed);
      } catch (err) {
        if (!isMounted) return;
        setError(err);
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    }

    load();

    // Realtime updates for city-one-table only
    const subscription = supabase
      .channel(`public:${tableName}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: tableName },
        (payload: any) => {
          const row = payload.new || payload.old;
          setAreas((prev) => {
            if (payload.eventType === "DELETE") {
              return prev.filter((p) => p.id !== String(row.id));
            }
            const updated: AreaMood = {
              id: String(row.id),
              area: row.area,
              sentiment: (row.sentiment || "neutral") as AreaMood["sentiment"],
              description: row.description,
              polygon: row.polygon ? (typeof row.polygon === "string" ? JSON.parse(row.polygon) : row.polygon) : undefined,
              created_at: row.created_at,
            };
            const existing = prev.some((p) => p.id === String(row.id));
            if (existing) {
              return prev.map((p) => (p.id === String(row.id) ? { ...p, ...updated } : p));
            } else {
              return [...prev, updated];
            }
          });
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(subscription);
    };
  }, [tableName]);

  return { areas, loading, error };
}


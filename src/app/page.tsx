import { MapDashboard } from "@/components/city-pulse/map-dashboard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "City Pulse - Chennai Live",
  description:
    "An interactive map-first dashboard for live city monitoring in Chennai.",
};

import Link from "next/link";

export default function Home() {
  return (
    <div className="h-screen w-screen overflow-hidden">
      <nav style={{ position: "absolute", top: 16, right: 16, zIndex: 2000 }}>
        <Link href="/events" style={{ padding: "8px 16px", background: "#fff", borderRadius: 6, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", textDecoration: "none", color: "#222", fontWeight: 500 }}>Events</Link>
      </nav>
      <MapDashboard />
    </div>
  );
}

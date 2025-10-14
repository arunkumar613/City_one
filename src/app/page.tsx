import { MapDashboard } from "@/components/city-pulse/map-dashboard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chennai-One - Chennai Live",
  description:
    "An interactive map-first dashboard for live city monitoring in Chennai.",
};

import Link from "next/link";

export default function Home() {
  return (
    <div className="h-screen w-screen overflow-hidden">
      <nav style={{ position: "absolute", top: 16, right: 16, zIndex: 2000 }}>
        <div className="flex gap-2">
          <Link 
            href="/events" 
            className="px-3 py-1.5 bg-black/70 hover:bg-black/90 text-white text-sm rounded-lg transition-colors duration-200 backdrop-blur-sm"
          >
            Events
          </Link>
          <Link 
            href="/ev-hubs" 
            className="px-3 py-1.5 bg-green-600/70 hover:bg-green-600/90 text-white text-sm rounded-lg transition-colors duration-200 backdrop-blur-sm"
          >
            EV Hubs
          </Link>
        </div>
      </nav>
      <MapDashboard />
    </div>
  );
}

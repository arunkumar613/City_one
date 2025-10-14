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
        {/* Events link removed */}
      </nav>
      <MapDashboard />
    </div>
  );
}

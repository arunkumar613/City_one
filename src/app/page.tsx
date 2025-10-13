import { MapDashboard } from "@/components/city-pulse/map-dashboard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "City Pulse - Chennai Live",
  description:
    "An interactive map-first dashboard for live city monitoring in Chennai.",
};

export default function Home() {
  return (
    <div className="h-screen w-screen overflow-hidden">
      <MapDashboard />
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

// Leaflet needs the DOM — load the map only on the client.
const MapView = dynamic(() => import("@/components/map/MapView"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[calc(100vh-3.5rem-2.5rem)] place-items-center text-slate-500">
      Loading map…
    </div>
  ),
});

export default function MapPage() {
  return <Suspense fallback={<div>Loading map…</div>}><MapView /></Suspense>;
}

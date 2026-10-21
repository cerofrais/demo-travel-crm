"use client";

import { TripDetail } from "@/components/trips/trip-detail";

export default function TripDetailPage({ params }: { params: { id: string } }) {
  return <TripDetail tripId={params.id} />;
}

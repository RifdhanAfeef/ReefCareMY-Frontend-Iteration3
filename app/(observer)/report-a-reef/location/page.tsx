import type { Metadata } from "next";
import { LocationFlow } from "@/features/epic-04-location/location-flow";

export const metadata: Metadata = { title: "Observation location" };

export default function ObservationLocationPage() {
  return <LocationFlow />;
}

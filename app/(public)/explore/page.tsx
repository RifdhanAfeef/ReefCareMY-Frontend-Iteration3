import type { Metadata } from "next";
import { ReefExplorer } from "@/features/epic-02-reef-explorer/reef-explorer";

export const metadata: Metadata = {
  title: "Explore reef areas",
  description: "Explore selected Malaysian islands and named dive sites, responsible-observation guidance and public-safe ReefCare activity.",
};

export default function ReefExplorerPage() {
  return <ReefExplorer />;
}


import type { Metadata } from "next";
import { SiteHistoryPage } from "@/features/epic-08-context/site-history-page";

export const metadata: Metadata = { title: "Site conservation history" };

export default function CoordinatorSiteHistory() {
  return <SiteHistoryPage />;
}

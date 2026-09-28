import type { Metadata } from "next";
import { LandingPage } from "@/features/landing/landing-page";

export const metadata: Metadata = {
  title: "Community reef observation",
  description: "Learn how to report potential reef threats in Malaysia, protect sensitive locations and follow what happens next.",
};

export default function HomePage() {
  return <LandingPage />;
}

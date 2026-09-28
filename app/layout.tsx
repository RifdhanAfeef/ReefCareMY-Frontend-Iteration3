import type { Metadata } from "next";
import { Providers } from "./providers";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ReefCare MY",
    template: "%s | ReefCare MY",
  },
  description:
    "A Malaysia-focused platform for reporting and following up potential reef threats.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

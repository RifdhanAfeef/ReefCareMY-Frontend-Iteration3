"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function RouteFocusManager() {
  const pathname = usePathname();

  useEffect(() => {
    const heading = document.querySelector<HTMLElement>("main h1");
    if (!heading) return;

    heading.tabIndex = -1;
    heading.style.outline = "none";
    heading.style.outlineOffset = "0";
    heading.style.boxShadow = "none";
    heading.focus({ preventScroll: true });
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return null;
}

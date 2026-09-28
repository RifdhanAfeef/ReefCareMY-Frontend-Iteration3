import type { ReefImage } from "@/features/epic-02-reef-explorer/types";
import type { Area } from "./planning-data";

type SurfaceImage = ReefImage & { licenseUrl: string };
// Regional coastal photographs, never represented as exact dive-site or current-condition imagery.
export const surfaceImages: Record<Area, SurfaceImage> = {
  Perhentian: {
    src: "/images/reef-sites/surface/perhentian.jpg",
    alt: "Sea and beach at Perhentian Besar, a regional coastal view rather than the exact dive site",
    caption: "Perhentian Besar · Island coastal view",
    credit: "Vyacheslav Argenberg",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Perhentian_Islands,_Malaysia,_Beach.jpg",
  },
  Redang: {
    src: "/images/reef-sites/surface/redang.jpg",
    alt: "Sea and tropical shoreline at Pasir Panjang, Redang, a regional coastal view rather than the exact dive site",
    caption: "Redang · Island coastal view",
    credit: "Mukherjeesaikat",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Redang_Sea_Beach.jpg",
  },
  Tioman: {
    src: "/images/reef-sites/surface/tioman.jpg",
    alt: "Sea and beach on southern Tioman, a regional coastal view rather than the exact dive site",
    caption: "Tioman · Island coastal view",
    credit: "Singaporean",
    license: "Copyrighted free use",
    licenseUrl:
      "https://commons.wikimedia.org/wiki/File:Beach_of_Pulau_Tioman.JPG#Licensing",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Beach_of_Pulau_Tioman.JPG",
  },
};

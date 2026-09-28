export type ReefImage = {
  src: string;
  alt: string;
  caption: string;
  credit: string;
  license: string;
  sourceUrl: string;
};

export type ReefFeature = {
  title: string;
  description: string;
};

export type ReefSite = {
  id: string;
  backendDiveSiteId: number;
  name: string;
  island: "Perhentian" | "Redang" | "Tioman";
  publicAreaLabel: string;
  position: [number, number];
  introduction: string;
  images: ReefImage[];
  reefFeatures: ReefFeature[];
  marineLife: string[];
  popularReasons: string[];
  experience: {
    level: "Beginner" | "Intermediate" | "Experienced";
    explanation: string;
  };
  preparation: string[];
  source: {
    label: string;
    url: string;
  };
};

export type ReefSiteReference = Pick<
  ReefSite,
  "id" | "backendDiveSiteId" | "name" | "island" | "publicAreaLabel"
>;

import type { ReefSiteReference } from "./types";

// Synced with GET /api/v1/reference/dive-sites on 15 September 2026.
// Every backend site has a matching, public-safe visitor profile in reef-sites.ts.
export const diveSiteCatalog: ReefSiteReference[] = [
  { id: "perhentian-batu-nisan", backendDiveSiteId: 17, name: "Batu Nisan", island: "Perhentian", publicAreaLabel: "Perhentian Islands" },
  { id: "perhentian-d-lagoon", backendDiveSiteId: 19, name: "D'Lagoon", island: "Perhentian", publicAreaLabel: "Perhentian Islands" },
  { id: "perhentian-shark-point", backendDiveSiteId: 18, name: "Shark Point", island: "Perhentian", publicAreaLabel: "Perhentian Islands" },
  { id: "perhentian-sugar-wreck", backendDiveSiteId: 14, name: "Sugar Wreck", island: "Perhentian", publicAreaLabel: "Perhentian Islands" },
  { id: "perhentian-tanjung-basi", backendDiveSiteId: 20, name: "Tanjung Basi", island: "Perhentian", publicAreaLabel: "Perhentian Islands" },
  { id: "perhentian-temple-of-the-sea", backendDiveSiteId: 13, name: "Temple of the Sea (Tokong Laut)", island: "Perhentian", publicAreaLabel: "Perhentian Islands" },
  { id: "perhentian-terumbu-tiga", backendDiveSiteId: 16, name: "Terumbu Tiga", island: "Perhentian", publicAreaLabel: "Perhentian Islands" },
  { id: "perhentian-vietnamese-wreck", backendDiveSiteId: 15, name: "Vietnamese Wreck", island: "Perhentian", publicAreaLabel: "Perhentian Islands" },
  { id: "redang-mini-mount", backendDiveSiteId: 23, name: "Mini Mount", island: "Redang", publicAreaLabel: "Redang Island" },
  { id: "redang-pulau-paku-besar", backendDiveSiteId: 21, name: "Pulau Paku Besar", island: "Redang", publicAreaLabel: "Redang Island" },
  { id: "redang-tanjung-tengah", backendDiveSiteId: 22, name: "Tanjung Tengah", island: "Redang", publicAreaLabel: "Redang Island" },
  { id: "redang-terumbu-kili", backendDiveSiteId: 24, name: "Terumbu Kili", island: "Redang", publicAreaLabel: "Redang Island" },
  { id: "tioman-batu-malang", backendDiveSiteId: 8, name: "Batu Malang", island: "Tioman", publicAreaLabel: "Tioman Island" },
  { id: "tioman-chebeh-island", backendDiveSiteId: 2, name: "Chebeh Island", island: "Tioman", publicAreaLabel: "Tioman Island" },
  { id: "tioman-coral-island", backendDiveSiteId: 11, name: "Coral Island (Pulau Tulai)", island: "Tioman", publicAreaLabel: "Tioman Island" },
  { id: "tioman-fan-canyon", backendDiveSiteId: 9, name: "Fan Canyon", island: "Tioman", publicAreaLabel: "Tioman Island" },
  { id: "tioman-labas-island", backendDiveSiteId: 5, name: "Labas Island", island: "Tioman", publicAreaLabel: "Tioman Island" },
  { id: "tioman-malang-rock", backendDiveSiteId: 6, name: "Malang Rock", island: "Tioman", publicAreaLabel: "Tioman Island" },
  { id: "tioman-marine-park", backendDiveSiteId: 12, name: "Marine Park (Tekek)", island: "Tioman", publicAreaLabel: "Tioman Island" },
  { id: "tioman-pirate-reef", backendDiveSiteId: 10, name: "Pirate Reef", island: "Tioman", publicAreaLabel: "Tioman Island" },
  { id: "tioman-renggis", backendDiveSiteId: 3, name: "Renggis Island", island: "Tioman", publicAreaLabel: "Tioman Island" },
  { id: "tioman-sepoi-island", backendDiveSiteId: 7, name: "Sepoi Island", island: "Tioman", publicAreaLabel: "Tioman Island" },
  { id: "tioman-soyak-island", backendDiveSiteId: 4, name: "Soyak Island", island: "Tioman", publicAreaLabel: "Tioman Island" },
  { id: "tioman-tiger-reef", backendDiveSiteId: 1, name: "Tiger Reef", island: "Tioman", publicAreaLabel: "Tioman Island" },
];

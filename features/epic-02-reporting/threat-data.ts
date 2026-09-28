import type { ThreatCategoryCode } from "./types";

export type ThreatCategory = {
  id: number;
  code: ThreatCategoryCode;
  label: string;
  shortExplanation: string;
  usefulEvidence: string[];
  safetyReminder: string;
  guidanceAvailable: boolean;
};

export const threatCategories: ThreatCategory[] = [
  {
    id: 1,
    code: "ghost_gear",
    label: "Ghost fishing gear",
    shortExplanation: "Lost or abandoned nets, lines, traps or ropes that may entangle coral or marine animals.",
    usefulEvidence: ["A clear photograph of the gear", "How it interacts with coral or animals", "The approximate size and location"],
    safetyReminder: "Photograph and record the location if safe to do so. Do not attempt removal unless trained and authorised.",
    guidanceAvailable: true,
  },
  {
    id: 2,
    code: "coral_bleaching",
    label: "Coral bleaching",
    shortExplanation: "Coral that appears unusually pale or white across part or all of a colony or reef area.",
    usefulEvidence: ["A well-lit photograph showing the colour", "A wider view of the surrounding reef", "The approximate area affected"],
    safetyReminder: "Observe without touching the coral. Keep a safe distance and avoid stirring sediment.",
    guidanceAvailable: true,
  },
  {
    id: 3,
    code: "marine_debris",
    label: "Marine debris",
    shortExplanation: "Plastic, metal, glass, fabric or other human-made waste resting on or near the reef.",
    usefulEvidence: ["A photograph showing the debris type", "Whether it is touching coral or animals", "The approximate amount and location"],
    safetyReminder: "Do not handle sharp, hazardous or entangling debris. Record it from a safe position.",
    guidanceAvailable: true,
  },
  {
    id: 4,
    code: "physical_reef_damage",
    label: "Physical reef damage",
    shortExplanation: "Recently broken, crushed or scraped coral that may be associated with anchors, vessels or direct contact.",
    usefulEvidence: ["A close and wider photograph", "Any visible nearby cause", "The approximate area and location"],
    safetyReminder: "Do not move damaged coral or confront other people. Record only what you can observe safely.",
    guidanceAvailable: true,
  },
  {
    id: 5,
    code: "unsure",
    label: "Unsure",
    shortExplanation: "Use this when the observation may be important but does not clearly match another category.",
    usefulEvidence: ["A clear photograph", "A short factual description", "The dive site and location confidence"],
    safetyReminder: "You do not need to diagnose the issue. Describe only what you observed and avoid touching it.",
    guidanceAvailable: false,
  },
];

export function getThreatCategory(code: ThreatCategoryCode | "") {
  return threatCategories.find((category) => category.code === code);
}

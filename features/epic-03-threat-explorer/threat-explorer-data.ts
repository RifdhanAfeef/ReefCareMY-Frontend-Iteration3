export type ThreatExplorerCode =
  | "ghost_gear"
  | "coral_bleaching"
  | "marine_debris"
  | "physical_reef_damage";

/**
 * One gallery image for a threat module: an "affected" view paired with a
 * "healthy for comparison" view, so the pair reads as a clear before/after.
 * (US3.1 AC2 representative imagery; US3.2 AC2 before/after comparison)
 */
export type ThreatExplorerImage = {
  image: string;
  alt: string;
  caption?: string;
};

export type ThreatExplorerItem = {
  code: ThreatExplorerCode;
  label: string;
  number: string;
  eyebrow: string;
  summary: string;
  looksLike: string;
  impact: string;
  impactSource: { label: string; url: string };
  recognitionCues: string[];
  /** Short "what may be useful to record" guidance. Mirrors the reference/reporting API's useful evidence wording without turning the page into a reporting form. (US3.1 AC4) */
  evidenceGuidance: string;
  safety: string;
  image: string;
  imageAlt: string;
  /** Affected vs. healthy comparison pair shown in the detail gallery. (US3.1 AC2, US3.2 AC2) */
  examples: ThreatExplorerImage[];
};

export const threatExplorerItems: ThreatExplorerItem[] = [
  {
    code: "ghost_gear",
    label: "Ghost fishing gear",
    number: "01",
    eyebrow: "Entanglement threat",
    summary: "Lost or abandoned nets, lines, traps or ropes that continue to catch wildlife and damage coral.",
    looksLike: "Netting, rope, hooks or traps caught across coral, drifting underwater or resting on the seabed.",
    impact: "It can entangle turtles and fish, break living coral, and keep causing harm long after it was lost.",
    impactSource: { label: "NOAA Fisheries", url: "https://www.fisheries.noaa.gov/pacific-islands/habitat-conservation/marine-debris-research-and-removal-northwestern-hawaiian" },
    recognitionCues: ["Mesh or rope wrapped around coral", "Animals trapped or restricted", "Gear with no vessel or diver attending it"],
    evidenceGuidance: "A photo showing the gear and the coral it is touching. How large it looks. Whether any animal is trapped.",
    safety: "Keep clear of hooks and loose lines. Photograph it from a safe distance and never attempt removal unless trained and authorised.",
    image: "/images/threats/generated-v2/ghost-gear.webp",
    imageAlt: "Fishing net mesh and loose rope tangled around branching coral",
    examples: [
      { image: "/images/threats/generated-v2/ghost-gear-affected.webp", alt: "Coral entangled in derelict fishing net", caption: "Coral entangled in lost fishing net" },
      { image: "/images/threats/generated-v2/ghost-gear-healthy.webp", alt: "Healthy coral nearby, free of any netting", caption: "Healthy coral for comparison" },
    ],
  },
  {
    code: "coral_bleaching",
    label: "Coral bleaching",
    number: "02",
    eyebrow: "Heat stress signal",
    summary: "Coral that has become unusually pale or white after losing the algae that provide much of its colour and energy.",
    looksLike: "A single colony or wider reef area that appears bright white, very pale, or patchy compared with nearby coral.",
    impact: "Bleached coral is under stress and more vulnerable to disease and death, though it may recover if conditions improve.",
    impactSource: { label: "NOAA Ocean Service", url: "https://oceanservice.noaa.gov/facts/coral_bleach.html" },
    recognitionCues: ["Unusually white or washed-out tissue", "Several nearby colonies showing similar paling", "A visible contrast with normally coloured coral"],
    evidenceGuidance: "A close photo of the pale coral, roughly an arm's length away. A wider photo showing how much of the area is affected.",
    safety: "Observe without touching. Keep good buoyancy, avoid stirring sediment, and capture both a close and wider view if safe.",
    image: "/images/threats/generated-v2/coral-bleaching.webp",
    imageAlt: "White bleached branching coral beside naturally coloured healthy coral",
    examples: [
      { image: "/images/threats/generated-v2/coral-bleaching-affected.webp", alt: "Fully bleached white branching coral", caption: "Bleached coral losing its colour" },
      { image: "/images/threats/generated-v2/coral-bleaching-healthy.webp", alt: "Naturally coloured healthy coral nearby", caption: "Healthy coral for comparison" },
    ],
  },
  {
    code: "marine_debris",
    label: "Marine debris",
    number: "03",
    eyebrow: "Human-made waste",
    summary: "Plastic, metal, glass, fabric and other discarded material resting on or moving through the reef environment.",
    looksLike: "Bottles, packaging, bags, cans, fabric or mixed waste touching coral, lodged in reef gaps or drifting nearby.",
    impact: "Debris can crush or smother coral. Wildlife can become entangled in it or mistake discarded material for food.",
    impactSource: { label: "NOAA Ocean Service", url: "https://oceanservice.noaa.gov/education/tutorial-coastal/marine-debris/md06.html" },
    recognitionCues: ["Clearly human-made material", "Waste touching or covering coral", "Sharp, hazardous or entangling objects"],
    evidenceGuidance: "A photo of the debris where it lies, including what surrounds it. Roughly how large it is and how much there is.",
    safety: "Do not handle sharp, chemical, medical or entangling waste. Record the type, amount and location from a safe position.",
    image: "/images/threats/generated-v2/marine-debris.webp",
    imageAlt: "A transparent plastic bag and silver aluminium can lodged beside coral",
    examples: [
      { image: "/images/threats/generated-v2/marine-debris-affected.webp", alt: "Plastic bag and aluminium can resting on the reef", caption: "Debris resting on the reef" },
      { image: "/images/threats/generated-v2/marine-debris-healthy.webp", alt: "Healthy coral nearby, free of debris", caption: "Healthy coral for comparison" },
    ],
  },
  {
    code: "physical_reef_damage",
    label: "Physical reef damage",
    number: "04",
    eyebrow: "Breakage and abrasion",
    summary: "Recently broken, crushed or scraped coral that may be linked to anchors, vessels, equipment or direct contact.",
    looksLike: "Fresh pale break surfaces, scattered fragments, scrape tracks, toppled coral or a concentrated damaged patch.",
    impact: "Anchors and vessel groundings can damage coral structures and the habitat that reef wildlife depends on.",
    impactSource: { label: "NOAA Fisheries", url: "https://www.fisheries.noaa.gov/national/habitat-conservation/shallow-coral-reef-habitat" },
    recognitionCues: ["Fresh-looking white break surfaces", "Loose fragments below a damaged colony", "A track or impact pattern with a nearby possible cause"],
    evidenceGuidance: "A photo of the damaged area. Whether the breaks look recent. Any visible cause, such as an anchor, chain or contact.",
    safety: "Do not move fragments or confront anyone. Maintain safe buoyancy and document only what you can observe safely.",
    image: "/images/threats/generated-v2/physical-damage.webp",
    imageAlt: "Snapped coral branches with pale fracture surfaces and loose fragments on the reef floor",
    examples: [
      { image: "/images/threats/generated-v2/physical-damage-affected.webp", alt: "Snapped coral branches with pale fracture surfaces", caption: "Broken coral with fresh fracture surfaces" },
      { image: "/images/threats/generated-v2/physical-damage-healthy.webp", alt: "An intact healthy coral colony nearby", caption: "Healthy coral for comparison" },
    ],
  },
];

/** Recognition-only notice shown with the education content. (US3.2 AC4) */
export const recognitionNotice = "This page helps you recognise what you may have seen and observe it safely. It is educational guidance, not a scientific identification or confirmation of any specific observation.";

export const spotTheThreatExamples = [
  { id: "example-net", threatCode: "ghost_gear" as const, prompt: "Follow the mesh and loose lines", image: "/images/threats/quiz-v3/ghost-gear.png", imageAlt: "Visual guide to net mesh wrapped around living coral", explanation: "The repeating diamond-shaped mesh crosses several branches. Rope trails away from the colony instead of growing from it. These connected threads distinguish lost fishing gear from the coral's natural structure." },
  { id: "example-bleaching", threatCode: "coral_bleaching" as const, prompt: "Notice the colour, not just the shape", image: "/images/threats/quiz-v3/coral-bleaching.png", imageAlt: "Visual guide comparing white bleached coral with brown neighbouring colonies", explanation: "The pale colony still has an intact branching shape, while nearby coral retains its brown colour. Widespread loss of colour is the visible clue here, rather than snapped branches. A white coral is not automatically dead." },
  { id: "example-debris", threatCode: "marine_debris" as const, prompt: "Pick out the objects that do not belong", image: "/images/threats/quiz-v3/marine-debris.png", imageAlt: "Visual guide to plastic film and a metal can among coral", explanation: "The bag's folded transparent film and the can's circular metal rim are manufactured shapes. Both sit on the reef rather than forming part of it. Record the material and how it touches the coral without handling hazardous waste." },
  { id: "example-damage", threatCode: "physical_reef_damage" as const, prompt: "Trace the breaks to the fallen fragments", image: "/images/threats/quiz-v3/physical-damage.png", imageAlt: "Visual guide to fresh coral fractures and detached branches", explanation: "Bright exposed ends mark where branches have snapped. Detached pieces lie below the damaged colony, unlike the intact branches seen in bleaching. Document the breakage without assuming what caused it or moving the fragments." },
];

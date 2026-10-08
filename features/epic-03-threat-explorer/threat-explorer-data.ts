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
    image: "/images/threats/open/net-reef.webp",
    imageAlt: "A lost fishing net draped over coral on a reef slope",
    examples: [
      { image: "/images/threats/open/net-divers.webp", alt: "Two divers working around a large mass of derelict fishing net on a reef", caption: "Trained divers removing a lost net" },
      { image: "/images/reef-sites/profiles/tioman-malang-rock-1.jpg", alt: "Plate and branching corals on a reef with no netting", caption: "Healthy reef for comparison" },
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
    image: "/images/threats/open/bleaching-acropora.webp",
    imageAlt: "A bleached white branching Acropora coral colony on a rock in blue water",
    examples: [
      { image: "/images/reef-sites/profiles/tioman-labas-island-1.jpg", alt: "A wide area of branching coral that has turned white", caption: "A bleached branching reef" },
      { image: "/images/reef-sites/profiles/tioman-labas-island-2.jpg", alt: "Living branching and table corals with their natural colour", caption: "Healthy branching reef for comparison" },
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
    image: "/images/threats/open/debris-indonesia.webp",
    imageAlt: "A purple plastic wrapper caught on coral",
    examples: [
      { image: "/images/threats/open/debris-indonesia.webp", alt: "A purple plastic wrapper caught on coral", caption: "Plastic caught on the reef" },
      { image: "/images/reef-sites/profiles/tioman-pirate-reef-2.jpg", alt: "Colourful corals and reef fish with no visible waste", caption: "Healthy reef for comparison" },
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
    image: "/images/threats/open/broken-corals.webp",
    imageAlt: "Broken coral fragments heaped on the reef floor",
    examples: [
      { image: "/images/threats/open/broken-coral.webp", alt: "Broken coral pieces caught in a derelict net on a reef flat", caption: "Coral broken off and caught in a net" },
      { image: "/images/reef-sites/profiles/perhentian-batu-nisan-1.jpg", alt: "An intact branching Acropora colony", caption: "Intact coral for comparison" },
    ],
  },
];

/** Recognition-only notice shown with the education content. (US3.2 AC4) */
export const recognitionNotice = "This page helps you recognise what you may have seen and observe it safely. It is educational guidance, not a scientific identification or confirmation of any specific observation.";

/**
 * One Spot the Threat question. `questionAlt` describes what is visible without naming the threat, so screen reader
 * users are not given the answer before they choose; `imageAlt` replaces it once answered. `wrongAnswerNotes` explains,
 * for each other threat, why this image does not show it. (US3.3 AC1-AC3)
 */
export type SpotTheThreatExample = {
  id: string;
  threatCode: ThreatExplorerCode;
  prompt: string;
  image: string;
  questionAlt: string;
  imageAlt: string;
  explanation: string;
  wrongAnswerNotes: Partial<Record<ThreatExplorerCode, string>>;
};

export const spotTheThreatExamples: SpotTheThreatExample[] = [
  {
    id: "example-bleaching",
    threatCode: "coral_bleaching",
    prompt: "Notice the colour, not just the shape",
    image: "/images/threats/quiz-v3/coral-bleaching.png",
    questionAlt: "Illustration of a white branching coral colony next to a brown branching colony",
    imageAlt: "Visual guide comparing white bleached coral with brown neighbouring colonies",
    explanation: "The pale colony still has an intact branching shape, while nearby coral retains its brown colour. Widespread loss of colour is the visible clue here, rather than snapped branches. A white coral is not automatically dead.",
    wrongAnswerNotes: {
      ghost_gear: "There is no mesh or rope here. The white shape is the coral itself, with every branch still attached.",
      marine_debris: "Nothing human-made is touching the reef. The white colony has the same branching shape as the brown coral beside it.",
      physical_reef_damage: "Damage shows snapped ends and fallen pieces. These pale branches are whole and still attached, so the change is in colour, not shape.",
    },
  },
  {
    id: "example-damage",
    threatCode: "physical_reef_damage",
    prompt: "Trace the breaks to the fallen fragments",
    image: "/images/threats/quiz-v3/physical-damage.png",
    questionAlt: "Illustration of a tan branching coral colony with white tips, and loose coral pieces on the rock below",
    imageAlt: "Visual guide to fresh coral fractures and detached branches",
    explanation: "Bright exposed ends mark where branches have snapped. Detached pieces lie below the damaged colony, unlike the intact branches seen in bleaching. Document the breakage without assuming what caused it or moving the fragments.",
    wrongAnswerNotes: {
      coral_bleaching: "The colony keeps its tan colour. Only the broken ends are white, where the inside of the branch is exposed, and the pieces below have fallen off.",
      ghost_gear: "There is no net or line on this colony. Look at the snapped tips and the fragments lying on the rock below.",
      marine_debris: "Everything on the rock is coral. The loose pieces below are broken branches, not dropped objects.",
    },
  },
  {
    id: "example-net",
    threatCode: "ghost_gear",
    prompt: "Follow the mesh and loose lines",
    image: "/images/threats/quiz-v3/ghost-gear.png",
    questionAlt: "Illustration of pale threads in a diamond pattern and a loose line crossing the branches of a tan coral colony",
    imageAlt: "Visual guide to net mesh wrapped around living coral",
    explanation: "The repeating diamond-shaped mesh crosses several branches. Rope trails away from the colony instead of growing from it. These connected threads distinguish lost fishing gear from the coral's natural structure.",
    wrongAnswerNotes: {
      coral_bleaching: "The coral keeps its tan colour. The pale lines are threads of net and rope lying over the branches.",
      marine_debris: "Close, as a lost net is waste too. Netting or rope wrapped around coral is recorded as ghost fishing gear, because it can keep catching wildlife.",
      physical_reef_damage: "The branches are whole. The threads crossing them are a net and rope caught on the colony, not cracks or breaks.",
    },
  },
  {
    id: "example-debris",
    threatCode: "marine_debris",
    prompt: "Pick out the objects that do not belong",
    image: "/images/threats/quiz-v3/marine-debris.png",
    questionAlt: "Illustration of a clear crumpled sheet and a small metal cylinder resting on tan coral",
    imageAlt: "Visual guide to plastic film and a metal can among coral",
    explanation: "The bag's folded transparent film and the can's circular metal rim are manufactured shapes. Both sit on the reef rather than forming part of it. Record the material and how it touches the coral without handling hazardous waste.",
    wrongAnswerNotes: {
      ghost_gear: "There is no mesh, line or trap. The bag and can are everyday rubbish, not fishing gear.",
      coral_bleaching: "The clear, pale shape is a plastic bag lying on the coral. The coral under it keeps its normal colour.",
      physical_reef_damage: "The coral is not broken. The bag and the can sit on the reef rather than being part of it.",
    },
  },
];

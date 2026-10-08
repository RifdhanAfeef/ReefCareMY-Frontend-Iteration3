import type { ReefImage } from "./types";

type ImageSource = [file: string, caption: string, credit: string, license: string];

const sources: Record<string, [ImageSource, ImageSource]> = {
  "perhentian-batu-nisan": [["Acropora coral ffs.jpg", "branching Acropora hard coral", "Andy Collins, NOAA", "Public domain"], ["Blue corals.JPG", "blue coral habitat", "Brocken Inaglory", "CC BY-SA 3.0"]],
  "perhentian-d-lagoon": [["Bunaken Marine Park.JPG", "mixed coral habitat and reef fish", "Sakurai Midori", "CC BY-SA 3.0"], ["Anemonefish colony.jpg", "anemonefish colony", "Nhobgood", "CC BY-SA 3.0"]],
  "perhentian-shark-point": [["Callyspongia sp. (Tube sponge).jpg", "tube sponges", "Nick Hobgood", "CC BY-SA 3.0"], ["Aluterus scriptus (Scribbled leatherjacket).jpg", "scribbled leatherjacket among reef habitat", "Nick Hobgood", "CC BY-SA 3.0"]],
  "perhentian-sugar-wreck": [["Amphiprion perideraion (Pink anemonefish) in Heteractis magnifica (Magnificent sea anemone).jpg", "pink anemonefish and magnificent sea anemone", "Nick Hobgood", "CC BY-SA 3.0"], ["Acanthurus sohal.jpg", "surgeonfish over reef", "Hannes Grobe/AWI", "CC BY 3.0"]],
  "perhentian-tanjung-basi": [["Almog001.jpg", "hard-coral reef surface", "Itayba", "Public domain"], ["Coral Reef.JPG", "coral reef habitat", "BrendelSignature", "CC BY-SA 3.0"]],
  "perhentian-temple-of-the-sea": [["Coral reefs 1.JPG", "dense coral reef", "Brocken Inaglory", "CC BY-SA 3.0"], ["Coral reefs in Hurghada.JPG", "coral formations and reef fish", "Aymangabalawy", "CC BY-SA 3.0"]],
  "perhentian-terumbu-tiga": [["14-EastTimor-Dive Dili-Rock-West 32 (Coral Reef)-APiazza.JPG", "coral-covered rocky reef", "Andrepiazza", "CC BY-SA 3.0"], ["48-EastTimor-Dive1 Behau Village 19 (Emperor Angelfish Juvenile)-APiazza.JPG", "juvenile emperor angelfish", "Andrepiazza", "CC BY-SA 3.0"]],
  "perhentian-vietnamese-wreck": [["Coral reefs of Karimunjawa.jpg", "reef fish above coral habitat", "Vinno Christopan", "CC BY 4.0"], ["Barriera corallina - panoramio.jpg", "shallow coral and reef fish", "Francesco Lo Bello", "CC BY 3.0"]],
  "redang-mini-mount": [["Barriera corallina - panoramio - Francesco Lo Bello.jpg", "shallow reef and grazing fish", "Francesco Lo Bello", "CC BY 3.0"], ["Barriera corallina - panoramio - Francesco Lo Bello (1).jpg", "reef fish over coral rubble", "Francesco Lo Bello", "CC BY 3.0"]],
  "redang-pulau-paku-besar": [["2010 Thailand Koh Phi Phi & Lanta scuba diving3.jpg", "coral slope with schooling fish", "Ilse Reijs and Jan-Noud Hutten", "CC BY 2.0"], ["Aquarium of the Amsterdam Island.jpg", "open coral garden", "Abihut", "CC BY-SA 4.0"]],
  "redang-tanjung-tengah": [["Coral, Hydroid and Gorgonian.jpg", "coral, hydroids and gorgonians", "Mudasir Zainuddin", "CC BY-SA 4.0"], ["Bluefin travelley gliding over the reefs.jpg", "bluefin trevally over a reef", "Vardhanjp", "CC BY-SA 4.0"]],
  "redang-terumbu-kili": [["Coralreeflife.jpg", "mixed coral reef life", "NOAA National Ocean Service", "CC BY-SA 2.0"], ["Corals fish.JPG", "reef fish among corals", "Brocken Inaglory", "CC BY-SA 3.0"]],
  "tioman-batu-malang": [["My Diving.jpg", "diver beside branching and encrusting coral", "Mastura Manap", "CC BY 4.0"], ["Mushroom Coral (Fungia sp.) (6127135997).jpg", "mushroom coral among reef growth", "Bernard Dupont", "CC BY-SA 2.0"]],
  "tioman-chebeh-island": [["FungiaConcinnaJI1.jpg", "mushroom coral (Fungia concinna)", "Joi Ito", "CC BY 2.0"], ["Cirripectes matatakaro in-situe.jpg", "reef blenny in coral habitat", "David Rolla", "CC BY 4.0"]],
  "tioman-coral-island": [["Arrecifes de Cozumel National Park.jpg", "large coral formations", "Matthew T Rader", "CC BY-SA 4.0"], ["Coral reef of Perhentian Islands.jpg", "shallow coral reef seen from the surface, Perhentian Islands", "Chamberlain of Nilai", "CC BY-SA 4.0"]],
  "tioman-fan-canyon": [["Digitate Leather Coral (Sinularia sp.) (8488836029).jpg", "digitate leather coral on a reef wall", "Bernard Dupont", "CC BY-SA 2.0"], ["Acoel Flatworms (Waminoa sp.) on Bubble Coral (Plerogyra sinuosa) - Panglima, Pulau Mabul, Sabah, Malaysia.jpg", "bubble coral at Pulau Mabul, Sabah", "Bernard Dupont", "CC BY-SA 2.0"]],
  "tioman-labas-island": [["Bleached coral reef.png", "bleached branching coral", "Danielle Ihde", "CC0"], ["Coral reef PloS.jpg", "living branching coral reef", "Terry Hughes", "CC BY 2.5"]],
  "tioman-malang-rock": [["Coral Reef in the Red Sea.JPG", "plate and branching corals", "Mahmoud Habeeb", "Public domain"], ["Jack fish and reef sharks.jpg", "schooling jacks and reef sharks", "Avoini", "CC BY-SA 3.0"]],
  "tioman-marine-park": [["Corals sea worms.JPG", "corals and marine worms", "Brocken Inaglory", "CC BY-SA 3.0"], ["Coral off the coast of Cuba.jpg", "coral reef habitat", "calind", "CC BY-SA 3.0"]],
  "tioman-pirate-reef": [["Corals seastar.JPG", "sea star among corals", "Brocken Inaglory", "CC BY-SA 3.0"], ["Colorful underwater landscape of a coral reef.jpg", "colourful coral landscape", "Jim E Maragos, U.S. Fish and Wildlife Service", "Public domain"]],
  "tioman-renggis": [["Hawksbill turtle on Pom Pom Island.jpg", "hawksbill turtle at Pom Pom Island, Sabah", "Profmauri", "CC BY-SA 3.0"], ["Coral Reef, Belize.jpg", "mixed hard-coral garden", "Andy Blackledge", "CC BY 2.0"]],
  "tioman-sepoi-island": [["Corals with fish.JPG", "reef fish among corals", "Brocken Inaglory", "CC BY-SA 3.0"], ["CSIRO ScienceImage 3490 Gorgonians.jpg", "gorgonian sea fans", "CSIRO Marine Research", "CC BY 3.0"]],
  "tioman-soyak-island": [["Coral reef 09.jpg", "dense coral community", "Jim Maragos / U.S. Fish and Wildlife Service; modified by Mielon", "CC BY 2.0"], ["Coral reef 876.jpg", "coral heads and reef fish", "Matt Kieffer", "CC BY-SA 2.0"]],
  "tioman-tiger-reef": [["Coral reef 98.jpg", "layered hard-coral reef", "Kydd Pollock", "CC BY 2.0"], ["Reef shark beneath a school of jack fish.jpg", "reef shark beneath schooling jacks over coral", "Avoini", "CC BY-SA 3.0"]],
};

export function imagesFor(siteId: string): [ReefImage, ReefImage] {
  return sources[siteId].map(([file, caption, credit, license], index) => ({
    src: `/images/reef-sites/profiles/${siteId}-${index + 1}.jpg`,
    alt: `${caption}; illustrative marine image, not a photograph of this dive site`,
    caption: `Illustrative marine image (not photographed at this dive site): ${caption}`,
    credit,
    license,
    sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(`File:${file}`).replaceAll("%2F", "/")}`,
  })) as [ReefImage, ReefImage];
}

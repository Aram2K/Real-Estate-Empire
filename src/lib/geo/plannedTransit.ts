/**
 * Comprehensive Planned Transit Infrastructure across Île-de-France.
 *
 * Sources:
 * - Société des grands projets (SGP) - Grand Paris Express (L15 Sud/Ouest/Est, L16, L17, L18)
 * - Île-de-France Mobilités (IDFM) - RER E (EOLE Ouest), Câble C1, Metro M1/M10 extensions, Tram T1/T10 extensions
 */

export interface PlannedStation {
  name: string;
  line: string;
  segment: string;
  lon: number;
  lat: number;
  openingYear: number;
  openingLabel: string;
  status: "UNDER_CONSTRUCTION" | "PLANNED";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  type: "metro" | "rer" | "tram" | "cable";
  sourceUrl?: string;
}

export interface PlannedLine {
  id: string;
  name: string;
  shortName: string;
  type: "metro" | "rer" | "tram" | "cable";
  color: string;
  status: "UNDER_CONSTRUCTION" | "PLANNED";
  openingLabel: string;
  coords: [number, number][]; // [lat, lon]
}

export const PLANNED_STATIONS: PlannedStation[] = [
  // ==========================================
  // GRAND PARIS EXPRESS - LIGNE 15 SUD (~2027)
  // ==========================================
  { name: "Pont de Sèvres", line: "15", segment: "L15 Sud", lon: 2.2306, lat: 48.8297, openingYear: 2027, openingLabel: "Autumn 2027 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-15" },
  { name: "Issy RER", line: "15", segment: "L15 Sud", lon: 2.2620, lat: 48.8250, openingYear: 2027, openingLabel: "Autumn 2027 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-15" },
  { name: "Fort d'Issy-Vanves-Clamart", line: "15", segment: "L15 Sud", lon: 2.2830, lat: 48.8180, openingYear: 2027, openingLabel: "Autumn 2027 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-15" },
  { name: "Châtillon-Montrouge", line: "15", segment: "L15 Sud", lon: 2.3010, lat: 48.8100, openingYear: 2027, openingLabel: "Autumn 2027 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-15" },
  { name: "Bagneux", line: "15", segment: "L15 Sud", lon: 2.3130, lat: 48.7980, openingYear: 2027, openingLabel: "Autumn 2027 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-15" },
  { name: "Arcueil-Cachan", line: "15", segment: "L15 Sud", lon: 2.3320, lat: 48.7880, openingYear: 2027, openingLabel: "Autumn 2027 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-15" },
  { name: "Villejuif - Gustave Roussy", line: "15", segment: "L15 Sud", lon: 2.3503, lat: 48.7936, openingYear: 2027, openingLabel: "Autumn 2027 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-15" },
  { name: "Villejuif Louis Aragon", line: "15", segment: "L15 Sud", lon: 2.3670, lat: 48.7870, openingYear: 2027, openingLabel: "Autumn 2027 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-15" },
  { name: "Vitry Centre", line: "15", segment: "L15 Sud", lon: 2.3920, lat: 48.7870, openingYear: 2027, openingLabel: "Autumn 2027 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-15" },
  { name: "Les Ardoines", line: "15", segment: "L15 Sud", lon: 2.3990, lat: 48.7780, openingYear: 2027, openingLabel: "Autumn 2027 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-15" },
  { name: "Le Vert de Maisons", line: "15", segment: "L15 Sud", lon: 2.4200, lat: 48.7900, openingYear: 2027, openingLabel: "Autumn 2027 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-15" },
  { name: "Créteil L'Échat", line: "15", segment: "L15 Sud", lon: 2.4500, lat: 48.7900, openingYear: 2027, openingLabel: "Autumn 2027 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-15" },
  { name: "Saint-Maur-Créteil", line: "15", segment: "L15 Sud", lon: 2.4890, lat: 48.7900, openingYear: 2027, openingLabel: "Autumn 2027 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-15" },
  { name: "Champigny Centre", line: "15", segment: "L15 Sud", lon: 2.5150, lat: 48.8130, openingYear: 2027, openingLabel: "Autumn 2027 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-15" },
  { name: "Bry-Villiers-Champigny", line: "15", segment: "L15 Sud", lon: 2.5320, lat: 48.8180, openingYear: 2027, openingLabel: "Autumn 2027 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-15" },
  { name: "Noisy-Champs", line: "15", segment: "L15 Sud", lon: 2.5870, lat: 48.8410, openingYear: 2027, openingLabel: "Autumn 2027 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-15" },

  // ==========================================
  // GRAND PARIS EXPRESS - LIGNE 15 OUEST (~2030-2031)
  // ==========================================
  { name: "Saint-Cloud", line: "15", segment: "L15 Ouest", lon: 2.2183, lat: 48.8436, openingYear: 2031, openingLabel: "2031 (est.)", status: "PLANNED", confidence: "MEDIUM", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-15" },
  { name: "Rueil-Suresnes Mont-Valérien", line: "15", segment: "L15 Ouest", lon: 2.2030, lat: 48.8722, openingYear: 2031, openingLabel: "2031 (est.)", status: "PLANNED", confidence: "MEDIUM", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-15" },
  { name: "Nanterre La Boule", line: "15", segment: "L15 Ouest", lon: 2.2045, lat: 48.8890, openingYear: 2031, openingLabel: "2031 (est.)", status: "PLANNED", confidence: "MEDIUM", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-15" },
  { name: "Nanterre La Folie", line: "15", segment: "L15 Ouest", lon: 2.2270, lat: 48.8970, openingYear: 2030, openingLabel: "2030 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-15" },
  { name: "La Défense (L15)", line: "15", segment: "L15 Ouest", lon: 2.2378, lat: 48.8918, openingYear: 2030, openingLabel: "2030 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-15" },
  { name: "Bécon-les-Bruyères", line: "15", segment: "L15 Ouest", lon: 2.2708, lat: 48.9078, openingYear: 2030, openingLabel: "2030 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-15" },
  { name: "Bois-Colombes", line: "15", segment: "L15 Ouest", lon: 2.2680, lat: 48.9135, openingYear: 2030, openingLabel: "2030 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-15" },
  { name: "Les Agnettes", line: "15", segment: "L15 Ouest", lon: 2.2867, lat: 48.9242, openingYear: 2030, openingLabel: "2030 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-15" },
  { name: "Les Grésillons", line: "15", segment: "L15 Ouest", lon: 2.3150, lat: 48.9217, openingYear: 2030, openingLabel: "2030 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-15" },

  // ==========================================
  // GRAND PARIS EXPRESS - LIGNE 15 EST (~2030-2031)
  // ==========================================
  { name: "Saint-Denis Pleyel (L15)", line: "15", segment: "L15 Est", lon: 2.3450, lat: 48.9200, openingYear: 2030, openingLabel: "2030 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-15" },
  { name: "Stade de France", line: "15", segment: "L15 Est", lon: 2.3610, lat: 48.9180, openingYear: 2030, openingLabel: "2030 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-15" },
  { name: "Mairie d'Aubervilliers (L15)", line: "15", segment: "L15 Est", lon: 2.3810, lat: 48.9140, openingYear: 2030, openingLabel: "2030 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-15" },
  { name: "Fort d'Aubervilliers (L15)", line: "15", segment: "L15 Est", lon: 2.4040, lat: 48.9140, openingYear: 2030, openingLabel: "2030 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-15" },
  { name: "Drancy - Bobigny", line: "15", segment: "L15 Est", lon: 2.4330, lat: 48.9100, openingYear: 2030, openingLabel: "2030 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-15" },
  { name: "Bobigny Pablo Picasso (L15)", line: "15", segment: "L15 Est", lon: 2.4500, lat: 48.9060, openingYear: 2030, openingLabel: "2030 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-15" },
  { name: "Pont de Bondy", line: "15", segment: "L15 Est", lon: 2.4700, lat: 48.9030, openingYear: 2030, openingLabel: "2030 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-15" },
  { name: "Bondy (L15)", line: "15", segment: "L15 Est", lon: 2.4810, lat: 48.8950, openingYear: 2030, openingLabel: "2030 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-15" },
  { name: "Rosny-Bois-Perrier (L15)", line: "15", segment: "L15 Est", lon: 2.4840, lat: 48.8830, openingYear: 2030, openingLabel: "2030 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-15" },
  { name: "Val de Fontenay (L15)", line: "15", segment: "L15 Est", lon: 2.4850, lat: 48.8550, openingYear: 2030, openingLabel: "2030 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-15" },
  { name: "Nogent - Le Perreux", line: "15", segment: "L15 Est", lon: 2.4970, lat: 48.8370, openingYear: 2030, openingLabel: "2030 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-15" },

  // ==========================================
  // GRAND PARIS EXPRESS - LIGNE 16 (~2027-2028)
  // ==========================================
  { name: "Saint-Denis Pleyel", line: "16", segment: "L16 ph1", lon: 2.3450, lat: 48.9200, openingYear: 2027, openingLabel: "End 2027 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-16" },
  { name: "La Courneuve Six Routes", line: "16", segment: "L16 ph1", lon: 2.4000, lat: 48.9210, openingYear: 2027, openingLabel: "End 2027 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-16" },
  { name: "Le Bourget RER", line: "16", segment: "L16 ph1", lon: 2.4260, lat: 48.9350, openingYear: 2027, openingLabel: "End 2027 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-16" },
  { name: "Le Blanc-Mesnil", line: "16", segment: "L16 ph1", lon: 2.4650, lat: 48.9380, openingYear: 2027, openingLabel: "End 2027 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-16" },
  { name: "Aulnay", line: "16", segment: "L16 ph1", lon: 2.4940, lat: 48.9340, openingYear: 2027, openingLabel: "End 2027 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-16" },
  { name: "Sevran-Beaudottes", line: "16", segment: "L16 ph1", lon: 2.5250, lat: 48.9420, openingYear: 2027, openingLabel: "End 2027 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-16" },
  { name: "Sevran-Livry", line: "16", segment: "L16 ph1", lon: 2.5330, lat: 48.9350, openingYear: 2027, openingLabel: "End 2027 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-16" },
  { name: "Clichy-Montfermeil", line: "16", segment: "L16 ph1", lon: 2.5330, lat: 48.9020, openingYear: 2027, openingLabel: "End 2027 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-16" },
  { name: "Chelles", line: "16", segment: "L16 ph2", lon: 2.5900, lat: 48.8830, openingYear: 2028, openingLabel: "End 2028 (est.)", status: "UNDER_CONSTRUCTION", confidence: "MEDIUM", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-16" },
  { name: "Noisy-Champs (L16)", line: "16", segment: "L16 ph2", lon: 2.5870, lat: 48.8410, openingYear: 2028, openingLabel: "End 2028 (est.)", status: "UNDER_CONSTRUCTION", confidence: "MEDIUM", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-16" },

  // ==========================================
  // GRAND PARIS EXPRESS - LIGNE 17 (~2027-2030)
  // ==========================================
  { name: "Le Bourget Aéroport", line: "17", segment: "L17 ph1", lon: 2.4340, lat: 48.9490, openingYear: 2027, openingLabel: "End 2027 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-17" },
  { name: "Triangle de Gonesse", line: "17", segment: "L17 ph1", lon: 2.4540, lat: 48.9730, openingYear: 2028, openingLabel: "2028 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-17" },
  { name: "Parc des Expositions (L17)", line: "17", segment: "L17 ph2", lon: 2.5180, lat: 48.9740, openingYear: 2030, openingLabel: "2030 (est.)", status: "UNDER_CONSTRUCTION", confidence: "MEDIUM", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-17" },
  { name: "Aéroport CDG 2 TGV", line: "17", segment: "L17 ph2", lon: 2.5710, lat: 49.0040, openingYear: 2030, openingLabel: "2030 (est.)", status: "UNDER_CONSTRUCTION", confidence: "MEDIUM", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-17" },
  { name: "Le Mesnil-Amelot", line: "17", segment: "L17 ph2", lon: 2.5920, lat: 49.0180, openingYear: 2030, openingLabel: "2030 (est.)", status: "PLANNED", confidence: "MEDIUM", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-17" },

  // ==========================================
  // GRAND PARIS EXPRESS - LIGNE 18 (~2026-2030)
  // ==========================================
  { name: "Aéroport d'Orly (L18)", line: "18", segment: "L18 ph2", lon: 2.3650, lat: 48.7260, openingYear: 2027, openingLabel: "Autumn 2027 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-18" },
  { name: "Antonypôle", line: "18", segment: "L18 ph2", lon: 2.3080, lat: 48.7420, openingYear: 2027, openingLabel: "Autumn 2027 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-18" },
  { name: "Massy Opéra", line: "18", segment: "L18 ph2", lon: 2.2790, lat: 48.7300, openingYear: 2027, openingLabel: "Autumn 2027 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-18" },
  { name: "Massy-Palaiseau", line: "18", segment: "L18 ph1", lon: 2.2590, lat: 48.7255, openingYear: 2026, openingLabel: "Late 2026 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-18" },
  { name: "Palaiseau", line: "18", segment: "L18 ph1", lon: 2.2100, lat: 48.7130, openingYear: 2026, openingLabel: "Late 2026 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-18" },
  { name: "Orsay-Gif", line: "18", segment: "L18 ph1", lon: 2.1720, lat: 48.7020, openingYear: 2026, openingLabel: "Late 2026 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-18" },
  { name: "CEA Saint-Aubin", line: "18", segment: "L18 ph1", lon: 2.1470, lat: 48.7100, openingYear: 2026, openingLabel: "Late 2026 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-18" },
  { name: "Christ de Saclay", line: "18", segment: "L18 ph1", lon: 2.1500, lat: 48.7250, openingYear: 2026, openingLabel: "Late 2026 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-18" },
  { name: "Guyancourt", line: "18", segment: "L18 ph3", lon: 2.0670, lat: 48.7660, openingYear: 2030, openingLabel: "2030 (est.)", status: "PLANNED", confidence: "MEDIUM", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-18" },
  { name: "Satory", line: "18", segment: "L18 ph3", lon: 2.1060, lat: 48.7880, openingYear: 2030, openingLabel: "2030 (est.)", status: "PLANNED", confidence: "MEDIUM", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-18" },
  { name: "Versailles Chantiers (L18)", line: "18", segment: "L18 ph3", lon: 2.1350, lat: 48.7950, openingYear: 2030, openingLabel: "2030 (est.)", status: "PLANNED", confidence: "MEDIUM", type: "metro", sourceUrl: "https://www.grandparisexpress.fr/ligne-18" },

  // ==========================================
  // RER E - EOLE PROLONGEMENT OUEST (~2026-2027)
  // ==========================================
  { name: "Houilles-Carrières-sur-Seine (RER E)", line: "RER E", segment: "EOLE Ouest", lon: 2.1850, lat: 48.9220, openingYear: 2026, openingLabel: "Late 2026 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "rer", sourceUrl: "https://www.rer-eole.fr" },
  { name: "Sartrouville (RER E)", line: "RER E", segment: "EOLE Ouest", lon: 2.1640, lat: 48.9380, openingYear: 2026, openingLabel: "Late 2026 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "rer", sourceUrl: "https://www.rer-eole.fr" },
  { name: "Poissy (RER E)", line: "RER E", segment: "EOLE Ouest", lon: 2.0420, lat: 48.9330, openingYear: 2026, openingLabel: "Late 2026 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "rer", sourceUrl: "https://www.rer-eole.fr" },
  { name: "Villennes-sur-Seine", line: "RER E", segment: "EOLE Ouest", lon: 1.9990, lat: 48.9380, openingYear: 2026, openingLabel: "Late 2026 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "rer", sourceUrl: "https://www.rer-eole.fr" },
  { name: "Vernouillet - Verneuil", line: "RER E", segment: "EOLE Ouest", lon: 1.9830, lat: 48.9790, openingYear: 2026, openingLabel: "Late 2026 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "rer", sourceUrl: "https://www.rer-eole.fr" },
  { name: "Les Clairières de Verneuil", line: "RER E", segment: "EOLE Ouest", lon: 1.9610, lat: 48.9950, openingYear: 2026, openingLabel: "Late 2026 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "rer", sourceUrl: "https://www.rer-eole.fr" },
  { name: "Les Mureaux", line: "RER E", segment: "EOLE Ouest", lon: 1.9120, lat: 48.9980, openingYear: 2026, openingLabel: "Late 2026 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "rer", sourceUrl: "https://www.rer-eole.fr" },
  { name: "Aubergenville-Élisabethville", line: "RER E", segment: "EOLE Ouest", lon: 1.8480, lat: 48.9720, openingYear: 2026, openingLabel: "Late 2026 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "rer", sourceUrl: "https://www.rer-eole.fr" },
  { name: "Épône - Mézières", line: "RER E", segment: "EOLE Ouest", lon: 1.8150, lat: 48.9610, openingYear: 2026, openingLabel: "Late 2026 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "rer", sourceUrl: "https://www.rer-eole.fr" },
  { name: "Mantes Station", line: "RER E", segment: "EOLE Ouest", lon: 1.7190, lat: 48.9890, openingYear: 2027, openingLabel: "2027 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "rer", sourceUrl: "https://www.rer-eole.fr" },
  { name: "Mantes-la-Jolie", line: "RER E", segment: "EOLE Ouest", lon: 1.7030, lat: 48.9900, openingYear: 2027, openingLabel: "2027 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "rer", sourceUrl: "https://www.rer-eole.fr" },

  // ==========================================
  // CÂBLE C1 - 1ER TÉLÉPHÉRIQUE D'IDF (~2025/2026)
  // ==========================================
  { name: "Créteil Pointe du Lac (Câble C1)", line: "Câble C1", segment: "C1 Val-de-Marne", lon: 2.4630, lat: 48.7700, openingYear: 2025, openingLabel: "2025/2026 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "cable", sourceUrl: "https://cable-c1.iledefrance-mobilites.fr" },
  { name: "Limeil-Brévannes - Temps Durables", line: "Câble C1", segment: "C1 Val-de-Marne", lon: 2.4780, lat: 48.7560, openingYear: 2025, openingLabel: "2025/2026 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "cable", sourceUrl: "https://cable-c1.iledefrance-mobilites.fr" },
  { name: "Valenton - Château des Rentiers", line: "Câble C1", segment: "C1 Val-de-Marne", lon: 2.4720, lat: 48.7470, openingYear: 2025, openingLabel: "2025/2026 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "cable", sourceUrl: "https://cable-c1.iledefrance-mobilites.fr" },
  { name: "La Végétale", line: "Câble C1", segment: "C1 Val-de-Marne", lon: 2.4710, lat: 48.7390, openingYear: 2025, openingLabel: "2025/2026 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "cable", sourceUrl: "https://cable-c1.iledefrance-mobilites.fr" },
  { name: "Villa Nova - Villeneuve-Saint-Georges", line: "Câble C1", segment: "C1 Val-de-Marne", lon: 2.4640, lat: 48.7310, openingYear: 2025, openingLabel: "2025/2026 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "cable", sourceUrl: "https://cable-c1.iledefrance-mobilites.fr" },

  // ==========================================
  // METRO EXTENSIONS (M1, M10)
  // ==========================================
  { name: "Les Rigollots (Fontenay)", line: "M1", segment: "M1 Est", lon: 2.4650, lat: 48.8490, openingYear: 2032, openingLabel: "Post-2030 (est.)", status: "PLANNED", confidence: "LOW", type: "metro", sourceUrl: "https://prolongement-ligne1.iledefrance-mobilites.fr" },
  { name: "Val de Fontenay (M1)", line: "M1", segment: "M1 Est", lon: 2.4850, lat: 48.8550, openingYear: 2032, openingLabel: "Post-2030 (est.)", status: "PLANNED", confidence: "LOW", type: "metro", sourceUrl: "https://prolongement-ligne1.iledefrance-mobilites.fr" },
  { name: "Chevaleret (M10)", line: "M10", segment: "M10 Sud-Est", lon: 2.3680, lat: 48.8350, openingYear: 2033, openingLabel: "Post-2030 (est.)", status: "PLANNED", confidence: "LOW", type: "metro" },
  { name: "Bibliothèque F. Mitterrand (M10)", line: "M10", segment: "M10 Sud-Est", lon: 2.3780, lat: 48.8300, openingYear: 2033, openingLabel: "Post-2030 (est.)", status: "PLANNED", confidence: "LOW", type: "metro" },
  { name: "Bruneseau", line: "M10", segment: "M10 Sud-Est", lon: 2.3850, lat: 48.8230, openingYear: 2033, openingLabel: "Post-2030 (est.)", status: "PLANNED", confidence: "LOW", type: "metro" },
  { name: "Ivry-Gambetta", line: "M10", segment: "M10 Sud-Est", lon: 2.3920, lat: 48.8140, openingYear: 2033, openingLabel: "Post-2030 (est.)", status: "PLANNED", confidence: "LOW", type: "metro" },

  // ==========================================
  // TRAMWAY EXTENSIONS (T1, T10)
  // ==========================================
  { name: "Gabriel Péri - Colombes (T1)", line: "T1", segment: "T1 Ouest", lon: 2.2470, lat: 48.9240, openingYear: 2026, openingLabel: "Late 2026 (est.)", status: "UNDER_CONSTRUCTION", confidence: "HIGH", type: "tram" },
  { name: "Nanterre Université (T1)", line: "T1", segment: "T1 Ouest", lon: 2.2140, lat: 48.9010, openingYear: 2027, openingLabel: "2027 (est.)", status: "UNDER_CONSTRUCTION", confidence: "MEDIUM", type: "tram" },
  { name: "Rueil-Malmaison (T1)", line: "T1", segment: "T1 Ouest", lon: 2.1850, lat: 48.8910, openingYear: 2027, openingLabel: "2027 (est.)", status: "UNDER_CONSTRUCTION", confidence: "MEDIUM", type: "tram" },
  { name: "Gare de Clamart (T10)", line: "T10", segment: "T10 Nord", lon: 2.2740, lat: 48.8150, openingYear: 2028, openingLabel: "2028 (est.)", status: "PLANNED", confidence: "MEDIUM", type: "tram" },
];

/**
 * Geometric alignments for the planned lines (track polylines).
 */
export const PLANNED_LINES: PlannedLine[] = [
  {
    id: "gpe-15-sud",
    name: "Ligne 15 Sud (Pont de Sèvres → Noisy-Champs)",
    shortName: "L15 Sud",
    type: "metro",
    color: "#b91c1c", // Burgundy / Dark Red
    status: "UNDER_CONSTRUCTION",
    openingLabel: "Autumn 2027",
    coords: [
      [48.8297, 2.2306], // Pont de Sèvres
      [48.8250, 2.2620], // Issy RER
      [48.8180, 2.2830], // Fort d'Issy-Vanves-Clamart
      [48.8100, 2.3010], // Châtillon-Montrouge
      [48.7980, 2.3130], // Bagneux
      [48.7880, 2.3320], // Arcueil-Cachan
      [48.7936, 2.3503], // Villejuif - Gustave Roussy
      [48.7870, 2.3670], // Villejuif Louis Aragon
      [48.7870, 2.3920], // Vitry Centre
      [48.7780, 2.3990], // Les Ardoines
      [48.7900, 2.4200], // Le Vert de Maisons
      [48.7900, 2.4500], // Créteil L'Échat
      [48.7900, 2.4890], // Saint-Maur-Créteil
      [48.8130, 2.5150], // Champigny Centre
      [48.8180, 2.5320], // Bry-Villiers-Champigny
      [48.8410, 2.5870], // Noisy-Champs
    ],
  },
  {
    id: "gpe-15-ouest",
    name: "Ligne 15 Ouest (Pont de Sèvres → Saint-Denis Pleyel)",
    shortName: "L15 Ouest",
    type: "metro",
    color: "#991b1b",
    status: "PLANNED",
    openingLabel: "2030-2031",
    coords: [
      [48.8297, 2.2306], // Pont de Sèvres
      [48.8436, 2.2183], // Saint-Cloud
      [48.8722, 2.2030], // Rueil - Suresnes
      [48.8890, 2.2045], // Nanterre La Boule
      [48.8970, 2.2270], // Nanterre La Folie
      [48.8918, 2.2378], // La Défense
      [48.9078, 2.2708], // Bécon-les-Bruyères
      [48.9135, 2.2680], // Bois-Colombes
      [48.9242, 2.2867], // Les Agnettes
      [48.9217, 2.3150], // Les Grésillons
      [48.9200, 2.3450], // Saint-Denis Pleyel
    ],
  },
  {
    id: "gpe-15-est",
    name: "Ligne 15 Est (Saint-Denis Pleyel → Champigny Centre)",
    shortName: "L15 Est",
    type: "metro",
    color: "#7f1d1d",
    status: "PLANNED",
    openingLabel: "2030-2031",
    coords: [
      [48.9200, 2.3450], // Saint-Denis Pleyel
      [48.9180, 2.3610], // Stade de France
      [48.9140, 2.3810], // Mairie d'Aubervilliers
      [48.9140, 2.4040], // Fort d'Aubervilliers
      [48.9100, 2.4330], // Drancy - Bobigny
      [48.9060, 2.4500], // Bobigny Pablo Picasso
      [48.9030, 2.4700], // Pont de Bondy
      [48.8950, 2.4810], // Bondy
      [48.8830, 2.4840], // Rosny-Bois-Perrier
      [48.8550, 2.4850], // Val de Fontenay
      [48.8370, 2.4970], // Nogent - Le Perreux
      [48.8130, 2.5150], // Champigny Centre
    ],
  },
  {
    id: "gpe-16",
    name: "Ligne 16 (Saint-Denis Pleyel → Noisy-Champs)",
    shortName: "L16",
    type: "metro",
    color: "#db2777", // Pink / Rose
    status: "UNDER_CONSTRUCTION",
    openingLabel: "2027-2028",
    coords: [
      [48.9200, 2.3450], // Saint-Denis Pleyel
      [48.9210, 2.4000], // La Courneuve Six-Routes
      [48.9350, 2.4260], // Le Bourget RER
      [48.9380, 2.4650], // Le Blanc-Mesnil
      [48.9340, 2.4940], // Aulnay
      [48.9420, 2.5250], // Sevran-Beaudottes
      [48.9350, 2.5330], // Sevran-Livry
      [48.9020, 2.5330], // Clichy-Montfermeil
      [48.8830, 2.5900], // Chelles
      [48.8410, 2.5870], // Noisy-Champs
    ],
  },
  {
    id: "gpe-17",
    name: "Ligne 17 (Saint-Denis Pleyel → Le Mesnil-Amelot)",
    shortName: "L17",
    type: "metro",
    color: "#65a30d", // Olive Green
    status: "UNDER_CONSTRUCTION",
    openingLabel: "2027-2030",
    coords: [
      [48.9200, 2.3450], // Saint-Denis Pleyel
      [48.9210, 2.4000], // La Courneuve Six-Routes
      [48.9350, 2.4260], // Le Bourget RER
      [48.9490, 2.4340], // Le Bourget Aéroport
      [48.9730, 2.4540], // Triangle de Gonesse
      [48.9740, 2.5180], // Parc des Expositions
      [49.0040, 2.5710], // Aéroport CDG 2 TGV
      [49.0180, 2.5920], // Le Mesnil-Amelot
    ],
  },
  {
    id: "gpe-18",
    name: "Ligne 18 (Aéroport d'Orly → Versailles Chantiers)",
    shortName: "L18",
    type: "metro",
    color: "#06b6d4", // Cyan
    status: "UNDER_CONSTRUCTION",
    openingLabel: "2026-2030",
    coords: [
      [48.7260, 2.3650], // Aéroport d'Orly
      [48.7420, 2.3080], // Antonypôle
      [48.7300, 2.2790], // Massy Opéra
      [48.7255, 2.2590], // Massy-Palaiseau
      [48.7130, 2.2100], // Palaiseau
      [48.7020, 2.1720], // Orsay-Gif
      [48.7100, 2.1470], // CEA Saint-Aubin
      [48.7250, 2.1500], // Christ de Saclay
      [48.7660, 2.0670], // Guyancourt
      [48.7880, 2.1060], // Satory
      [48.7950, 2.1350], // Versailles Chantiers
    ],
  },
  {
    id: "rer-e-ouest",
    name: "RER E Ouest (Nanterre La Folie → Mantes-la-Jolie)",
    shortName: "RER E Ouest",
    type: "rer",
    color: "#c026d3", // Magenta
    status: "UNDER_CONSTRUCTION",
    openingLabel: "2026-2027",
    coords: [
      [48.8970, 2.2270], // Nanterre La Folie
      [48.9220, 2.1850], // Houilles-Carrières
      [48.9380, 2.1640], // Sartrouville
      [48.9330, 2.0420], // Poissy
      [48.9380, 1.9990], // Villennes-sur-Seine
      [48.9790, 1.9830], // Vernouillet - Verneuil
      [48.9950, 1.9610], // Les Clairières
      [48.9980, 1.9120], // Les Mureaux
      [48.9720, 1.8480], // Aubergenville
      [48.9610, 1.8150], // Épône - Mézières
      [48.9890, 1.7190], // Mantes Station
      [48.9900, 1.7030], // Mantes-la-Jolie
    ],
  },
  {
    id: "cable-c1",
    name: "Câble C1 (Créteil → Villeneuve-Saint-Georges)",
    shortName: "Câble C1",
    type: "cable",
    color: "#0ea5e9", // Sky Blue
    status: "UNDER_CONSTRUCTION",
    openingLabel: "2025/2026",
    coords: [
      [48.7700, 2.4630], // Créteil Pointe du Lac
      [48.7560, 2.4780], // Limeil-Brévannes
      [48.7470, 2.4720], // Valenton
      [48.7390, 2.4710], // La Végétale
      [48.7310, 2.4640], // Villa Nova
    ],
  },
  {
    id: "metro-1-est",
    name: "Métro 1 Est (Château de Vincennes → Val de Fontenay)",
    shortName: "M1 Est",
    type: "metro",
    color: "#f59e0b", // Amber / Metro 1 yellow
    status: "PLANNED",
    openingLabel: "Post-2030",
    coords: [
      [48.8440, 2.4410], // Château de Vincennes
      [48.8490, 2.4650], // Les Rigollots
      [48.8550, 2.4850], // Val de Fontenay
    ],
  },
  {
    id: "metro-10-est",
    name: "Métro 10 Est (Gare d'Austerlitz → Ivry-Gambetta)",
    shortName: "M10 Est",
    type: "metro",
    color: "#eab308", // Yellow / M10 olive
    status: "PLANNED",
    openingLabel: "Post-2030",
    coords: [
      [48.8420, 2.3660], // Austerlitz
      [48.8350, 2.3680], // Chevaleret
      [48.8300, 2.3780], // BNF
      [48.8230, 2.3850], // Bruneseau
      [48.8140, 2.3920], // Ivry-Gambetta
    ],
  },
  {
    id: "tram-t1-ouest",
    name: "Tram T1 Ouest (Asnières → Rueil-Malmaison)",
    shortName: "T1 Ouest",
    type: "tram",
    color: "#14b8a6", // Teal
    status: "UNDER_CONSTRUCTION",
    openingLabel: "2026-2027",
    coords: [
      [48.9300, 2.2780], // Asnières Quatre Routes
      [48.9240, 2.2470], // Gabriel Péri
      [48.9010, 2.2140], // Nanterre Université
      [48.8910, 2.1850], // Rueil-Malmaison
    ],
  },
  {
    id: "tram-t10-nord",
    name: "Tram T10 Nord (Jardin Parisien → Clamart Gare)",
    shortName: "T10 Nord",
    type: "tram",
    color: "#059669", // Emerald
    status: "PLANNED",
    openingLabel: "2028",
    coords: [
      [48.7900, 2.2450], // Jardin Parisien
      [48.8150, 2.2740], // Clamart Gare
    ],
  },
];

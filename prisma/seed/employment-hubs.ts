/**
 * Major Île-de-France employment hubs — curated seed (PRD §8).
 * jobsCount is an order-of-magnitude estimate used only for relative weighting
 * in the transport/appreciation scoring; coordinates are hub centroids.
 */

export interface HubSeed {
  name: string;
  type:
    | "BUSINESS_DISTRICT"
    | "AIRPORT"
    | "TECH_CLUSTER"
    | "HOSPITAL"
    | "LOGISTICS"
    | "LEISURE";
  jobsCount: number;
  lon: number;
  lat: number;
}

export const EMPLOYMENT_HUBS: HubSeed[] = [
  { name: "Paris CBD (Opéra / QCA)", type: "BUSINESS_DISTRICT", jobsCount: 500_000, lon: 2.3320, lat: 48.8700 },
  { name: "La Défense", type: "BUSINESS_DISTRICT", jobsCount: 180_000, lon: 2.2419, lat: 48.8920 },
  { name: "Saint-Denis / Pleyel", type: "BUSINESS_DISTRICT", jobsCount: 60_000, lon: 2.3450, lat: 48.9200 },
  { name: "Roissy CDG", type: "AIRPORT", jobsCount: 90_000, lon: 2.5479, lat: 49.0097 },
  { name: "Orly Airport", type: "AIRPORT", jobsCount: 28_000, lon: 2.3794, lat: 48.7262 },
  { name: "Paris-Saclay", type: "TECH_CLUSTER", jobsCount: 40_000, lon: 2.1700, lat: 48.7100 },
  { name: "Boulogne-Billancourt", type: "BUSINESS_DISTRICT", jobsCount: 45_000, lon: 2.2400, lat: 48.8350 },
  { name: "Issy-les-Moulineaux", type: "BUSINESS_DISTRICT", jobsCount: 40_000, lon: 2.2730, lat: 48.8240 },
  { name: "Créteil", type: "HOSPITAL", jobsCount: 25_000, lon: 2.4550, lat: 48.7900 },
  { name: "Marne-la-Vallée", type: "BUSINESS_DISTRICT", jobsCount: 30_000, lon: 2.5870, lat: 48.8410 },
  { name: "Disneyland Paris", type: "LEISURE", jobsCount: 17_000, lon: 2.7830, lat: 48.8720 },
  { name: "Massy", type: "BUSINESS_DISTRICT", jobsCount: 20_000, lon: 2.2740, lat: 48.7300 },
  { name: "Rungis (MIN)", type: "LOGISTICS", jobsCount: 12_000, lon: 2.3520, lat: 48.7480 },
];

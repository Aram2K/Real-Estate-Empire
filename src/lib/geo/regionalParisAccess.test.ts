import { describe, expect, it } from "vitest";
import { nearestParisConnectedStation, parisAccessLevelForStation } from "./regionalParisAccess";

describe("regional Paris rail access", () => {
  it("normalizes accents and punctuation in official station names", () => {
    expect(parisAccessLevelForStation("Évreux-Normandie")).toBe("INTERCITY_DIRECT");
    expect(parisAccessLevelForStation("Saint-Pierre-des-Corps")).toBe("HIGH_SPEED_DIRECT");
  });

  it("does not infer Paris access for an unreviewed station", () => {
    expect(parisAccessLevelForStation("Some nearby halt")).toBeNull();
  });

  it("finds the closest reviewed Paris-connected station", () => {
    const result = nearestParisConnectedStation(
      { lat: 49.44, lon: 1.10 },
      [
        { nom: "Rouen Rive Droite", lat: 49.449, lon: 1.094 },
        { nom: "A local halt", lat: 49.441, lon: 1.101 },
      ]
    );
    expect(result?.item.nom).toBe("Rouen Rive Droite");
    expect(result?.item.accessLevel).toBe("INTERCITY_DIRECT");
  });
});

import { expect, it } from "vitest";
import { propertyFacts } from "./propertyFacts";
it("reads explicit floors and keeps building storeys unknown", () => {
  expect(propertyFacts("Au 6ème et dernier étage sans ascenseur")).toEqual({ floor: 6, hasElevator: false });
  expect(propertyFacts("En rez-de-chaussée")).toEqual({ floor: 0 });
  expect(propertyFacts("Immeuble de 6 étages")).toEqual({});
  expect(propertyFacts("Au 5ème étage avec ascenseur")).toEqual({ floor: 5, hasElevator: true });
});

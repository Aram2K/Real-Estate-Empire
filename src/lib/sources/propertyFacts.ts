/** Extract only explicit floor/elevator facts, never the building's floor count. */
export function propertyFacts(description: string, floor?: number, hasElevator?: boolean) {
  const text = description.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const match = text.match(/\b(?:au|en|situe au|situee au)\s+(\d+)\s*(?:er|e|eme|ieme)?\s*(?:et (?:au )?dernier\s+)?etage\b/);
  const ground = /\b(?:en|au) rez[- ]de[- ](?:chaussee|jardin)\b|\bau rdc\b/.test(text);
  const parsedFloor = Number.isInteger(floor) ? floor : match ? Number(match[1]) : ground ? 0 : undefined;
  const parsedElevator = typeof hasElevator === "boolean" ? hasElevator
    : /sans ascenseur/.test(text) ? false : /avec ascenseur/.test(text) ? true : undefined;
  return { ...(parsedFloor !== undefined ? { floor: parsedFloor } : {}), ...(parsedElevator !== undefined ? { hasElevator: parsedElevator } : {}) };
}

export * from "./types";
export { computeAcquisitionCost, computeFinancing, pctOf } from "./acquisition";
export { computeMortgage } from "./mortgage";
export { computeCashFlow } from "./cashflow";
export { computeYields } from "./yields";
export { computeDscr, classifyDscr } from "./dscr";
export {
  classifyWhiteOperation,
  STRONG_CASHFLOW_CENTS,
  EXCELLENT_CASHFLOW_CENTS,
} from "./whiteOperation";
export { computeBreakEven } from "./breakEven";
export { computeNegotiationScenarios } from "./negotiation";
export { analyzeProperty, selectRent } from "./analyze";
export type { AnalyzeInput } from "./analyze";

export const LEAD_STAGE_OPTIONS = [
  "New",
  "Contacted",
  "Qualified",
  "Proposal",
  "Negotiation",
  "Won",
  "Lost"
] as const;

export type LeadStage = (typeof LEAD_STAGE_OPTIONS)[number];


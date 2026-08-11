/**
 * Professional receptionist domain layer (ADR-0046).
 *
 * ResponseOS supplies the interaction, qualification, scheduling,
 * memory, and audit surface. Professional truth — work history,
 * projects, skills — stays behind `ProfessionalKnowledgeProvider`, and
 * downstream career workflows stay behind
 * `ProfessionalHandoffProvider`. Nothing in this directory knows what
 * Career OS looks like inside.
 */

// `intake.ts` is deliberately absent: it is the server-only write path
// (data layer + audit + handoff) and is imported directly by callers
// that already run on the server.

export * from "./authority";
export * from "./intent";
export * from "./policy";
export * from "./receptionist";

/** A pilot capture (ADR-0082) runs on an active assignment; every other capture on a qualification one. */
export function captureAssignmentStatus(capture: { admission_mode: string }) {
  return capture.admission_mode === "pilot" ? "active" as const : "qualification" as const;
}

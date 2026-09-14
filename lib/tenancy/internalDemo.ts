/**
 * The account id of the internal demo tenant.
 *
 * It lives here rather than in the knowledge fixture that first needed
 * it because two layers now resolve the same tenant: the professional
 * knowledge provider serves its records, and `lib/data/agentProfiles`
 * reads its stored disclosure policy for the public demo surface
 * (ADR-0052). Duplicating the string would let those two drift, and the
 * failure would be silent — a page answering from one tenant's records
 * under another tenant's policy.
 */
export const INTERNAL_DEMO_ACCOUNT_ID = "org_tyrone_1";

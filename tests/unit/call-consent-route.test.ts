import { expect, test } from "vitest";
import { sourceTime } from "@/lib/callReview/withdrawal";

const received = new Date('2026-10-19T14:05:00.123Z');
const grant = new Date('2026-10-19T13:55:00.000Z');
test.each(['2026-10-19T14:00:00Z', '2026-10-19T14:00:00.123Z'])('accepts supported UTC precision: %s', occurredAt => {
  expect(sourceTime({ occurredAt, attestation: 'operator_witness' }, received, grant, null)).toMatchObject({ reason: null, parsed: new Date(occurredAt), provenance: 'authenticated_operator_witness' });
});
test.each(['2026-02-30T14:00:00Z', '2026-10-19T14:00:00.1234Z', '2026-10-19T14:00:00', '2026-10-19T14:00:00+00:00', 'yesterday'])('routes unsupported/impossible source format to review: %s', occurredAt => {
  expect(sourceTime({ occurredAt, attestation: 'operator_witness' }, received, grant, null).reason).toBe('invalid_utc_timestamp');
});
test('external text and additional authority fields cannot attest source time', () => {
  expect(sourceTime({ occurredAt: '2026-10-19T14:00:00Z', attestation: 'provider_text' }, received, grant, null).reason).toBe('unverified_source');
  expect(sourceTime({ occurredAt: '2026-10-19T14:00:00Z', attestation: 'operator_witness', actor: 'customer' }, received, grant, null).reason).toBe('unverified_source');
});
test('future, missing chronology and post-end timestamps require review', () => {
  const claim = { occurredAt: '2026-10-19T14:00:00Z', attestation: 'operator_witness' };
  expect(sourceTime(claim, new Date('2026-10-19T13:59:59Z'), grant, null).reason).toBe('future_source_time');
  expect(sourceTime(claim, received, null, null).reason).toBe('before_supported_consent');
  expect(sourceTime(claim, received, grant, new Date('2026-10-19T13:59:59Z')).reason).toBe('after_capture_end');
});

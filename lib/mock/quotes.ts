import { MockQuoteRequest, QuoteRequest } from "@/types/quote";

export const mockQuoteRequests: QuoteRequest[] = [
  MockQuoteRequest({
    id: "quote_mock_1",
    organization_id: "org_mock_1",
    contact_id: "contact_mock_1",
    lead_event_id: "lead_mock_6",
    service_type: "AC tune-up + repair",
    description: "Two-zone unit, upstairs blowing warm air.",
    property_address: "123 Main St, Tampa, FL 33601",
    estimated_value: 95_000,
    status: "reviewing",
  }),
  MockQuoteRequest({
    id: "quote_mock_2",
    organization_id: "org_mock_2",
    contact_id: "contact_mock_3",
    lead_event_id: "lead_mock_8",
    service_type: "Roof replacement",
    description: "Asphalt shingle, ~2,200 sq ft, post-storm assessment.",
    property_address: "880 Gulf Blvd, Clearwater, FL 33755",
    estimated_value: 240_000,
    status: "sent",
  }),
];

export function getMockQuoteRequests(): QuoteRequest[] {
  return mockQuoteRequests;
}

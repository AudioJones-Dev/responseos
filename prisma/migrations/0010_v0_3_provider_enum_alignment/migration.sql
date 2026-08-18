-- Stage B only: align stored provider identifiers with ADR-0031 and ADR-0037.
-- This migration adds no credentials, live adapters, routes, or provider traffic.
ALTER TYPE "CallProvider" ADD VALUE 'telnyx';
ALTER TYPE "CalendarProvider" ADD VALUE 'calendly';
ALTER TYPE "ProviderConnectionProvider" ADD VALUE 'telnyx';
ALTER TYPE "ProviderConnectionProvider" ADD VALUE 'calendly';
ALTER TYPE "SmsProvider" ADD VALUE 'telnyx';

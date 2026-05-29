-- ResponseOS v0.2 closeout step 2: Booking -> Appointment rename.
--
-- Renames in-place: the enum type, the Booking table, the primary-key
-- constraint, and every index. No data shape changes. No foreign-key
-- constraints to rebuild (Prisma schema uses logical FKs without
-- @relation). No other table holds a booking_id column, so the rename
-- is fully contained within the Booking/Appointment surface.
--
-- See ADR-0019 step 2.2 and roadmap checkpoint issue #27.

-- 1. Rename the enum type.
ALTER TYPE "BookingStatus" RENAME TO "AppointmentStatus";

-- 2. Rename the table.
ALTER TABLE "Booking" RENAME TO "Appointment";

-- 3. Rename the primary-key constraint.
ALTER TABLE "Appointment" RENAME CONSTRAINT "Booking_pkey" TO "Appointment_pkey";

-- 4. Rename the indexes. Note: Booking_account_id_idx is itself a renamed
--    artifact of migration 0002 (originally Booking_organization_id_idx in
--    0001); the chain is preserved by renaming the current name forward.
ALTER INDEX "Booking_account_id_idx" RENAME TO "Appointment_account_id_idx";
ALTER INDEX "Booking_contact_id_idx" RENAME TO "Appointment_contact_id_idx";
ALTER INDEX "Booking_lead_event_id_idx" RENAME TO "Appointment_lead_event_id_idx";
ALTER INDEX "Booking_start_time_idx" RENAME TO "Appointment_start_time_idx";

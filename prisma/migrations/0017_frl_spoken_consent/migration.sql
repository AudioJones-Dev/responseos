ALTER TABLE "FrlPilotDeletion" ALTER COLUMN "recording_id" DROP NOT NULL, ADD COLUMN "call_control_id" TEXT, ADD COLUMN "call_leg_id" TEXT, ADD COLUMN "call_session_id" TEXT;

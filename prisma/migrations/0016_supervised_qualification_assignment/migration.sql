ALTER TYPE "TelephonyNumberAssignmentStatus" ADD VALUE 'qualification';

ALTER TABLE "CallCaptureSession" ADD COLUMN "assignment_id" TEXT;

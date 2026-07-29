-- @polsia:user-owned — Add submission audit fields to bid_drafts.
-- Forward-only. Adds three nullable columns so existing rows survive:
--   - submitted_at        (TIMESTAMP(3), null when never submitted)
--   - submitted_by_user_id (TEXT, null when never submitted)
--   - submission_audit    (JSONB, null when never submitted)
-- All three are populated by the POST /api/bids/<id>/submit handler inside
-- a single transaction that also flips status to 'SUBMITTED'.
-- Mirrors the nullable-precedent on sam_scrape_runs (owner_user_id /
-- submitted_by_user_id).

-- AlterTable
ALTER TABLE "bid_drafts" ADD COLUMN "submitted_at" TIMESTAMP(3);
ALTER TABLE "bid_drafts" ADD COLUMN "submitted_by_user_id" TEXT;
ALTER TABLE "bid_drafts" ADD COLUMN "submission_audit" JSONB;

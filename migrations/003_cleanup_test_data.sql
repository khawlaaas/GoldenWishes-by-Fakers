-- ============================================================
-- Golden Wishes — migration 003: remove data left by the app's automated tests
-- Run ONCE with the OWNER account (gw_app cannot delete donors):
--   psql "$OWNER_DATABASE_URL" -f migrations/003_cleanup_test_data.sql
--
-- What it deletes (checked on 2026-09-27 against the live database):
--   donors: 1 row
--     65c021eb-9e75-4982-8926-1bda65134b01  "Test2"  test-donor@example.org  total_donated 0.00
--   wishes: 0 rows. The tests that submitted/approved wishes ran inside transactions
--     that were rolled back. The 2 'ai_intake' wishes in pending_review
--     ("A brand-new premium school backpack", "A school bag with supplies for a new
--     school year") are the team's seeded demo submissions: they are NOT touched.
--   donations, volunteer_applications, partner_requests: 0 rows (demo donations were
--     already removed with reset_demo_donations(), test forms were rolled back).
--
-- Safe: it only deletes the donor by exact id AND email, and stops without deleting
-- anything if that donor has donations or a non-zero total (i.e. real activity).
-- Safe to run twice (the second run finds nothing).
-- ============================================================

BEGIN;

-- Preview: the rows that will be deleted.
SELECT id, full_name, email, total_donated, created_at
  FROM donors
 WHERE id = '65c021eb-9e75-4982-8926-1bda65134b01'
   AND email = 'test-donor@example.org';

DO $$
DECLARE
  n_donations INTEGER;
  total       NUMERIC;
  removed     INTEGER;
BEGIN
  SELECT count(*) INTO n_donations
    FROM donations
   WHERE donor_id = '65c021eb-9e75-4982-8926-1bda65134b01';
  SELECT total_donated INTO total
    FROM donors
   WHERE id = '65c021eb-9e75-4982-8926-1bda65134b01';

  IF n_donations > 0 OR COALESCE(total, 0) <> 0 THEN
    RAISE EXCEPTION 'Test donor has % donation(s) / total %: not deleting, check by hand', n_donations, total;
  END IF;

  DELETE FROM donors
   WHERE id = '65c021eb-9e75-4982-8926-1bda65134b01'
     AND email = 'test-donor@example.org';
  GET DIAGNOSTICS removed = ROW_COUNT;
  RAISE NOTICE 'Removed % test donor row(s)', removed;
END $$;

COMMIT;

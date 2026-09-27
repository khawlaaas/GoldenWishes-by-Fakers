-- ============================================================
-- Golden Wishes — migration 002: limited database user for the website
-- The website (Netlify Functions) must NOT connect with the owner account.
-- gw_app can read, insert and update data, and delete demo donations only.
-- It cannot delete wishes, drop tables or change the structure.
--
-- BEFORE RUNNING: replace CHANGE_ME_STRONG_PASSWORD with a long random password
-- in your local copy only. Never commit the real password.
-- On Neon you can also create the role in the console, then run the GRANTs.
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gw_app') THEN
    CREATE ROLE gw_app LOGIN PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO gw_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO gw_app;
GRANT DELETE ON donations TO gw_app;                 -- needed by reset_demo_donations()
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO gw_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO gw_app;

-- ══════════════════════════════════════════════════════════════
-- EARNOVA — Daily Quiz আপডেট
-- Supabase Dashboard → SQL Editor → New query → পুরোটা paste → Run
-- (একাধিকবার চালালেও সমস্যা নেই)
-- ══════════════════════════════════════════════════════════════

-- প্রতিদিনের কুইজের অগ্রগতি (যেমন {"2026-10-11_0":1, "2026-10-11_1":0})
ALTER TABLE users ADD COLUMN IF NOT EXISTS quiz_progress JSONB DEFAULT '{}'::jsonb;

-- একটা প্রশ্ন atomically "claim" করে: একই প্রশ্নে দ্বিতীয়বার true ফেরত দেয় না,
-- তাই একই প্রশ্নের রিওয়ার্ড দুইবার পাওয়া যায় না। পুরনো দিনের এন্ট্রি নিজে থেকে মুছে যায়।
CREATE OR REPLACE FUNCTION claim_quiz(p_uid text, p_day text, p_idx int, p_ok int)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  k text := p_day || '_' || p_idx;
  n int;
BEGIN
  IF auth.uid() IS NULL OR auth.uid()::text <> p_uid THEN RETURN false; END IF;
  IF p_idx < 0 OR p_idx > 9 OR p_ok NOT IN (0,1) THEN RETURN false; END IF;
  UPDATE users
     SET quiz_progress =
       (SELECT COALESCE(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
          FROM jsonb_each(COALESCE(quiz_progress,'{}'::jsonb)) e
         WHERE e.key LIKE p_day || '\_%')
       || jsonb_build_object(k, p_ok)
   WHERE id::text = p_uid
     AND NOT (COALESCE(quiz_progress,'{}'::jsonb) ? k);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n = 1;
END $$;

GRANT EXECUTE ON FUNCTION claim_quiz(text,text,int,int) TO authenticated;

NOTIFY pgrst, 'reload schema';

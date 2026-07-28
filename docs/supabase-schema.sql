-- =====================================================
-- ghstCandidate — Supabase Schema
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/qhmpiwvzatdnbevrcmyp/sql
-- =====================================================


-- ── 1. Profiles ──────────────────────────────────────────────────
-- Stores the candidate's profile extracted from their CV and
-- enriched by the Ghost Profiler chatbot.

CREATE TABLE IF NOT EXISTS public.profiles (
  id                uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  name              text,
  email             text,
  target_roles      jsonb    DEFAULT '[]'::jsonb,
  locations         jsonb    DEFAULT '[]'::jsonb,
  skills            jsonb    DEFAULT '[]'::jsonb,
  raw_resume_text        text     DEFAULT '',
  raw_cover_letter_text  text     DEFAULT '',
  -- Dynamic facts injected by the Ghost Profiler (salary, github, visa, etc.)
  extra_data             jsonb    DEFAULT '{}'::jsonb,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now()
);

-- Auto-update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: users can only read/write their own profile
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: select own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles: insert own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles: update own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles: delete own" ON public.profiles
  FOR DELETE USING (auth.uid() = id);


-- ── 2. Jobs (Kanban) ─────────────────────────────────────────────
-- Stores all scraped and analysed jobs for a user's Kanban board.

CREATE TABLE IF NOT EXISTS public.jobs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  company              text,
  title                text,
  location             text,
  posted_ago           text,
  match_score          integer DEFAULT 0,
  "column"             text    DEFAULT 'review'
                       CHECK ("column" IN ('discovered', 'review', 'applied')),
  verdict              text,
  matches_found        jsonb   DEFAULT '[]'::jsonb,
  missing_or_weak      jsonb   DEFAULT '[]'::jsonb,
  human_input_required jsonb   DEFAULT '[]'::jsonb,
  source_url           text,
  -- Phase 11: Graceful failure fields
  needs_input          boolean DEFAULT false,
  missing_field        text,
  created_at           timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jobs: select own" ON public.jobs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "jobs: insert own" ON public.jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "jobs: update own" ON public.jobs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "jobs: delete own" ON public.jobs
  FOR DELETE USING (auth.uid() = user_id);


-- ── 3. Chat History ──────────────────────────────────────────────
-- Stores the full conversation history with the Ghost Profiler AI.

CREATE TABLE IF NOT EXISTS public.chat_history (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('user', 'ghost')),
  text       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_history: select own" ON public.chat_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "chat_history: insert own" ON public.chat_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "chat_history: delete own" ON public.chat_history
  FOR DELETE USING (auth.uid() = user_id);


-- ── 4. Global Jobs (Data Lake) ───────────────────────────────────
-- Centralized data lake for jobs fetched from official APIs.

CREATE TABLE IF NOT EXISTS public.global_jobs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title          text,
  company        text,
  location       text,
  description    text,
  apply_url      text UNIQUE,
  api_source     text,
  created_at     timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.global_jobs ENABLE ROW LEVEL SECURITY;

-- Auth users can read all global jobs
CREATE POLICY "global_jobs: select auth" ON public.global_jobs
  FOR SELECT USING (auth.role() = 'authenticated');

-- Service role / backend can insert jobs (using service key or assuming standard insert for now)
-- We will allow authenticated users to insert, but in practice it will be the backend.
CREATE POLICY "global_jobs: insert auth" ON public.global_jobs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');


-- ── 5. Candidate Memories ────────────────────────────────────────
-- Stores individual facts the Ghost Brain learns about the candidate.

CREATE TABLE IF NOT EXISTS public.candidate_memories (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  memory_key   text NOT NULL,
  memory_value text NOT NULL,
  source       text NOT NULL,
  created_at   timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.candidate_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "candidate_memories: select own" ON public.candidate_memories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "candidate_memories: insert own" ON public.candidate_memories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "candidate_memories: update own" ON public.candidate_memories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "candidate_memories: delete own" ON public.candidate_memories
  FOR DELETE USING (auth.uid() = user_id);


-- ── 6. Generated Documents ───────────────────────────────────────
-- Stores metadata about custom PDFs (CVs, cover letters) generated for applications.

CREATE TABLE IF NOT EXISTS public.generated_docs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  job_title     text,
  company       text,
  doc_type      text,
  file_path     text,
  changes_made  text,
  reasoning     text,
  created_at    timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.generated_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "generated_docs: select own" ON public.generated_docs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "generated_docs: insert own" ON public.generated_docs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "generated_docs: delete own" ON public.generated_docs
  FOR DELETE USING (auth.uid() = user_id);

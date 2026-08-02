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
  first_name        text,
  last_name         text,
  phone             text,
  linkedin_url      text,
  github_url        text,
  portfolio_url     text,
  target_roles      jsonb    DEFAULT '[]'::jsonb,
  locations         jsonb    DEFAULT '[]'::jsonb,
  skills            jsonb    DEFAULT '[]'::jsonb,
  raw_resume_text        text     DEFAULT '',
  raw_cover_letter_text  text     DEFAULT '',
  
  -- ATS Screening Fields (Phase 24.7 & 25.2)
  auth_to_work           boolean,
  needs_sponsorship      boolean,
  felony_conviction      boolean,
  education_level        text,
  highest_degree_major   text,
  years_of_experience    integer,
  salary_expectation     text,
  notice_period          text,
  relocation             boolean,
  work_environment       text,
  willing_to_travel      text,
  willing_to_relocate    boolean,

  -- Dynamic facts injected by the Ghost Profiler
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

-- Add ATS-native ID for smarter deduplication
ALTER TABLE public.global_jobs ADD COLUMN IF NOT EXISTS ats_id text;

-- Create composite unique index for cross-ATS deduplication
-- (same job ID from different ATS platforms won't collide)
CREATE UNIQUE INDEX IF NOT EXISTS idx_global_jobs_source_ats
  ON public.global_jobs (api_source, ats_id)
  WHERE ats_id IS NOT NULL;

-- Auth users can read all global jobs
CREATE POLICY "global_jobs: select auth" ON public.global_jobs
  FOR SELECT USING (auth.role() = 'authenticated');

-- Service role / backend can insert jobs (using service key or assuming standard insert for now)
-- We will allow authenticated users to insert, but in practice it will be the backend.
CREATE POLICY "global_jobs: insert auth" ON public.global_jobs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Allow backend (service role) to delete stale jobs (used by the Sweeper cron)
CREATE POLICY "global_jobs: delete service" ON public.global_jobs
  FOR DELETE USING (auth.role() = 'service_role');


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
  job_id        uuid REFERENCES public.jobs (id) ON DELETE CASCADE,
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

-- ── 7. Waitlist ──────────────────────────────────────────────────
-- Stores users who have joined the waitlist for the closed beta.

CREATE TABLE IF NOT EXISTS public.waitlist (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text,
  surname           text,
  email             text NOT NULL,
  phone             text,
  inform_on_launch  boolean NOT NULL DEFAULT false,
  keep_posted       boolean DEFAULT false,
  created_at        timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Allow service role to do everything (implicit bypass)
-- Allow anon/authenticated to insert via API (if we want direct insert). 
-- Wait, the backend will insert it using service role, so we don't strictly need insert policy for anon.
CREATE TABLE IF NOT EXISTS public.waitlist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    surname TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    inform_on_launch BOOLEAN DEFAULT TRUE,
    keep_posted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Allow public anonymous inserts
CREATE POLICY "Allow anonymous inserts" ON public.waitlist
    FOR INSERT WITH CHECK (true);
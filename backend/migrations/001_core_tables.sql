-- Migration: 001_core_tables
-- Description: Creates the foundational tables for profiles, global data lake, and user kanban jobs.

-- 1. Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    email TEXT,
    target_roles TEXT[] DEFAULT '{}',
    locations TEXT[] DEFAULT '{}',
    skills TEXT[] DEFAULT '{}',
    raw_resume_text TEXT,
    extra_data JSONB DEFAULT '{}'::jsonb,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 2. Global Jobs Data Lake
CREATE TABLE IF NOT EXISTS public.global_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    location TEXT NOT NULL,
    description TEXT,
    apply_url TEXT UNIQUE NOT NULL,
    api_source TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.global_jobs ENABLE ROW LEVEL SECURITY;

-- Anyone can read from the data lake (used by Hunter)
CREATE POLICY "Public read access to global_jobs"
    ON public.global_jobs FOR SELECT
    USING (true);

-- Only service role (cron) can insert/update/delete global jobs
-- (Service role bypasses RLS automatically)

-- 3. User Kanban Jobs
CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    location TEXT,
    posted_ago TEXT,
    match_score INTEGER DEFAULT 0,
    column TEXT NOT NULL DEFAULT 'discovered', -- discovered, review, applied
    verdict TEXT,
    matches_found TEXT[] DEFAULT '{}',
    missing_or_weak TEXT[] DEFAULT '{}',
    human_input_required TEXT[] DEFAULT '{}',
    source_url TEXT,
    needs_input BOOLEAN DEFAULT false,
    missing_field TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own jobs"
    ON public.jobs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own jobs"
    ON public.jobs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own jobs"
    ON public.jobs FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own jobs"
    ON public.jobs FOR DELETE
    USING (auth.uid() = user_id);

-- 4. Waitlist
CREATE TABLE IF NOT EXISTS public.waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Anyone can insert into waitlist (public endpoint)
CREATE POLICY "Public can join waitlist"
    ON public.waitlist FOR INSERT
    WITH CHECK (true);

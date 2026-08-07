-- Migration: 004_generated_docs
-- Description: Stores metadata and storage links for generated resumes and cover letters.

CREATE TABLE IF NOT EXISTS public.generated_docs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
    job_title TEXT NOT NULL,
    company TEXT NOT NULL,
    doc_type TEXT NOT NULL CHECK (doc_type IN ('resume', 'cover_letter')),
    file_path TEXT NOT NULL, -- The storage URL
    resume_url TEXT,         -- Alias/helper if they exist
    cover_letter_url TEXT,
    changes_made TEXT,
    reasoning TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.generated_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own generated docs"
    ON public.generated_docs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generated docs"
    ON public.generated_docs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own generated docs"
    ON public.generated_docs FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own generated docs"
    ON public.generated_docs FOR DELETE
    USING (auth.uid() = user_id);

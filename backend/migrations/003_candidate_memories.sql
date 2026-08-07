-- Migration: 003_candidate_memories
-- Description: Stores distinct facts extracted by the AI about the candidate over time.

CREATE TABLE IF NOT EXISTS public.candidate_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    memory_key TEXT NOT NULL,
    memory_value TEXT NOT NULL,
    source TEXT NOT NULL, -- e.g., 'ghost_chat', 'bottleneck_jit', 'user_added'
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.candidate_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own memories"
    ON public.candidate_memories FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own memories"
    ON public.candidate_memories FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own memories"
    ON public.candidate_memories FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own memories"
    ON public.candidate_memories FOR DELETE
    USING (auth.uid() = user_id);

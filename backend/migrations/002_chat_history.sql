-- Migration: 002_chat_history
-- Description: Stores the conversation history for the Ghost Profiler (AI Chat).

CREATE TABLE IF NOT EXISTS public.chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'ghost')),
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat history"
    ON public.chat_history FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat history"
    ON public.chat_history FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Usually we don't update/delete chat history, but adding delete for account cleanup
CREATE POLICY "Users can delete own chat history"
    ON public.chat_history FOR DELETE
    USING (auth.uid() = user_id);

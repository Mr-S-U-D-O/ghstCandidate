-- Migration: Admin Dashboard & Apify Fleet Manager
-- Execute this script in your Supabase SQL Editor

-- 1. Add is_admin to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- 2. Create the apify_fleet_configs table
CREATE TABLE IF NOT EXISTS public.apify_fleet_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    niche_name TEXT NOT NULL,
    api_key TEXT NOT NULL,
    search_queries TEXT[] NOT NULL DEFAULT '{}',
    max_items_per_actor INTEGER NOT NULL DEFAULT 200,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.apify_fleet_configs ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies for apify_fleet_configs
-- Only users with is_admin = true can perform operations on this table
CREATE POLICY "Admins can SELECT apify_fleet_configs"
    ON public.apify_fleet_configs FOR SELECT
    USING (
        auth.uid() IN (
            SELECT id FROM public.profiles WHERE is_admin = true
        )
    );

CREATE POLICY "Admins can INSERT apify_fleet_configs"
    ON public.apify_fleet_configs FOR INSERT
    WITH CHECK (
        auth.uid() IN (
            SELECT id FROM public.profiles WHERE is_admin = true
        )
    );

CREATE POLICY "Admins can UPDATE apify_fleet_configs"
    ON public.apify_fleet_configs FOR UPDATE
    USING (
        auth.uid() IN (
            SELECT id FROM public.profiles WHERE is_admin = true
        )
    )
    WITH CHECK (
        auth.uid() IN (
            SELECT id FROM public.profiles WHERE is_admin = true
        )
    );

CREATE POLICY "Admins can DELETE apify_fleet_configs"
    ON public.apify_fleet_configs FOR DELETE
    USING (
        auth.uid() IN (
            SELECT id FROM public.profiles WHERE is_admin = true
        )
    );

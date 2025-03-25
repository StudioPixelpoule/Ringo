/*
  # Remove reports functionality

  1. Drop Tables
    - Drop reports table
    - Drop report_templates table

  2. Clean Up
    - Remove any related data from storage
*/

-- Drop reports table
DROP TABLE IF EXISTS public.reports;

-- Drop report_templates table
DROP TABLE IF EXISTS public.report_templates;

-- Remove report files from storage
DELETE FROM storage.objects WHERE name LIKE 'reports/%';
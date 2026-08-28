-- Phase 4: owner/manager workforce statistics (enum value must commit before use)
alter type public.app_permission add value if not exists 'stats.read';

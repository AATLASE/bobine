-- Rollback of 20261120100000_leave_space.sql.
-- People who already left stay gone: this only removes the functions.
drop function if exists public.leave_space(uuid);
drop function if exists public.leave_space_preview(uuid);
drop function if exists public.leave_space_plan(uuid, uuid);

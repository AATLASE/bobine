-- Rollback of 20261117130000_delete_account.sql.
-- Accounts already deleted stay deleted: this only removes the functions.
drop function if exists public.delete_my_account();
drop function if exists public.account_deletion_preview();
drop function if exists public.account_deletion_plan(uuid);
drop policy if exists "episode-media: uploader reads own" on storage.objects;
drop policy if exists "episode-media: uploader removes own" on storage.objects;

-- Rollback of 20261031120000_ideas_and_profile_policies.sql
drop policy if exists "ideas_delete_owner_or_author" on public.ideas;
drop policy if exists "idea_votes_insert_own" on public.idea_votes;
create policy "idea_votes_insert_own" on public.idea_votes
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "profiles_insert_own" on public.profiles;

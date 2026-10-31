-- Ideas tab and profile fallback: rules the app relied on but the database
-- never had (found by replaying every app write on 2026-10-31).
--
-- 1. Deleting an idea did nothing: there was no DELETE policy on ideas, so the
--    owner's or the author's trash button removed 0 rows without an error.
-- 2. Any signed-in account could vote on any idea, from any space, if it knew
--    the id. Votes now follow the same rule as proposing: participants of that
--    space only (the screen already says "Seuls les membres peuvent voter").
-- 3. The app creates a missing profile row as a fallback (providers/auth.tsx);
--    profiles had no INSERT policy, so that fallback always failed.

-- 1. Delete an idea: the space owner or whoever proposed it ------------------
drop policy if exists "ideas_delete_owner_or_author" on public.ideas;
create policy "ideas_delete_owner_or_author" on public.ideas
  for delete to authenticated
  using (proposed_by = auth.uid() or public.my_space_role(space_id) = 'owner');

-- 2. Votes: participants of the idea's space ---------------------------------
drop policy if exists "idea_votes_insert_own" on public.idea_votes;
create policy "idea_votes_insert_own" on public.idea_votes
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.ideas i
      where i.id = idea_votes.idea_id and public.my_is_contributor(i.space_id)
    )
  );

-- 3. Profile fallback: your own row only --------------------------------------
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

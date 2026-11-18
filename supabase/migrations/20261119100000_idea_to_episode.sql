-- An idea can become an episode.
--
-- Ideas were proposed and voted on, then nothing: the list only grew, and the
-- outing the group finally did had no link with the idea it came from. An idea
-- now remembers the episode it turned into and moves to "done" (a status the
-- table has had from the start, never used by the app).

alter table public.ideas
  add column if not exists episode_id uuid references public.episodes (id) on delete set null;

create index if not exists ideas_episode_id_idx on public.ideas (episode_id);

-- Only the space owner may update an idea directly (ideas_update_owner), and
-- episodes are created by any participant: the link goes through this function.
create or replace function public.link_idea_to_episode(p_idea_id uuid, p_episode_id uuid)
  returns void
  language plpgsql security definer
  set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_space uuid;
  v_episode_space uuid;
  v_episode_author uuid;
begin
  if v_user is null then
    raise exception 'Connecte-toi pour continuer.';
  end if;

  select i.space_id into v_space from public.ideas i where i.id = p_idea_id;
  if v_space is null then
    raise exception 'Cette idée n''existe plus.';
  end if;

  select e.space_id, e.created_by into v_episode_space, v_episode_author
  from public.episodes e where e.id = p_episode_id;
  if v_episode_space is distinct from v_space then
    raise exception 'Cet épisode n''appartient pas au même espace que l''idée.';
  end if;

  -- Whoever created the episode, or the owner; and still a participant.
  if not public.my_is_contributor(v_space)
     or (v_episode_author is distinct from v_user and public.my_space_role(v_space) is distinct from 'owner') then
    raise exception 'Seul l''auteur de l''épisode ou le propriétaire peut relier une idée à un épisode.';
  end if;

  update public.ideas
  set status = 'done', episode_id = p_episode_id, updated_at = now()
  where id = p_idea_id;
end;
$$;

revoke execute on function public.link_idea_to_episode(uuid, uuid) from public, anon;
grant execute on function public.link_idea_to_episode(uuid, uuid) to authenticated;

-- An episode deleted (a mistake, a duplicate) gives its idea back to the vote.
create or replace function public.episodes_before_delete_release_idea()
  returns trigger
  language plpgsql security definer
  set search_path = public
as $$
begin
  update public.ideas
  set status = 'voting', updated_at = now()
  where episode_id = old.id;
  return old;
end;
$$;

revoke execute on function public.episodes_before_delete_release_idea() from public, anon, authenticated;

drop trigger if exists episodes_release_idea on public.episodes;
create trigger episodes_release_idea
  before delete on public.episodes
  for each row execute function public.episodes_before_delete_release_idea();

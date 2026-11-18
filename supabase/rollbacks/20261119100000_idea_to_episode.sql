-- Rollback of 20261119100000_idea_to_episode.
-- Ideas marked "done" go back to the vote: the previous app showed every idea
-- in one list and knew nothing of the link.
drop trigger if exists episodes_release_idea on public.episodes;
drop function if exists public.episodes_before_delete_release_idea();
drop function if exists public.link_idea_to_episode(uuid, uuid);

update public.ideas set status = 'voting' where episode_id is not null and status = 'done';

drop index if exists public.ideas_episode_id_idx;
alter table public.ideas drop column if exists episode_id;

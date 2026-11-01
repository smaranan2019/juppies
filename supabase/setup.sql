-- =============================================================================
-- Juppies database: tables, security rules and the functions the app calls.
--
-- Paste this whole file into Supabase → SQL Editor → Run.
-- It is safe to run again after an update: nothing here deletes team data.
--
-- Security model
--   * Browsers use the public "anon" key. They can READ the team's public data
--     and can only WRITE by calling the functions in this file, which check
--     every rule. Direct inserts/updates/deletes are refused.
--   * Admins sign in with a shared PIN, which only the database can check. A
--     correct PIN returns a session token that the app sends with each request
--     (see is_admin()). Set or change the PIN with set_admin_pin() below.
--   * Rules mirrored in the browser (for instant feedback) say so in comments;
--     this file is the source of truth.
-- =============================================================================


-- Supabase keeps extensions in their own schema; bcrypt comes from pgcrypto.
create extension if not exists pgcrypto schema extensions;


-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

create table if not exists public.settings (
  id boolean primary key default true check (id),  -- exactly one row
  training_lock_hours int not null default 2 check (training_lock_hours between 0 and 72),
  match_lock_hours int not null default 12 check (match_lock_hours between 0 and 168),
  weeks_ahead int not null default 3 check (weeks_ahead between 1 and 12),
  training_start date not null default current_date,
  match_venue text not null default '' check (length(match_venue) <= 120)
);
insert into public.settings default values on conflict do nothing;

-- Left over from email sign-in.
drop table if exists public.admins;

-- The shared admin PIN (bcrypt hash only) and the lock on repeated wrong guesses.
create table if not exists public.admin_pin (
  id boolean primary key default true check (id),  -- exactly one row
  pin_hash text not null,
  failed_attempts int not null default 0,
  locked_until timestamptz
);

-- Signed-in admin devices. Only token hashes are stored, so a leak can't sign anyone in.
create table if not exists public.admin_sessions (
  token_hash bytea primary key,
  expires_at timestamptz not null
);

create table if not exists public.players (
  name text primary key check (length(name) between 1 and 60 and name = trim(name)),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Weekly trainings; sessions are generated from these by ensure_trainings().
create table if not exists public.training_slots (
  id bigint generated always as identity primary key,
  weekday smallint not null check (weekday between 0 and 6),  -- 0 = Sunday
  start_time time not null,
  end_time time
);
insert into public.training_slots (weekday, start_time, end_time)
select * from (values (2, time '18:45', time '21:30'), (6, time '08:45', time '11:30')) as defaults
where not exists (select 1 from public.training_slots);

-- Readable ids (see session ids in js/logic/ids.js), so rows are recognisable.
create table if not exists public.sessions (
  id text primary key,
  type text not null check (type in ('Training', 'Match')),
  date date not null,
  start_time time not null,
  end_time time,
  opponent text not null default '' check (length(opponent) <= 80),
  status text not null default 'Active' check (status in ('Active', 'Cancelled')),
  note text not null default '' check (length(note) <= 200)
);
create index if not exists sessions_date_idx on public.sessions (date);

create table if not exists public.rsvps (
  session_id text not null references public.sessions (id) on delete cascade,
  player text not null references public.players (name) on update cascade on delete cascade,
  status text not null check (status in ('Going', 'Not going', 'TBC')),
  reason text not null default '' check (length(reason) <= 200),
  updated_at timestamptz not null default now(),
  primary key (session_id, player)
);

create table if not exists public.videos (
  id bigint generated always as identity primary key,
  session_id text not null references public.sessions (id) on delete cascade,
  title text not null default 'Video' check (length(title) <= 100),
  -- Only canonical YouTube links are ever stored (see add_video).
  url text not null check (url ~ '^https://www\.youtube\.com/watch\?v=[A-Za-z0-9_-]{11}$'),
  added_at timestamptz not null default now()
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null default 'Anonymous' check (length(name) <= 60),
  session_id text references public.sessions (id) on delete set null,
  message text not null check (length(message) between 1 and 2000),
  status text not null default 'New' check (status in ('New', 'Seen', 'Done'))
);

create table if not exists public.match_results (
  session_id text primary key references public.sessions (id) on delete cascade,
  our_score int not null check (our_score between 0 and 99),
  their_score int not null check (their_score between 0 and 99),
  player_of_match text references public.players (name) on update cascade on delete set null,
  updated_at timestamptz not null default now()
);

-- One row per player who played a match. Being listed means they played.
create table if not exists public.player_stats (
  session_id text not null references public.sessions (id) on delete cascade,
  player text not null references public.players (name) on update cascade on delete cascade,
  goals int not null default 0 check (goals between 0 and 99),
  assists int not null default 0 check (assists between 0 and 99),
  primary key (session_id, player)
);


-- ----------------------------------------------------------------------------
-- Helpers (internal: not callable from the browser, see Grants)
-- ----------------------------------------------------------------------------

-- Hash of the session token sent in this request's x-admin-token header.
create or replace function public.admin_token_hash() returns bytea
language sql stable as $$
  select sha256(convert_to(coalesce(
    nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-admin-token', ''), 'UTF8'));
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from admin_sessions
    where token_hash = admin_token_hash() and expires_at > now()
  );
$$;

create or replace function public.require_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'Admins only. Sign in with the admin PIN first.' using errcode = '42501';
  end if;
end;
$$;

-- Free text from the app: trimmed and capped.
create or replace function public.clean_text(value text, max_length int) returns text
language sql immutable as $$ select left(trim(coalesce(value, '')), max_length) $$;

-- ('2026-09-13', 'NUS Titans') -> 'M-20260913-nus-titans'. Mirrors matchId in js/logic/ids.js.
create or replace function public.match_id(match_date date, opponent text) returns text
language sql immutable as $$
  select 'M-' || to_char(match_date, 'YYYYMMDD') || '-' || coalesce(
    nullif(trim(both '-' from regexp_replace(lower(coalesce(opponent, '')), '[^a-z0-9]+', '-', 'g')), ''),
    'match');
$$;

-- The 11-character id from an https YouTube link, else null. Mirrors youTubeId in js/logic/ids.js.
create or replace function public.youtube_id(url text) returns text
language sql immutable as $$
  select case when trim(coalesce(url, '')) ~* '^https://(www\.|m\.)?(youtube\.com|youtu\.be)/'
    then substring(trim(url) from '(?:youtu\.be/|v=|/embed/|/shorts/|/live/)([A-Za-z0-9_-]{11})')
  end;
$$;

-- Sessions happen in Singapore.
create or replace function public.session_start(session_date date, start_time time) returns timestamptz
language sql immutable as $$ select (session_date + start_time) at time zone 'Asia/Singapore' $$;

-- 'yyyy-mm-dd' text -> date, with a readable error.
create or replace function public.parse_date(value text) returns date
language plpgsql immutable as $$
begin
  if coalesce(value, '') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Date must be yyyy-mm-dd'; end if;
  return value::date;
end;
$$;

-- 'HH:MM' text -> time ('' or null -> null), with a readable error.
create or replace function public.parse_time(value text) returns time
language plpgsql immutable as $$
begin
  if coalesce(value, '') = '' then return null; end if;
  if value !~ '^\d{1,2}:\d{2}$' then raise exception 'Times must be HH:MM'; end if;
  return value::time;
end;
$$;

/*
 * Problems with a match result (empty array = valid). Player goals may add up
 * to less than our score: own goals by the opponent count without a scorer.
 * Mirrors validateMatchResult in js/logic/match-result.js.
 */
create or replace function public.match_result_errors(
  p_our_score int, p_their_score int, p_player_of_match text, lineup jsonb
) returns text[]
language plpgsql stable set search_path = public as $$
declare
  errors text[] := '{}';
  total_goals numeric;
  total_assists numeric;
begin
  if p_our_score is null or p_their_score is null or p_our_score not between 0 and 99 or p_their_score not between 0 and 99 then
    errors := errors || 'Scores must be whole numbers from 0 to 99.'::text;
  end if;

  errors := errors || coalesce((
    select array_agg(x.player || ' is not on the team list.')
    from jsonb_to_recordset(lineup) as x (player text)
    where not exists (select 1 from players p where p.name = x.player)), '{}');
  errors := errors || coalesce((
    select array_agg(d.player || ' is listed twice.')
    from (select x.player from jsonb_to_recordset(lineup) as x (player text) group by x.player having count(*) > 1) d), '{}');
  errors := errors || coalesce((
    select array_agg(x.player || ': goals and assists must be whole numbers.')
    from jsonb_to_recordset(lineup) as x (player text, goals numeric, assists numeric)
    where x.goals is null or x.assists is null or x.goals <> trunc(x.goals) or x.assists <> trunc(x.assists)
       or x.goals not between 0 and 99 or x.assists not between 0 and 99), '{}');

  select coalesce(sum(x.goals), 0), coalesce(sum(x.assists), 0) into total_goals, total_assists
  from jsonb_to_recordset(lineup) as x (goals numeric, assists numeric);
  if p_our_score between 0 and 99 then
    if total_goals > p_our_score then
      errors := errors || format('Player goals (%s) add up to more than our score (%s).', total_goals, p_our_score);
    end if;
    if total_assists > p_our_score then
      errors := errors || format('Assists (%s) can''t be more than our score (%s).', total_assists, p_our_score);
    end if;
  end if;

  if coalesce(p_player_of_match, '') <> '' and not exists (
    select 1 from jsonb_to_recordset(lineup) as x (player text) where x.player = p_player_of_match) then
    errors := errors || 'Player of the match must be someone who played.'::text;
  end if;
  return errors;
end;
$$;


-- ----------------------------------------------------------------------------
-- Public functions: anyone with the link
-- ----------------------------------------------------------------------------

-- Creates training sessions from training_slots up to weeks_ahead from today. Idempotent.
create or replace function public.ensure_trainings() returns void
language plpgsql security definer set search_path = public as $$
declare
  s settings;
  today date := (now() at time zone 'Asia/Singapore')::date;
begin
  select * into s from settings;
  insert into sessions (id, type, date, start_time, end_time)
  select 'T-' || to_char(day, 'YYYYMMDD') || '-' || to_char(slot.start_time, 'HH24MI'),
         'Training', day, slot.start_time, slot.end_time
  from generate_series(s.training_start::timestamp, (today + 7 * s.weeks_ahead)::timestamp, interval '1 day') as g (ts)
  cross join lateral (select g.ts::date as day) d
  join training_slots slot on slot.weekday = extract(dow from d.day)
  on conflict (id) do nothing;
end;
$$;

/*
 * Everything the app needs, in one call (same shape the frontend has always
 * used). Runs as the caller, so table security decides what's included:
 * inactive players and feedback only reach admins.
 */
create or replace function public.bootstrap() returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  admin boolean := is_admin();
  s settings;
  payload jsonb;
begin
  perform ensure_trainings();
  select * into s from settings;

  payload := jsonb_build_object(
    'now', now(),
    'admin', admin,
    'settings', jsonb_build_object(
      'trainingLockHours', s.training_lock_hours,
      'matchLockHours', s.match_lock_hours,
      'venue', s.match_venue),
    'players', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'active', active) order by name) from players), '[]'),
    'sessions', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'type', type, 'date', to_char(date, 'YYYY-MM-DD'),
        'start', to_char(start_time, 'HH24:MI'), 'end', coalesce(to_char(end_time, 'HH24:MI'), ''),
        'opponent', opponent, 'status', status, 'note', note) order by date, start_time) from sessions), '[]'),
    'rsvps', coalesce((select jsonb_agg(jsonb_build_object(
        'sessionId', session_id, 'player', player, 'status', status, 'reason', reason, 'updatedAt', updated_at)) from rsvps), '[]'),
    'videos', coalesce((select jsonb_agg(jsonb_build_object(
        'sessionId', session_id, 'title', title, 'url', url) order by added_at) from videos), '[]'),
    'results', coalesce((select jsonb_agg(jsonb_build_object(
        'sessionId', session_id, 'ourScore', our_score, 'theirScore', their_score,
        'playerOfMatch', coalesce(player_of_match, ''))) from match_results), '[]'),
    'playerStats', coalesce((select jsonb_agg(jsonb_build_object(
        'sessionId', session_id, 'player', player, 'goals', goals, 'assists', assists)) from player_stats), '[]'));

  if admin then
    payload := payload || jsonb_build_object('feedback', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'timestamp', created_at, 'name', name, 'sessionId', coalesce(session_id, ''),
      'message', message, 'status', status) order by created_at) from feedback), '[]'));
  end if;
  return payload;
end;
$$;

/*
 * Firm answers (Going / Not going) lock at the cutoff; TBC or no answer can
 * still change. Mirrors isLocked in js/logic/rsvp.js.
 */
create or replace function public.submit_rsvp(
  p_session_id text, p_player text, p_status text, p_reason text default ''
) returns void
language plpgsql security definer set search_path = public as $$
declare
  s settings;
  sess sessions;
  current_status text;
  lock_at timestamptz;
begin
  if p_status is null or p_status not in ('Going', 'Not going', 'TBC') then
    raise exception 'Status must be Going, Not going or TBC';
  end if;
  if not exists (select 1 from players where name = p_player and active) then
    raise exception 'Name not on the team list';
  end if;
  select * into sess from sessions where id = p_session_id;
  if not found then raise exception 'Session not found'; end if;
  if sess.status = 'Cancelled' then raise exception 'This session is cancelled'; end if;

  select * into s from settings;
  select status into current_status from rsvps where session_id = sess.id and player = p_player;
  lock_at := session_start(sess.date, sess.start_time) - make_interval(hours =>
    case when sess.type = 'Match' then s.match_lock_hours else s.training_lock_hours end);
  if current_status in ('Going', 'Not going') and now() >= lock_at then
    raise exception 'RSVP is locked. Please message the coach to change it.';
  end if;

  insert into rsvps (session_id, player, status, reason, updated_at)
  values (sess.id, p_player, p_status, clean_text(p_reason, 200), now())
  on conflict (session_id, player)
  do update set status = excluded.status, reason = excluded.reason, updated_at = excluded.updated_at;
end;
$$;

/*
 * p_name empty = anonymous. Anyone can call this, so a simple team-wide limit
 * (10 messages a minute) stops a script from flooding the inbox. RSVPs need no
 * limit: each player has one answer per session, so they can't pile up.
 */
create or replace function public.submit_feedback(
  p_message text, p_session_id text default '', p_name text default ''
) returns void
language plpgsql security definer set search_path = public as $$
declare
  message text := clean_text(p_message, 2000);
begin
  if message = '' then raise exception 'Feedback is empty'; end if;
  if (select count(*) from feedback where created_at > now() - interval '1 minute') >= 10 then
    raise exception 'Lots of feedback is coming in right now. Please try again in a minute.';
  end if;
  insert into feedback (name, session_id, message)
  values (coalesce(nullif(clean_text(p_name, 60), ''), 'Anonymous'),
          (select id from sessions where id = nullif(p_session_id, '')),
          message);
end;
$$;


-- ----------------------------------------------------------------------------
-- Admin sign-in
-- ----------------------------------------------------------------------------

/*
 * Sets or changes the PIN and signs out every device. Not callable from the
 * browser: run it in the SQL Editor, e.g. select set_admin_pin('your-new-pin');
 */
create or replace function public.set_admin_pin(p_pin text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if length(coalesce(p_pin, '')) < 6 then raise exception 'The PIN must be at least 6 characters'; end if;
  insert into admin_pin (pin_hash) values (extensions.crypt(p_pin, extensions.gen_salt('bf', 10)))
  on conflict (id) do update set pin_hash = excluded.pin_hash, failed_attempts = 0, locked_until = null;
  delete from admin_sessions where true;
end;
$$;

/*
 * Returns { token } or { error }. A wrong PIN returns rather than raises,
 * because raising would roll back the failed-attempt count. Five wrong PINs in
 * a row lock sign-in for everyone for 15 minutes, so a PIN can't be guessed by
 * a script. Sessions already signed in keep working during a lock.
 */
create or replace function public.admin_sign_in(p_pin text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  current_pin admin_pin;
  new_token text := gen_random_uuid()::text;
begin
  select * into current_pin from admin_pin for update;  -- parallel guesses wait their turn
  if not found then return jsonb_build_object('error', 'No admin PIN has been set yet.'); end if;
  if current_pin.locked_until > now() then
    return jsonb_build_object('error', 'Too many wrong PINs. Try again in 15 minutes.');
  end if;

  if extensions.crypt(coalesce(p_pin, ''), current_pin.pin_hash) <> current_pin.pin_hash then
    update admin_pin set
      failed_attempts = case when failed_attempts >= 4 then 0 else failed_attempts + 1 end,
      locked_until = case when failed_attempts >= 4 then now() + interval '15 minutes' end
    where id;
    return jsonb_build_object('error', 'Wrong PIN.');
  end if;

  update admin_pin set failed_attempts = 0, locked_until = null where id;
  delete from admin_sessions where expires_at <= now();
  insert into admin_sessions (token_hash, expires_at)
  values (sha256(convert_to(new_token, 'UTF8')), now() + interval '30 days');
  return jsonb_build_object('token', new_token);
end;
$$;

create or replace function public.admin_sign_out() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from admin_sessions where token_hash = admin_token_hash();
end;
$$;


-- ----------------------------------------------------------------------------
-- Admin functions: each starts with require_admin()
-- ----------------------------------------------------------------------------

create or replace function public.add_player(p_name text) returns void
language plpgsql security definer set search_path = public as $$
declare
  clean_name text := clean_text(p_name, 60);
begin
  perform require_admin();
  if clean_name = '' then raise exception 'Name is empty'; end if;
  if exists (select 1 from players where lower(name) = lower(clean_name)) then
    raise exception '% is already on the list', clean_name;
  end if;
  insert into players (name) values (clean_name);
end;
$$;

-- Deactivating hides a player from the name list but keeps their history and stats.
create or replace function public.set_player_active(p_name text, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform require_admin();
  update players set active = coalesce(p_active, true) where name = p_name;
  if not found then raise exception 'Not found: %', p_name; end if;
end;
$$;

create or replace function public.set_session_status(p_id text, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform require_admin();
  update sessions set status = case when p_status = 'Cancelled' then 'Cancelled' else 'Active' end where id = p_id;
  if not found then raise exception 'Session not found'; end if;
end;
$$;

-- One-off training or match. Returns the new session id.
create or replace function public.add_session(
  p_type text, p_date text, p_start text, p_end text default '', p_opponent text default '', p_note text default ''
) returns text
language plpgsql security definer set search_path = public as $$
declare
  session_type text := case when p_type = 'Match' then 'Match' else 'Training' end;
  session_date date := parse_date(p_date);
  starts_at time := parse_time(p_start);
  versus text := clean_text(p_opponent, 80);
  new_id text;
begin
  perform require_admin();
  if starts_at is null then raise exception 'Start time is missing'; end if;
  if session_type = 'Match' and versus = '' then raise exception 'Add the opponent for a match'; end if;
  new_id := case when session_type = 'Match' then match_id(session_date, versus)
    else 'T-' || to_char(session_date, 'YYYYMMDD') || '-' || to_char(starts_at, 'HH24MI') || '-X' end;
  if exists (select 1 from sessions where id = new_id) then raise exception 'That session already exists'; end if;
  insert into sessions (id, type, date, start_time, end_time, opponent, note)
  values (new_id, session_type, session_date, starts_at, parse_time(p_end), versus, clean_text(p_note, 200));
  return new_id;
end;
$$;

/*
 * p_matches: [{ date, start, opponent, note, rsvps: { name: { status, reason } } }]
 * Matches are upserted by date + opponent, keeping any cancelled state and
 * admin note. RSVPs only fill blanks, so answers given in the app are never
 * overwritten. Returns { added, updated, playersAdded, rsvpsAdded }.
 */
create or replace function public.import_matches(p_matches jsonb, p_import_rsvps boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  m jsonb;
  answer record;
  match_date date;
  versus text;
  new_id text;
  inserted boolean;
  added int := 0;
  updated int := 0;
  players_added int := 0;
  rsvps_added int := 0;
  affected int;
begin
  perform require_admin();
  for m in select * from jsonb_array_elements(coalesce(p_matches, '[]')) loop
    if coalesce(m ->> 'date', '') !~ '^\d{4}-\d{2}-\d{2}$' then continue; end if;
    match_date := (m ->> 'date')::date;
    versus := clean_text(m ->> 'opponent', 80);
    new_id := match_id(match_date, versus);

    insert into sessions (id, type, date, start_time, opponent, note)
    values (new_id, 'Match', match_date, coalesce(parse_time(m ->> 'start'), time '00:00'), versus, clean_text(m ->> 'note', 200))
    on conflict (id) do update set
      start_time = excluded.start_time,
      opponent = excluded.opponent,
      note = case when sessions.note = '' then excluded.note else sessions.note end
    returning (xmax = 0) into inserted;
    if inserted then added := added + 1; else updated := updated + 1; end if;

    if not coalesce(p_import_rsvps, false) then continue; end if;
    for answer in
      select clean_text(key, 60) as name, value ->> 'status' as status, clean_text(value ->> 'reason', 200) as reason
      from jsonb_each(coalesce(m -> 'rsvps', '{}'))
    loop
      if answer.name = '' then continue; end if;
      if not exists (select 1 from players where lower(name) = lower(answer.name)) then
        insert into players (name) values (answer.name);
        players_added := players_added + 1;
      end if;
      if answer.status not in ('Going', 'Not going', 'TBC') then continue; end if;
      insert into rsvps (session_id, player, status, reason)
      select new_id, p.name, answer.status, answer.reason from players p where lower(p.name) = lower(answer.name)
      on conflict (session_id, player) do nothing;
      get diagnostics affected = row_count;
      rsvps_added := rsvps_added + affected;
    end loop;
  end loop;
  return jsonb_build_object('added', added, 'updated', updated, 'playersAdded', players_added, 'rsvpsAdded', rsvps_added);
end;
$$;

create or replace function public.add_video(p_session_id text, p_title text, p_url text) returns void
language plpgsql security definer set search_path = public as $$
declare
  video_id text := youtube_id(p_url);
begin
  perform require_admin();
  if not exists (select 1 from sessions where id = p_session_id) then raise exception 'Match not found'; end if;
  if video_id is null then raise exception 'Please paste a YouTube link'; end if;
  insert into videos (session_id, title, url)
  values (p_session_id, coalesce(nullif(clean_text(p_title, 100), ''), 'Video'), 'https://www.youtube.com/watch?v=' || video_id);
end;
$$;

create or replace function public.remove_video(p_session_id text, p_url text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform require_admin();
  delete from videos where session_id = p_session_id and url = p_url;
end;
$$;

create or replace function public.set_feedback_status(p_id text, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform require_admin();
  update feedback set status = case when p_status in ('New', 'Seen', 'Done') then p_status else 'Seen' end
  where id::text = p_id;
end;
$$;

/*
 * Saves (or replaces) a match result.
 * p_players: [{ player, goals, assists }]; everyone listed played.
 */
create or replace function public.save_match_result(
  p_session_id text, p_our_score int, p_their_score int, p_player_of_match text, p_players jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  the_match sessions;
  lineup jsonb := coalesce(p_players, '[]');
  potm text := nullif(clean_text(p_player_of_match, 60), '');
  errors text[];
begin
  perform require_admin();
  select * into the_match from sessions where id = p_session_id;
  if not found or the_match.type <> 'Match' then raise exception 'Match not found'; end if;
  if the_match.status = 'Cancelled' then raise exception 'This match is cancelled'; end if;
  if session_start(the_match.date, the_match.start_time) > now() then raise exception 'This match hasn''t started yet'; end if;

  errors := match_result_errors(p_our_score, p_their_score, potm, lineup);
  if cardinality(errors) > 0 then raise exception '%', array_to_string(errors, ' '); end if;

  insert into match_results (session_id, our_score, their_score, player_of_match, updated_at)
  values (the_match.id, p_our_score, p_their_score, potm, now())
  on conflict (session_id) do update set
    our_score = excluded.our_score, their_score = excluded.their_score,
    player_of_match = excluded.player_of_match, updated_at = excluded.updated_at;

  delete from player_stats where session_id = the_match.id;
  insert into player_stats (session_id, player, goals, assists)
  select the_match.id, x.player, x.goals, x.assists
  from jsonb_to_recordset(lineup) as x (player text, goals int, assists int);
end;
$$;

create or replace function public.clear_match_result(p_session_id text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform require_admin();
  delete from match_results where session_id = p_session_id;
  delete from player_stats where session_id = p_session_id;
end;
$$;


-- ----------------------------------------------------------------------------
-- Grants and row-level security (deny by default)
-- ----------------------------------------------------------------------------

alter table public.settings enable row level security;
alter table public.admin_pin enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.players enable row level security;
alter table public.training_slots enable row level security;
alter table public.sessions enable row level security;
alter table public.rsvps enable row level security;
alter table public.videos enable row level security;
alter table public.feedback enable row level security;
alter table public.match_results enable row level security;
alter table public.player_stats enable row level security;

-- Browsers may only read, and only these tables. All writes go through the functions above.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.settings, public.players, public.training_slots, public.sessions, public.rsvps,
  public.videos, public.match_results, public.player_stats, public.feedback to anon, authenticated;

drop policy if exists "Anyone can read" on public.settings;
create policy "Anyone can read" on public.settings for select using (true);
drop policy if exists "Active players, or all for admins" on public.players;
create policy "Active players, or all for admins" on public.players for select using (active or public.is_admin());
drop policy if exists "Anyone can read" on public.training_slots;
create policy "Anyone can read" on public.training_slots for select using (true);
drop policy if exists "Anyone can read" on public.sessions;
create policy "Anyone can read" on public.sessions for select using (true);
drop policy if exists "Anyone can read" on public.rsvps;
create policy "Anyone can read" on public.rsvps for select using (true);
drop policy if exists "Anyone can read" on public.videos;
create policy "Anyone can read" on public.videos for select using (true);
drop policy if exists "Anyone can read" on public.match_results;
create policy "Anyone can read" on public.match_results for select using (true);
drop policy if exists "Anyone can read" on public.player_stats;
create policy "Anyone can read" on public.player_stats for select using (true);
drop policy if exists "Admins can read" on public.feedback;
create policy "Admins can read" on public.feedback for select using (public.is_admin());
-- admin_pin, admin_sessions: no grants or policies, so nobody can read them through the API.

-- Functions: nothing is callable unless granted below.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.bootstrap(), public.ensure_trainings(), public.is_admin(),
  public.submit_rsvp(text, text, text, text), public.submit_feedback(text, text, text),
  public.admin_sign_in(text), public.admin_sign_out(),
  -- Admin functions check the session themselves, through require_admin().
  public.add_player(text), public.set_player_active(text, boolean), public.set_session_status(text, text),
  public.add_session(text, text, text, text, text, text), public.import_matches(jsonb, boolean),
  public.add_video(text, text, text), public.remove_video(text, text), public.set_feedback_status(text, text),
  public.save_match_result(text, int, int, text, jsonb), public.clear_match_result(text)
  to anon, authenticated;

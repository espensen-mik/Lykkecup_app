--
-- PostgreSQL database dump
--

\restrict 0BuM7pSY76rSthzUXfDMb0LzvVI7cJQHQyx32gWF2ddSVx2NxTuvMttccYF8aYa

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: court_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.court_type AS ENUM (
    'mini',
    'kort',
    'stor'
);


ALTER TYPE public.court_type OWNER TO postgres;

--
-- Name: TYPE court_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TYPE public.court_type IS 'Bane størrelse: mini (lille), kort, stor — matcher LykkeCup taksonomi.';


--
-- Name: galla_check_in_ticket(bigint, text, bigint, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.galla_check_in_ticket(p_attendee_id bigint, p_security_code text, p_event_id bigint, p_checked_in_by text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_row public.galla_tickets%ROWTYPE;
  v_updated public.galla_tickets%ROWTYPE;
  v_code text := trim(coalesce(p_security_code, ''));
BEGIN
  IF p_event_id IS DISTINCT FROM 16899 THEN
    RETURN jsonb_build_object(
      'status', 'invalid',
      'message', 'Ugyldig billet',
      'reason', 'wrong_event_id'
    );
  END IF;

  IF p_attendee_id IS NULL OR v_code = '' THEN
    RETURN jsonb_build_object(
      'status', 'invalid',
      'message', 'Ugyldig billet',
      'reason', 'parse_error'
    );
  END IF;

  SELECT * INTO v_row FROM public.galla_tickets WHERE attendee_id = p_attendee_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'invalid',
      'message', 'Ugyldig billet',
      'reason', 'not_found',
      'attendee_id', p_attendee_id
    );
  END IF;

  IF v_row.security_code IS DISTINCT FROM v_code THEN
    RETURN jsonb_build_object(
      'status', 'invalid',
      'message', 'Ugyldig billet',
      'reason', 'wrong_security_code',
      'attendee_id', p_attendee_id,
      'name', v_row.name,
      'ticket_type', v_row.ticket_type
    );
  END IF;

  IF lower(trim(v_row.order_status)) IS DISTINCT FROM 'completed' THEN
    RETURN jsonb_build_object(
      'status', 'invalid',
      'message', 'Ugyldig billet',
      'reason', 'not_completed',
      'attendee_id', p_attendee_id,
      'name', v_row.name,
      'ticket_type', v_row.ticket_type
    );
  END IF;

  IF v_row.checked_in THEN
    RETURN jsonb_build_object(
      'status', 'already_checked_in',
      'message', 'Allerede checket ind',
      'attendee_id', p_attendee_id,
      'name', v_row.name,
      'ticket_type', v_row.ticket_type,
      'checked_in_at', v_row.checked_in_at
    );
  END IF;

  UPDATE public.galla_tickets
  SET
    checked_in = true,
    checked_in_at = now(),
    checked_in_by = nullif(trim(coalesce(p_checked_in_by, '')), ''),
    updated_at = now()
  WHERE attendee_id = p_attendee_id
    AND checked_in = false
    AND security_code = v_code
  RETURNING * INTO v_updated;

  IF NOT FOUND THEN
    SELECT * INTO v_row FROM public.galla_tickets WHERE attendee_id = p_attendee_id;
    RETURN jsonb_build_object(
      'status', 'already_checked_in',
      'message', 'Allerede checket ind',
      'attendee_id', p_attendee_id,
      'name', v_row.name,
      'ticket_type', v_row.ticket_type,
      'checked_in_at', v_row.checked_in_at
    );
  END IF;

  RETURN jsonb_build_object(
    'status', 'approved',
    'message', 'Godkendt – Deltager checket ind',
    'attendee_id', v_updated.attendee_id,
    'name', v_updated.name,
    'ticket_type', v_updated.ticket_type,
    'checked_in_at', v_updated.checked_in_at
  );
END;
$$;


ALTER FUNCTION public.galla_check_in_ticket(p_attendee_id bigint, p_security_code text, p_event_id bigint, p_checked_in_by text) OWNER TO postgres;

--
-- Name: galla_import_staging_to_tickets(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.galla_import_staging_to_tickets() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_inserted bigint;
  v_skipped bigint;
BEGIN
  INSERT INTO public.galla_tickets (
    attendee_id,
    security_code,
    unique_id,
    ticket_type,
    ticket_product_id,
    name,
    email,
    order_id,
    order_status,
    checked_in,
    checked_in_at
  )
  SELECT
    s.attendee_id::bigint,
    btrim(s.security_code),
    nullif(btrim(s.unique_id), ''),
    nullif(btrim(s.ticket_type), ''),
    nullif(btrim(s.ticket_product_id), '')::bigint,
    coalesce(nullif(btrim(s.name), ''), ''),
    nullif(btrim(s.email), ''),
    nullif(btrim(s.order_id), '')::bigint,
    coalesce(nullif(btrim(s.order_status), ''), ''),
    public.galla_parse_checked_in_text(s.checked_in),
    CASE
      WHEN public.galla_parse_checked_in_text(s.checked_in) THEN now()
      ELSE NULL
    END
  FROM public.galla_tickets_staging s
  WHERE btrim(coalesce(s.attendee_id, '')) ~ '^[0-9]+$'
    AND btrim(coalesce(s.security_code, '')) <> ''
  ON CONFLICT (attendee_id) DO UPDATE SET
    security_code = EXCLUDED.security_code,
    unique_id = EXCLUDED.unique_id,
    ticket_type = EXCLUDED.ticket_type,
    ticket_product_id = EXCLUDED.ticket_product_id,
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    order_id = EXCLUDED.order_id,
    order_status = EXCLUDED.order_status,
    checked_in = EXCLUDED.checked_in,
    checked_in_at = EXCLUDED.checked_in_at,
    updated_at = now();

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  SELECT count(*)::bigint INTO v_skipped
  FROM public.galla_tickets_staging s
  WHERE btrim(coalesce(s.attendee_id, '')) !~ '^[0-9]+$'
     OR btrim(coalesce(s.security_code, '')) = '';

  TRUNCATE public.galla_tickets_staging;

  RETURN jsonb_build_object(
    'inserted_or_updated', v_inserted,
    'skipped_invalid_rows', v_skipped
  );
END;
$_$;


ALTER FUNCTION public.galla_import_staging_to_tickets() OWNER TO postgres;

--
-- Name: galla_parse_checked_in_text(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.galla_parse_checked_in_text(raw text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT CASE
    WHEN raw IS NULL OR btrim(raw) = '' THEN false
    WHEN lower(btrim(raw)) IN ('1', 'true', 't', 'yes', 'y', 'ja') THEN true
    WHEN lower(btrim(raw)) IN ('0', 'false', 'f', 'no', 'n', 'nej') THEN false
    ELSE false
  END;
$$;


ALTER FUNCTION public.galla_parse_checked_in_text(raw text) OWNER TO postgres;

--
-- Name: galla_tickets_set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.galla_tickets_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.galla_tickets_set_updated_at() OWNER TO postgres;

--
-- Name: get_lc_analytics_hourly_views(date); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_lc_analytics_hourly_views(p_day date DEFAULT (timezone('Europe/Copenhagen'::text, now()))::date) RETURNS json
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH bounds AS (
    SELECT
      (p_day::timestamp AT TIME ZONE 'Europe/Copenhagen') AS t_start,
      ((p_day + 1)::timestamp AT TIME ZONE 'Europe/Copenhagen') AS t_end
  ),
  hours AS (SELECT generate_series(0, 23) AS hr),
  counts AS (
    SELECT
      EXTRACT(HOUR FROM (v.created_at AT TIME ZONE 'Europe/Copenhagen'))::integer AS hr,
      COUNT(*)::bigint AS views
    FROM public.lc_analytics_page_views v
    CROSS JOIN bounds b
    WHERE v.created_at >= b.t_start
      AND v.created_at < b.t_end
      AND (v.path = '/lykkecup26' OR v.path LIKE '/lykkecup26/%')
    GROUP BY 1
  )
  SELECT COALESCE(
    (
      SELECT json_agg(json_build_object('hour', h.hr, 'views', COALESCE(c.views, 0)) ORDER BY h.hr)
      FROM hours h
      LEFT JOIN counts c ON c.hr = h.hr
    ),
    '[]'::json
  );
$$;


ALTER FUNCTION public.get_lc_analytics_hourly_views(p_day date) OWNER TO postgres;

--
-- Name: get_lc_analytics_summary(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_lc_analytics_summary() RETURNS json
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT json_build_object(
    'uniqueVisitors', (
      SELECT COUNT(DISTINCT visitor_id)::bigint
      FROM public.lc_analytics_page_views
      WHERE path = '/lykkecup26' OR path LIKE '/lykkecup26/%'
    ),
    'totalViews', (
      SELECT COUNT(*)::bigint
      FROM public.lc_analytics_page_views
      WHERE path = '/lykkecup26' OR path LIKE '/lykkecup26/%'
    ),
    'paths', COALESCE(
      (
        SELECT json_agg(json_build_object('path', q.path, 'views', q.views))
        FROM (
          SELECT path, COUNT(*)::bigint AS views
          FROM public.lc_analytics_page_views
          WHERE path = '/lykkecup26' OR path LIKE '/lykkecup26/%'
          GROUP BY path
          ORDER BY COUNT(*) DESC
          LIMIT 100
        ) q
      ),
      '[]'::json
    )
  );
$$;


ALTER FUNCTION public.get_lc_analytics_summary() OWNER TO postgres;

--
-- Name: lc26_page_content_set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.lc26_page_content_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION public.lc26_page_content_set_updated_at() OWNER TO postgres;

--
-- Name: lc26_public_messages_set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.lc26_public_messages_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.lc26_public_messages_set_updated_at() OWNER TO postgres;

--
-- Name: level_court_settings_set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.level_court_settings_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION public.level_court_settings_set_updated_at() OWNER TO postgres;

--
-- Name: log_coach_update_changes(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.log_coach_update_changes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  actor_id uuid := auth.uid();
  actor_name text;
begin
  if actor_id is not null then
    select coalesce(nullif(trim(full_name), ''), 'Ukendt bruger')
      into actor_name
      from public.profiles
      where id = actor_id
      limit 1;
  end if;

  if actor_name is null then
    actor_name := 'Ukendt bruger';
  end if;

  if new.name is distinct from old.name then
    insert into public.coach_change_log (coach_id, event_id, field_name, old_value, new_value, changed_by, changed_by_name)
    values (new.id, new.event_id, 'name', old.name, new.name, actor_id, actor_name);
  end if;

  if new.home_club is distinct from old.home_club then
    insert into public.coach_change_log (coach_id, event_id, field_name, old_value, new_value, changed_by, changed_by_name)
    values (new.id, new.event_id, 'home_club', old.home_club, new.home_club, actor_id, actor_name);
  end if;

  if new.birthdate is distinct from old.birthdate then
    insert into public.coach_change_log (coach_id, event_id, field_name, old_value, new_value, changed_by, changed_by_name)
    values (new.id, new.event_id, 'birthdate', old.birthdate::text, new.birthdate::text, actor_id, actor_name);
  end if;

  if new.age is distinct from old.age then
    insert into public.coach_change_log (coach_id, event_id, field_name, old_value, new_value, changed_by, changed_by_name)
    values (new.id, new.event_id, 'age', old.age::text, new.age::text, actor_id, actor_name);
  end if;

  if new.tshirt_size is distinct from old.tshirt_size then
    insert into public.coach_change_log (coach_id, event_id, field_name, old_value, new_value, changed_by, changed_by_name)
    values (new.id, new.event_id, 'tshirt_size', old.tshirt_size, new.tshirt_size, actor_id, actor_name);
  end if;

  if new.email is distinct from old.email then
    insert into public.coach_change_log (coach_id, event_id, field_name, old_value, new_value, changed_by, changed_by_name)
    values (new.id, new.event_id, 'email', old.email, new.email, actor_id, actor_name);
  end if;

  if new.phone is distinct from old.phone then
    insert into public.coach_change_log (coach_id, event_id, field_name, old_value, new_value, changed_by, changed_by_name)
    values (new.id, new.event_id, 'phone', old.phone, new.phone, actor_id, actor_name);
  end if;

  return new;
end;
$$;


ALTER FUNCTION public.log_coach_update_changes() OWNER TO postgres;

--
-- Name: log_player_update_changes(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.log_player_update_changes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  actor_id uuid := auth.uid();
  actor_name text;
begin
  if actor_id is not null then
    select coalesce(nullif(trim(full_name), ''), 'Ukendt bruger')
      into actor_name
      from public.profiles
      where id = actor_id
      limit 1;
  end if;

  if actor_name is null then
    actor_name := 'Ukendt bruger';
  end if;

  if new.name is distinct from old.name then
    insert into public.player_change_log (player_id, event_id, field_name, old_value, new_value, changed_by, changed_by_name)
    values (new.id, new.event_id, 'name', old.name, new.name, actor_id, actor_name);
  end if;

  if new.home_club is distinct from old.home_club then
    insert into public.player_change_log (player_id, event_id, field_name, old_value, new_value, changed_by, changed_by_name)
    values (new.id, new.event_id, 'home_club', old.home_club, new.home_club, actor_id, actor_name);
  end if;

  if new.birthdate is distinct from old.birthdate then
    insert into public.player_change_log (player_id, event_id, field_name, old_value, new_value, changed_by, changed_by_name)
    values (new.id, new.event_id, 'birthdate', old.birthdate::text, new.birthdate::text, actor_id, actor_name);
  end if;

  if new.age is distinct from old.age then
    insert into public.player_change_log (player_id, event_id, field_name, old_value, new_value, changed_by, changed_by_name)
    values (new.id, new.event_id, 'age', old.age::text, new.age::text, actor_id, actor_name);
  end if;

  if new.gender is distinct from old.gender then
    insert into public.player_change_log (player_id, event_id, field_name, old_value, new_value, changed_by, changed_by_name)
    values (new.id, new.event_id, 'gender', old.gender, new.gender, actor_id, actor_name);
  end if;

  if new.level is distinct from old.level then
    insert into public.player_change_log (player_id, event_id, field_name, old_value, new_value, changed_by, changed_by_name)
    values (new.id, new.event_id, 'level', old.level, new.level, actor_id, actor_name);
  end if;

  if new.preferences is distinct from old.preferences then
    insert into public.player_change_log (player_id, event_id, field_name, old_value, new_value, changed_by, changed_by_name)
    values (new.id, new.event_id, 'preferences', old.preferences::text, new.preferences::text, actor_id, actor_name);
  end if;

  return new;
end;
$$;


ALTER FUNCTION public.log_player_update_changes() OWNER TO postgres;

--
-- Name: normalize_club_key(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.normalize_club_key(v text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select lower(coalesce(public.normalize_club_name(v), ''));
$$;


ALTER FUNCTION public.normalize_club_key(v text) OWNER TO postgres;

--
-- Name: normalize_club_name(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.normalize_club_name(v text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select nullif(
    trim(
      regexp_replace(
        replace(
          replace(
            replace(
              replace(coalesce(v, ''), chr(8203), ''), -- zero-width space
              chr(8204), ''                            -- zero-width non-joiner
            ),
            chr(8205), ''                              -- zero-width joiner
          ),
          chr(160), ' '                                -- non-breaking space
        ),
        '\s+',
        ' ',
        'g'
      )
    ),
    ''
  );
$$;


ALTER FUNCTION public.normalize_club_name(v text) OWNER TO postgres;

--
-- Name: normalize_home_club_text(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.normalize_home_club_text(v text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select nullif(
    regexp_replace(
      replace(trim(coalesce(v, '')), chr(160), ' '),
      '\s+',
      ' ',
      'g'
    ),
    ''
  );
$$;


ALTER FUNCTION public.normalize_home_club_text(v text) OWNER TO postgres;

--
-- Name: set_coaches_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_coaches_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION public.set_coaches_updated_at() OWNER TO postgres;

--
-- Name: set_profiles_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_profiles_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION public.set_profiles_updated_at() OWNER TO postgres;

--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION public.set_updated_at() OWNER TO postgres;

--
-- Name: sync_club_reference(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sync_club_reference() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  normalized_name text;
  club_row public.lykkecup26_clubs%rowtype;
begin
  if NEW.event_id is null then
    return NEW;
  end if;

  if NEW.home_club is not null and public.normalize_club_name(NEW.home_club) is not null then
    normalized_name := public.normalize_club_name(NEW.home_club);
    insert into public.lykkecup26_clubs (event_id, name)
    values (NEW.event_id, normalized_name)
    on conflict (event_id, normalized_key) do update
      set updated_at = now()
    returning * into club_row;

    if club_row.id is null then
      select * into club_row
      from public.lykkecup26_clubs
      where event_id = NEW.event_id
        and normalized_key = public.normalize_club_key(normalized_name)
      limit 1;
    end if;

    NEW.club_id := club_row.id;
    NEW.home_club := club_row.name;
    return NEW;
  end if;

  if NEW.club_id is not null then
    select * into club_row
    from public.lykkecup26_clubs
    where id = NEW.club_id
      and event_id = NEW.event_id
    limit 1;

    if club_row.id is not null then
      NEW.home_club := club_row.name;
    else
      NEW.club_id := null;
      NEW.home_club := null;
    end if;
    return NEW;
  end if;

  NEW.home_club := null;
  return NEW;
end;
$$;


ALTER FUNCTION public.sync_club_reference() OWNER TO postgres;

--
-- Name: tournament_periods_set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.tournament_periods_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION public.tournament_periods_set_updated_at() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: club_feedback; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.club_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    home_club text NOT NULL,
    author_name text,
    comment_text text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    ll_status_text text,
    ll_status_created_at timestamp with time zone,
    ll_status_author_id uuid,
    ll_status_author_name text,
    ll_status_author_avatar_url text,
    handled_at timestamp with time zone,
    handled_by uuid,
    author_phone text,
    club_id uuid,
    working_on_user_id uuid,
    working_on_name text,
    working_on_avatar_url text,
    working_on_at timestamp with time zone
);


ALTER TABLE public.club_feedback OWNER TO postgres;

--
-- Name: COLUMN club_feedback.ll_status_text; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.club_feedback.ll_status_text IS 'Status fra LykkeLiga (intern note til admins)';


--
-- Name: COLUMN club_feedback.handled_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.club_feedback.handled_at IS 'Når kommentaren er markeret som håndteret';


--
-- Name: COLUMN club_feedback.author_phone; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.club_feedback.author_phone IS 'Valgfrit telefonnummer fra træner; vises ikke på den offentlige coach-feedback-side.';


--
-- Name: club_feedback_internal_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.club_feedback_internal_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_feedback_id uuid NOT NULL,
    event_id uuid NOT NULL,
    body text NOT NULL,
    author_id uuid,
    author_name text DEFAULT ''::text NOT NULL,
    author_avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT club_feedback_internal_messages_body_nonempty CHECK ((char_length(TRIM(BOTH FROM body)) > 0))
);


ALTER TABLE public.club_feedback_internal_messages OWNER TO postgres;

--
-- Name: TABLE club_feedback_internal_messages; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.club_feedback_internal_messages IS 'Intern admin-tråd pr. club_feedback-række; ikke synlig på coach-feedback.';


--
-- Name: clubs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clubs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    association_name text,
    city text,
    municipality text,
    region text,
    contact_name text,
    contact_email text,
    contact_phone text,
    status text,
    notes text,
    logo_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.clubs OWNER TO postgres;

--
-- Name: clubs_import_raw; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clubs_import_raw (
    "Holdnavn" text,
    "Forening" text,
    "By" text,
    "Kommune" text,
    "Region" text,
    "Kontaktperson" text,
    "E-mail" text,
    "Telefon" text,
    "Status" text,
    "Noter" text,
    "Klublogo" text
);


ALTER TABLE public.clubs_import_raw OWNER TO postgres;

--
-- Name: coach_change_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.coach_change_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    coach_id uuid NOT NULL,
    event_id uuid NOT NULL,
    field_name text NOT NULL,
    old_value text,
    new_value text,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    changed_by uuid,
    changed_by_name text
);


ALTER TABLE public.coach_change_log OWNER TO postgres;

--
-- Name: TABLE coach_change_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.coach_change_log IS 'Historik over manuelle ændringer af trænere i KontrolCenter.';


--
-- Name: coaches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.coaches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    ticket_id text NOT NULL,
    name text NOT NULL,
    home_club text NOT NULL,
    email text,
    phone text,
    birthdate date,
    age integer,
    tshirt_size text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    club_id uuid
);


ALTER TABLE public.coaches OWNER TO postgres;

--
-- Name: coaches_import_raw; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.coaches_import_raw (
    event_id text,
    ticket_id text,
    name text,
    home_club text,
    email text,
    phone text,
    birthdate text,
    age text,
    tshirt_size text
);


ALTER TABLE public.coaches_import_raw OWNER TO postgres;

--
-- Name: court_availability; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.court_availability (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    court_id uuid NOT NULL,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT court_availability_time_check CHECK ((end_time > start_time))
);


ALTER TABLE public.court_availability OWNER TO postgres;

--
-- Name: court_breaks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.court_breaks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    court_id uuid NOT NULL,
    label text,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT court_breaks_time_check CHECK ((end_time > start_time))
);


ALTER TABLE public.court_breaks OWNER TO postgres;

--
-- Name: courts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.courts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    venue_id uuid NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    court_type public.court_type,
    is_active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.courts OWNER TO postgres;

--
-- Name: events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    starts_on date,
    ends_on date,
    location text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.events OWNER TO postgres;

--
-- Name: galla_tickets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.galla_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    attendee_id bigint NOT NULL,
    security_code text NOT NULL,
    unique_id text,
    ticket_type text,
    ticket_product_id bigint,
    name text DEFAULT ''::text NOT NULL,
    email text,
    order_id bigint,
    order_status text DEFAULT ''::text NOT NULL,
    checked_in boolean DEFAULT false NOT NULL,
    checked_in_at timestamp with time zone,
    checked_in_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.galla_tickets OWNER TO postgres;

--
-- Name: TABLE galla_tickets; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.galla_tickets IS 'LykkeCup Galla — WordPress/Event Tickets export til QR check-in (event_id 16899).';


--
-- Name: galla_tickets_staging; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.galla_tickets_staging (
    attendee_id text,
    security_code text,
    unique_id text,
    ticket_type text,
    ticket_product_id text,
    name text,
    email text,
    order_id text,
    order_status text,
    checked_in text
);


ALTER TABLE public.galla_tickets_staging OWNER TO postgres;

--
-- Name: TABLE galla_tickets_staging; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.galla_tickets_staging IS 'Midlertidig CSV-import (alle felter text). Tøm efter galla_import_staging_to_tickets().';


--
-- Name: holddannelse_chat_message_likes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.holddannelse_chat_message_likes (
    message_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.holddannelse_chat_message_likes OWNER TO postgres;

--
-- Name: TABLE holddannelse_chat_message_likes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.holddannelse_chat_message_likes IS 'Synes godt om på CupChat-beskeder; én like per bruger per besked.';


--
-- Name: holddannelse_chat_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.holddannelse_chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    parent_id uuid,
    body text NOT NULL,
    author_id uuid NOT NULL,
    author_name text DEFAULT ''::text NOT NULL,
    author_avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT holddannelse_chat_messages_body_nonempty CHECK ((char_length(TRIM(BOTH FROM body)) > 0))
);


ALTER TABLE public.holddannelse_chat_messages OWNER TO postgres;

--
-- Name: TABLE holddannelse_chat_messages; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.holddannelse_chat_messages IS 'Intern HoldChat i KontrolCenter; nyeste top-level først, svar under hver tråd.';


--
-- Name: kontrolcenter_event_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.kontrolcenter_event_settings (
    event_id uuid NOT NULL,
    planning_lockdown boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.kontrolcenter_event_settings OWNER TO postgres;

--
-- Name: TABLE kontrolcenter_event_settings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.kontrolcenter_event_settings IS 'Én række pr. turnering/event — globale KontrolCenter-indstillinger.';


--
-- Name: COLUMN kontrolcenter_event_settings.planning_lockdown; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.kontrolcenter_event_settings.planning_lockdown IS 'Når true: Holddannelse og Turnering (puljer, kampe, opsætning) er skrivebeskyttet. App Indhold påvirkes ikke.';


--
-- Name: lc26_guest_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lc26_guest_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    display_name text NOT NULL,
    role_hint text DEFAULT ''::text NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lc26_guest_messages_body_len CHECK (((char_length(body) <= 8000) AND (char_length(body) >= 1))),
    CONSTRAINT lc26_guest_messages_display_name_len CHECK ((char_length(display_name) <= 200)),
    CONSTRAINT lc26_guest_messages_role_hint_len CHECK ((char_length(role_hint) <= 200))
);


ALTER TABLE public.lc26_guest_messages OWNER TO postgres;

--
-- Name: TABLE lc26_guest_messages; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.lc26_guest_messages IS 'Hilsner fra deltagere til LykkeLiga (KontrolCenter /beskeder).';


--
-- Name: lc26_page_content; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lc26_page_content (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    page_key text NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    intro text DEFAULT ''::text NOT NULL,
    hero_image_url text,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lc26_page_content_page_key_check CHECK ((page_key = ANY (ARRAY['program'::text, 'find-rundt'::text, 'praktisk-info'::text, 'nyt-fra-lykkeliga'::text, 'lykke-og-lagkage'::text])))
);


ALTER TABLE public.lc26_page_content OWNER TO postgres;

--
-- Name: TABLE lc26_page_content; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.lc26_page_content IS 'CMS-indhold for LykkeCup26 offentlige informationssider.';


--
-- Name: COLUMN lc26_page_content.page_key; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.lc26_page_content.page_key IS 'program | find-rundt | praktisk-info | nyt-fra-lykkeliga';


--
-- Name: COLUMN lc26_page_content.content; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.lc26_page_content.content IS 'Fleksibel JSONB payload til sektioner, lister, FAQ, artikler, billedtekster mv.';


--
-- Name: lc26_public_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lc26_public_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    sender_name text NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    avatar_url text,
    available_at timestamp with time zone NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.lc26_public_messages OWNER TO postgres;

--
-- Name: TABLE lc26_public_messages; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.lc26_public_messages IS 'Planlagte beskeder til LykkeCup 26-webappen (offentlig læsning når available_at er passeret).';


--
-- Name: lc_analytics_page_views; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lc_analytics_page_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    visitor_id text NOT NULL,
    path text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lc_analytics_path_len CHECK ((char_length(path) <= 512)),
    CONSTRAINT lc_analytics_visitor_len CHECK ((char_length(visitor_id) <= 80))
);


ALTER TABLE public.lc_analytics_page_views OWNER TO postgres;

--
-- Name: TABLE lc_analytics_page_views; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.lc_analytics_page_views IS 'Sidevisninger fra LykkeCup-app og KontrolCenter (anonym visitor_id i browser).';


--
-- Name: level_court_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.level_court_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    level text NOT NULL,
    court_type public.court_type NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT level_court_settings_level_nonempty CHECK ((char_length(TRIM(BOTH FROM level)) > 0))
);


ALTER TABLE public.level_court_settings OWNER TO postgres;

--
-- Name: TABLE level_court_settings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.level_court_settings IS 'Per event: hvilken bane-størrelse et niveau skal planlægges på — LykkeCup Regnemaskine og global scheduler.';


--
-- Name: level_schedule_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.level_schedule_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    level text NOT NULL,
    match_duration_minutes integer NOT NULL,
    break_between_matches_minutes integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    plan_target_players_per_team integer,
    plan_matches_per_team integer,
    rounds_per_match integer DEFAULT 1 NOT NULL,
    plan_target_teams_per_pool integer,
    plan_max_teams_per_pool integer,
    CONSTRAINT level_schedule_settings_break_between_matches_minutes_check CHECK ((break_between_matches_minutes >= 0)),
    CONSTRAINT level_schedule_settings_match_duration_minutes_check CHECK ((match_duration_minutes > 0)),
    CONSTRAINT level_schedule_settings_plan_max_teams_per_pool_check CHECK (((plan_max_teams_per_pool IS NULL) OR ((plan_max_teams_per_pool >= 2) AND (plan_max_teams_per_pool <= 99)))),
    CONSTRAINT level_schedule_settings_plan_target_teams_per_pool_check CHECK (((plan_target_teams_per_pool IS NULL) OR ((plan_target_teams_per_pool >= 2) AND (plan_target_teams_per_pool <= 99)))),
    CONSTRAINT level_schedule_settings_rounds_per_match_check CHECK (((rounds_per_match >= 1) AND (rounds_per_match <= 4)))
);


ALTER TABLE public.level_schedule_settings OWNER TO postgres;

--
-- Name: COLUMN level_schedule_settings.plan_target_players_per_team; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.level_schedule_settings.plan_target_players_per_team IS 'Planlægning (Regnemaskine): mål-spillere pr. hold; null = brug standard i app.';


--
-- Name: COLUMN level_schedule_settings.plan_matches_per_team; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.level_schedule_settings.plan_matches_per_team IS 'Planlægning (Regnemaskine): kampe pr. hold; null = brug standard i app.';


--
-- Name: COLUMN level_schedule_settings.plan_target_teams_per_pool; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.level_schedule_settings.plan_target_teams_per_pool IS 'Mål antal hold pr. pulje (AutoPulje og anbefaling). Null = kampe/hold + 1.';


--
-- Name: COLUMN level_schedule_settings.plan_max_teams_per_pool; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.level_schedule_settings.plan_max_teams_per_pool IS 'Valgfri hård grænse hold pr. pulje. Null = kun systemloft (64).';


--
-- Name: lykkecup26_clubs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lykkecup26_clubs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    name text NOT NULL,
    normalized_key text GENERATED ALWAYS AS (public.normalize_club_key(name)) STORED,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.lykkecup26_clubs OWNER TO postgres;

--
-- Name: TABLE lykkecup26_clubs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.lykkecup26_clubs IS 'LykkeCup26 clubs (canonical klubnavne pr. event).';


--
-- Name: matches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.matches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    pool_id uuid,
    team_a_id uuid,
    team_b_id uuid,
    court_id uuid,
    start_time timestamp with time zone,
    end_time timestamp with time zone,
    status text DEFAULT 'scheduled'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    round_index integer,
    schedule_relaxed_team_rest boolean DEFAULT false NOT NULL
);


ALTER TABLE public.matches OWNER TO postgres;

--
-- Name: COLUMN matches.round_index; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.matches.round_index IS 'Rækkefølge på banen inden for perioden (scheduler).';


--
-- Name: COLUMN matches.schedule_relaxed_team_rest; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.matches.schedule_relaxed_team_rest IS 'True when kamp er planlagt uden den ønskede hold-pause (min. 1 runde).';


--
-- Name: player_change_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.player_change_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    player_id uuid NOT NULL,
    event_id uuid NOT NULL,
    field_name text NOT NULL,
    old_value text,
    new_value text,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    changed_by uuid,
    changed_by_name text
);


ALTER TABLE public.player_change_log OWNER TO postgres;

--
-- Name: TABLE player_change_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.player_change_log IS 'Historik over manuelle ændringer af spillere i KontrolCenter.';


--
-- Name: players; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.players (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    ticket_id text NOT NULL,
    name text NOT NULL,
    home_club text,
    birthdate date,
    age integer,
    gender text,
    level text,
    preferences text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    club_id uuid
);


ALTER TABLE public.players OWNER TO postgres;

--
-- Name: players_backup_2026_04_20; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.players_backup_2026_04_20 (
    id uuid,
    event_id uuid,
    ticket_id text,
    name text,
    home_club text,
    birthdate date,
    age integer,
    gender text,
    level text,
    preferences text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.players_backup_2026_04_20 OWNER TO postgres;

--
-- Name: players_import_raw; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.players_import_raw (
    event_id text,
    ticket_id text,
    name text,
    home_club text,
    birthdate text,
    age text,
    gender text,
    level text,
    preferences text
);


ALTER TABLE public.players_import_raw OWNER TO postgres;

--
-- Name: pools; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pools (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    level text NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    period_id uuid,
    is_closed boolean DEFAULT false NOT NULL
);


ALTER TABLE public.pools OWNER TO postgres;

--
-- Name: COLUMN pools.period_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.pools.period_id IS 'Hvilken turneringsperiode puljens kampe skal ligge i.';


--
-- Name: COLUMN pools.is_closed; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.pools.is_closed IS 'Når true: puljen er færdig — hold kan ikke tilføjes eller fjernes.';


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    role text DEFAULT 'user'::text NOT NULL,
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'user'::text])))
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: team_coaches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.team_coaches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    team_id uuid NOT NULL,
    coach_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.team_coaches OWNER TO postgres;

--
-- Name: team_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.team_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    player_id uuid NOT NULL,
    team_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.team_members OWNER TO postgres;

--
-- Name: teams; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    pool_id uuid,
    name text NOT NULL,
    level text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_completed boolean DEFAULT false NOT NULL,
    nickname text
);


ALTER TABLE public.teams OWNER TO postgres;

--
-- Name: COLUMN teams.nickname; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.teams.nickname IS 'Holdets kaldenavn — vises på den offentlige LykkeCup 26-app når udfyldt; `name` forbliver det autogenererede navn til oversigt i KontrolCenter.';


--
-- Name: tournament_periods; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tournament_periods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    name text NOT NULL,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_all_day boolean DEFAULT false NOT NULL,
    CONSTRAINT tournament_periods_time_order CHECK ((end_time > start_time))
);


ALTER TABLE public.tournament_periods OWNER TO postgres;

--
-- Name: TABLE tournament_periods; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.tournament_periods IS 'Tidsperioder for turneringen (fx Formiddag). Puljer spiller kampe inden for periodens vindue.';


--
-- Name: COLUMN tournament_periods.is_all_day; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournament_periods.is_all_day IS 'Når sand: puljens kampe må placeres i hele banernes tilgængelighed (start/slut er kun visning).';


--
-- Name: venues; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.venues (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.venues OWNER TO postgres;

--
-- Name: club_feedback_internal_messages club_feedback_internal_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_feedback_internal_messages
    ADD CONSTRAINT club_feedback_internal_messages_pkey PRIMARY KEY (id);


--
-- Name: club_feedback club_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_feedback
    ADD CONSTRAINT club_feedback_pkey PRIMARY KEY (id);


--
-- Name: clubs clubs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clubs
    ADD CONSTRAINT clubs_pkey PRIMARY KEY (id);


--
-- Name: coach_change_log coach_change_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coach_change_log
    ADD CONSTRAINT coach_change_log_pkey PRIMARY KEY (id);


--
-- Name: coaches coaches_event_id_ticket_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coaches
    ADD CONSTRAINT coaches_event_id_ticket_id_key UNIQUE (event_id, ticket_id);


--
-- Name: coaches coaches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coaches
    ADD CONSTRAINT coaches_pkey PRIMARY KEY (id);


--
-- Name: court_availability court_availability_event_id_court_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.court_availability
    ADD CONSTRAINT court_availability_event_id_court_id_key UNIQUE (event_id, court_id);


--
-- Name: court_availability court_availability_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.court_availability
    ADD CONSTRAINT court_availability_pkey PRIMARY KEY (id);


--
-- Name: court_breaks court_breaks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.court_breaks
    ADD CONSTRAINT court_breaks_pkey PRIMARY KEY (id);


--
-- Name: courts courts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.courts
    ADD CONSTRAINT courts_pkey PRIMARY KEY (id);


--
-- Name: courts courts_venue_id_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.courts
    ADD CONSTRAINT courts_venue_id_name_key UNIQUE (venue_id, name);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: events events_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_slug_key UNIQUE (slug);


--
-- Name: galla_tickets galla_tickets_attendee_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.galla_tickets
    ADD CONSTRAINT galla_tickets_attendee_id_key UNIQUE (attendee_id);


--
-- Name: galla_tickets galla_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.galla_tickets
    ADD CONSTRAINT galla_tickets_pkey PRIMARY KEY (id);


--
-- Name: holddannelse_chat_message_likes holddannelse_chat_message_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.holddannelse_chat_message_likes
    ADD CONSTRAINT holddannelse_chat_message_likes_pkey PRIMARY KEY (message_id, user_id);


--
-- Name: holddannelse_chat_messages holddannelse_chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.holddannelse_chat_messages
    ADD CONSTRAINT holddannelse_chat_messages_pkey PRIMARY KEY (id);


--
-- Name: kontrolcenter_event_settings kontrolcenter_event_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kontrolcenter_event_settings
    ADD CONSTRAINT kontrolcenter_event_settings_pkey PRIMARY KEY (event_id);


--
-- Name: lc26_guest_messages lc26_guest_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lc26_guest_messages
    ADD CONSTRAINT lc26_guest_messages_pkey PRIMARY KEY (id);


--
-- Name: lc26_page_content lc26_page_content_event_page_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lc26_page_content
    ADD CONSTRAINT lc26_page_content_event_page_unique UNIQUE (event_id, page_key);


--
-- Name: lc26_page_content lc26_page_content_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lc26_page_content
    ADD CONSTRAINT lc26_page_content_pkey PRIMARY KEY (id);


--
-- Name: lc26_public_messages lc26_public_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lc26_public_messages
    ADD CONSTRAINT lc26_public_messages_pkey PRIMARY KEY (id);


--
-- Name: lc_analytics_page_views lc_analytics_page_views_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lc_analytics_page_views
    ADD CONSTRAINT lc_analytics_page_views_pkey PRIMARY KEY (id);


--
-- Name: level_court_settings level_court_settings_event_level_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.level_court_settings
    ADD CONSTRAINT level_court_settings_event_level_unique UNIQUE (event_id, level);


--
-- Name: level_court_settings level_court_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.level_court_settings
    ADD CONSTRAINT level_court_settings_pkey PRIMARY KEY (id);


--
-- Name: level_schedule_settings level_schedule_settings_event_id_level_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.level_schedule_settings
    ADD CONSTRAINT level_schedule_settings_event_id_level_key UNIQUE (event_id, level);


--
-- Name: level_schedule_settings level_schedule_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.level_schedule_settings
    ADD CONSTRAINT level_schedule_settings_pkey PRIMARY KEY (id);


--
-- Name: lykkecup26_clubs lykkecup26_clubs_event_key_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lykkecup26_clubs
    ADD CONSTRAINT lykkecup26_clubs_event_key_unique UNIQUE (event_id, normalized_key);


--
-- Name: lykkecup26_clubs lykkecup26_clubs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lykkecup26_clubs
    ADD CONSTRAINT lykkecup26_clubs_pkey PRIMARY KEY (id);


--
-- Name: matches matches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_pkey PRIMARY KEY (id);


--
-- Name: player_change_log player_change_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_change_log
    ADD CONSTRAINT player_change_log_pkey PRIMARY KEY (id);


--
-- Name: players players_event_id_ticket_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_event_id_ticket_id_key UNIQUE (event_id, ticket_id);


--
-- Name: players players_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_pkey PRIMARY KEY (id);


--
-- Name: pools pools_event_id_level_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pools
    ADD CONSTRAINT pools_event_id_level_name_key UNIQUE (event_id, level, name);


--
-- Name: pools pools_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pools
    ADD CONSTRAINT pools_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: team_coaches team_coaches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_coaches
    ADD CONSTRAINT team_coaches_pkey PRIMARY KEY (id);


--
-- Name: team_members team_members_event_id_player_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_event_id_player_id_key UNIQUE (event_id, player_id);


--
-- Name: team_members team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_pkey PRIMARY KEY (id);


--
-- Name: teams teams_event_id_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_event_id_name_key UNIQUE (event_id, name);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: tournament_periods tournament_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_periods
    ADD CONSTRAINT tournament_periods_pkey PRIMARY KEY (id);


--
-- Name: team_coaches unique_team_coach; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_coaches
    ADD CONSTRAINT unique_team_coach UNIQUE (event_id, team_id, coach_id);


--
-- Name: coaches unique_ticket_id; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coaches
    ADD CONSTRAINT unique_ticket_id UNIQUE (ticket_id);


--
-- Name: venues venues_event_id_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.venues
    ADD CONSTRAINT venues_event_id_name_key UNIQUE (event_id, name);


--
-- Name: venues venues_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.venues
    ADD CONSTRAINT venues_pkey PRIMARY KEY (id);


--
-- Name: club_feedback_club_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX club_feedback_club_id_idx ON public.club_feedback USING btree (club_id);


--
-- Name: club_feedback_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX club_feedback_created_at_idx ON public.club_feedback USING btree (created_at DESC);


--
-- Name: club_feedback_event_club_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX club_feedback_event_club_idx ON public.club_feedback USING btree (event_id, home_club);


--
-- Name: club_feedback_event_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX club_feedback_event_id_idx ON public.club_feedback USING btree (event_id);


--
-- Name: club_feedback_internal_messages_event_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX club_feedback_internal_messages_event_idx ON public.club_feedback_internal_messages USING btree (event_id);


--
-- Name: club_feedback_internal_messages_feedback_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX club_feedback_internal_messages_feedback_idx ON public.club_feedback_internal_messages USING btree (club_feedback_id, created_at);


--
-- Name: club_feedback_working_on_event_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX club_feedback_working_on_event_idx ON public.club_feedback USING btree (event_id, working_on_at DESC) WHERE (working_on_user_id IS NOT NULL);


--
-- Name: clubs_municipality_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX clubs_municipality_idx ON public.clubs USING btree (municipality);


--
-- Name: clubs_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX clubs_name_idx ON public.clubs USING btree (name);


--
-- Name: clubs_region_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX clubs_region_idx ON public.clubs USING btree (region);


--
-- Name: coach_change_log_coach_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX coach_change_log_coach_idx ON public.coach_change_log USING btree (coach_id, changed_at DESC);


--
-- Name: coaches_club_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX coaches_club_id_idx ON public.coaches USING btree (club_id);


--
-- Name: coaches_event_ticket_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX coaches_event_ticket_uidx ON public.coaches USING btree (event_id, ticket_id);


--
-- Name: court_availability_court_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX court_availability_court_id_idx ON public.court_availability USING btree (court_id);


--
-- Name: court_availability_event_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX court_availability_event_id_idx ON public.court_availability USING btree (event_id);


--
-- Name: court_breaks_court_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX court_breaks_court_id_idx ON public.court_breaks USING btree (court_id);


--
-- Name: court_breaks_event_court_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX court_breaks_event_court_idx ON public.court_breaks USING btree (event_id, court_id);


--
-- Name: court_breaks_event_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX court_breaks_event_id_idx ON public.court_breaks USING btree (event_id);


--
-- Name: galla_tickets_checked_in_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX galla_tickets_checked_in_idx ON public.galla_tickets USING btree (checked_in);


--
-- Name: galla_tickets_email_lower_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX galla_tickets_email_lower_idx ON public.galla_tickets USING btree (lower(email));


--
-- Name: galla_tickets_name_lower_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX galla_tickets_name_lower_idx ON public.galla_tickets USING btree (lower(name));


--
-- Name: galla_tickets_order_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX galla_tickets_order_status_idx ON public.galla_tickets USING btree (order_status);


--
-- Name: galla_tickets_security_code_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX galla_tickets_security_code_idx ON public.galla_tickets USING btree (security_code);


--
-- Name: galla_tickets_unique_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX galla_tickets_unique_id_idx ON public.galla_tickets USING btree (unique_id);


--
-- Name: holddannelse_chat_message_likes_message_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX holddannelse_chat_message_likes_message_idx ON public.holddannelse_chat_message_likes USING btree (message_id);


--
-- Name: holddannelse_chat_messages_event_parent_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX holddannelse_chat_messages_event_parent_created_idx ON public.holddannelse_chat_messages USING btree (event_id, parent_id, created_at DESC);


--
-- Name: holddannelse_chat_messages_event_top_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX holddannelse_chat_messages_event_top_created_idx ON public.holddannelse_chat_messages USING btree (event_id, created_at DESC) WHERE (parent_id IS NULL);


--
-- Name: idx_team_coaches_coach_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_team_coaches_coach_id ON public.team_coaches USING btree (coach_id);


--
-- Name: idx_team_coaches_event_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_team_coaches_event_id ON public.team_coaches USING btree (event_id);


--
-- Name: idx_team_coaches_team_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_team_coaches_team_id ON public.team_coaches USING btree (team_id);


--
-- Name: lc26_guest_messages_event_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lc26_guest_messages_event_created ON public.lc26_guest_messages USING btree (event_id, created_at DESC);


--
-- Name: lc26_page_content_event_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lc26_page_content_event_idx ON public.lc26_page_content USING btree (event_id, page_key);


--
-- Name: lc26_public_messages_event_available; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lc26_public_messages_event_available ON public.lc26_public_messages USING btree (event_id, available_at, sort_order);


--
-- Name: lc_analytics_page_views_path_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lc_analytics_page_views_path_created ON public.lc_analytics_page_views USING btree (path, created_at DESC);


--
-- Name: lc_analytics_page_views_visitor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lc_analytics_page_views_visitor ON public.lc_analytics_page_views USING btree (visitor_id);


--
-- Name: level_court_settings_event_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX level_court_settings_event_id_idx ON public.level_court_settings USING btree (event_id);


--
-- Name: level_schedule_settings_event_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX level_schedule_settings_event_id_idx ON public.level_schedule_settings USING btree (event_id);


--
-- Name: level_schedule_settings_event_level_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX level_schedule_settings_event_level_idx ON public.level_schedule_settings USING btree (event_id, level);


--
-- Name: lykkecup26_clubs_event_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lykkecup26_clubs_event_idx ON public.lykkecup26_clubs USING btree (event_id);


--
-- Name: player_change_log_player_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX player_change_log_player_idx ON public.player_change_log USING btree (player_id, changed_at DESC);


--
-- Name: players_club_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX players_club_id_idx ON public.players USING btree (club_id);


--
-- Name: players_event_ticket_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX players_event_ticket_uidx ON public.players USING btree (event_id, ticket_id);


--
-- Name: pools_period_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX pools_period_id_idx ON public.pools USING btree (period_id);


--
-- Name: tournament_periods_event_sort_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tournament_periods_event_sort_idx ON public.tournament_periods USING btree (event_id, sort_order, name);


--
-- Name: club_feedback club_feedback_sync_club_reference; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER club_feedback_sync_club_reference BEFORE INSERT OR UPDATE OF home_club, club_id, event_id ON public.club_feedback FOR EACH ROW EXECUTE FUNCTION public.sync_club_reference();


--
-- Name: coaches coaches_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER coaches_set_updated_at BEFORE UPDATE ON public.coaches FOR EACH ROW EXECUTE FUNCTION public.set_coaches_updated_at();


--
-- Name: coaches coaches_sync_club_reference; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER coaches_sync_club_reference BEFORE INSERT OR UPDATE OF home_club, club_id, event_id ON public.coaches FOR EACH ROW EXECUTE FUNCTION public.sync_club_reference();


--
-- Name: coaches coaches_track_change_log; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER coaches_track_change_log AFTER UPDATE ON public.coaches FOR EACH ROW EXECUTE FUNCTION public.log_coach_update_changes();


--
-- Name: galla_tickets galla_tickets_touch_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER galla_tickets_touch_updated_at BEFORE UPDATE ON public.galla_tickets FOR EACH ROW EXECUTE FUNCTION public.galla_tickets_set_updated_at();


--
-- Name: lc26_page_content lc26_page_content_touch_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER lc26_page_content_touch_updated_at BEFORE UPDATE ON public.lc26_page_content FOR EACH ROW EXECUTE FUNCTION public.lc26_page_content_set_updated_at();


--
-- Name: lc26_public_messages lc26_public_messages_touch_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER lc26_public_messages_touch_updated_at BEFORE UPDATE ON public.lc26_public_messages FOR EACH ROW EXECUTE FUNCTION public.lc26_public_messages_set_updated_at();


--
-- Name: level_court_settings level_court_settings_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER level_court_settings_set_updated_at BEFORE UPDATE ON public.level_court_settings FOR EACH ROW EXECUTE FUNCTION public.level_court_settings_set_updated_at();


--
-- Name: level_schedule_settings level_schedule_settings_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER level_schedule_settings_set_updated_at BEFORE UPDATE ON public.level_schedule_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: players players_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER players_set_updated_at BEFORE UPDATE ON public.players FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: players players_sync_club_reference; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER players_sync_club_reference BEFORE INSERT OR UPDATE OF home_club, club_id, event_id ON public.players FOR EACH ROW EXECUTE FUNCTION public.sync_club_reference();


--
-- Name: players players_track_change_log; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER players_track_change_log AFTER UPDATE ON public.players FOR EACH ROW EXECUTE FUNCTION public.log_player_update_changes();


--
-- Name: profiles profiles_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_profiles_updated_at();


--
-- Name: tournament_periods tournament_periods_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tournament_periods_set_updated_at BEFORE UPDATE ON public.tournament_periods FOR EACH ROW EXECUTE FUNCTION public.tournament_periods_set_updated_at();


--
-- Name: club_feedback club_feedback_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_feedback
    ADD CONSTRAINT club_feedback_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.lykkecup26_clubs(id) ON DELETE SET NULL;


--
-- Name: club_feedback club_feedback_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_feedback
    ADD CONSTRAINT club_feedback_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: club_feedback club_feedback_handled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_feedback
    ADD CONSTRAINT club_feedback_handled_by_fkey FOREIGN KEY (handled_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: club_feedback_internal_messages club_feedback_internal_messages_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_feedback_internal_messages
    ADD CONSTRAINT club_feedback_internal_messages_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: club_feedback_internal_messages club_feedback_internal_messages_club_feedback_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_feedback_internal_messages
    ADD CONSTRAINT club_feedback_internal_messages_club_feedback_id_fkey FOREIGN KEY (club_feedback_id) REFERENCES public.club_feedback(id) ON DELETE CASCADE;


--
-- Name: club_feedback club_feedback_ll_status_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_feedback
    ADD CONSTRAINT club_feedback_ll_status_author_id_fkey FOREIGN KEY (ll_status_author_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: club_feedback club_feedback_working_on_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_feedback
    ADD CONSTRAINT club_feedback_working_on_user_id_fkey FOREIGN KEY (working_on_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: coach_change_log coach_change_log_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coach_change_log
    ADD CONSTRAINT coach_change_log_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: coach_change_log coach_change_log_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coach_change_log
    ADD CONSTRAINT coach_change_log_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.coaches(id) ON DELETE CASCADE;


--
-- Name: coaches coaches_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coaches
    ADD CONSTRAINT coaches_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.lykkecup26_clubs(id) ON DELETE SET NULL;


--
-- Name: coaches coaches_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coaches
    ADD CONSTRAINT coaches_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: court_availability court_availability_court_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.court_availability
    ADD CONSTRAINT court_availability_court_id_fkey FOREIGN KEY (court_id) REFERENCES public.courts(id) ON DELETE CASCADE;


--
-- Name: court_availability court_availability_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.court_availability
    ADD CONSTRAINT court_availability_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: court_breaks court_breaks_court_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.court_breaks
    ADD CONSTRAINT court_breaks_court_id_fkey FOREIGN KEY (court_id) REFERENCES public.courts(id) ON DELETE CASCADE;


--
-- Name: court_breaks court_breaks_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.court_breaks
    ADD CONSTRAINT court_breaks_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: courts courts_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.courts
    ADD CONSTRAINT courts_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: courts courts_venue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.courts
    ADD CONSTRAINT courts_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES public.venues(id) ON DELETE CASCADE;


--
-- Name: team_coaches fk_coach; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_coaches
    ADD CONSTRAINT fk_coach FOREIGN KEY (coach_id) REFERENCES public.coaches(id) ON DELETE CASCADE;


--
-- Name: team_coaches fk_team; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_coaches
    ADD CONSTRAINT fk_team FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: holddannelse_chat_message_likes holddannelse_chat_message_likes_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.holddannelse_chat_message_likes
    ADD CONSTRAINT holddannelse_chat_message_likes_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.holddannelse_chat_messages(id) ON DELETE CASCADE;


--
-- Name: holddannelse_chat_message_likes holddannelse_chat_message_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.holddannelse_chat_message_likes
    ADD CONSTRAINT holddannelse_chat_message_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: holddannelse_chat_messages holddannelse_chat_messages_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.holddannelse_chat_messages
    ADD CONSTRAINT holddannelse_chat_messages_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: holddannelse_chat_messages holddannelse_chat_messages_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.holddannelse_chat_messages
    ADD CONSTRAINT holddannelse_chat_messages_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.holddannelse_chat_messages(id) ON DELETE CASCADE;


--
-- Name: level_schedule_settings level_schedule_settings_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.level_schedule_settings
    ADD CONSTRAINT level_schedule_settings_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: matches matches_court_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_court_id_fkey FOREIGN KEY (court_id) REFERENCES public.courts(id) ON DELETE SET NULL;


--
-- Name: matches matches_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: matches matches_pool_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_pool_id_fkey FOREIGN KEY (pool_id) REFERENCES public.pools(id) ON DELETE SET NULL;


--
-- Name: matches matches_team_a_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_team_a_id_fkey FOREIGN KEY (team_a_id) REFERENCES public.teams(id) ON DELETE SET NULL;


--
-- Name: matches matches_team_b_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_team_b_id_fkey FOREIGN KEY (team_b_id) REFERENCES public.teams(id) ON DELETE SET NULL;


--
-- Name: player_change_log player_change_log_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_change_log
    ADD CONSTRAINT player_change_log_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: player_change_log player_change_log_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_change_log
    ADD CONSTRAINT player_change_log_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- Name: players players_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.lykkecup26_clubs(id) ON DELETE SET NULL;


--
-- Name: players players_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: pools pools_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pools
    ADD CONSTRAINT pools_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: pools pools_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pools
    ADD CONSTRAINT pools_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.tournament_periods(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: team_members team_members_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: team_members team_members_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- Name: team_members team_members_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: teams teams_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: teams teams_pool_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pool_id_fkey FOREIGN KEY (pool_id) REFERENCES public.pools(id) ON DELETE SET NULL;


--
-- Name: venues venues_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.venues
    ADD CONSTRAINT venues_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: club_feedback_internal_messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.club_feedback_internal_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: club_feedback_internal_messages club_feedback_internal_messages_insert_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY club_feedback_internal_messages_insert_authenticated ON public.club_feedback_internal_messages FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: club_feedback_internal_messages club_feedback_internal_messages_select_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY club_feedback_internal_messages_select_authenticated ON public.club_feedback_internal_messages FOR SELECT TO authenticated USING (true);


--
-- Name: clubs_import_raw; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.clubs_import_raw ENABLE ROW LEVEL SECURITY;

--
-- Name: coach_change_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.coach_change_log ENABLE ROW LEVEL SECURITY;

--
-- Name: coach_change_log coach_change_log_authenticated_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY coach_change_log_authenticated_insert ON public.coach_change_log FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: coach_change_log coach_change_log_authenticated_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY coach_change_log_authenticated_select ON public.coach_change_log FOR SELECT TO authenticated USING (true);


--
-- Name: coaches_import_raw; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.coaches_import_raw ENABLE ROW LEVEL SECURITY;

--
-- Name: court_availability; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.court_availability ENABLE ROW LEVEL SECURITY;

--
-- Name: court_availability court_availability_delete_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY court_availability_delete_authenticated ON public.court_availability FOR DELETE TO authenticated USING (true);


--
-- Name: court_availability court_availability_insert_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY court_availability_insert_authenticated ON public.court_availability FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: court_availability court_availability_select_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY court_availability_select_authenticated ON public.court_availability FOR SELECT TO authenticated USING (true);


--
-- Name: court_availability court_availability_update_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY court_availability_update_authenticated ON public.court_availability FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: court_breaks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.court_breaks ENABLE ROW LEVEL SECURITY;

--
-- Name: court_breaks court_breaks_delete_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY court_breaks_delete_authenticated ON public.court_breaks FOR DELETE TO authenticated USING (true);


--
-- Name: court_breaks court_breaks_insert_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY court_breaks_insert_authenticated ON public.court_breaks FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: court_breaks court_breaks_select_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY court_breaks_select_authenticated ON public.court_breaks FOR SELECT TO authenticated USING (true);


--
-- Name: court_breaks court_breaks_update_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY court_breaks_update_authenticated ON public.court_breaks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: courts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.courts ENABLE ROW LEVEL SECURITY;

--
-- Name: courts courts_delete_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY courts_delete_authenticated ON public.courts FOR DELETE TO authenticated USING (true);


--
-- Name: courts courts_insert_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY courts_insert_authenticated ON public.courts FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: courts courts_select_anon_lc26; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY courts_select_anon_lc26 ON public.courts FOR SELECT TO anon USING (((event_id = 'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf'::uuid) OR (venue_id IN ( SELECT venues.id
   FROM public.venues
  WHERE (venues.event_id = 'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf'::uuid)))));


--
-- Name: courts courts_select_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY courts_select_authenticated ON public.courts FOR SELECT TO authenticated USING (true);


--
-- Name: courts courts_update_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY courts_update_authenticated ON public.courts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: galla_tickets; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.galla_tickets ENABLE ROW LEVEL SECURITY;

--
-- Name: galla_tickets galla_tickets_authenticated_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY galla_tickets_authenticated_select ON public.galla_tickets FOR SELECT TO authenticated USING (true);


--
-- Name: galla_tickets_staging; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.galla_tickets_staging ENABLE ROW LEVEL SECURITY;

--
-- Name: galla_tickets_staging galla_tickets_staging_authenticated_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY galla_tickets_staging_authenticated_all ON public.galla_tickets_staging TO authenticated USING (true) WITH CHECK (true);


--
-- Name: holddannelse_chat_message_likes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.holddannelse_chat_message_likes ENABLE ROW LEVEL SECURITY;

--
-- Name: holddannelse_chat_message_likes holddannelse_chat_message_likes_delete_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY holddannelse_chat_message_likes_delete_own ON public.holddannelse_chat_message_likes FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: holddannelse_chat_message_likes holddannelse_chat_message_likes_insert_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY holddannelse_chat_message_likes_insert_authenticated ON public.holddannelse_chat_message_likes FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.holddannelse_chat_messages m
  WHERE (m.id = holddannelse_chat_message_likes.message_id)))));


--
-- Name: holddannelse_chat_message_likes holddannelse_chat_message_likes_select_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY holddannelse_chat_message_likes_select_authenticated ON public.holddannelse_chat_message_likes FOR SELECT TO authenticated USING (true);


--
-- Name: holddannelse_chat_messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.holddannelse_chat_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: holddannelse_chat_messages holddannelse_chat_messages_insert_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY holddannelse_chat_messages_insert_authenticated ON public.holddannelse_chat_messages FOR INSERT TO authenticated WITH CHECK (((auth.uid() = author_id) AND (char_length(TRIM(BOTH FROM body)) > 0) AND ((parent_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.holddannelse_chat_messages p
  WHERE ((p.id = holddannelse_chat_messages.parent_id) AND (p.event_id = holddannelse_chat_messages.event_id) AND (p.parent_id IS NULL)))))));


--
-- Name: holddannelse_chat_messages holddannelse_chat_messages_select_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY holddannelse_chat_messages_select_authenticated ON public.holddannelse_chat_messages FOR SELECT TO authenticated USING (true);


--
-- Name: kontrolcenter_event_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.kontrolcenter_event_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: kontrolcenter_event_settings kontrolcenter_event_settings_insert_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY kontrolcenter_event_settings_insert_admin ON public.kontrolcenter_event_settings FOR INSERT TO authenticated WITH CHECK ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));


--
-- Name: kontrolcenter_event_settings kontrolcenter_event_settings_select_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY kontrolcenter_event_settings_select_authenticated ON public.kontrolcenter_event_settings FOR SELECT TO authenticated USING (true);


--
-- Name: kontrolcenter_event_settings kontrolcenter_event_settings_update_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY kontrolcenter_event_settings_update_admin ON public.kontrolcenter_event_settings FOR UPDATE TO authenticated USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)) WITH CHECK ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));


--
-- Name: lc26_guest_messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lc26_guest_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: lc26_guest_messages lc26_guest_messages_anon_insert_event; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY lc26_guest_messages_anon_insert_event ON public.lc26_guest_messages FOR INSERT TO anon WITH CHECK ((event_id = 'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf'::uuid));


--
-- Name: lc26_guest_messages lc26_guest_messages_authenticated_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY lc26_guest_messages_authenticated_delete ON public.lc26_guest_messages FOR DELETE TO authenticated USING (true);


--
-- Name: lc26_guest_messages lc26_guest_messages_authenticated_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY lc26_guest_messages_authenticated_select ON public.lc26_guest_messages FOR SELECT TO authenticated USING (true);


--
-- Name: lc26_page_content; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lc26_page_content ENABLE ROW LEVEL SECURITY;

--
-- Name: lc26_page_content lc26_page_content_anon_select_event; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY lc26_page_content_anon_select_event ON public.lc26_page_content FOR SELECT TO anon USING ((event_id = 'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf'::uuid));


--
-- Name: lc26_page_content lc26_page_content_authenticated_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY lc26_page_content_authenticated_delete ON public.lc26_page_content FOR DELETE TO authenticated USING (true);


--
-- Name: lc26_page_content lc26_page_content_authenticated_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY lc26_page_content_authenticated_insert ON public.lc26_page_content FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: lc26_page_content lc26_page_content_authenticated_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY lc26_page_content_authenticated_select ON public.lc26_page_content FOR SELECT TO authenticated USING (true);


--
-- Name: lc26_page_content lc26_page_content_authenticated_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY lc26_page_content_authenticated_update ON public.lc26_page_content FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: lc26_public_messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lc26_public_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: lc26_public_messages lc26_public_messages_anon_select_event; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY lc26_public_messages_anon_select_event ON public.lc26_public_messages FOR SELECT TO anon USING ((event_id = 'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf'::uuid));


--
-- Name: lc26_public_messages lc26_public_messages_authenticated_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY lc26_public_messages_authenticated_delete ON public.lc26_public_messages FOR DELETE TO authenticated USING (true);


--
-- Name: lc26_public_messages lc26_public_messages_authenticated_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY lc26_public_messages_authenticated_insert ON public.lc26_public_messages FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: lc26_public_messages lc26_public_messages_authenticated_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY lc26_public_messages_authenticated_select ON public.lc26_public_messages FOR SELECT TO authenticated USING (true);


--
-- Name: lc26_public_messages lc26_public_messages_authenticated_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY lc26_public_messages_authenticated_update ON public.lc26_public_messages FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: lc_analytics_page_views lc_analytics_insert_anon; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY lc_analytics_insert_anon ON public.lc_analytics_page_views FOR INSERT TO anon WITH CHECK (true);


--
-- Name: lc_analytics_page_views lc_analytics_insert_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY lc_analytics_insert_authenticated ON public.lc_analytics_page_views FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: lc_analytics_page_views; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lc_analytics_page_views ENABLE ROW LEVEL SECURITY;

--
-- Name: level_court_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.level_court_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: level_court_settings level_court_settings_delete_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY level_court_settings_delete_authenticated ON public.level_court_settings FOR DELETE TO authenticated USING (true);


--
-- Name: level_court_settings level_court_settings_insert_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY level_court_settings_insert_authenticated ON public.level_court_settings FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: level_court_settings level_court_settings_select_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY level_court_settings_select_authenticated ON public.level_court_settings FOR SELECT TO authenticated USING (true);


--
-- Name: level_court_settings level_court_settings_update_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY level_court_settings_update_authenticated ON public.level_court_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: lykkecup26_clubs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lykkecup26_clubs ENABLE ROW LEVEL SECURITY;

--
-- Name: lykkecup26_clubs lykkecup26_clubs_insert_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY lykkecup26_clubs_insert_authenticated ON public.lykkecup26_clubs FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: lykkecup26_clubs lykkecup26_clubs_select_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY lykkecup26_clubs_select_authenticated ON public.lykkecup26_clubs FOR SELECT TO authenticated USING (true);


--
-- Name: lykkecup26_clubs lykkecup26_clubs_update_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY lykkecup26_clubs_update_authenticated ON public.lykkecup26_clubs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: matches; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

--
-- Name: matches matches_delete_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY matches_delete_authenticated ON public.matches FOR DELETE TO authenticated USING (true);


--
-- Name: matches matches_insert_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY matches_insert_authenticated ON public.matches FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: matches matches_select_anon_lc26_scheduled; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY matches_select_anon_lc26_scheduled ON public.matches FOR SELECT TO anon USING (((event_id = 'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf'::uuid) AND (court_id IS NOT NULL) AND (start_time IS NOT NULL)));


--
-- Name: matches matches_select_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY matches_select_authenticated ON public.matches FOR SELECT TO authenticated USING (true);


--
-- Name: matches matches_update_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY matches_update_authenticated ON public.matches FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: player_change_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.player_change_log ENABLE ROW LEVEL SECURITY;

--
-- Name: player_change_log player_change_log_authenticated_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY player_change_log_authenticated_insert ON public.player_change_log FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: player_change_log player_change_log_authenticated_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY player_change_log_authenticated_select ON public.player_change_log FOR SELECT TO authenticated USING (true);


--
-- Name: players_backup_2026_04_20; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.players_backup_2026_04_20 ENABLE ROW LEVEL SECURITY;

--
-- Name: players_import_raw; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.players_import_raw ENABLE ROW LEVEL SECURITY;

--
-- Name: pools; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.pools ENABLE ROW LEVEL SECURITY;

--
-- Name: pools pools_delete_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY pools_delete_authenticated ON public.pools FOR DELETE TO authenticated USING (true);


--
-- Name: pools pools_insert_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY pools_insert_authenticated ON public.pools FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: pools pools_select_anon; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY pools_select_anon ON public.pools FOR SELECT TO anon USING ((event_id = 'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf'::uuid));


--
-- Name: pools pools_select_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY pools_select_authenticated ON public.pools FOR SELECT TO authenticated USING (true);


--
-- Name: pools pools_update_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY pools_update_authenticated ON public.pools FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: tournament_periods; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tournament_periods ENABLE ROW LEVEL SECURITY;

--
-- Name: tournament_periods tournament_periods_delete_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY tournament_periods_delete_authenticated ON public.tournament_periods FOR DELETE TO authenticated USING (true);


--
-- Name: tournament_periods tournament_periods_insert_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY tournament_periods_insert_authenticated ON public.tournament_periods FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: tournament_periods tournament_periods_select_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY tournament_periods_select_authenticated ON public.tournament_periods FOR SELECT TO authenticated USING (true);


--
-- Name: tournament_periods tournament_periods_update_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY tournament_periods_update_authenticated ON public.tournament_periods FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: venues venues_delete_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY venues_delete_authenticated ON public.venues FOR DELETE TO authenticated USING (true);


--
-- Name: venues venues_insert_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY venues_insert_authenticated ON public.venues FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: venues venues_select_anon_lc26; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY venues_select_anon_lc26 ON public.venues FOR SELECT TO anon USING ((event_id = 'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf'::uuid));


--
-- Name: venues venues_select_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY venues_select_authenticated ON public.venues FOR SELECT TO authenticated USING (true);


--
-- Name: venues venues_update_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY venues_update_authenticated ON public.venues FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION galla_check_in_ticket(p_attendee_id bigint, p_security_code text, p_event_id bigint, p_checked_in_by text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.galla_check_in_ticket(p_attendee_id bigint, p_security_code text, p_event_id bigint, p_checked_in_by text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.galla_check_in_ticket(p_attendee_id bigint, p_security_code text, p_event_id bigint, p_checked_in_by text) TO anon;
GRANT ALL ON FUNCTION public.galla_check_in_ticket(p_attendee_id bigint, p_security_code text, p_event_id bigint, p_checked_in_by text) TO authenticated;
GRANT ALL ON FUNCTION public.galla_check_in_ticket(p_attendee_id bigint, p_security_code text, p_event_id bigint, p_checked_in_by text) TO service_role;


--
-- Name: FUNCTION galla_import_staging_to_tickets(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.galla_import_staging_to_tickets() FROM PUBLIC;
GRANT ALL ON FUNCTION public.galla_import_staging_to_tickets() TO anon;
GRANT ALL ON FUNCTION public.galla_import_staging_to_tickets() TO authenticated;
GRANT ALL ON FUNCTION public.galla_import_staging_to_tickets() TO service_role;


--
-- Name: FUNCTION galla_parse_checked_in_text(raw text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.galla_parse_checked_in_text(raw text) TO anon;
GRANT ALL ON FUNCTION public.galla_parse_checked_in_text(raw text) TO authenticated;
GRANT ALL ON FUNCTION public.galla_parse_checked_in_text(raw text) TO service_role;


--
-- Name: FUNCTION galla_tickets_set_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.galla_tickets_set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.galla_tickets_set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.galla_tickets_set_updated_at() TO service_role;


--
-- Name: FUNCTION get_lc_analytics_hourly_views(p_day date); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.get_lc_analytics_hourly_views(p_day date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_lc_analytics_hourly_views(p_day date) TO anon;
GRANT ALL ON FUNCTION public.get_lc_analytics_hourly_views(p_day date) TO authenticated;
GRANT ALL ON FUNCTION public.get_lc_analytics_hourly_views(p_day date) TO service_role;


--
-- Name: FUNCTION get_lc_analytics_summary(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.get_lc_analytics_summary() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_lc_analytics_summary() TO anon;
GRANT ALL ON FUNCTION public.get_lc_analytics_summary() TO authenticated;
GRANT ALL ON FUNCTION public.get_lc_analytics_summary() TO service_role;


--
-- Name: FUNCTION lc26_page_content_set_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.lc26_page_content_set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.lc26_page_content_set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.lc26_page_content_set_updated_at() TO service_role;


--
-- Name: FUNCTION lc26_public_messages_set_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.lc26_public_messages_set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.lc26_public_messages_set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.lc26_public_messages_set_updated_at() TO service_role;


--
-- Name: FUNCTION level_court_settings_set_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.level_court_settings_set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.level_court_settings_set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.level_court_settings_set_updated_at() TO service_role;


--
-- Name: FUNCTION log_coach_update_changes(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.log_coach_update_changes() TO anon;
GRANT ALL ON FUNCTION public.log_coach_update_changes() TO authenticated;
GRANT ALL ON FUNCTION public.log_coach_update_changes() TO service_role;


--
-- Name: FUNCTION log_player_update_changes(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.log_player_update_changes() TO anon;
GRANT ALL ON FUNCTION public.log_player_update_changes() TO authenticated;
GRANT ALL ON FUNCTION public.log_player_update_changes() TO service_role;


--
-- Name: FUNCTION normalize_club_key(v text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.normalize_club_key(v text) TO anon;
GRANT ALL ON FUNCTION public.normalize_club_key(v text) TO authenticated;
GRANT ALL ON FUNCTION public.normalize_club_key(v text) TO service_role;


--
-- Name: FUNCTION normalize_club_name(v text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.normalize_club_name(v text) TO anon;
GRANT ALL ON FUNCTION public.normalize_club_name(v text) TO authenticated;
GRANT ALL ON FUNCTION public.normalize_club_name(v text) TO service_role;


--
-- Name: FUNCTION normalize_home_club_text(v text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.normalize_home_club_text(v text) TO anon;
GRANT ALL ON FUNCTION public.normalize_home_club_text(v text) TO authenticated;
GRANT ALL ON FUNCTION public.normalize_home_club_text(v text) TO service_role;


--
-- Name: FUNCTION set_coaches_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_coaches_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_coaches_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_coaches_updated_at() TO service_role;


--
-- Name: FUNCTION set_profiles_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_profiles_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_profiles_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_profiles_updated_at() TO service_role;


--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;


--
-- Name: FUNCTION sync_club_reference(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.sync_club_reference() TO anon;
GRANT ALL ON FUNCTION public.sync_club_reference() TO authenticated;
GRANT ALL ON FUNCTION public.sync_club_reference() TO service_role;


--
-- Name: FUNCTION tournament_periods_set_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.tournament_periods_set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.tournament_periods_set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.tournament_periods_set_updated_at() TO service_role;


--
-- Name: TABLE club_feedback; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.club_feedback TO anon;
GRANT ALL ON TABLE public.club_feedback TO authenticated;
GRANT ALL ON TABLE public.club_feedback TO service_role;


--
-- Name: TABLE club_feedback_internal_messages; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.club_feedback_internal_messages TO anon;
GRANT ALL ON TABLE public.club_feedback_internal_messages TO authenticated;
GRANT ALL ON TABLE public.club_feedback_internal_messages TO service_role;


--
-- Name: TABLE clubs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.clubs TO anon;
GRANT ALL ON TABLE public.clubs TO authenticated;
GRANT ALL ON TABLE public.clubs TO service_role;


--
-- Name: TABLE clubs_import_raw; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.clubs_import_raw TO anon;
GRANT ALL ON TABLE public.clubs_import_raw TO authenticated;
GRANT ALL ON TABLE public.clubs_import_raw TO service_role;


--
-- Name: TABLE coach_change_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.coach_change_log TO anon;
GRANT ALL ON TABLE public.coach_change_log TO authenticated;
GRANT ALL ON TABLE public.coach_change_log TO service_role;


--
-- Name: TABLE coaches; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.coaches TO anon;
GRANT ALL ON TABLE public.coaches TO authenticated;
GRANT ALL ON TABLE public.coaches TO service_role;


--
-- Name: TABLE coaches_import_raw; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.coaches_import_raw TO anon;
GRANT ALL ON TABLE public.coaches_import_raw TO authenticated;
GRANT ALL ON TABLE public.coaches_import_raw TO service_role;


--
-- Name: TABLE court_availability; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.court_availability TO anon;
GRANT ALL ON TABLE public.court_availability TO authenticated;
GRANT ALL ON TABLE public.court_availability TO service_role;


--
-- Name: TABLE court_breaks; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.court_breaks TO anon;
GRANT ALL ON TABLE public.court_breaks TO authenticated;
GRANT ALL ON TABLE public.court_breaks TO service_role;


--
-- Name: TABLE courts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.courts TO anon;
GRANT ALL ON TABLE public.courts TO authenticated;
GRANT ALL ON TABLE public.courts TO service_role;


--
-- Name: TABLE events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.events TO anon;
GRANT ALL ON TABLE public.events TO authenticated;
GRANT ALL ON TABLE public.events TO service_role;


--
-- Name: TABLE galla_tickets; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.galla_tickets TO anon;
GRANT ALL ON TABLE public.galla_tickets TO authenticated;
GRANT ALL ON TABLE public.galla_tickets TO service_role;


--
-- Name: TABLE galla_tickets_staging; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.galla_tickets_staging TO anon;
GRANT ALL ON TABLE public.galla_tickets_staging TO authenticated;
GRANT ALL ON TABLE public.galla_tickets_staging TO service_role;


--
-- Name: TABLE holddannelse_chat_message_likes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.holddannelse_chat_message_likes TO anon;
GRANT ALL ON TABLE public.holddannelse_chat_message_likes TO authenticated;
GRANT ALL ON TABLE public.holddannelse_chat_message_likes TO service_role;


--
-- Name: TABLE holddannelse_chat_messages; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.holddannelse_chat_messages TO anon;
GRANT ALL ON TABLE public.holddannelse_chat_messages TO authenticated;
GRANT ALL ON TABLE public.holddannelse_chat_messages TO service_role;


--
-- Name: TABLE kontrolcenter_event_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.kontrolcenter_event_settings TO anon;
GRANT ALL ON TABLE public.kontrolcenter_event_settings TO authenticated;
GRANT ALL ON TABLE public.kontrolcenter_event_settings TO service_role;


--
-- Name: TABLE lc26_guest_messages; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lc26_guest_messages TO anon;
GRANT ALL ON TABLE public.lc26_guest_messages TO authenticated;
GRANT ALL ON TABLE public.lc26_guest_messages TO service_role;


--
-- Name: TABLE lc26_page_content; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lc26_page_content TO anon;
GRANT ALL ON TABLE public.lc26_page_content TO authenticated;
GRANT ALL ON TABLE public.lc26_page_content TO service_role;


--
-- Name: TABLE lc26_public_messages; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lc26_public_messages TO anon;
GRANT ALL ON TABLE public.lc26_public_messages TO authenticated;
GRANT ALL ON TABLE public.lc26_public_messages TO service_role;


--
-- Name: TABLE lc_analytics_page_views; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lc_analytics_page_views TO anon;
GRANT ALL ON TABLE public.lc_analytics_page_views TO authenticated;
GRANT ALL ON TABLE public.lc_analytics_page_views TO service_role;


--
-- Name: TABLE level_court_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.level_court_settings TO anon;
GRANT ALL ON TABLE public.level_court_settings TO authenticated;
GRANT ALL ON TABLE public.level_court_settings TO service_role;


--
-- Name: TABLE level_schedule_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.level_schedule_settings TO anon;
GRANT ALL ON TABLE public.level_schedule_settings TO authenticated;
GRANT ALL ON TABLE public.level_schedule_settings TO service_role;


--
-- Name: TABLE lykkecup26_clubs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lykkecup26_clubs TO anon;
GRANT ALL ON TABLE public.lykkecup26_clubs TO authenticated;
GRANT ALL ON TABLE public.lykkecup26_clubs TO service_role;


--
-- Name: TABLE matches; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.matches TO anon;
GRANT ALL ON TABLE public.matches TO authenticated;
GRANT ALL ON TABLE public.matches TO service_role;


--
-- Name: TABLE player_change_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.player_change_log TO anon;
GRANT ALL ON TABLE public.player_change_log TO authenticated;
GRANT ALL ON TABLE public.player_change_log TO service_role;


--
-- Name: TABLE players; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.players TO anon;
GRANT ALL ON TABLE public.players TO authenticated;
GRANT ALL ON TABLE public.players TO service_role;


--
-- Name: TABLE players_backup_2026_04_20; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.players_backup_2026_04_20 TO anon;
GRANT ALL ON TABLE public.players_backup_2026_04_20 TO authenticated;
GRANT ALL ON TABLE public.players_backup_2026_04_20 TO service_role;


--
-- Name: TABLE players_import_raw; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.players_import_raw TO anon;
GRANT ALL ON TABLE public.players_import_raw TO authenticated;
GRANT ALL ON TABLE public.players_import_raw TO service_role;


--
-- Name: TABLE pools; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.pools TO anon;
GRANT ALL ON TABLE public.pools TO authenticated;
GRANT ALL ON TABLE public.pools TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE team_coaches; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.team_coaches TO anon;
GRANT ALL ON TABLE public.team_coaches TO authenticated;
GRANT ALL ON TABLE public.team_coaches TO service_role;


--
-- Name: TABLE team_members; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.team_members TO anon;
GRANT ALL ON TABLE public.team_members TO authenticated;
GRANT ALL ON TABLE public.team_members TO service_role;


--
-- Name: TABLE teams; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.teams TO anon;
GRANT ALL ON TABLE public.teams TO authenticated;
GRANT ALL ON TABLE public.teams TO service_role;


--
-- Name: TABLE tournament_periods; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tournament_periods TO anon;
GRANT ALL ON TABLE public.tournament_periods TO authenticated;
GRANT ALL ON TABLE public.tournament_periods TO service_role;


--
-- Name: TABLE venues; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.venues TO anon;
GRANT ALL ON TABLE public.venues TO authenticated;
GRANT ALL ON TABLE public.venues TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict 0BuM7pSY76rSthzUXfDMb0LzvVI7cJQHQyx32gWF2ddSVx2NxTuvMttccYF8aYa


-- Online klaverjassen, stap 2: tafel maken, meedoen, wachtruimte.
-- Alles staat in een eigen schema "klaverjas" dat niet direct van buiten bereikbaar is.
-- Spelers praten alleen via de functies public.klaverjas_* hieronder (security definer).
-- Geen Supabase-login: elke speler krijgt een geheime sleutel (token) die op zijn apparaat blijft.

create schema if not exists klaverjas;
revoke all on schema klaverjas from public, anon, authenticated;

create table if not exists klaverjas.tafels (
  code text primary key,
  regels jsonb not null default '{}'::jsonb,
  status text not null default 'wachten' check (status in ('wachten', 'spelen', 'klaar')),
  versie integer not null default 1,
  gemaakt timestamptz not null default now()
);

create table if not exists klaverjas.plekken (
  code text not null references klaverjas.tafels(code) on delete cascade,
  plek smallint not null check (plek between 0 and 3),
  naam text not null,
  token text not null unique,
  maker boolean not null default false,
  gezien timestamptz not null default now(),
  primary key (code, plek)
);

alter table klaverjas.tafels enable row level security;
alter table klaverjas.plekken enable row level security;

-- Hulpfuncties (alleen intern).
create or replace function klaverjas.nieuwe_code() returns text language plpgsql as $$
declare
  letters constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- geen O/0, I/1
  c text;
begin
  loop
    c := '';
    for i in 1..4 loop c := c || substr(letters, 1 + floor(random() * length(letters))::int, 1); end loop;
    exit when not exists (select 1 from klaverjas.tafels where code = c);
  end loop;
  return c;
end $$;

create or replace function klaverjas.seintje(p_code text) returns void language plpgsql as $$
declare v integer;
begin
  update klaverjas.tafels set versie = versie + 1 where code = p_code returning versie into v;
  -- Live seintje naar iedereen aan tafel; daarna haalt elk apparaat zelf zijn eigen beeld op.
  begin
    perform realtime.send(jsonb_build_object('versie', v), 'versie', 'klaverjas-' || p_code, false);
  exception when others then null; -- zonder Realtime werkt het ook (de app kijkt dan zelf af en toe)
  end;
end $$;

create or replace function klaverjas.beeld(p_code text, p_token text) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'code', t.code, 'status', t.status, 'versie', t.versie, 'regels', t.regels,
    'ik', (select p.plek from klaverjas.plekken p where p.code = t.code and p.token = p_token),
    'maker', (select p.maker from klaverjas.plekken p where p.code = t.code and p.token = p_token),
    'plekken', (select coalesce(jsonb_agg(jsonb_build_object('plek', p.plek, 'naam', p.naam, 'maker', p.maker) order by p.plek), '[]'::jsonb)
                from klaverjas.plekken p where p.code = t.code))
  from klaverjas.tafels t where t.code = p_code
$$;

-- Openbare functies.
create or replace function public.klaverjas_maak(p_naam text, p_regels jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c text; tok text := encode(extensions.gen_random_bytes(16), 'hex');
begin
  if coalesce(trim(p_naam), '') = '' or length(p_naam) > 20 then raise exception 'Naam ontbreekt of is te lang'; end if;
  -- Oude tafels opruimen (ouder dan 2 dagen).
  delete from klaverjas.tafels where gemaakt < now() - interval '2 days';
  c := klaverjas.nieuwe_code();
  insert into klaverjas.tafels (code, regels) values (c, coalesce(p_regels, '{}'::jsonb));
  insert into klaverjas.plekken (code, plek, naam, token, maker) values (c, 0, trim(p_naam), tok, true);
  return jsonb_build_object('token', tok, 'beeld', klaverjas.beeld(c, tok));
end $$;

create or replace function public.klaverjas_meedoen(p_code text, p_naam text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c text := upper(trim(p_code)); vrij smallint; tok text := encode(extensions.gen_random_bytes(16), 'hex');
begin
  if coalesce(trim(p_naam), '') = '' or length(p_naam) > 20 then raise exception 'Naam ontbreekt of is te lang'; end if;
  perform 1 from klaverjas.tafels where code = c and status = 'wachten' for update;
  if not found then raise exception 'Deze tafel bestaat niet of is al begonnen'; end if;
  select min(g) into vrij from generate_series(0, 3) g where g not in (select plek from klaverjas.plekken where code = c);
  if vrij is null then raise exception 'De tafel is vol'; end if;
  insert into klaverjas.plekken (code, plek, naam, token) values (c, vrij, trim(p_naam), tok);
  perform klaverjas.seintje(c);
  return jsonb_build_object('token', tok, 'beeld', klaverjas.beeld(c, tok));
end $$;

create or replace function public.klaverjas_kies_plek(p_code text, p_token text, p_plek smallint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c text := upper(trim(p_code));
begin
  perform 1 from klaverjas.tafels where code = c and status = 'wachten' for update;
  if not found then raise exception 'De tafel is al begonnen'; end if;
  if p_plek not between 0 and 3 then raise exception 'Onbekende plek'; end if;
  if exists (select 1 from klaverjas.plekken where code = c and plek = p_plek) then raise exception 'Die plek is bezet'; end if;
  update klaverjas.plekken set plek = p_plek, gezien = now() where code = c and token = p_token;
  if not found then raise exception 'Je zit niet aan deze tafel'; end if;
  perform klaverjas.seintje(c);
  return klaverjas.beeld(c, p_token);
end $$;

create or replace function public.klaverjas_verlaat(p_code text, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
declare c text := upper(trim(p_code)); was_maker boolean;
begin
  delete from klaverjas.plekken where code = c and token = p_token returning maker into was_maker;
  if not found then return; end if;
  if was_maker then delete from klaverjas.tafels where code = c; -- maker weg: tafel weg
  else perform klaverjas.seintje(c); end if;
  if was_maker then
    begin perform realtime.send(jsonb_build_object('weg', true), 'versie', 'klaverjas-' || c, false);
    exception when others then null; end;
  end if;
end $$;

create or replace function public.klaverjas_beeld(p_code text, p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c text := upper(trim(p_code)); b jsonb;
begin
  update klaverjas.plekken set gezien = now() where code = c and token = p_token;
  b := klaverjas.beeld(c, p_token);
  if b is null then raise exception 'Deze tafel bestaat niet meer'; end if;
  return b;
end $$;

-- Starten: in deze stap alleen de status. Delen en spelen volgen in stap 3.
create or replace function public.klaverjas_start(p_code text, p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c text := upper(trim(p_code));
begin
  if not exists (select 1 from klaverjas.plekken where code = c and token = p_token and maker) then
    raise exception 'Alleen de maker kan starten';
  end if;
  update klaverjas.tafels set status = 'spelen' where code = c and status = 'wachten';
  perform klaverjas.seintje(c);
  return klaverjas.beeld(c, p_token);
end $$;

revoke all on function public.klaverjas_maak(text, jsonb), public.klaverjas_meedoen(text, text),
  public.klaverjas_kies_plek(text, text, smallint), public.klaverjas_verlaat(text, text),
  public.klaverjas_beeld(text, text), public.klaverjas_start(text, text) from public;
grant execute on function public.klaverjas_maak(text, jsonb), public.klaverjas_meedoen(text, text),
  public.klaverjas_kies_plek(text, text, smallint), public.klaverjas_verlaat(text, text),
  public.klaverjas_beeld(text, text), public.klaverjas_start(text, text) to anon, authenticated;

-- Online klaverjassen: een apparaat kan maar één keer aan dezelfde tafel zitten.
-- Doet een apparaat opnieuw mee (bijvoorbeeld twee keer op "Meedoen" getikt), dan krijgt het
-- zijn eigen plek en sleutel terug in plaats van een tweede plek.

alter table klaverjas.plekken add column if not exists apparaat text;
create unique index if not exists plekken_apparaat on klaverjas.plekken (code, apparaat) where apparaat is not null;

drop function if exists public.klaverjas_maak(text, jsonb);
drop function if exists public.klaverjas_meedoen(text, text);

create or replace function public.klaverjas_maak(p_naam text, p_regels jsonb, p_apparaat text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c text; tok text := encode(extensions.gen_random_bytes(16), 'hex');
begin
  if coalesce(trim(p_naam), '') = '' or length(p_naam) > 20 then raise exception 'Naam ontbreekt of is te lang'; end if;
  delete from klaverjas.tafels where gemaakt < now() - interval '2 days';
  c := klaverjas.nieuwe_code();
  insert into klaverjas.tafels (code, regels) values (c, coalesce(p_regels, '{}'::jsonb));
  insert into klaverjas.plekken (code, plek, naam, token, maker, apparaat) values (c, 0, trim(p_naam), tok, true, p_apparaat);
  return jsonb_build_object('token', tok, 'beeld', klaverjas.beeld(c, tok));
end $$;

create or replace function public.klaverjas_meedoen(p_code text, p_naam text, p_apparaat text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c text := upper(trim(p_code)); vrij smallint; tok text; bestaand text;
begin
  if coalesce(trim(p_naam), '') = '' or length(p_naam) > 20 then raise exception 'Naam ontbreekt of is te lang'; end if;
  -- Zit dit apparaat al aan deze tafel? Dan dezelfde plek terug (ook als de tafel al gestart is).
  if p_apparaat is not null then
    select token into bestaand from klaverjas.plekken where code = c and apparaat = p_apparaat;
    if bestaand is not null then
      return jsonb_build_object('token', bestaand, 'beeld', klaverjas.beeld(c, bestaand));
    end if;
  end if;
  perform 1 from klaverjas.tafels where code = c and status = 'wachten' for update;
  if not found then raise exception 'Deze tafel bestaat niet of is al begonnen'; end if;
  select min(g) into vrij from generate_series(0, 3) g where g not in (select plek from klaverjas.plekken where code = c);
  if vrij is null then raise exception 'De tafel is vol'; end if;
  tok := encode(extensions.gen_random_bytes(16), 'hex');
  insert into klaverjas.plekken (code, plek, naam, token, apparaat) values (c, vrij, trim(p_naam), tok, p_apparaat);
  perform klaverjas.seintje(c);
  return jsonb_build_object('token', tok, 'beeld', klaverjas.beeld(c, tok));
end $$;

revoke all on function public.klaverjas_maak(text, jsonb, text), public.klaverjas_meedoen(text, text, text) from public;
grant execute on function public.klaverjas_maak(text, jsonb, text), public.klaverjas_meedoen(text, text, text) to anon, authenticated;

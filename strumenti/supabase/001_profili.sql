-- Profili dei giocatori della sala giochi: un documento JSON per account (lib/profilo.js),
-- con un numero di versione per scrivere solo se nessun altro dispositivo ha scritto nel frattempo.
create table public.profili (
  id uuid primary key references auth.users (id) on delete cascade,
  dati jsonb not null default '{}'::jsonb,
  versione integer not null default 1,
  aggiornato timestamptz not null default now(),
  constraint profili_dati_oggetto check (jsonb_typeof(dati) = 'object'),
  constraint profili_dati_misura check (pg_column_size(dati) <= 262144)
);
comment on table public.profili is 'Progressi della sala giochi (esperienza, medaglie, sfide), uno per account.';

alter table public.profili enable row level security;

create policy "profilo: leggo il mio" on public.profili
  for select to authenticated using ((select auth.uid()) = id);
create policy "profilo: creo il mio" on public.profili
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "profilo: aggiorno il mio" on public.profili
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "profilo: cancello il mio" on public.profili
  for delete to authenticated using ((select auth.uid()) = id);

revoke all on table public.profili from anon;
grant select, insert, update, delete on table public.profili to authenticated;

-- a ogni modifica: versione + 1 e data di aggiornamento
create function public.profili_versione() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.id := old.id;
  new.versione := old.versione + 1;
  new.aggiornato := now();
  return new;
end;
$$;
create trigger profili_versione before update on public.profili
  for each row execute function public.profili_versione();

-- un profilo nuovo parte sempre dalla versione 1
create function public.profili_nuovo() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.versione := 1;
  new.aggiornato := now();
  return new;
end;
$$;
create trigger profili_nuovo before insert on public.profili
  for each row execute function public.profili_nuovo();

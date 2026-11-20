-- Chi ha un account può eliminarlo da solo, insieme ai suoi progressi (on delete cascade su profili).
-- Agisce solo sull'utente che la chiama: auth.uid() viene dal suo accesso.
-- (Il controllo di sicurezza di Supabase la segnala perché è SECURITY DEFINER chiamabile da chi ha fatto
-- l'accesso: è voluto.)
create function public.elimina_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Serve un accesso' using errcode = '42501';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke execute on function public.elimina_account() from public, anon;
grant execute on function public.elimina_account() to authenticated;

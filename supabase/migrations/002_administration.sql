create schema if not exists mecascope_interne;
revoke all on schema mecascope_interne from public,anon,authenticated;
create table mecascope_interne.administrateurs (
 utilisateur uuid primary key references auth.users(id) on delete cascade
);
create function public.synthese_administration() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from mecascope_interne.administrateurs a join auth.users u on u.id=a.utilisateur where u.id=auth.uid() and u.email_confirmed_at is not null) then
 raise insufficient_privilege using message='Accès réservé';
 end if;
 return jsonb_build_object('entreprises',(select count(*) from public.entreprises),'etablissements',(select count(*) from public.etablissements),'aVerifier',(select count(*) from public.entreprises where not verifiee));
end $$;
revoke all on function public.synthese_administration() from public,anon;
grant execute on function public.synthese_administration() to authenticated;

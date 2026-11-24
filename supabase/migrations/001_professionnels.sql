begin;
create table public.entreprises (
 id uuid primary key default gen_random_uuid(), siren text unique not null check(siren ~ '^[0-9]{9}$'),
 nom text not null check(length(trim(nom)) between 1 and 200),
 gerant uuid not null references auth.users, verifiee boolean not null default false,
 unique(id,siren)
);
create table public.etablissements (
 id uuid primary key default gen_random_uuid(), entreprise uuid not null, siren text not null,
 siret text unique not null check(siret ~ '^[0-9]{14}$' and left(siret,9)=siren),
 foreign key(entreprise,siren) references public.entreprises(id,siren)
);
alter table public.entreprises enable row level security;
alter table public.etablissements enable row level security;
revoke all on public.entreprises,public.etablissements from public, anon,authenticated;
grant select on public.entreprises,public.etablissements to authenticated;
create policy lecture_gerant on public.entreprises for select to authenticated using(gerant=(select auth.uid()));
create policy lecture_sites on public.etablissements for select to authenticated using(exists(select 1 from public.entreprises e where e.id=entreprise and e.gerant=(select auth.uid())));
create function public.inscrire_entreprise(nom_societe text, premier_siret text) returns uuid language plpgsql security definer set search_path='' as $$
declare societe uuid;
begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Compte vérifié requis'; end if;
 insert into public.entreprises(nom,siren,gerant) values(nom_societe,left(premier_siret,9),auth.uid()) returning id into societe;
 insert into public.etablissements(entreprise,siren,siret) values(societe,left(premier_siret,9),premier_siret);
 return societe;
end $$;
revoke all on function public.inscrire_entreprise(text,text) from public,anon;
grant execute on function public.inscrire_entreprise(text,text) to authenticated;
commit;

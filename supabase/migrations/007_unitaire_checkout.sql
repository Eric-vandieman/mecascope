-- Dossiers à l'unité : devis approuvé avant acompte, solde après réussite uniquement.
create table if not exists public.meca_admins(
 user_id uuid primary key references auth.users(id) on delete restrict,
 cree_le timestamptz not null default now()
);
-- Administrateur fondateur déjà propriétaire du compte Mécascope, aucun utilisateur arbitraire
insert into public.meca_admins(user_id)
select owner_id from public.meca_garages
where id='f7816deb-84db-47cc-bd3d-50752e5fec29'
and owner_id='fc80d0f5-3762-46af-a9f1-c49f20dc0b32'
on conflict do nothing;

create table if not exists public.meca_demandes_unitaires(
 id uuid primary key default gen_random_uuid(),
 reference text not null unique,
 contact text not null,
 email text not null,
 telephone text,
 details jsonb not null,
 statut text not null default 'deposee'
 check(statut in ('deposee','devis_envoye','acompte_paye','reussite','solde_paye','echec','annulee')),
 offre text check(offre is null or offre in ('ciblee','approfondie','expert')),
 jeton_hash text unique,
 initial_price text,
 solde_price text,
 initial_session text unique,
 solde_session text unique,
 initial_paid_at timestamptz,
 solde_paid_at timestamptz,
 cree_le timestamptz not null default now(),
 modifie_le timestamptz not null default now()
);
create index if not exists meca_demandes_unitaires_statut on public.meca_demandes_unitaires(statut,cree_le desc);
alter table public.meca_admins enable row level security;
alter table public.meca_demandes_unitaires enable row level security;
revoke all on public.meca_admins,public.meca_demandes_unitaires from public,anon,authenticated;
grant select on public.meca_admins to service_role;
grant select,insert,update on public.meca_demandes_unitaires to service_role;

create or replace function public.meca_unitaire_confirmer_paiement(
 p_dossier uuid,p_session text,p_etape text,p_price text)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare d record; nouveau text;
begin
 select * into d from public.meca_demandes_unitaires where id=p_dossier for update;
 if not found then raise exception 'Dossier inexistant'; end if;
 if p_etape='initial' then
   if d.initial_session=p_session and d.initial_paid_at is not null then return d.statut; end if;
   if d.statut<>'devis_envoye' or d.initial_paid_at is not null or d.initial_price<>p_price then
     raise exception 'Acompte inattendu'; end if;
   update public.meca_demandes_unitaires
    set initial_session=p_session,initial_paid_at=now(),statut='acompte_paye',modifie_le=now()
    where id=p_dossier returning statut into nouveau;
 elsif p_etape='solde' then
   if d.solde_session=p_session and d.solde_paid_at is not null then return d.statut; end if;
   if d.statut<>'reussite' or d.initial_paid_at is null or d.solde_paid_at is not null or d.solde_price<>p_price then
     raise exception 'Solde non autorisé'; end if;
   update public.meca_demandes_unitaires
    set solde_session=p_session,solde_paid_at=now(),statut='solde_paye',modifie_le=now()
    where id=p_dossier returning statut into nouveau;
 else raise exception 'Étape de paiement invalide'; end if;
 return nouveau;
end $$;
revoke all on function public.meca_unitaire_confirmer_paiement(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.meca_unitaire_confirmer_paiement(uuid,text,text,text) to service_role;

-- Liens particuliers / dossiers et notification sûre du solde.
alter table public.meca_demandes_unitaires add column if not exists particulier_id uuid references auth.users(id) on delete set null;
create index if not exists meca_demandes_particulier_idx on public.meca_demandes_unitaires(particulier_id,cree_le desc) where particulier_id is not null;
alter table public.meca_demandes_unitaires add column if not exists solde_email_envoye_le timestamptz;
CREATE OR REPLACE FUNCTION public.meca_admin_preparer_resultat(p_dossier uuid, p_pays text, p_prix_centimes bigint, p_delai text, p_etat text, p_compatibilite text, p_fournisseur text, p_precisions text DEFAULT ''::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d record;
begin
 if auth.uid() is null or not (
   exists(select 1 from mecascope_interne.administrateurs where utilisateur=auth.uid())
   or exists(select 1 from public.meca_admins where user_id=auth.uid()))
 then raise insufficient_privilege;end if;
 select id,statut,initial_paid_at into d from public.meca_demandes_unitaires where id=p_dossier for update;
 if not found or d.initial_paid_at is null or d.statut not in ('acompte_paye','reussite') then
  raise exception 'Acompte confirmé requis avant préparation du résultat';
 end if;
 if nullif(trim(coalesce(p_pays,'')),'') is null or length(p_pays)>100
 or p_prix_centimes is null or p_prix_centimes<0 or p_prix_centimes>100000000
 or nullif(trim(coalesce(p_delai,'')),'') is null or length(p_delai)>140
 or nullif(trim(coalesce(p_fournisseur,'')),'') is null or length(p_fournisseur)>300
 or length(trim(p_fournisseur))<2 or length(coalesce(p_precisions,''))>3000
 then raise exception 'Résultat incomplet ou invalide';end if;
 insert into public.meca_resultats_fournisseurs(
 dossier_id,pays,prix_centimes,delai,etat,compatibilite,fournisseur_prive,precisions)
 values(p_dossier,trim(p_pays),p_prix_centimes,trim(p_delai),
 left(coalesce(p_etat,''),60),left(coalesce(p_compatibilite,''),100),trim(p_fournisseur),coalesce(p_precisions,''))
 on conflict(dossier_id) do update set pays=excluded.pays,prix_centimes=excluded.prix_centimes,
 delai=excluded.delai,etat=excluded.etat,compatibilite=excluded.compatibilite,
 fournisseur_prive=excluded.fournisseur_prive,precisions=excluded.precisions,actualise_le=now();
 return true;
end $function$
;
revoke all on function public.meca_admin_preparer_resultat(uuid,text,bigint,text,text,text,text,text) from public,anon;
grant execute on function public.meca_admin_preparer_resultat(uuid,text,bigint,text,text,text,text,text) to authenticated;

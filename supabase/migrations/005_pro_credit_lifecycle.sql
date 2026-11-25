-- Mécascope Pro : débits/remboursements idempotents par dossier, opérations strictement service_role.
-- Aucune création de demande client ne débite le compte : seule l'acceptation administrative le fait.
create table if not exists public.meca_credit_mouvements (
 id uuid primary key default gen_random_uuid(),
 garage_id uuid not null references public.meca_garages(id) on delete restrict,
 recherche_id uuid not null references public.meca_recherches(id) on delete restrict,
 type text not null check(type in ('debit_recherche','restitution_echec')),
 credits integer not null check(credits in (-2,1)),
 cree_le timestamptz not null default now(),
 constraint meca_credit_mouvement_unique unique(recherche_id,type)
);
create index if not exists meca_credit_mouvements_garage on public.meca_credit_mouvements(garage_id,cree_le);
alter table public.meca_credit_mouvements enable row level security;
revoke all on public.meca_credit_mouvements from public,anon,authenticated;
grant select,insert on public.meca_credit_mouvements to service_role;

create or replace function public.meca_credit_engager_recherche(p_recherche uuid)
returns integer language plpgsql security definer set search_path=public,pg_temp
as $$
declare dossier record; deja boolean; result integer;
begin
 select r.id,r.garage_id,r.approuvee,r.statut into dossier
 from public.meca_recherches r where r.id=p_recherche for update;
 if not found then raise exception 'Dossier non trouvé'; end if;
 select exists(select 1 from public.meca_credit_mouvements m where m.recherche_id=p_recherche and m.type='debit_recherche') into deja;
 if deja then return (select credits_disponibles from public.meca_garages where id=dossier.garage_id); end if;
 if dossier.approuvee is not true or dossier.statut <> 'nouvelle' then raise exception 'Dossier non validé pour engagement'; end if;
 update public.meca_garages set credits_disponibles=credits_disponibles-2
 where id=dossier.garage_id and credits_disponibles>=2
 returning credits_disponibles into result;
 if not found then raise exception 'Crédits insuffisants'; end if;
 insert into public.meca_credit_mouvements(garage_id,recherche_id,type,credits)
 values(dossier.garage_id,p_recherche,'debit_recherche',-2);
 update public.meca_recherches set statut='en_cours',modifie_le=now() where id=p_recherche;
 return result;
end $$;

create or replace function public.meca_credit_echec_recherche(p_recherche uuid)
returns integer language plpgsql security definer set search_path=public,pg_temp
as $$
declare dossier record; result integer;
begin
 select id,garage_id,statut into dossier from public.meca_recherches where id=p_recherche for update;
 if not found then raise exception 'Dossier non trouvé'; end if;
 if not exists(select 1 from public.meca_credit_mouvements where recherche_id=p_recherche and type='debit_recherche')
 then raise exception 'Aucun crédit initial débité'; end if;
 if exists(select 1 from public.meca_credit_mouvements where recherche_id=p_recherche and type='restitution_echec')
 then return (select credits_disponibles from public.meca_garages where id=dossier.garage_id); end if;
 if dossier.statut not in ('en_cours','en_attente') then raise exception 'Dossier non éligible à restitution'; end if;
 update public.meca_garages set credits_disponibles=credits_disponibles+1
 where id=dossier.garage_id returning credits_disponibles into result;
 insert into public.meca_credit_mouvements(garage_id,recherche_id,type,credits)
 values(dossier.garage_id,p_recherche,'restitution_echec',1);
 update public.meca_recherches set statut='terminee',modifie_le=now() where id=p_recherche;
 return result;
end $$;
revoke all on function public.meca_credit_engager_recherche(uuid) from public,anon,authenticated;
revoke all on function public.meca_credit_echec_recherche(uuid) from public,anon,authenticated;
grant execute on function public.meca_credit_engager_recherche(uuid) to service_role;
grant execute on function public.meca_credit_echec_recherche(uuid) to service_role;

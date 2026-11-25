-- Stripe Mécascope: synchronisation d'un abonnement résilié, accès service_role uniquement.
create or replace function public.meca_stripe_statut_abonnement(p_subscription text,p_statut text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare n int;
begin
 if p_statut not in ('resilie','impaye','actif') then raise exception 'Statut refusé'; end if;
 update public.meca_stripe_abonnements set statut=p_statut,modifie_le=now()
 where stripe_subscription_id=p_subscription;
 get diagnostics n=row_count;
 return n>0;
end; $$;
revoke all on function public.meca_stripe_statut_abonnement(text,text) from public,anon,authenticated;
grant execute on function public.meca_stripe_statut_abonnement(text,text) to service_role;
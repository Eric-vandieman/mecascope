-- Mécascope : fondations du suivi Stripe/credits (non activées sans contrôles E2E).
-- Exécuter dans une migration après sauvegarde de la base et validation des droits.
alter table public.meca_garages add column if not exists verified boolean not null default false;

create table if not exists public.meca_stripe_abonnements (
 stripe_subscription_id text primary key,
 garage_id uuid not null references public.meca_garages(id) on delete restrict,
 stripe_customer_id text not null,
 plan text not null check (plan in ('priorite','pro5','pro10')),
 stripe_price_id text not null,
 credits_par_periode integer not null check (credits_par_periode in (0,10,20)),
 statut text not null default 'actif',
 cree_le timestamptz not null default now(),
 modifie_le timestamptz not null default now()
);
create index if not exists meca_abonnements_garage_idx on public.meca_stripe_abonnements(garage_id);
create table if not exists public.meca_credit_operations (
 id uuid primary key default gen_random_uuid(),
 garage_id uuid not null references public.meca_garages(id) on delete restrict,
 stripe_subscription_id text not null references public.meca_stripe_abonnements(stripe_subscription_id),
 stripe_invoice_id text not null unique,
 credits integer not null check (credits>=0 and credits<=20),
 cree_le timestamptz not null default now()
);
create index if not exists meca_credit_operations_garage_idx on public.meca_credit_operations(garage_id);

alter table public.meca_stripe_abonnements enable row level security;
alter table public.meca_credit_operations enable row level security;
revoke all on public.meca_stripe_abonnements from public, anon, authenticated;
revoke all on public.meca_credit_operations from public, anon, authenticated;

create or replace function public.meca_stripe_lier_abonnement(
 p_garage uuid,p_subscription text,p_customer text,p_plan text,p_price text,p_credits integer
) returns void
language plpgsql security definer set search_path=public,pg_temp
as $$
begin
 if p_garage is null or length(coalesce(p_subscription,''))<8 or length(coalesce(p_customer,''))<8
 or p_plan not in ('priorite','pro5','pro10')
 or (p_plan='priorite' and p_credits<>0) or (p_plan='pro5' and p_credits<>10) or (p_plan='pro10' and p_credits<>20)
 then raise exception 'Abonnement Stripe invalide'; end if;
 if not exists (select 1 from public.meca_garages where id=p_garage and verified=true)
 then raise exception 'Etablissement non vérifié'; end if;
 insert into public.meca_stripe_abonnements(stripe_subscription_id,garage_id,stripe_customer_id,plan,stripe_price_id,credits_par_periode)
 values(p_subscription,p_garage,p_customer,p_plan,p_price,p_credits)
 on conflict(stripe_subscription_id) do update set
  statut='actif',modifie_le=now()
 where public.meca_stripe_abonnements.garage_id=excluded.garage_id
   and public.meca_stripe_abonnements.stripe_customer_id=excluded.stripe_customer_id
   and public.meca_stripe_abonnements.stripe_price_id=excluded.stripe_price_id;
 if not found then raise exception 'Conflit de rattachement abonnement'; end if;
end $$;

create or replace function public.meca_stripe_crediter_facture(p_subscription text,p_invoice text)
returns integer
language plpgsql security definer set search_path=public,pg_temp
as $$
declare info record; nouveau uuid;
begin
 if length(coalesce(p_invoice,''))<8 then raise exception 'Facture Stripe invalide'; end if;
 select garage_id,credits_par_periode into info from public.meca_stripe_abonnements where stripe_subscription_id=p_subscription for update;
 if not found then raise exception 'Abonnement non rattaché'; end if;
 insert into public.meca_credit_operations(garage_id,stripe_subscription_id,stripe_invoice_id,credits)
 values(info.garage_id,p_subscription,p_invoice,info.credits_par_periode)
 on conflict(stripe_invoice_id) do nothing returning id into nouveau;
 if nouveau is not null and info.credits_par_periode>0 then
  update public.meca_garages set credits_disponibles=credits_disponibles+info.credits_par_periode where id=info.garage_id;
 end if;
 return info.credits_par_periode;
end $$;

revoke all on function public.meca_stripe_lier_abonnement(uuid,text,text,text,text,integer) from public,anon,authenticated;
revoke all on function public.meca_stripe_crediter_facture(text,text) from public,anon,authenticated;
grant execute on function public.meca_stripe_lier_abonnement(uuid,text,text,text,text,integer) to service_role;
grant execute on function public.meca_stripe_crediter_facture(text,text) to service_role;
grant select,insert,update on public.meca_stripe_abonnements to service_role;
grant select,insert on public.meca_credit_operations to service_role;

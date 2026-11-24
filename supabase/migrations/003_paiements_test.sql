create table mecascope_interne.configuration_paiement_test (id boolean primary key check(id), empreinte text not null);
create table mecascope_interne.paiements_test (
 objet text primary key, evenement text not null unique, type_evenement text not null, centimes bigint not null check(centimes>=0),
 devise text not null, lien text, recu_le timestamptz not null default now()
);
alter table mecascope_interne.configuration_paiement_test enable row level security;
alter table mecascope_interne.paiements_test enable row level security;
create function public.recevoir_paiement_test(cle text, evenement text, objet text, type_evenement text, centimes bigint, devise text, lien text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from mecascope_interne.configuration_paiement_test c where c.empreinte=encode(sha256(convert_to(cle,'UTF8')),'hex')) then raise insufficient_privilege; end if;
 insert into mecascope_interne.paiements_test(objet,evenement,type_evenement,centimes,devise,lien)
 values ($3,$2,$4,$5,$6,$7) on conflict do nothing;
end $$;
revoke all on function public.recevoir_paiement_test(text,text,text,text,bigint,text,text) from public;
grant execute on function public.recevoir_paiement_test(text,text,text,text,bigint,text,text) to anon;

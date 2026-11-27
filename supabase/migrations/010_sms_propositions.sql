-- Historique transactionnel et verrou anti-doublons pour les SMS de proposition Mécascope.
-- La clé primaire empêche de facturer plusieurs alertes pour un même dossier.
create table if not exists public.meca_sms_notifications (
 dossier_id uuid primary key references public.meca_demandes_unitaires(id) on delete cascade,
 type text not null default 'proposition' check(type = 'proposition'),
 statut text not null default 'en_attente' check(statut in ('en_attente','envoye','echec','non_envoye')),
 telephone text,
 ovh_job_id text,
 erreur text,
 cree_le timestamptz not null default now(),
 modifie_le timestamptz not null default now()
);
alter table public.meca_sms_notifications enable row level security;
revoke all on public.meca_sms_notifications from anon, authenticated;

-- Modèles personnalisables par l'administrateur. Aucun accès public.
create table if not exists public.meca_sms_modeles (
 type text primary key check (type in ('proposition','piece_trouvee')),
 message text not null,
 modifie_le timestamptz not null default now(),
 constraint meca_sms_modeles_message_length check (char_length(message) between 1 and 160)
);
alter table public.meca_sms_modeles enable row level security;
revoke all on public.meca_sms_modeles from anon, authenticated;
insert into public.meca_sms_modeles(type,message) values
('proposition','MECASCOPE : votre proposition est disponible. Consultez votre e-mail, y compris les spams, pour acceder a votre dossier.'),
('piece_trouvee','MECASCOPE : Bonne nouvelle ! Nous avons trouve votre piece. Connectez-vous a votre espace client pour regler le solde et obtenir le contact du fournisseur.')
on conflict(type) do nothing;

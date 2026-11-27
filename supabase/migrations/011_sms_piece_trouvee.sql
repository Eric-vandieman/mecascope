-- Un dossier peut recevoir exactement un SMS de proposition et un SMS de pièce trouvée.
alter table public.meca_sms_notifications drop constraint meca_sms_notifications_type_check;
alter table public.meca_sms_notifications add constraint meca_sms_notifications_type_check
check (type in ('proposition','piece_trouvee'));
alter table public.meca_sms_notifications drop constraint meca_sms_notifications_pkey;
alter table public.meca_sms_notifications add constraint meca_sms_notifications_pkey
primary key (dossier_id,type);

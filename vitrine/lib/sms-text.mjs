// Mesure les unités réellement utilisées par un SMS unique : GSM-7 (160 septets)
// ou Unicode/UCS-2 (70 unités UTF-16). Les caractères d'extension GSM-7 coûtent 2 septets.
export const GSM7_BASIC = new Set([...("@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà")]);
export const GSM7_EXTENDED = new Set([...("^{}\\[~]|€\f")]);
export function measureSms(input){
 const value=String(input??'');
 let septets=0, gsm=true;
 for(const c of value){
  if(GSM7_BASIC.has(c))septets++;
  else if(GSM7_EXTENDED.has(c))septets+=2;
  else{gsm=false;break}
 }
 const units=gsm?septets:value.length;
 const limit=gsm?160:70;
 return {encoding:gsm?'GSM-7':'Unicode',units,limit,remaining:limit-units,characters:[...value].length,oneSms:value.length>0&&units<=limit};
}
export const DEFAULT_SMS={
 proposition:'MECASCOPE : votre proposition est disponible. Consultez votre e-mail, y compris les spams, pour acceder a votre dossier.',
 piece_trouvee:'MECASCOPE : Bonne nouvelle ! Nous avons trouve votre piece. Connectez-vous a votre espace client pour regler le solde et obtenir le contact du fournisseur.'
};

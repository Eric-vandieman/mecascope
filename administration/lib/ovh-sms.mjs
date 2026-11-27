import {createHash} from 'node:crypto';

export function normalizeMobile(input){
 let n=String(input||'').trim().replace(/[\s().-]/g,'');
 if(n.startsWith('00'))n='+'+n.slice(2);
 if(/^0[67]\d{8}$/.test(n))return '+33'+n.slice(1);
 if(/^\+33[67]\d{8}$/.test(n))return n;
 // Outside France, require an international number; the carrier performs final mobile validation.
 if(/^\+[1-9]\d{7,14}$/.test(n)&&!n.startsWith('+33'))return n;
 return '';
}
const URL_BASE='https://api.eu.ovhcloud.com/1.0';
export async function sendProposalSms(phone,kind='proposition',customMessage=null){
 if(!['proposition','piece_trouvee'].includes(kind))throw Error('Type de SMS invalide');
 const receiver=normalizeMobile(phone);
 if(!receiver)throw Error('Numéro de portable absent ou invalide');
 const app=process.env.OVH_APP_KEY,secret=process.env.OVH_APP_SECRET,consumer=process.env.OVH_CONSUMER_KEY,service=process.env.OVH_SMS_SERVICE;
 if(!app||!secret||!consumer||!service)throw Error('Configuration OVH SMS incomplète');
 const timeResponse=await fetch(URL_BASE+'/auth/time',{signal:AbortSignal.timeout(8000)});
 if(!timeResponse.ok)throw Error('Horloge OVH indisponible');
 const timestamp=Number(await timeResponse.text());
 if(!Number.isFinite(timestamp))throw Error('Horloge OVH invalide');
 const url=URL_BASE+'/sms/'+encodeURIComponent(service)+'/jobs';
 const payload={charset:'UTF-8',message:kind==='piece_trouvee'?'MECASCOPE : Bonne nouvelle ! Nous avons trouve votre piece. Connectez-vous a votre espace client pour regler le solde et obtenir le contact du fournisseur.':'MECASCOPE : votre proposition est disponible. Consultez votre e-mail, y compris les spams, pour acceder a votre dossier.',receivers:[receiver],sender:'MECASCOPE',noStopClause:true,priority:'high',senderForResponse:false};
 if(typeof customMessage==='string'&&customMessage.trim())payload.message=customMessage.trim();
 // Limite défensive pour ne jamais facturer de SMS concaténés par inadvertance.
 const basic=new Set([...("@£$¥èéùìòÇ\\nØø\\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\\\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà")]);
 const ext=new Set([...("^{}\\\\[~]|€\\f")]);
 let count=0,unicode=false;
 for(const char of payload.message){if(basic.has(char))count++;else if(ext.has(char))count+=2;else{unicode=true;break}}
 const max=unicode?70:160;
 if((unicode?payload.message.length:count)>max)throw Error('Message trop long pour un seul SMS');
  const body=JSON.stringify(payload),method='POST';
 const signature='$1$'+createHash('sha1').update([secret,consumer,method,url,body,timestamp].join('+')).digest('hex');
 const response=await fetch(url,{method,headers:{'Content-Type':'application/json','X-Ovh-Application':app,'X-Ovh-Consumer':consumer,'X-Ovh-Timestamp':String(timestamp),'X-Ovh-Signature':signature},body,signal:AbortSignal.timeout(12000)});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Error('OVH HTTP '+response.status+': '+String(result.message||result.error||'Envoi refusé').slice(0,160));
 if(Array.isArray(result.invalidReceivers)&&result.invalidReceivers.length)throw Error('Destinataire refusé par OVH');
 return {jobId:Array.isArray(result.ids)?String(result.ids[0]||''):String(result.id||''),credits:result.totalCreditsRemoved??null};
}

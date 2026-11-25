export const config={maxDuration:60};
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({success:false,step:'method'});
 if(!process.env.OPENAI_API_KEY)return res.status(503).json({success:false,step:'environment',error:'OPENAI_API_KEY absente'});
 try{
 const openai=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Authorization':'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.MECASCOPE_AI_MODEL||'gpt-4.1-mini',temperature:0.1,response_format:{type:'json_object'},messages:[{role:'system',content:'Tu es un documentaliste mécanique prudent. Réponds en JSON en français, n’invente aucune compatibilité ni cote non documentée.'},{role:'user',content:'TEST AUTOMATISÉ : dossier fictif, Renault Clio II 1.2 16V 2003, demande de soupape admission sans référence OEM. Retourne un JSON avec les clés resume_simple,fonctionnement,caracteristiques_techniques,alternatives_compatibles_a_verifier,points_inconnus. Ne donne aucune référence inventée.'}]}),signal:AbortSignal.timeout(44000)});
 const result=await openai.json().catch(()=>({}));
 if(!openai.ok)return res.status(502).json({success:false,step:'openai',status:openai.status,error:result.error?.message||'Erreur OpenAI',error_code:result.error?.code||null});
 let fiche;try{fiche=JSON.parse(result.choices?.[0]?.message?.content||'{}')}catch{return res.status(502).json({success:false,step:'json',error:'Réponse invalide'})}
 return res.status(200).json({success:!!fiche.resume_simple&&!!fiche.fonctionnement,step:'generation',model:result.model||null,fields:Object.keys(fiche),fiche,usage:result.usage||null});
 }catch(e){return res.status(502).json({success:false,step:'network',error:String(e.message||e)})}
}
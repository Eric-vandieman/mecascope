// L'API fournisseur n'est pas encore configurée. Ne pas simuler une identification.
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({message:'Méthode non autorisée'});
 return res.status(503).json({message:"La recherche par immatriculation sera disponible après activation de l'API gratuite. Utilisez la sélection manuelle."});
}

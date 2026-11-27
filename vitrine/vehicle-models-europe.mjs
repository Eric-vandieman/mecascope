// Catalogue complémentaire Mécascope pour les modèles européens, actuels et historiques.
// Liste indicative : jamais utilisée comme liste fermée. La saisie manuelle reste accessible.
// Les variantes moteur/génération se précisent ensuite dans le formulaire.
const DATA = {
  "Peugeot": "101|104|106|107|108|201|202|203|204|205|206|206+|206 CC|206 SW|207|207 CC|207 SW|208|301|302|304|305|306|306 Cabriolet|306 Break|307|307 CC|307 SW|307 Break|308|308 CC|308 SW|309|401|402|403|404|405|406|406 Coupé|407|407 Coupé|407 SW|408|504|505|508|508 SW|604|605|607|806|807|1007|2008|3008|4007|4008|5008|e-208|e-2008|e-3008|e-5008|e-308|e-408|iOn|RCZ|Rifter|Partner|Partner Tepee|Bipper|Bipper Tepee|Expert|Expert Tepee|Traveller|Boxer|J5|J7|J9|Landtrek|Hoggar|P4",
  "Citroën": "2CV|Ami|Ami 6|Ami 8|Ami Super|AX|BX|CX|C1|C2|C3|C3 Aircross|C3 Picasso|C3 Pluriel|C4|C4 Aircross|C4 Cactus|C4 Coupé|C4 Picasso|Grand C4 Picasso|C4 SpaceTourer|Grand C4 SpaceTourer|C4 X|C5|C5 Aircross|C5 X|C5 Tourer|C6|C8|C15|C25|C35|DS|DS3|DS4|DS5|Dyane|E-Méhari|Évasion|GS|GSA|ID|LN|LNA|Méhari|Nemo|Saxo|SM|Traction Avant|Visa|Xantia|XM|Xsara|Xsara Picasso|ZX|Berlingo|Berlingo Multispace|Jumpy|Jumper|Spacetourer|C-Crosser|C-Elysée|C-Zero|ë-C3|ë-C4|ë-C4 X|ë-Berlingo|ë-Spacetourer",
  "Renault": "4|4L|5|5 E-Tech|6|8|9|10|11|12|14|15|16|17|18|19|20|21|25|30|Alaskan|Arkana|Austral|Avantime|Captur|Clio|Clio Williams|Dauphine|Espace|Estafette|Express|Fluence|Fuego|Grand Scénic|Kadjar|Kangoo|Kangoo Express|Koleos|Laguna|Laguna Coupé|Latitude|Logan|Mascott|Master|Mégane|Mégane Coupé|Mégane CC|Mégane Estate|Mégane E-Tech|Modus|Grand Modus|Rafale|R4 E-Tech|R5 E-Tech|Rodeo|Safrane|Scénic|Scénic E-Tech|Spider|Super 5|Symbioz|Talisman|Talisman Estate|Trafic|Twingo|Twizy|Vel Satis|Wind|Zoe|Express Van|Kangoo Van|Master Van|Trafic Van",
  "Dacia": "1100|1300|1310|1410|Bigster|Dokker|Dokker Stepway|Duster|Jogger|Lodgy|Logan|Logan MCV|Logan Stepway|Pick-Up|Sandero|Sandero Stepway|Solenza|Spring|Nova|SuperNova",
  "DS": "DS 3|DS 3 Crossback|DS 4|DS 4 Crossback|DS 5|DS 7|DS 7 Crossback|DS 9|N°4|N°7|N°8",
  "Volkswagen": "Amarok|Arteon|Atlas|Beetle|New Beetle|Bora|Caddy|California|Caravelle|CC|Corrado|Crafter|Derby|Eos|Fox|Golf|Golf Cabriolet|Golf Plus|Golf Sportsvan|Golf Variant|ID.3|ID.4|ID.5|ID.6|ID.7|ID. Buzz|Jetta|Karmann Ghia|Lupo|LT|Multivan|Passat|Passat CC|Passat Variant|Phaeton|Polo|Routan|Scirocco|Sharan|Taigo|T-Cross|T-Roc|Tiguan|Touareg|Touran|Transporter|T1|T2|T3|T4|T5|T6|T7|Up!|Vento",
  "Audi": "50|80|90|100|200|A1|A2|A3|A3 Sportback|A3 Cabriolet|A4|A4 Avant|A4 Allroad|A5|A5 Sportback|A5 Avant|A6|A6 Avant|A6 Allroad|A7|A8|e-tron|Q2|Q3|Q4 e-tron|Q5|Q6 e-tron|Q7|Q8|Q8 e-tron|R8|RS3|RS4|RS5|RS6|RS7|RS Q3|RS Q8|S1|S3|S4|S5|S6|S7|S8|SQ2|SQ5|SQ6|SQ7|SQ8|TT|TTS|TT RS",
  "BMW": "1500|1602|1802|2002|3.0 CS|Série 1|Série 2|Série 2 Active Tourer|Série 2 Gran Tourer|Série 3|Série 3 Touring|Série 4|Série 4 Gran Coupé|Série 5|Série 5 Touring|Série 6|Série 6 Gran Turismo|Série 7|Série 8|M1|M2|M3|M4|M5|M6|M8|i3|i4|i5|i7|i8|iX|iX1|iX2|iX3|X1|X2|X3|X4|X5|X6|X7|XM|Z1|Z3|Z4|Z8",
  "Mercedes-Benz": "190|190 E|190 D|Classe A|Classe B|Classe C|Classe C Coupé|Classe C Break|Classe E|Classe E Coupé|Classe E Break|Classe G|Classe M|Classe R|Classe S|CLA|CLC|CLK|CLS|CL|SL|SLC|SLK|SLR|SLS|AMG GT|GLA|GLB|GLC|GLE|GLK|GLS|GL|EQA|EQB|EQC|EQE|EQS|EQV|Vito|Viano|Classe V|Citan|Sprinter|T1|T2|Classe T|Classe X|Unimog|Maybach|G 63 AMG",
  "Opel": "Adam|Agila|Ampera|Ampera-e|Antara|Ascona|Astra|Calibra|Campo|Cascada|Combo|Commodore|Corsa|Crossland|Crossland X|Frontera|Grandland|Grandland X|GT|Insignia|Kadett|Karl|Manta|Meriva|Mokka|Mokka X|Monza|Movano|Omega|Rekord|Senator|Signum|Speedster|Tigra|Vectra|Vivaro|Zafira|Zafira Tourer|Zafira Life",
  "Ford": "Anglia|B-Max|Bronco|C-Max|Capri|Cortina|Cougar|Ecosport|Edge|Escort|Explorer|F-150|F-250|Fiesta|Focus|Focus C-Max|Fusion|Galaxy|Granada|GT|Ka|Ka+|Kuga|Maverick|Mondeo|Mustang|Mustang Mach-E|Orion|Puma|Puma Gen-E|Ranger|S-Max|Scorpio|Sierra|Taunus|Tourneo Connect|Tourneo Courier|Tourneo Custom|Transit|Transit Connect|Transit Courier|Transit Custom|Transit 2T|Windstar",
  "Toyota": "4Runner|Auris|Avensis|Aygo|Aygo X|bZ4X|C-HR|Camry|Carina|Celica|Corolla|Corolla Cross|Corolla Verso|Crown|FJ Cruiser|GR86|GT86|Hiace|Highlander|Hilux|Land Cruiser|LiteAce|Mirai|MR2|Paseo|Picnic|Previa|Prius|Prius+|Proace|Proace City|RAV4|Starlet|Supra|Tundra|Urban Cruiser|Verso|Yaris|Yaris Cross|Yaris Verso",
  "Nissan": "100NX|200SX|300ZX|350Z|370Z|Almera|Almera Tino|Ariya|Bluebird|Cube|Evalia|GT-R|Interstar|Juke|King Cab|Kubistar|Leaf|Maxima|Micra|Murano|Navara|Note|NV200|NV250|NV300|NV400|Pathfinder|Patrol|Primastar|Primera|Pulsar|Qashqai|Qashqai+2|Rogue|Sentra|Serena|Silvia|Skyline|Sunny|Terrano|Tiida|Townstar|X-Trail|Z",
  "Fiat": "124|124 Spider|125|126|127|128|130|131|500|500C|500e|500L|500L Living|500X|600|600e|850|Barchetta|Brava|Bravo|Cinquecento|Coupe|Croma|Doblo|Ducato|Fiorino|Freemont|Fullback|Grande Punto|Idea|Linea|Marea|Multipla|Panda|Panda 4x4|Panda Cross|Punto|Punto Evo|Qubo|Regata|Ritmo|Scudo|Sedici|Seicento|Stilo|Strada|Talento|Tempra|Tipo|Topolino|Ulysse|Uno|X1/9",
  "Alfa Romeo": "33|75|90|145|146|147|155|156|159|164|166|4C|8C Competizione|Alfasud|Brera|Crosswagon|Giulia|Giulietta|GT|GTV|Junior|MiTo|Spider|Stelvio|Tonale",
  "Seat": "Alhambra|Altea|Altea XL|Arona|Arosa|Ateca|Cordoba|Exeo|Ibiza|Inca|Leon|Leon ST|Marbella|Mii|Tarraco|Toledo",
  "Skoda": "Citigo|Elroq|Enyaq|Enyaq Coupé|Fabia|Favorit|Felicia|Kamiq|Karoq|Kodiaq|Octavia|Rapid|Rapid Spaceback|Roomster|Scala|Superb|Yeti",
  "Kia": "Carens|Carnival|Ceed|Ceed SW|Cerato|EV3|EV4|EV5|EV6|EV9|K4|K5|Magentis|Niro|Niro EV|Opirus|Optima|Picanto|ProCeed|Rio|Seltos|Sorento|Soul|Sportage|Stinger|Stonic|Venga|XCeed",
  "Hyundai": "Accent|Atos|Bayon|Coupe|Elantra|Galloper|Genesis|Getz|Grandeur|H-1|H350|i10|i20|i30|i30 Fastback|i40|Inster|Ioniq|Ioniq 5|Ioniq 5 N|Ioniq 6|Ioniq 9|ix20|ix35|Kona|Kona Electric|Lantra|Matrix|Nexo|Santa Fe|Sonata|Staria|Terracan|Trajet|Tucson|Veloster",
  "Honda": "Accord|Civic|Civic Type R|City|CR-V|CR-X|CR-Z|e|e:Ny1|FR-V|HR-V|Insight|Integra|Jazz|Legend|Logo|NSX|Prelude|S2000|Shuttle|Stream|ZR-V",
  "Mazda": "121|2|2 Hybrid|3|5|6|323|626|929|B2500|BT-50|CX-3|CX-30|CX-5|CX-50|CX-60|CX-7|CX-80|CX-9|CX-90|Demio|MX-3|MX-5|MX-6|MX-30|MPV|Premacy|RX-7|RX-8|Xedos 6|Xedos 9",
  "Mitsubishi": "3000GT|ASX|Carisma|Colt|Eclipse|Eclipse Cross|Galant|Grandis|i-MiEV|L200|L300|L400|Lancer|Lancer Evolution|Mirage|Outlander|Outlander PHEV|Pajero|Pajero Pinin|Pajero Sport|Space Star|Space Wagon",
  "Suzuki": "Across|Alto|Baleno|Celerio|Grand Vitara|Ignis|Jimny|Kizashi|Liana|S-Cross|Samurai|Splash|Swift|Swift Sport|SX4|Vitara|Wagon R+",
  "Volvo": "240|244|245|340|360|440|460|480|740|760|850|940|960|C30|C40|C70|EC40|ES90|EX30|EX40|EX90|S40|S60|S70|S80|S90|V40|V50|V60|V70|V90|XC40|XC60|XC70|XC90",
  "Mini": "Aceman|Cabrio|Clubman|Cooper|Cooper S|Cooper SE|Countryman|Coupe|John Cooper Works|One|Paceman|Roadster",
  "Jeep": "Avenger|Cherokee|Commander|Compass|Gladiator|Grand Cherokee|Patriot|Renegade|Wagoneer|Wrangler",
  "Land Rover": "Defender|Discovery|Discovery Sport|Freelander|Range Rover|Range Rover Evoque|Range Rover Sport|Range Rover Velar",
  "Jaguar": "E-Pace|F-Pace|F-Type|I-Pace|S-Type|X-Type|XE|XF|XJ|XK|XKR|E-Type|Mark 2",
  "Porsche": "356|718 Boxster|718 Cayman|911|912|914|924|928|944|968|Boxster|Carrera GT|Cayenne|Cayman|Macan|Panamera|Taycan",
  "Tesla": "Model 3|Model S|Model X|Model Y|Roadster|Cybertruck",
  "Subaru": "BRZ|Forester|Impreza|Justy|Legacy|Levorg|Outback|Solterra|SVX|Tribeca|WRX|XV|Crosstrek",
  "Saab": "9-3|9-5|90|900|9000|Sonett|96|99",
  "Chevrolet": "Aveo|Blazer|Bolt|Camaro|Captiva|Corvette|Cruze|Epica|Equinox|Kalos|Lacetti|Malibu|Matiz|Orlando|Silverado|Spark|Suburban|Tahoe|Trax|Volt",
  "Chrysler": "200|300|300C|Crossfire|Grand Voyager|Neon|Pacifica|PT Cruiser|Sebring|Stratus|Town & Country|Voyager",
  "Dodge": "Avenger|Caliber|Challenger|Charger|Durango|Grand Caravan|Journey|Magnum|Nitro|Ram|Viper",
  "Lexus": "CT|ES|GS|GX|IS|LBX|LC|LFA|LM|LS|LX|NX|RC|RX|RZ|SC|UX",
  "Smart": "#1|#3|#5|Crossblade|Forfour|Fortwo|Roadster",
  "MG": "3|4|5|Cyberster|EHS|GS|HS|Marvel R|MG ZS|ZS EV|S5 EV|TF|F|ZR|ZS|ZT",
  "Opel/Vauxhall": "Astra|Corsa|Insignia|Mokka|Zafira",
  "Cupra": "Ateca|Born|Formentor|Leon|Tavascan|Terramar",
  "Polestar": "1|2|3|4|5",
  "BYD": "Atto 2|Atto 3|Dolphin|Dolphin Surf|Han|Seal|Seal U|Sealion 7|Tang",
  "Renault Trucks": "C|D|D Wide|E-Tech D|K|Master|Midlum|Premium|T",
  "Iveco": "Daily|Eurocargo|Eurostar|Eurotech|Stralis|S-Way",
  "Isuzu": "D-Max|MU-X|N-Series|Trooper",
  "Ferrari": "208|246 Dino|308|328|348|355|360|430|458|488|550|575M|599|612|812|California|F8|F12|FF|GTC4Lusso|Portofino|Purosangue|Roma|SF90|296",
  "Lamborghini": "Aventador|Countach|Diablo|Gallardo|Huracán|Jalpa|Miura|Murciélago|Revuelto|Urus",
  "Lotus": "Elan|Elise|Emeya|Emira|Esprit|Eletre|Europa|Evora|Exige",
  "Alpine": "A106|A108|A110|A290|A310|A610|GTA|V6 GT|V6 Turbo",
  "Lancia": "Beta|Delta|Dedra|Flavia|Fulvia|Gamma|Kappa|Lybra|Musa|Phedra|Prisma|Stratos|Thema|Thesis|Y|Ypsilon",
  "Daewoo": "Espero|Kalos|Lacetti|Lanos|Leganza|Matiz|Nexia|Nubira|Rezzo|Tacuma",
  "Rover": "25|45|75|100|200|400|600|800|Mini|MGF|Streetwise",
  "Daewoo/Chevrolet": "Aveo|Kalos|Lacetti|Lanos|Matiz|Nubira|Spark"
};
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]/g,'').toLowerCase();
export const localBrands=Object.keys(DATA).filter(n=>!n.includes('/'));
export function localModels(brand){
 const key=Object.keys(DATA).find(k=>normalize(k)===normalize(brand));
 return key?[...new Set(DATA[key].split('|').map(x=>x.trim()).filter(Boolean))]:[];
}
export function localMatch(name){
 return Object.keys(DATA).find(k=>normalize(k)===normalize(name))||null;
}

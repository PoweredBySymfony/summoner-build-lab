import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ItemCategory, PuzzleChoiceType, PuzzleDifficulty, Role, LanguageCode, ItemRelationType } from "@prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
});

const patch = "14.10";
const ddChampion = "https://ddragon.leagueoflegends.com/cdn/14.10.1/img/champion";
const ddItem = "https://ddragon.leagueoflegends.com/cdn/14.10.1/img/item";

type LocalizedText = { fr: string; en: string };

type SeedChampion = {
  riotId: number;
  riotKey: string;
  slug: string;
  name: string;
  title: string;
  primaryRole: Role;
  roles: Role[];
  damageType: string;
  image: string;
  tags: string[];
  threat: LocalizedText;
};

type SeedItem = {
  riotItemId: number;
  slug: string;
  name: string;
  shortDescription: LocalizedText;
  fullDescription: LocalizedText;
  goldTotal: number;
  goldBase?: number;
  goldSell?: number;
  combineCost?: number;
  category: ItemCategory;
  stats: Array<{ label: string; value: string }>;
  image: string;
  isMythic?: boolean;
  isLegendary?: boolean;
  isBoots?: boolean;
  activeEffect?: LocalizedText;
  passiveEffect?: LocalizedText;
  activeName?: string;
  passiveName?: string;
  components?: Array<{ name: string; cost: number; icon: string }>;
  tags: string[];
};

const champions: SeedChampion[] = [
  { riotId: 222, riotKey: "Jinx", slug: "jinx", name: "Jinx", title: "the Loose Cannon", primaryRole: Role.ADC, roles: [Role.ADC], damageType: "AD", image: `${ddChampion}/Jinx.png`, tags: ["Crit", "Hypercarry", "Late"], threat: { fr: "DPS tardif eleve", en: "High late-game DPS" } },
  { riotId: 103, riotKey: "Ahri", slug: "ahri", name: "Ahri", title: "the Nine-Tailed Fox", primaryRole: Role.MID, roles: [Role.MID], damageType: "AP", image: `${ddChampion}/Ahri.png`, tags: ["Burst", "Pick", "Mobile"], threat: { fr: "Pick mobile et burst", en: "Mobile pick and burst" } },
  { riotId: 238, riotKey: "Zed", slug: "zed", name: "Zed", title: "the Master of Shadows", primaryRole: Role.MID, roles: [Role.MID], damageType: "AD", image: `${ddChampion}/Zed.png`, tags: ["Assassin", "Burst", "Snowball"], threat: { fr: "One-shot AD et flank", en: "AD one-shot and flank" } },
  { riotId: 202, riotKey: "Jhin", slug: "jhin", name: "Jhin", title: "the Virtuoso", primaryRole: Role.ADC, roles: [Role.ADC], damageType: "AD", image: `${ddChampion}/Jhin.png`, tags: ["Crit", "Poke", "Pick"], threat: { fr: "Burst a distance", en: "Long-range burst" } },
  { riotId: 145, riotKey: "Kaisa", slug: "kaisa", name: "Kai'Sa", title: "Daughter of the Void", primaryRole: Role.ADC, roles: [Role.ADC], damageType: "Mixed", image: `${ddChampion}/Kaisa.png`, tags: ["Hybrid", "Dive", "DPS"], threat: { fr: "Dive hybride", en: "Hybrid dive" } },
  { riotId: 498, riotKey: "Xayah", slug: "xayah", name: "Xayah", title: "the Rebel", primaryRole: Role.ADC, roles: [Role.ADC], damageType: "AD", image: `${ddChampion}/Xayah.png`, tags: ["Crit", "Self-peel", "Teamfight"], threat: { fr: "DPS et auto-peel", en: "DPS and self-peel" } },
  { riotId: 236, riotKey: "Lucian", slug: "lucian", name: "Lucian", title: "the Purifier", primaryRole: Role.ADC, roles: [Role.ADC, Role.MID], damageType: "AD", image: `${ddChampion}/Lucian.png`, tags: ["Burst", "Lane", "Spellcaster"], threat: { fr: "Spike rapide", en: "Fast spike" } },
  { riotId: 134, riotKey: "Syndra", slug: "syndra", name: "Syndra", title: "the Dark Sovereign", primaryRole: Role.MID, roles: [Role.MID], damageType: "AP", image: `${ddChampion}/Syndra.png`, tags: ["Burst", "Control", "Pick"], threat: { fr: "Burst AP massif", en: "Massive AP burst" } },
  { riotId: 61, riotKey: "Orianna", slug: "orianna", name: "Orianna", title: "the Lady of Clockwork", primaryRole: Role.MID, roles: [Role.MID], damageType: "AP", image: `${ddChampion}/Orianna.png`, tags: ["Control", "Teamfight", "Scaling"], threat: { fr: "Zone et teamfight", en: "Zone control and teamfights" } },
  { riotId: 268, riotKey: "Azir", slug: "azir", name: "Azir", title: "the Emperor of the Sands", primaryRole: Role.MID, roles: [Role.MID], damageType: "AP", image: `${ddChampion}/Azir.png`, tags: ["Scaling", "DPS", "Zone"], threat: { fr: "DPS AP soutenu", en: "Sustained AP DPS" } },
  { riotId: 266, riotKey: "Aatrox", slug: "aatrox", name: "Aatrox", title: "the Darkin Blade", primaryRole: Role.TOP, roles: [Role.TOP], damageType: "AD", image: `${ddChampion}/Aatrox.png`, tags: ["Bruiser", "Sustain", "Frontline"], threat: { fr: "Drain tank", en: "Drain tank" } },
  { riotId: 58, riotKey: "Renekton", slug: "renekton", name: "Renekton", title: "the Butcher of the Sands", primaryRole: Role.TOP, roles: [Role.TOP], damageType: "AD", image: `${ddChampion}/Renekton.png`, tags: ["Bruiser", "Lane", "Tempo"], threat: { fr: "Snowball de lane", en: "Lane snowball" } },
  { riotId: 24, riotKey: "Jax", slug: "jax", name: "Jax", title: "Grandmaster at Arms", primaryRole: Role.TOP, roles: [Role.TOP, Role.JUNGLE], damageType: "Mixed", image: `${ddChampion}/Jax.png`, tags: ["Duelist", "Scaling", "Split"], threat: { fr: "Split push et duel", en: "Split push and duel" } },
  { riotId: 54, riotKey: "Malphite", slug: "malphite", name: "Malphite", title: "Shard of the Monolith", primaryRole: Role.TOP, roles: [Role.TOP, Role.SUPPORT], damageType: "AP", image: `${ddChampion}/Malphite.png`, tags: ["Tank", "Armor", "Engage"], threat: { fr: "Frontline tanky", en: "Tanky frontline" } },
  { riotId: 89, riotKey: "Leona", slug: "leona", name: "Leona", title: "the Radiant Dawn", primaryRole: Role.SUPPORT, roles: [Role.SUPPORT], damageType: "Mixed", image: `${ddChampion}/Leona.png`, tags: ["Engage", "Tank", "CC"], threat: { fr: "Engage et lockdown", en: "Engage and lockdown" } },
  { riotId: 16, riotKey: "Soraka", slug: "soraka", name: "Soraka", title: "the Starchild", primaryRole: Role.SUPPORT, roles: [Role.SUPPORT], damageType: "AP", image: `${ddChampion}/Soraka.png`, tags: ["Heal", "Enchanter", "Sustain"], threat: { fr: "Soins massifs", en: "Massive healing" } },
  { riotId: 117, riotKey: "Lulu", slug: "lulu", name: "Lulu", title: "the Fae Sorceress", primaryRole: Role.SUPPORT, roles: [Role.SUPPORT], damageType: "AP", image: `${ddChampion}/Lulu.png`, tags: ["Peel", "Shield", "Enchanter"], threat: { fr: "Peel et buffs", en: "Peel and buffs" } },
  { riotId: 111, riotKey: "Nautilus", slug: "nautilus", name: "Nautilus", title: "the Titan of the Depths", primaryRole: Role.SUPPORT, roles: [Role.SUPPORT], damageType: "AP", image: `${ddChampion}/Nautilus.png`, tags: ["Engage", "Tank", "CC"], threat: { fr: "Pick et engage", en: "Pick and engage" } },
  { riotId: 2380, riotKey: "Smolder", slug: "smolder", name: "Smolder", title: "the Fiery Fledgling", primaryRole: Role.ADC, roles: [Role.ADC], damageType: "AD", image: `${ddChampion}/Smolder.png`, tags: ["Scaling", "Poke", "Execute"], threat: { fr: "Scaling et poke", en: "Scaling and poke" } },
];

const items: SeedItem[] = [
  { riotItemId: 3031, slug: "infinity-edge", name: "Infinity Edge", shortDescription: { fr: "Gros spike crit en troisieme slot.", en: "Major crit spike as a third item." }, fullDescription: { fr: "Ideal quand ton build crit peut activer le passif de degats critiques.", en: "Ideal when your crit build can activate the bonus critical damage passive." }, goldTotal: 3400, goldBase: 2775, goldSell: 2380, combineCost: 625, category: ItemCategory.CRIT, stats: [{ label: "Attack Damage", value: "+70" }, { label: "Critical Strike Chance", value: "+25%" }], image: `${ddItem}/3031.png`, passiveEffect: { fr: "Si tu as au moins 60% crit, tes critiques infligent plus de degats.", en: "If you have at least 60% crit, your critical strikes deal bonus damage." }, passiveName: "Perfection", tags: ["AD", "Crit", "Spike"], components: [{ name: "B.F. Sword", cost: 1300, icon: `${ddItem}/1038.png` }, { name: "Pickaxe", cost: 875, icon: `${ddItem}/1037.png` }, { name: "Cloak of Agility", cost: 600, icon: `${ddItem}/1018.png` }] },
  { riotItemId: 6672, slug: "kraken-slayer", name: "Kraken Slayer", shortDescription: { fr: "DPS stable contre frontlines.", en: "Stable DPS into frontlines." }, fullDescription: { fr: "Excellent premier item ADC contre des cibles que tu peux frapper longtemps.", en: "Excellent first ADC item into targets you can hit for extended fights." }, goldTotal: 3100, goldBase: 2475, goldSell: 2170, combineCost: 625, category: ItemCategory.MARKSMAN, stats: [{ label: "Attack Damage", value: "+40" }, { label: "Attack Speed", value: "+35%" }, { label: "Critical Strike Chance", value: "+25%" }], image: `${ddItem}/6672.png`, passiveEffect: { fr: "Toutes les trois attaques, tu infliges des degats bonus.", en: "Every third attack deals bonus damage." }, passiveName: "Bring It Down", tags: ["AD", "Attack Speed", "Crit"], components: [{ name: "Noonquiver", cost: 1300, icon: `${ddItem}/6670.png` }, { name: "Pickaxe", cost: 875, icon: `${ddItem}/1037.png` }] },
  { riotItemId: 3153, slug: "blade-of-the-ruined-king", name: "Blade of the Ruined King", shortDescription: { fr: "Anti-tank et duel.", en: "Anti-tank and dueling." }, fullDescription: { fr: "Tres fort contre les grosses barres de vie et les combats prolonges.", en: "Very strong into high-health targets and extended fights." }, goldTotal: 3200, goldBase: 2500, goldSell: 2240, combineCost: 700, category: ItemCategory.MARKSMAN, stats: [{ label: "Attack Damage", value: "+40" }, { label: "Attack Speed", value: "+25%" }, { label: "Life Steal", value: "+8%" }], image: `${ddItem}/3153.png`, passiveEffect: { fr: "Les auto attaques infligent des degats physiques bonus selon les PV actuels.", en: "Basic attacks deal bonus physical damage based on current health." }, passiveName: "Mist's Edge", tags: ["AD", "On-hit", "Anti-Tank"], components: [{ name: "Bilgewater Cutlass", cost: 1500, icon: `${ddItem}/3144.png` }, { name: "Recurve Bow", cost: 1000, icon: `${ddItem}/1043.png` }] },
  { riotItemId: 3036, slug: "lord-dominiks-regards", name: "Lord Dominik's Regards", shortDescription: { fr: "Penetration d'armure pour ADC.", en: "Armor penetration for marksmen." }, fullDescription: { fr: "Essentiel contre les cibles qui stackent armure et PV.", en: "Essential against targets stacking armor and health." }, goldTotal: 3000, goldBase: 2350, goldSell: 2100, combineCost: 650, category: ItemCategory.CRIT, stats: [{ label: "Attack Damage", value: "+35" }, { label: "Critical Strike Chance", value: "+25%" }], image: `${ddItem}/3036.png`, passiveEffect: { fr: "+40% penetration d'armure.", en: "+40% armor penetration." }, passiveName: "Giant Slayer", tags: ["AD", "Crit", "Armor Pen"], components: [{ name: "Last Whisper", cost: 1450, icon: `${ddItem}/3035.png` }, { name: "Cloak of Agility", cost: 600, icon: `${ddItem}/1018.png` }] },
  { riotItemId: 3072, slug: "bloodthirster", name: "Bloodthirster", shortDescription: { fr: "Vol de vie et bouclier pour les carries.", en: "Life steal and shielding for carries." }, fullDescription: { fr: "Bon contre le poke ou les fights rallonges quand tu peux garder le DPS.", en: "Good into poke or longer fights when you can maintain uptime." }, goldTotal: 3400, goldBase: 2800, goldSell: 2380, combineCost: 600, category: ItemCategory.CRIT, stats: [{ label: "Attack Damage", value: "+80" }, { label: "Critical Strike Chance", value: "+25%" }], image: `${ddItem}/3072.png`, passiveEffect: { fr: "Le sur-soin cree un bouclier.", en: "Overhealing creates a shield." }, passiveName: "Ichorshield", tags: ["AD", "Crit", "Sustain"], components: [{ name: "B.F. Sword", cost: 1300, icon: `${ddItem}/1038.png` }, { name: "Cloak of Agility", cost: 600, icon: `${ddItem}/1018.png` }, { name: "Vampiric Scepter", cost: 900, icon: `${ddItem}/1053.png` }] },
  { riotItemId: 3026, slug: "guardian-angel", name: "Guardian Angel", shortDescription: { fr: "Filet de securite contre le burst.", en: "Safety net into burst." }, fullDescription: { fr: "Tres utile quand ta survie decide du teamfight.", en: "Very useful when your survival decides the teamfight." }, goldTotal: 3200, goldBase: 2100, goldSell: 2240, combineCost: 1100, category: ItemCategory.DEFENSIVE, stats: [{ label: "Attack Damage", value: "+55" }, { label: "Armor", value: "+40" }], image: `${ddItem}/3026.png`, passiveEffect: { fr: "Ressuscite apres ta mort.", en: "Revives you after death." }, passiveName: "Resurrect", tags: ["AD", "Armor", "Defensive"], components: [{ name: "B.F. Sword", cost: 1300, icon: `${ddItem}/1038.png` }, { name: "Chain Vest", cost: 800, icon: `${ddItem}/1031.png` }] },
  { riotItemId: 6676, slug: "the-collector", name: "The Collector", shortDescription: { fr: "Snowball lethality pour cibles fragiles.", en: "Snowball lethality into squishies." }, fullDescription: { fr: "Permet de convertir une avance en kills rapides et en or supplementaire.", en: "Converts a lead into quick kills and bonus gold." }, goldTotal: 3000, goldBase: 2575, goldSell: 2100, combineCost: 425, category: ItemCategory.LETHALITY, stats: [{ label: "Attack Damage", value: "+55" }, { label: "Critical Strike Chance", value: "+25%" }, { label: "Lethality", value: "+12" }], image: `${ddItem}/6676.png`, passiveEffect: { fr: "Execute les cibles tres basses en PV.", en: "Executes very low-health targets." }, passiveName: "Death and Taxes", tags: ["AD", "Crit", "Lethality"], components: [{ name: "Serrated Dirk", cost: 1000, icon: `${ddItem}/3134.png` }, { name: "Pickaxe", cost: 875, icon: `${ddItem}/1037.png` }, { name: "Cloak of Agility", cost: 600, icon: `${ddItem}/1018.png` }] },
  { riotItemId: 3142, slug: "youmuus-ghostblade", name: "Youmuu's Ghostblade", shortDescription: { fr: "Mobilite lethality pour roam et picks.", en: "Mobile lethality for roams and picks." }, fullDescription: { fr: "Excellent premier item assassin pour accelerer le tempo de map.", en: "Excellent first assassin item to accelerate map tempo." }, goldTotal: 2800, goldBase: 2200, goldSell: 1960, combineCost: 600, category: ItemCategory.LETHALITY, stats: [{ label: "Attack Damage", value: "+55" }, { label: "Lethality", value: "+18" }, { label: "Ability Haste", value: "+15" }], image: `${ddItem}/3142.png`, activeEffect: { fr: "Donne un burst de vitesse de deplacement.", en: "Grants a burst of movement speed." }, activeName: "Wraith Step", tags: ["AD", "Lethality", "Mobility"], components: [{ name: "Serrated Dirk", cost: 1000, icon: `${ddItem}/3134.png` }, { name: "Caulfield's Warhammer", cost: 1100, icon: `${ddItem}/3133.png` }] },
  { riotItemId: 3508, slug: "essence-reaver", name: "Essence Reaver", shortDescription: { fr: "Crit pour ADC a sorts.", en: "Crit item for spell-based marksmen." }, fullDescription: { fr: "Fort sur les champions qui cherchent un profil spellblade.", en: "Strong on champions looking for a spellblade pattern." }, goldTotal: 2900, goldBase: 2600, goldSell: 2030, combineCost: 300, category: ItemCategory.CRIT, stats: [{ label: "Attack Damage", value: "+60" }, { label: "Critical Strike Chance", value: "+25%" }, { label: "Ability Haste", value: "+15" }], image: `${ddItem}/3508.png`, passiveEffect: { fr: "Ta prochaine auto apres un sort inflige des degats bonus.", en: "Your next basic attack after a spell deals bonus damage." }, passiveName: "Spellblade", tags: ["AD", "Crit", "Spellblade"], components: [{ name: "Sheen", cost: 900, icon: `${ddItem}/3057.png` }, { name: "Caulfield's Warhammer", cost: 1100, icon: `${ddItem}/3133.png` }] },
  { riotItemId: 3006, slug: "berserkers-greaves", name: "Berserker's Greaves", shortDescription: { fr: "Bottes offensives pour auto-attackers.", en: "Offensive boots for auto-attackers." }, fullDescription: { fr: "Boots de tempo offensif quand la survie n'est pas la priorite.", en: "Aggressive tempo boots when defense is not the priority." }, goldTotal: 1100, goldBase: 1100, goldSell: 770, category: ItemCategory.BOOTS, stats: [{ label: "Attack Speed", value: "+35%" }, { label: "Move Speed", value: "+45" }], image: `${ddItem}/3006.png`, isBoots: true, tags: ["Boots", "Attack Speed"], components: [{ name: "Boots", cost: 300, icon: `${ddItem}/1001.png` }, { name: "Dagger", cost: 300, icon: `${ddItem}/1042.png` }] },
  { riotItemId: 3047, slug: "plated-steelcaps", name: "Plated Steelcaps", shortDescription: { fr: "Bottes anti-auto attaques.", en: "Anti auto-attack boots." }, fullDescription: { fr: "Tres fortes contre ADC fed, bruisers AD et lanes physiques.", en: "Very strong into fed ADCs, AD bruisers and physical lanes." }, goldTotal: 1200, goldBase: 1200, goldSell: 840, category: ItemCategory.BOOTS, stats: [{ label: "Armor", value: "+25" }, { label: "Move Speed", value: "+45" }], image: `${ddItem}/3047.png`, isBoots: true, passiveEffect: { fr: "Reduit les degats des attaques de base.", en: "Reduces basic attack damage taken." }, tags: ["Boots", "Armor", "Defensive"], components: [{ name: "Boots", cost: 300, icon: `${ddItem}/1001.png` }, { name: "Cloth Armor", cost: 300, icon: `${ddItem}/1029.png` }] },
  { riotItemId: 3111, slug: "mercurys-treads", name: "Mercury's Treads", shortDescription: { fr: "Bottes anti-CC et anti-AP.", en: "Anti-CC and anti-AP boots." }, fullDescription: { fr: "Prioritaires quand la compo ennemie a beaucoup de controle ou de menace magique.", en: "Priority when the enemy comp has heavy crowd control or magic threat." }, goldTotal: 1250, goldBase: 1250, goldSell: 875, category: ItemCategory.BOOTS, stats: [{ label: "Magic Resist", value: "+25" }, { label: "Move Speed", value: "+45" }], image: `${ddItem}/3111.png`, isBoots: true, passiveEffect: { fr: "Octroie de la tenacite.", en: "Grants tenacity." }, tags: ["Boots", "Magic Resist", "Tenacity"], components: [{ name: "Boots", cost: 300, icon: `${ddItem}/1001.png` }, { name: "Null-Magic Mantle", cost: 450, icon: `${ddItem}/1033.png` }] },
  { riotItemId: 3158, slug: "ionian-boots-of-lucidity", name: "Ionian Boots of Lucidity", shortDescription: { fr: "Bottes de tempo pour champions a sorts.", en: "Tempo boots for spellcasters." }, fullDescription: { fr: "Faible cout et excellente acceleration quand le cooldown importe plus que le DPS brut.", en: "Cheap and excellent acceleration when cooldowns matter more than raw DPS." }, goldTotal: 950, goldBase: 950, goldSell: 665, category: ItemCategory.BOOTS, stats: [{ label: "Ability Haste", value: "+20" }, { label: "Move Speed", value: "+45" }], image: `${ddItem}/3158.png`, isBoots: true, tags: ["Boots", "Ability Haste"], components: [{ name: "Boots", cost: 300, icon: `${ddItem}/1001.png` }] },
  { riotItemId: 6655, slug: "ludens-companion", name: "Luden's Companion", shortDescription: { fr: "Burst et tempo pour mages.", en: "Burst and tempo for mages." }, fullDescription: { fr: "Bon spike un ou deux items pour les mages de poke ou burst.", en: "Good one or two item spike for burst or poke mages." }, goldTotal: 2900, goldBase: 2350, goldSell: 2030, combineCost: 550, category: ItemCategory.MAGE, stats: [{ label: "Ability Power", value: "+95" }, { label: "Mana", value: "+600" }, { label: "Ability Haste", value: "+20" }], image: `${ddItem}/6655.png`, passiveEffect: { fr: "Le prochain sort charge inflige des degats supplementaires.", en: "The next charged spell deals bonus damage." }, passiveName: "Fire", tags: ["AP", "Mana", "Burst"], components: [{ name: "Lost Chapter", cost: 1200, icon: `${ddItem}/3802.png` }, { name: "Blasting Wand", cost: 850, icon: `${ddItem}/1026.png` }] },
  { riotItemId: 6653, slug: "liandrys-torment", name: "Liandry's Torment", shortDescription: { fr: "Burn AP contre frontlines et combats longs.", en: "AP burn into frontlines and long fights." }, fullDescription: { fr: "Tres bon contre les tanks et compositions a grosse barre de vie.", en: "Very good against tanks and high-health compositions." }, goldTotal: 3000, goldBase: 2250, goldSell: 2100, combineCost: 750, category: ItemCategory.MAGE, stats: [{ label: "Ability Power", value: "+70" }, { label: "Health", value: "+300" }, { label: "Ability Haste", value: "+20" }], image: `${ddItem}/6653.png`, passiveEffect: { fr: "Les sorts brulent en fonction des PV max de la cible.", en: "Abilities burn based on the target's max health." }, passiveName: "Torment", tags: ["AP", "Burn", "Anti-Tank"], components: [{ name: "Haunting Guise", cost: 1300, icon: `${ddItem}/3136.png` }, { name: "Blasting Wand", cost: 850, icon: `${ddItem}/1026.png` }] },
  { riotItemId: 3135, slug: "void-staff", name: "Void Staff", shortDescription: { fr: "Penetration magique brute.", en: "Raw magic penetration." }, fullDescription: { fr: "A acheter des que deux cibles importantes ont construit de la MR.", en: "Buy it once two important targets have built MR." }, goldTotal: 3000, goldBase: 2400, goldSell: 2100, combineCost: 600, category: ItemCategory.MAGE, stats: [{ label: "Ability Power", value: "+95" }], image: `${ddItem}/3135.png`, passiveEffect: { fr: "+40% penetration magique.", en: "+40% magic penetration." }, passiveName: "Dissolve", tags: ["AP", "Magic Pen"], components: [{ name: "Blighting Jewel", cost: 1100, icon: `${ddItem}/4630.png` }, { name: "Blasting Wand", cost: 850, icon: `${ddItem}/1026.png` }] },
  { riotItemId: 3089, slug: "rabadons-deathcap", name: "Rabadon's Deathcap", shortDescription: { fr: "Multiplicateur AP pur.", en: "Pure AP multiplier." }, fullDescription: { fr: "Achat gourmand mais devastateur quand tu as deja deux items AP.", en: "Greedy but devastating once you already have two AP items." }, goldTotal: 3600, goldBase: 2500, goldSell: 2520, combineCost: 1100, category: ItemCategory.MAGE, stats: [{ label: "Ability Power", value: "+120" }], image: `${ddItem}/3089.png`, passiveEffect: { fr: "Augmente ton AP total.", en: "Increases your total AP." }, passiveName: "Magical Opus", tags: ["AP", "Scaling"], components: [{ name: "Needlessly Large Rod", cost: 1250, icon: `${ddItem}/1058.png` }, { name: "Needlessly Large Rod", cost: 1250, icon: `${ddItem}/1058.png` }] },
  { riotItemId: 3157, slug: "zhonyas-hourglass", name: "Zhonya's Hourglass", shortDescription: { fr: "Reponse defensive contre dive et burst.", en: "Defensive answer to dive and burst." }, fullDescription: { fr: "Le meilleur achat quand survivre a l'engage vaut plus qu'un peu de DPS.", en: "The best purchase when surviving engage matters more than a bit of extra DPS." }, goldTotal: 3250, goldBase: 2200, goldSell: 2275, combineCost: 1050, category: ItemCategory.DEFENSIVE, stats: [{ label: "Ability Power", value: "+105" }, { label: "Armor", value: "+50" }, { label: "Ability Haste", value: "+10" }], image: `${ddItem}/3157.png`, activeEffect: { fr: "Entre en stase pendant 2.5 secondes.", en: "Enter stasis for 2.5 seconds." }, activeName: "Stasis", tags: ["AP", "Armor", "Active"], components: [{ name: "Seeker's Armguard", cost: 1000, icon: `${ddItem}/3191.png` }, { name: "Fiendish Codex", cost: 900, icon: `${ddItem}/3108.png` }] },
  { riotItemId: 3165, slug: "morellonomicon", name: "Morellonomicon", shortDescription: { fr: "Anti-heal AP stable.", en: "Stable AP anti-heal." }, fullDescription: { fr: "Prioritaire contre Soraka, Aatrox, drain tanks et compo sustain.", en: "Priority into Soraka, Aatrox, drain tanks and sustain-heavy comps." }, goldTotal: 2850, goldBase: 2300, goldSell: 1995, combineCost: 550, category: ItemCategory.UTILITY, stats: [{ label: "Ability Power", value: "+90" }, { label: "Health", value: "+300" }], image: `${ddItem}/3165.png`, passiveEffect: { fr: "Applique des blessures graves sur tes degats magiques.", en: "Applies grievous wounds on your magic damage." }, passiveName: "Affliction", tags: ["AP", "Anti-Heal", "Health"], components: [{ name: "Oblivion Orb", cost: 800, icon: `${ddItem}/3916.png` }, { name: "Blasting Wand", cost: 850, icon: `${ddItem}/1026.png` }] },
  { riotItemId: 4645, slug: "shadowflame", name: "Shadowflame", shortDescription: { fr: "Penetration magique immediate.", en: "Immediate flat magic penetration." }, fullDescription: { fr: "Tres bon contre backline squishy ou compo avec peu de MR.", en: "Very good into squishy backlines or low-MR comps." }, goldTotal: 3200, goldBase: 2500, goldSell: 2240, combineCost: 700, category: ItemCategory.MAGE, stats: [{ label: "Ability Power", value: "+120" }, { label: "Magic Penetration", value: "+12" }], image: `${ddItem}/4645.png`, passiveEffect: { fr: "Punition des cibles basses en vie.", en: "Punishes low-health targets." }, passiveName: "Cinderbloom", tags: ["AP", "Magic Pen", "Burst"], components: [{ name: "Hextech Alternator", cost: 1100, icon: `${ddItem}/3145.png` }, { name: "Needlessly Large Rod", cost: 1250, icon: `${ddItem}/1058.png` }] },
  { riotItemId: 3102, slug: "banshees-veil", name: "Banshee's Veil", shortDescription: { fr: "Bouclier anti-pick pour mage.", en: "Anti-pick shield for mages." }, fullDescription: { fr: "Tres utile contre hook, engage a distance ou pick AP.", en: "Very useful against hooks, ranged engage or AP pick tools." }, goldTotal: 3000, goldBase: 2600, goldSell: 2100, combineCost: 400, category: ItemCategory.DEFENSIVE, stats: [{ label: "Ability Power", value: "+95" }, { label: "Magic Resist", value: "+50" }, { label: "Ability Haste", value: "+10" }], image: `${ddItem}/3102.png`, passiveEffect: { fr: "Bloque le prochain sort ennemi.", en: "Blocks the next enemy ability." }, passiveName: "Annul", tags: ["AP", "Magic Resist", "Defensive"], components: [{ name: "Verdant Barrier", cost: 1000, icon: `${ddItem}/4632.png` }, { name: "Blasting Wand", cost: 850, icon: `${ddItem}/1026.png` }] },
  { riotItemId: 3020, slug: "sorcerers-shoes", name: "Sorcerer's Shoes", shortDescription: { fr: "Bottes offensives pour mages.", en: "Offensive boots for mages." }, fullDescription: { fr: "Achat tempo tres fort si personne n'a encore de MR.", en: "Very strong tempo purchase if nobody has MR yet." }, goldTotal: 1100, goldBase: 1100, goldSell: 770, category: ItemCategory.BOOTS, stats: [{ label: "Magic Penetration", value: "+15" }, { label: "Move Speed", value: "+45" }], image: `${ddItem}/3020.png`, isBoots: true, tags: ["Boots", "Magic Pen"], components: [{ name: "Boots", cost: 300, icon: `${ddItem}/1001.png` }, { name: "Amplifying Tome", cost: 400, icon: `${ddItem}/1052.png` }] },
  { riotItemId: 3071, slug: "black-cleaver", name: "Black Cleaver", shortDescription: { fr: "Armor shred pour bruisers AD.", en: "Armor shred for AD bruisers." }, fullDescription: { fr: "Bon quand ton equipe physique doit casser une frontline.", en: "Good when your physical-damage team needs help cracking a frontline." }, goldTotal: 3000, goldBase: 2400, goldSell: 2100, combineCost: 600, category: ItemCategory.BRUISER, stats: [{ label: "Attack Damage", value: "+40" }, { label: "Health", value: "+400" }, { label: "Ability Haste", value: "+20" }], image: `${ddItem}/3071.png`, passiveEffect: { fr: "Tes degats reduisent l'armure de la cible.", en: "Your damage reduces the target's armor." }, passiveName: "Carve", tags: ["AD", "Health", "Armor Shred"], components: [{ name: "Phage", cost: 1100, icon: `${ddItem}/3044.png` }, { name: "Kindlegem", cost: 800, icon: `${ddItem}/3067.png` }, { name: "Long Sword", cost: 350, icon: `${ddItem}/1036.png` }] },
  { riotItemId: 6609, slug: "chempunk-chainsword", name: "Chempunk Chainsword", shortDescription: { fr: "Anti-heal rapide pour AD.", en: "Fast anti-heal for AD users." }, fullDescription: { fr: "Permet de repondre tot a une compo sustain sans perdre trop de tempo.", en: "Lets AD users answer sustain early without losing too much tempo." }, goldTotal: 3100, goldBase: 2500, goldSell: 2170, combineCost: 600, category: ItemCategory.UTILITY, stats: [{ label: "Attack Damage", value: "+45" }, { label: "Health", value: "+450" }, { label: "Ability Haste", value: "+15" }], image: `${ddItem}/6609.png`, passiveEffect: { fr: "Applique des blessures graves.", en: "Applies grievous wounds." }, passiveName: "Hackshorn", tags: ["AD", "Health", "Anti-Heal"], components: [{ name: "Executioner's Calling", cost: 800, icon: `${ddItem}/3123.png` }, { name: "Kindlegem", cost: 800, icon: `${ddItem}/3067.png` }, { name: "Caulfield's Warhammer", cost: 1100, icon: `${ddItem}/3133.png` }] },
  { riotItemId: 6333, slug: "deaths-dance", name: "Death's Dance", shortDescription: { fr: "Defensif agressif contre burst AD.", en: "Aggressive defense into AD burst." }, fullDescription: { fr: "Fort pour survivre aux trades et se reset en escarmouche.", en: "Strong for surviving trades and resetting in skirmishes." }, goldTotal: 3300, goldBase: 2700, goldSell: 2310, combineCost: 600, category: ItemCategory.DEFENSIVE, stats: [{ label: "Attack Damage", value: "+60" }, { label: "Armor", value: "+50" }, { label: "Ability Haste", value: "+15" }], image: `${ddItem}/6333.png`, passiveEffect: { fr: "Differe une partie des degats subis.", en: "Delays a portion of incoming damage." }, passiveName: "Ignore Pain", tags: ["AD", "Armor", "Skirmish"], components: [{ name: "Chain Vest", cost: 800, icon: `${ddItem}/1031.png` }, { name: "Caulfield's Warhammer", cost: 1100, icon: `${ddItem}/3133.png` }, { name: "Pickaxe", cost: 875, icon: `${ddItem}/1037.png` }] },
  { riotItemId: 3053, slug: "steraks-gage", name: "Sterak's Gage", shortDescription: { fr: "Bouclier pour melee all-in.", en: "Shield for melee all-in fighters." }, fullDescription: { fr: "Tres fort contre le burst quand tu dois rester au contact.", en: "Very strong into burst when you need to stay in melee." }, goldTotal: 3200, goldBase: 2475, goldSell: 2240, combineCost: 725, category: ItemCategory.BRUISER, stats: [{ label: "Attack Damage", value: "+50" }, { label: "Health", value: "+400" }], image: `${ddItem}/3053.png`, passiveEffect: { fr: "Bouclier quand tu passes bas en vie.", en: "Shield when you drop low." }, passiveName: "Lifeline", tags: ["AD", "Health", "Anti-Burst"], components: [{ name: "Phage", cost: 1100, icon: `${ddItem}/3044.png` }, { name: "Pickaxe", cost: 875, icon: `${ddItem}/1037.png` }] },
  { riotItemId: 3078, slug: "trinity-force", name: "Trinity Force", shortDescription: { fr: "Spike mixte pour bruisers et splitpushers.", en: "Mixed spike for bruisers and splitpushers." }, fullDescription: { fr: "Tres bon quand ton champion proque souvent spellblade et veut toutes les stats.", en: "Very good when your champion procs spellblade often and wants a mix of stats." }, goldTotal: 3333, goldBase: 3000, goldSell: 2333, combineCost: 333, category: ItemCategory.FIGHTER, stats: [{ label: "Attack Damage", value: "+36" }, { label: "Attack Speed", value: "+30%" }, { label: "Health", value: "+300" }, { label: "Ability Haste", value: "+15" }], image: `${ddItem}/3078.png`, passiveEffect: { fr: "Ta prochaine auto apres un sort inflige des degats bonus.", en: "Your next attack after a spell deals bonus damage." }, passiveName: "Spellblade", tags: ["AD", "Attack Speed", "Spellblade"], components: [{ name: "Sheen", cost: 900, icon: `${ddItem}/3057.png` }, { name: "Phage", cost: 1100, icon: `${ddItem}/3044.png` }, { name: "Hearthbound Axe", cost: 1100, icon: `${ddItem}/6029.png` }] },
  { riotItemId: 3748, slug: "titanic-hydra", name: "Titanic Hydra", shortDescription: { fr: "Degats de waveclear et DPS sur gros pool HP.", en: "Waveclear and DPS from bonus health." }, fullDescription: { fr: "Bon sur bruisers qui empilent les PV et cherchent du push lateral.", en: "Good on bruisers stacking health and looking for side-lane pressure." }, goldTotal: 3300, goldBase: 2700, goldSell: 2310, combineCost: 600, category: ItemCategory.BRUISER, stats: [{ label: "Attack Damage", value: "+40" }, { label: "Health", value: "+550" }], image: `${ddItem}/3748.png`, passiveEffect: { fr: "Les attaques infligent des degats de zone.", en: "Attacks deal area damage." }, passiveName: "Cleave", tags: ["AD", "Health", "Waveclear"], components: [{ name: "Tiamat", cost: 1200, icon: `${ddItem}/3077.png` }, { name: "Giant's Belt", cost: 900, icon: `${ddItem}/1011.png` }] },
  { riotItemId: 3075, slug: "thornmail", name: "Thornmail", shortDescription: { fr: "Anti-heal pour tanks et anti auto-attackers.", en: "Anti-heal for tanks and anti auto-attackers." }, fullDescription: { fr: "Tres utile contre sustain AD et champions qui doivent te frapper.", en: "Very useful into sustain AD threats and champions that must hit you." }, goldTotal: 2700, goldBase: 1950, goldSell: 1890, combineCost: 750, category: ItemCategory.TANK, stats: [{ label: "Armor", value: "+70" }, { label: "Health", value: "+350" }], image: `${ddItem}/3075.png`, passiveEffect: { fr: "Renvoie des degats et applique blessures graves.", en: "Reflects damage and applies grievous wounds." }, passiveName: "Thorns", tags: ["Armor", "Health", "Anti-Heal"], components: [{ name: "Bramble Vest", cost: 800, icon: `${ddItem}/3076.png` }, { name: "Ruby Crystal", cost: 400, icon: `${ddItem}/1028.png` }] },
  { riotItemId: 3143, slug: "randuins-omen", name: "Randuin's Omen", shortDescription: { fr: "Anti-crit et anti-ADC.", en: "Anti-crit and anti-ADC." }, fullDescription: { fr: "Achat ideal contre deux carries crit ou un ADC tres fed.", en: "Ideal purchase against two crit carries or a very fed ADC." }, goldTotal: 2700, goldBase: 2100, goldSell: 1890, combineCost: 600, category: ItemCategory.TANK, stats: [{ label: "Armor", value: "+60" }, { label: "Health", value: "+400" }], image: `${ddItem}/3143.png`, activeEffect: { fr: "Ralentit les ennemis proches.", en: "Slows nearby enemies." }, activeName: "Humility", passiveEffect: { fr: "Reduit les degats critiques subis.", en: "Reduces incoming critical strike damage." }, passiveName: "Rock Solid", tags: ["Armor", "Health", "Anti-Crit"], components: [{ name: "Warden's Mail", cost: 1000, icon: `${ddItem}/3082.png` }, { name: "Ruby Crystal", cost: 400, icon: `${ddItem}/1028.png` }] },
  { riotItemId: 3742, slug: "dead-mans-plate", name: "Dead Man's Plate", shortDescription: { fr: "Tempo et engage pour tanks.", en: "Tempo and engage for tanks." }, fullDescription: { fr: "Parfait pour accelerer une frontline melee vers la backline.", en: "Perfect to speed a frontline melee champion toward the backline." }, goldTotal: 2900, goldBase: 1800, goldSell: 2030, combineCost: 1100, category: ItemCategory.TANK, stats: [{ label: "Armor", value: "+50" }, { label: "Health", value: "+400" }, { label: "Move Speed", value: "+5%" }], image: `${ddItem}/3742.png`, passiveEffect: { fr: "Accumule de la vitesse en bougeant.", en: "Builds up movement speed while moving." }, passiveName: "Shipwrecker", tags: ["Armor", "Health", "Mobility"], components: [{ name: "Chain Vest", cost: 800, icon: `${ddItem}/1031.png` }, { name: "Giant's Belt", cost: 900, icon: `${ddItem}/1011.png` }] },
  { riotItemId: 4401, slug: "force-of-nature", name: "Force of Nature", shortDescription: { fr: "MR de frontline contre AP soutenu.", en: "Frontline MR against sustained AP." }, fullDescription: { fr: "Tres fort quand plusieurs sources magiques t'arrosent en teamfight.", en: "Very strong when several magic sources are hitting you in teamfights." }, goldTotal: 2800, goldBase: 2200, goldSell: 1960, combineCost: 600, category: ItemCategory.TANK, stats: [{ label: "Magic Resist", value: "+70" }, { label: "Health", value: "+400" }, { label: "Move Speed", value: "+5%" }], image: `${ddItem}/4401.png`, passiveEffect: { fr: "Reduit les degats magiques apres plusieurs hits.", en: "Reduces magic damage after multiple hits." }, passiveName: "Absorb", tags: ["Magic Resist", "Health", "Anti-AP"], components: [{ name: "Spectre's Cowl", cost: 1250, icon: `${ddItem}/3211.png` }, { name: "Winged Moonplate", cost: 800, icon: `${ddItem}/2015.png` }] },
  { riotItemId: 3065, slug: "spirit-visage", name: "Spirit Visage", shortDescription: { fr: "MR avec amplification des soins.", en: "MR with improved healing." }, fullDescription: { fr: "Excellent sur champions a sustain, shields ou soins allies.", en: "Excellent on champions with sustain, shields or ally healing." }, goldTotal: 2900, goldBase: 2200, goldSell: 2030, combineCost: 700, category: ItemCategory.TANK, stats: [{ label: "Magic Resist", value: "+60" }, { label: "Health", value: "+450" }, { label: "Ability Haste", value: "+10" }], image: `${ddItem}/3065.png`, passiveEffect: { fr: "Augmente les soins et boucliers recus.", en: "Increases healing and shielding received." }, passiveName: "Boundless Vitality", tags: ["Magic Resist", "Health", "Sustain"], components: [{ name: "Spectre's Cowl", cost: 1250, icon: `${ddItem}/3211.png` }, { name: "Kindlegem", cost: 800, icon: `${ddItem}/3067.png` }] },
  { riotItemId: 3110, slug: "frozen-heart", name: "Frozen Heart", shortDescription: { fr: "Anti-auto attaques a bas cout.", en: "Cost-efficient anti auto-attack armor item." }, fullDescription: { fr: "Tres fort contre doubles ADC, Yasuo/Yone ou champions a vitesse d'attaque.", en: "Very strong against double marksman, Yasuo/Yone or attack-speed threats." }, goldTotal: 2500, goldBase: 2000, goldSell: 1750, combineCost: 500, category: ItemCategory.TANK, stats: [{ label: "Armor", value: "+80" }, { label: "Mana", value: "+400" }, { label: "Ability Haste", value: "+20" }], image: `${ddItem}/3110.png`, passiveEffect: { fr: "Reduit la vitesse d'attaque ennemie proche.", en: "Reduces nearby enemies' attack speed." }, passiveName: "Winter's Caress", tags: ["Armor", "Mana", "Anti-AS"], components: [{ name: "Warden's Mail", cost: 1000, icon: `${ddItem}/3082.png` }, { name: "Glacial Buckler", cost: 900, icon: `${ddItem}/3024.png` }] },
  { riotItemId: 3107, slug: "redemption", name: "Redemption", shortDescription: { fr: "Support utilitaire de teamfight.", en: "Utility support teamfight item." }, fullDescription: { fr: "Excellent si tu joues pour les fights groupes et le poke retour.", en: "Excellent if you play around grouped fights and reset windows." }, goldTotal: 2300, goldBase: 1900, goldSell: 1610, combineCost: 400, category: ItemCategory.SUPPORT, stats: [{ label: "Health", value: "+200" }, { label: "Mana Regen", value: "+100%" }, { label: "Heal and Shield Power", value: "+15%" }], image: `${ddItem}/3107.png`, activeEffect: { fr: "Zone de soin de teamfight.", en: "Teamfight healing zone." }, activeName: "Intervention", tags: ["Support", "Heal", "Utility"], components: [{ name: "Forbidden Idol", cost: 800, icon: `${ddItem}/3114.png` }, { name: "Kindlegem", cost: 800, icon: `${ddItem}/3067.png` }] },
  { riotItemId: 6617, slug: "moonstone-renewer", name: "Moonstone Renewer", shortDescription: { fr: "Soins prolonges pour enchanteurs.", en: "Extended healing for enchanters." }, fullDescription: { fr: "Tres fort dans les fights longs ou ton job est de maintenir la frontline.", en: "Very strong in extended fights where your job is sustaining the frontline." }, goldTotal: 2200, goldBase: 1800, goldSell: 1540, combineCost: 400, category: ItemCategory.SUPPORT, stats: [{ label: "Ability Power", value: "+25" }, { label: "Health", value: "+200" }, { label: "Ability Haste", value: "+20" }, { label: "Heal and Shield Power", value: "+15%" }], image: `${ddItem}/6617.png`, passiveEffect: { fr: "Les soins et boucliers se propagent pendant les combats.", en: "Heals and shields chain during fights." }, passiveName: "Starlit Grace", tags: ["Support", "Heal", "Scaling"], components: [{ name: "Forbidden Idol", cost: 800, icon: `${ddItem}/3114.png` }, { name: "Bandleglass Mirror", cost: 950, icon: `${ddItem}/4642.png` }] },
  { riotItemId: 4005, slug: "imperial-mandate", name: "Imperial Mandate", shortDescription: { fr: "Support pour picks et burst coordonne.", en: "Support item for picks and coordinated burst." }, fullDescription: { fr: "Fort quand ta compo suit tres bien les controles et catches.", en: "Strong when your comp follows up crowd control and catches well." }, goldTotal: 2300, goldBase: 1850, goldSell: 1610, combineCost: 450, category: ItemCategory.SUPPORT, stats: [{ label: "Ability Power", value: "+50" }, { label: "Health", value: "+200" }, { label: "Ability Haste", value: "+20" }], image: `${ddItem}/4005.png`, passiveEffect: { fr: "Les controles marquent une cible pour des degats bonus allies.", en: "Crowd control marks targets for allied bonus damage." }, passiveName: "Coordinated Fire", tags: ["Support", "Burst", "Pick"], components: [{ name: "Bandleglass Mirror", cost: 950, icon: `${ddItem}/4642.png` }, { name: "Fiendish Codex", cost: 900, icon: `${ddItem}/3108.png` }] },
];

type SeedPuzzle = {
  slug: string;
  title: LocalizedText;
  difficulty: PuzzleDifficulty;
  description: LocalizedText;
  situation: LocalizedText;
  question: LocalizedText;
  explanation: LocalizedText;
  role: Role;
  moduleKey: string;
  championSlug?: string;
  allyTeam: string[];
  enemyTeam: string[];
  gameContext: Record<string, unknown>;
  tags: string[];
  choices: Array<{
    itemSlug?: string;
    choiceType: PuzzleChoiceType;
    label: LocalizedText;
    textFallback?: LocalizedText;
    explanation: LocalizedText;
    isCorrect: boolean;
  }>;
};

const puzzles: SeedPuzzle[] = [
  {
    slug: "jinx-third-item-vs-double-frontline",
    title: { fr: "Jinx contre double frontline", en: "Jinx into double frontline" },
    difficulty: PuzzleDifficulty.INTERMEDIATE,
    description: { fr: "Choix du troisieme item ADC contre deux tanks.", en: "Third-item ADC choice into two tanks." },
    situation: { fr: "Tu joues Jinx a 22 minutes. Malphite et Leona ont deja de l'armure et ton equipe joue front-to-back.", en: "You are on Jinx at 22 minutes. Malphite and Leona already have armor and your team wants front-to-back fights." },
    question: { fr: "Quel troisieme item maximise ton impact sur le prochain drake ?", en: "Which third item maximizes your impact on the next dragon fight?" },
    explanation: { fr: "Lord Dominik's Regards est le meilleur arbitrage: tu restes sur une logique crit et tu convertis mieux tes auto contre la frontline. BotRK reste jouable mais delayer ton scaling crit te coute sur ce type de fight structure.", en: "Lord Dominik's Regards is the best tradeoff: you stay on your crit curve while converting autos better into the frontline. BotRK is playable, but delaying crit scaling costs you in this structured fight." },
    role: Role.ADC,
    moduleKey: "anti-comp",
    championSlug: "jinx",
    allyTeam: ["jinx", "lulu", "ahri", "jax", "nautilus"],
    enemyTeam: ["malphite", "leona", "orianna", "kaisa", "aatrox"],
    gameContext: { minute: 22, gold: 3050, lane: "bot", objective: "third-dragon", currentBuild: ["kraken-slayer", "berserkers-greaves", "infinity-edge"], scoreboard: "4/1/5", fedEnemies: ["malphite"], notes: ["front-to-back", "double armor stack"] },
    tags: ["adc", "anti-tank", "third-item", "objective-fight"],
    choices: [
      { itemSlug: "lord-dominiks-regards", choiceType: PuzzleChoiceType.ITEM, label: { fr: "Lord Dominik's Regards", en: "Lord Dominik's Regards" }, explanation: { fr: "Le bon choix. Tu gardes ton pic crit et tu ajoutes la penetration qui manque contre Malphite et Leona.", en: "Correct. You preserve your crit spike and add the penetration you need against Malphite and Leona." }, isCorrect: true },
      { itemSlug: "blade-of-the-ruined-king", choiceType: PuzzleChoiceType.ITEM, label: { fr: "Blade of the Ruined King", en: "Blade of the Ruined King" }, explanation: { fr: "Plausible, mais moins propre ici car tu casses la courbe crit et tu joues un fight objectif previsible.", en: "Plausible, but less clean here because you break your crit curve in a very structured objective fight." }, isCorrect: false },
      { itemSlug: "guardian-angel", choiceType: PuzzleChoiceType.ITEM, label: { fr: "Guardian Angel", en: "Guardian Angel" }, explanation: { fr: "Trop defensif. La menace principale ici est la frontline, pas un pick assassin imminent.", en: "Too defensive. The main issue here is the frontline, not an imminent assassin pick." }, isCorrect: false },
      { itemSlug: "bloodthirster", choiceType: PuzzleChoiceType.ITEM, label: { fr: "Bloodthirster", en: "Bloodthirster" }, explanation: { fr: "Le sustain aide, mais tu manques surtout de degats efficaces contre les tanks.", en: "The sustain helps, but what you really lack is efficient damage into tanks." }, isCorrect: false },
    ],
  },
  {
    slug: "ahri-anti-heal-vs-soraka-aatrox",
    title: { fr: "Ahri contre sustain massif", en: "Ahri into massive sustain" },
    difficulty: PuzzleDifficulty.BEGINNER,
    description: { fr: "Apprendre a prioriser l'anti-heal AP.", en: "Learning when to prioritize AP anti-heal." },
    situation: { fr: "Soraka et Aatrox gagnent du temps dans tous les fights. Tu es Ahri avec Luden + Sorcerer's Shoes.", en: "Soraka and Aatrox are stalling every fight. You are Ahri with Luden's Companion and Sorcerer's Shoes." },
    question: { fr: "Quel achat te donne le plus de valeur immediate avant le Herald ?", en: "Which buy gives you the most immediate value before the Herald fight?" },
    explanation: { fr: "Morellonomicon est prioritaire. Tes degats existent deja; le probleme est qu'ils ne convertissent pas tant que Soraka et Aatrox restent libres de se soigner.", en: "Morellonomicon is the priority. Your damage already exists; the issue is that it does not convert while Soraka and Aatrox heal freely." },
    role: Role.MID,
    moduleKey: "anti-heal",
    championSlug: "ahri",
    allyTeam: ["ahri", "jinx", "leona", "jax", "lulu"],
    enemyTeam: ["aatrox", "soraka", "orianna", "kaisa", "nautilus"],
    gameContext: { minute: 16, gold: 2600, lane: "mid", objective: "herald", currentBuild: ["ludens-companion", "sorcerers-shoes"], scoreboard: "3/1/4", fedEnemies: ["aatrox"], notes: ["double sustain"] },
    tags: ["mid", "anti-heal", "mage", "objective-fight"],
    choices: [
      { itemSlug: "morellonomicon", choiceType: PuzzleChoiceType.ITEM, label: { fr: "Morellonomicon", en: "Morellonomicon" }, explanation: { fr: "Correct. Tu coupes la valeur de Soraka et Aatrox sur chaque trade et sur le prochain objectif.", en: "Correct. You cut Soraka and Aatrox value on every trade and on the next objective." }, isCorrect: true },
      { itemSlug: "rabadons-deathcap", choiceType: PuzzleChoiceType.ITEM, label: { fr: "Rabadon's Deathcap", en: "Rabadon's Deathcap" }, explanation: { fr: "Trop gourmand ici. Tu ajoutes du burst mais tu ne regles pas la source du probleme.", en: "Too greedy here. You add burst but do not solve the core problem." }, isCorrect: false },
      { itemSlug: "zhonyas-hourglass", choiceType: PuzzleChoiceType.ITEM, label: { fr: "Zhonya's Hourglass", en: "Zhonya's Hourglass" }, explanation: { fr: "Jouable contre certains dives, mais pas la priorite dans ce contexte.", en: "Playable into some dives, but not the main priority in this context." }, isCorrect: false },
      { itemSlug: "void-staff", choiceType: PuzzleChoiceType.ITEM, label: { fr: "Void Staff", en: "Void Staff" }, explanation: { fr: "Trop tot pour la penetration magique si personne n'a encore vraiment stack de MR.", en: "Too early for magic penetration if nobody is really stacking MR yet." }, isCorrect: false },
    ],
  },
  {
    slug: "zed-snowball-roam-window",
    title: { fr: "Zed en avance pour roam", en: "Zed ahead and looking to roam" },
    difficulty: PuzzleDifficulty.INTERMEDIATE,
    description: { fr: "Maximiser un snowball d'assassin.", en: "Maximizing an assassin snowball." },
    situation: { fr: "Tu es 4/0 sur Zed a 12 minutes. L'ADC ennemi n'a aucune armure et tu veux accelerer le tempo.", en: "You are 4/0 on Zed at 12 minutes. The enemy ADC has no armor and you want to accelerate tempo." },
    question: { fr: "Quel deuxieme item convertit le mieux ton avantage maintenant ?", en: "Which second item best converts your lead right now?" },
    explanation: { fr: "The Collector est le choix le plus direct: lethality, execution, et or supplementaire. Tu punis plus vite les cibles fragiles tant qu'elles n'ont pas de reponses defensives.", en: "The Collector is the most direct option: lethality, execute, and bonus gold. You punish squishy targets before they can buy defensive answers." },
    role: Role.MID,
    moduleKey: "powerspikes",
    championSlug: "zed",
    allyTeam: ["zed", "xayah", "nautilus", "jax", "lulu"],
    enemyTeam: ["orianna", "jhin", "soraka", "malphite", "aatrox"],
    gameContext: { minute: 12, gold: 3100, lane: "mid", objective: "mid-push-bot-roam", currentBuild: ["youmuus-ghostblade", "ionian-boots-of-lucidity"], scoreboard: "4/0/1", fedEnemies: [], notes: ["snowball", "enemy-backline-no-armor"] },
    tags: ["assassin", "snowball", "tempo", "mid"],
    choices: [
      { itemSlug: "the-collector", choiceType: PuzzleChoiceType.ITEM, label: { fr: "The Collector", en: "The Collector" }, explanation: { fr: "Correct. Tu compresses ton timing de one-shot pendant la fenetre la plus rentable.", en: "Correct. You compress your one-shot timing during the most profitable window." }, isCorrect: true },
      { itemSlug: "guardian-angel", choiceType: PuzzleChoiceType.ITEM, label: { fr: "Guardian Angel", en: "Guardian Angel" }, explanation: { fr: "Trop defensif quand tu es encore en train de creer l'avance.", en: "Too defensive while you are still trying to create the lead." }, isCorrect: false },
      { itemSlug: "essence-reaver", choiceType: PuzzleChoiceType.ITEM, label: { fr: "Essence Reaver", en: "Essence Reaver" }, explanation: { fr: "Item mal adapte au plan de jeu pur assassin de Zed.", en: "Poorly aligned with Zed's pure assassin game plan." }, isCorrect: false },
      { choiceType: PuzzleChoiceType.ITEM, label: { fr: "Maw of Malmortius", en: "Maw of Malmortius" }, textFallback: { fr: "Maw of Malmortius", en: "Maw of Malmortius" }, explanation: { fr: "Reponse defensive trop anticipee. Tu n'es pas encore force de te couvrir.", en: "This is a defensive answer too early. You are not yet forced to cover yourself." }, isCorrect: false },
    ],
  },
  {
    slug: "jinx-baron-double-assassin",
    title: { fr: "Jinx au Nashor contre double assassin", en: "Jinx at Baron into double assassin" },
    difficulty: PuzzleDifficulty.ADVANCED,
    description: { fr: "Savoir sacrifier un peu de DPS pour pouvoir en infliger.", en: "Knowing when to trade some DPS for the ability to deal any damage at all." },
    situation: { fr: "Baron dans une minute. Zed et Ahri n'ont qu'une idee: te sortir du fight. Tu as deja trois items offensifs.", en: "Baron in one minute. Zed and Ahri want one thing: removing you from the fight. You already have three offensive items." },
    question: { fr: "Quel achat te donne le plus de probabilite de gagner le 5v5 ?", en: "Which purchase gives you the highest chance to win the 5v5?" },
    explanation: { fr: "Guardian Angel est optimal. Si la win condition est 'Jinx doit vivre assez longtemps pour reset', alors l'assurance survie vaut plus qu'un item purement offensif.", en: "Guardian Angel is optimal. If the win condition is 'Jinx must live long enough to reset', then survival insurance is worth more than a purely offensive item." },
    role: Role.ADC,
    moduleKey: "defensive",
    championSlug: "jinx",
    allyTeam: ["jinx", "lulu", "orianna", "jax", "nautilus"],
    enemyTeam: ["zed", "ahri", "malphite", "xayah", "leona"],
    gameContext: { minute: 28, gold: 3300, lane: "bot", objective: "baron", currentBuild: ["kraken-slayer", "berserkers-greaves", "infinity-edge"], scoreboard: "7/2/6", fedEnemies: ["zed"], notes: ["double-dive", "carry-protect"] },
    tags: ["adc", "defensive", "baron", "teamfight"],
    choices: [
      { itemSlug: "guardian-angel", choiceType: PuzzleChoiceType.ITEM, label: { fr: "Guardian Angel", en: "Guardian Angel" }, explanation: { fr: "Correct. Tu prends une marge de securite enorme contre les engages de Zed/Malphite.", en: "Correct. You gain a huge safety margin against Zed and Malphite engages." }, isCorrect: true },
      { itemSlug: "bloodthirster", choiceType: PuzzleChoiceType.ITEM, label: { fr: "Bloodthirster", en: "Bloodthirster" }, explanation: { fr: "Le bouclier aide contre le poke, beaucoup moins contre un combo coordonne.", en: "The shield helps against poke, much less against a coordinated burst combo." }, isCorrect: false },
      { itemSlug: "lord-dominiks-regards", choiceType: PuzzleChoiceType.ITEM, label: { fr: "Lord Dominik's Regards", en: "Lord Dominik's Regards" }, explanation: { fr: "Tu ajoutes du DPS, mais tu risques surtout de ne jamais pouvoir le sortir.", en: "You add DPS, but you mainly risk never getting to output it." }, isCorrect: false },
      { itemSlug: "blade-of-the-ruined-king", choiceType: PuzzleChoiceType.ITEM, label: { fr: "Blade of the Ruined King", en: "Blade of the Ruined King" }, explanation: { fr: "Pas la bonne priorite face a une menace d'assassinat immediate.", en: "Not the right priority against immediate assassination threat." }, isCorrect: false },
    ],
  },
  {
    slug: "syndra-double-mr-response",
    title: { fr: "Syndra contre double MR", en: "Syndra into double magic resist" },
    difficulty: PuzzleDifficulty.INTERMEDIATE,
    description: { fr: "Reconnaite le timing du Void Staff.", en: "Recognizing the right Void Staff timing." },
    situation: { fr: "Le top et le jungler ennemis ont deja de la MR et la botlane commence a acheter des composants defensifs.", en: "The enemy top and jungler already have MR and bot lane is starting defensive components." },
    question: { fr: "Quel item est le plus pertinent en troisieme slot ?", en: "Which item is most appropriate as your third slot?" },
    explanation: { fr: "Void Staff devient ici la meilleure conversion d'or. Shadowflame perd vite en valeur si plusieurs cibles importantes montent de la MR.", en: "Void Staff becomes the best gold conversion here. Shadowflame loses value quickly once multiple important targets buy MR." },
    role: Role.MID,
    moduleKey: "anti-comp",
    championSlug: "syndra",
    allyTeam: ["syndra", "xayah", "lulu", "jax", "nautilus"],
    enemyTeam: ["malphite", "aatrox", "ahri", "xayah", "soraka"],
    gameContext: { minute: 24, gold: 2950, lane: "mid", objective: "dragon-soul-fight", currentBuild: ["ludens-companion", "sorcerers-shoes", "shadowflame"], scoreboard: "5/2/7", fedEnemies: ["malphite"], notes: ["double-mr", "frontline-thickening"] },
    tags: ["mage", "magic-pen", "third-item", "teamfight"],
    choices: [
      { itemSlug: "void-staff", choiceType: PuzzleChoiceType.ITEM, label: { fr: "Void Staff", en: "Void Staff" }, explanation: { fr: "Correct. C'est le meilleur pivot des que plusieurs cibles importantes ont de la MR.", en: "Correct. It is the best pivot once several important targets have MR." }, isCorrect: true },
      { itemSlug: "rabadons-deathcap", choiceType: PuzzleChoiceType.ITEM, label: { fr: "Rabadon's Deathcap", en: "Rabadon's Deathcap" }, explanation: { fr: "Toujours fort, mais moins rentable tant que la MR adverse commence a couper ton burst.", en: "Still strong, but less efficient while enemy MR is actively cutting your burst." }, isCorrect: false },
      { itemSlug: "zhonyas-hourglass", choiceType: PuzzleChoiceType.ITEM, label: { fr: "Zhonya's Hourglass", en: "Zhonya's Hourglass" }, explanation: { fr: "Defensif utile si tu te fais hard dive, mais ce n'est pas le contexte principal ici.", en: "Useful defense if you are being hard dived, but that is not the main issue here." }, isCorrect: false },
      { itemSlug: "shadowflame", choiceType: PuzzleChoiceType.ITEM, label: { fr: "Shadowflame", en: "Shadowflame" }, explanation: { fr: "Le flat pen surperforme contre les cibles legeres, pas contre la MR deja empilee.", en: "Flat pen excels into light resistances, not already stacked MR." }, isCorrect: false },
    ],
  },
  {
    slug: "renekton-anti-heal-component-vs-full-item",
    title: { fr: "Renekton et l'anti-heal au bon timing", en: "Renekton and anti-heal timing" },
    difficulty: PuzzleDifficulty.INTERMEDIATE,
    description: { fr: "Choisir entre composant utile et item final trop lent.", en: "Choosing between the right component and a final item that is too slow." },
    situation: { fr: "Tu joues Renekton un peu derriere contre Aatrox. Le deux contre deux top est frequent et tu n'as pas les moyens d'un gros item complet.", en: "You are on Renekton slightly behind into Aatrox. Top-side 2v2s are frequent and you cannot afford a full completed item." },
    question: { fr: "Quel achat est le plus propre a ce reset ?", en: "What is the cleanest buy on this reset?" },
    explanation: { fr: "Executioner's Calling est le meilleur achat de tempo. Tu obtiens l'effet critique tout de suite sans casser ta progression sur ton prochain vrai spike de bruiser.", en: "Executioner's Calling is the best tempo buy. You get the critical effect immediately without ruining progress toward your next real bruiser spike." },
    role: Role.TOP,
    moduleKey: "bruiser",
    championSlug: "renekton",
    allyTeam: ["renekton", "lulu", "syndra", "jinx", "nautilus"],
    enemyTeam: ["aatrox", "soraka", "zed", "jhin", "leona"],
    gameContext: { minute: 13, gold: 900, lane: "top", objective: "top-skirmish", currentBuild: ["ionian-boots-of-lucidity"], scoreboard: "1/2/1", fedEnemies: ["aatrox"], notes: ["need-anti-heal-now", "low-gold-reset"] },
    tags: ["top", "anti-heal", "component", "tempo"],
    choices: [
      { choiceType: PuzzleChoiceType.COMPONENT, label: { fr: "Executioner's Calling", en: "Executioner's Calling" }, textFallback: { fr: "Executioner's Calling", en: "Executioner's Calling" }, explanation: { fr: "Correct. Tu prends la fonction anti-heal maintenant et tu gardes ta flexibilite de build.", en: "Correct. You buy the anti-heal function now and keep your build flexible." }, isCorrect: true },
      { itemSlug: "chempunk-chainsword", choiceType: PuzzleChoiceType.ITEM, label: { fr: "Chempunk Chainsword", en: "Chempunk Chainsword" }, explanation: { fr: "Le bon archetype plus tard, mais trop cher pour ce reset et moins bon en tempo immediat.", en: "The right archetype later, but too expensive for this reset and worse for immediate tempo." }, isCorrect: false },
      { itemSlug: "black-cleaver", choiceType: PuzzleChoiceType.ITEM, label: { fr: "Black Cleaver", en: "Black Cleaver" }, explanation: { fr: "Bon item de progression, mais il ne resout pas la source la plus urgente du matchup.", en: "A good progression item, but it does not solve the most urgent issue in the matchup." }, isCorrect: false },
      { itemSlug: "steraks-gage", choiceType: PuzzleChoiceType.ITEM, label: { fr: "Sterak's Gage", en: "Sterak's Gage" }, explanation: { fr: "Trop lent et trop cher pour le timing actuel.", en: "Too slow and too expensive for the current timing." }, isCorrect: false },
    ],
  },
  {
    slug: "xayah-boots-vs-bf-tempo",
    title: { fr: "Xayah: bottes ou B.F. Sword ?", en: "Xayah: boots or B.F. Sword?" },
    difficulty: PuzzleDifficulty.BEGINNER,
    description: { fr: "Comparer un spike d'item a un spike de tempo immediat.", en: "Comparing a raw item spike with immediate tempo." },
    situation: { fr: "Tu joues Xayah en lane contre Nautilus + Jhin. Le support ennemi cherche l'engage et ton flash est down.", en: "You are on Xayah in lane versus Nautilus + Jhin. The enemy support is looking for engage and your flash is down." },
    question: { fr: "Avec 1100 gold, quel achat est le plus rationnel ?", en: "With 1100 gold, what is the most rational purchase?" },
    explanation: { fr: "Plated Steelcaps vaut plus ici qu'un composant offensif. Tu augmentes ta survie lane et tu peux continuer a prendre les waves sans perdre toute pression.", en: "Plated Steelcaps are worth more here than a raw offensive component. You improve lane survivability and can keep taking waves without giving up all pressure." },
    role: Role.ADC,
    moduleKey: "fundamentals",
    championSlug: "xayah",
    allyTeam: ["xayah", "lulu", "ahri", "jax", "nautilus"],
    enemyTeam: ["jhin", "nautilus", "zed", "malphite", "aatrox"],
    gameContext: { minute: 9, gold: 1100, lane: "bot", objective: "lane-stability", currentBuild: ["kraken-slayer"], scoreboard: "1/0/1", fedEnemies: [], notes: ["flash-down", "heavy-ad-threat"] },
    tags: ["adc", "boots", "lane", "tempo"],
    choices: [
      { itemSlug: "plated-steelcaps", choiceType: PuzzleChoiceType.ITEM, label: { fr: "Plated Steelcaps", en: "Plated Steelcaps" }, explanation: { fr: "Correct. Ton probleme est de survivre et de garder la lane jouable, pas de maximiser un burst theorique.", en: "Correct. Your issue is surviving and keeping lane playable, not maximizing theoretical burst." }, isCorrect: true },
      { choiceType: PuzzleChoiceType.COMPONENT, label: { fr: "B.F. Sword", en: "B.F. Sword" }, textFallback: { fr: "B.F. Sword", en: "B.F. Sword" }, explanation: { fr: "Le composant est fort si tu peux auto librement. Ce n'est pas vraiment le cas ici.", en: "The component is strong if you can auto freely. That is not really the case here." }, isCorrect: false },
      { itemSlug: "berserkers-greaves", choiceType: PuzzleChoiceType.ITEM, label: { fr: "Berserker's Greaves", en: "Berserker's Greaves" }, explanation: { fr: "Trop gourmand defensivement contre cette botlane d'engage AD.", en: "Too greedy defensively against this AD engage lane." }, isCorrect: false },
      { choiceType: PuzzleChoiceType.COMPONENT, label: { fr: "Cloak of Agility + Long Sword", en: "Cloak of Agility + Long Sword" }, textFallback: { fr: "Cloak of Agility + Long Sword", en: "Cloak of Agility + Long Sword" }, explanation: { fr: "Achat acceptable si la lane est stable, mais moins coherent ici que des bottes defensives.", en: "Acceptable if lane is stable, but less coherent here than defensive boots." }, isCorrect: false },
    ],
  },
  {
    slug: "azir-scaling-vs-immediate-pen",
    title: { fr: "Azir: scaling ou spike immediat ?", en: "Azir: scaling or immediate spike?" },
    difficulty: PuzzleDifficulty.ADVANCED,
    description: { fr: "Arbitrer entre Rabadon et un item de penetration.", en: "Balancing Rabadon's against penetration." },
    situation: { fr: "Tu joues Azir et ton equipe veut temporiser. Les carries ennemis n'ont pas encore de MR, mais le combat drake suivant peut tout changer.", en: "You are on Azir and your team wants to stall. Enemy carries still have no MR, but the next dragon fight can change the game." },
    question: { fr: "Quel troisieme item maximise le plan de victoire le plus probable ?", en: "Which third item maximizes the most likely win condition?" },
    explanation: { fr: "Rabadon's Deathcap est meilleur ici parce que personne n'a encore investi en MR et que ton plan est de scaler ton DPS AP pour les fights suivants. Acheter Void trop tot, c'est payer une stat pas encore necessaire.", en: "Rabadon's Deathcap is better here because nobody has invested in MR yet and your plan is to scale AP DPS for later fights. Buying Void too early means paying for a stat that is not needed yet." },
    role: Role.MID,
    moduleKey: "powerspikes",
    championSlug: "azir",
    allyTeam: ["azir", "xayah", "lulu", "renekton", "nautilus"],
    enemyTeam: ["zed", "jhin", "leona", "aatrox", "soraka"],
    gameContext: { minute: 21, gold: 3600, lane: "mid", objective: "dragon-setup", currentBuild: ["liandrys-torment", "sorcerers-shoes"], scoreboard: "2/1/5", fedEnemies: ["jhin"], notes: ["enemy-no-mr", "scaling-wincon"] },
    tags: ["mage", "scaling", "timing", "third-item"],
    choices: [
      { itemSlug: "rabadons-deathcap", choiceType: PuzzleChoiceType.ITEM, label: { fr: "Rabadon's Deathcap", en: "Rabadon's Deathcap" }, explanation: { fr: "Correct. Tu pushes ton scaling tant que la MR adverse n'a pas encore de vraie valeur.", en: "Correct. You push scaling while enemy MR still has little real value." }, isCorrect: true },
      { itemSlug: "void-staff", choiceType: PuzzleChoiceType.ITEM, label: { fr: "Void Staff", en: "Void Staff" }, explanation: { fr: "Achat reactive, mais premature dans cette partie precise.", en: "Reactive purchase, but premature in this exact game." }, isCorrect: false },
      { itemSlug: "zhonyas-hourglass", choiceType: PuzzleChoiceType.ITEM, label: { fr: "Zhonya's Hourglass", en: "Zhonya's Hourglass" }, explanation: { fr: "Peut se defendre contre Zed, mais tu as encore de la marge pour jouer le scaling.", en: "Defensible against Zed, but you still have room to play for scaling." }, isCorrect: false },
      { itemSlug: "shadowflame", choiceType: PuzzleChoiceType.ITEM, label: { fr: "Shadowflame", en: "Shadowflame" }, explanation: { fr: "Bon item de milieu de partie, mais moins explosif que Rabadon dans ce contexte.", en: "A good mid-game item, but less explosive than Rabadon in this context." }, isCorrect: false },
    ],
  },
  {
    slug: "jax-side-lane-vs-ap-threat",
    title: { fr: "Jax en side contre menace AP", en: "Jax side-laning into AP threat" },
    difficulty: PuzzleDifficulty.INTERMEDIATE,
    description: { fr: "Repondre a la source de degats dominante sans perdre son plan de duel.", en: "Answering the dominant damage source without losing the duel plan." },
    situation: { fr: "Tu split sur Jax, mais Ahri est fed et vient souvent sur la side lane avec son jungler.", en: "You are splitting on Jax, but a fed Ahri often matches you on side lane with her jungler." },
    question: { fr: "Quel item ajoute le plus de valeur maintenant ?", en: "Which item adds the most value right now?" },
    explanation: { fr: "Maw of Malmortius est le meilleur pivot. Tu gardes un profil offensif tout en couvrant la source de burst qui t'empeche de jouer la side lane.", en: "Maw of Malmortius is the best pivot. You keep an offensive profile while covering the burst source preventing you from playing side lane." },
    role: Role.TOP,
    moduleKey: "bruiser",
    championSlug: "jax",
    allyTeam: ["jax", "jinx", "lulu", "syndra", "nautilus"],
    enemyTeam: ["ahri", "aatrox", "jhin", "leona", "malphite"],
    gameContext: { minute: 23, gold: 2850, lane: "side", objective: "1-3-1", currentBuild: ["trinity-force", "plated-steelcaps"], scoreboard: "4/3/2", fedEnemies: ["ahri"], notes: ["split-push", "ap-pick-pressure"] },
    tags: ["bruiser", "defensive", "splitpush", "adaptation"],
    choices: [
      { choiceType: PuzzleChoiceType.ITEM, label: { fr: "Maw of Malmortius", en: "Maw of Malmortius" }, textFallback: { fr: "Maw of Malmortius", en: "Maw of Malmortius" }, explanation: { fr: "Correct. Tu respectes la menace AP sans renoncer a ton plan de duel et de pression side lane.", en: "Correct. You respect the AP threat without abandoning your duel and side-lane plan." }, isCorrect: true },
      { itemSlug: "steraks-gage", choiceType: PuzzleChoiceType.ITEM, label: { fr: "Sterak's Gage", en: "Sterak's Gage" }, explanation: { fr: "Bon anti-burst generaliste, mais moins cible sur la menace principale ici.", en: "A good general anti-burst tool, but less targeted at the main threat here." }, isCorrect: false },
      { itemSlug: "titanic-hydra", choiceType: PuzzleChoiceType.ITEM, label: { fr: "Titanic Hydra", en: "Titanic Hydra" }, explanation: { fr: "Tu gagnes du push, mais pas la securite necessaire pour tenir la side lane.", en: "You gain push, but not the safety needed to hold side lane." }, isCorrect: false },
      { itemSlug: "black-cleaver", choiceType: PuzzleChoiceType.ITEM, label: { fr: "Black Cleaver", en: "Black Cleaver" }, explanation: { fr: "Moins utile que couvrir Ahri si elle conditionne deja ta facon de jouer la map.", en: "Less useful than covering Ahri if she already dictates how you can play the map." }, isCorrect: false },
    ],
  },
  {
    slug: "lulu-support-teamfight-choice",
    title: { fr: "Lulu et l'item de teamfight", en: "Lulu and the teamfight item choice" },
    difficulty: PuzzleDifficulty.BEGINNER,
    description: { fr: "Distinguer sustain de fight long et burst de catch.", en: "Distinguishing long-fight sustain from catch burst." },
    situation: { fr: "Ta compo protege Jinx et veut jouer les objectifs en 5v5 poses. Les fights durent longtemps et ton ADC n'est pas menace par un one-shot direct.", en: "Your comp is protecting Jinx and wants structured 5v5 objective fights. Fights are long and your ADC is not threatened by a direct one-shot." },
    question: { fr: "Quel item support complete le mieux ce plan ?", en: "Which support item best complements this plan?" },
    explanation: { fr: "Moonstone Renewer est le meilleur choix parce que la valeur vient de la duree du fight et de ta capacite a maintenir Jinx et la frontline en vie.", en: "Moonstone Renewer is the best choice because the value comes from fight duration and your ability to keep Jinx and the frontline alive." },
    role: Role.SUPPORT,
    moduleKey: "support",
    championSlug: "lulu",
    allyTeam: ["lulu", "jinx", "azir", "jax", "nautilus"],
    enemyTeam: ["jhin", "ahri", "aatrox", "leona", "malphite"],
    gameContext: { minute: 19, gold: 2200, lane: "support", objective: "dragon", currentBuild: ["redemption"], scoreboard: "0/1/9", fedEnemies: [], notes: ["protect-carry", "extended-fights"] },
    tags: ["support", "teamfight", "enchanter", "objective"],
    choices: [
      { itemSlug: "moonstone-renewer", choiceType: PuzzleChoiceType.ITEM, label: { fr: "Moonstone Renewer", en: "Moonstone Renewer" }, explanation: { fr: "Correct. Le fight long et structure maximise la valeur du sustain repete.", en: "Correct. The long, structured fight pattern maximizes repeated sustain value." }, isCorrect: true },
      { itemSlug: "imperial-mandate", choiceType: PuzzleChoiceType.ITEM, label: { fr: "Imperial Mandate", en: "Imperial Mandate" }, explanation: { fr: "Plus adapte a une compo qui joue catch et burst rapide qu'a une compo protect-carry.", en: "Better for catch-and-burst comps than for a protect-the-carry setup." }, isCorrect: false },
      { choiceType: PuzzleChoiceType.ITEM, label: { fr: "Mikael's Blessing", en: "Mikael's Blessing" }, textFallback: { fr: "Mikael's Blessing", en: "Mikael's Blessing" }, explanation: { fr: "Utile selon la partie, mais moins rentable en sustain pur ici.", en: "Useful in some games, but less rewarding in pure sustain here." }, isCorrect: false },
      { itemSlug: "zhonyas-hourglass", choiceType: PuzzleChoiceType.ITEM, label: { fr: "Zhonya's Hourglass", en: "Zhonya's Hourglass" }, explanation: { fr: "Trop ego et hors plan pour un support enchanteur dans ce contexte.", en: "Too selfish and off-plan for an enchanter support in this context." }, isCorrect: false },
    ],
  },
  {
    slug: "malphite-anti-crit-frontline",
    title: { fr: "Malphite contre double crit", en: "Malphite into double crit" },
    difficulty: PuzzleDifficulty.BEGINNER,
    description: { fr: "Savoir quand Randuin depasse un item d'armure generique.", en: "Knowing when Randuin beats a generic armor item." },
    situation: { fr: "L'equipe adverse joue Jinx + Yasuo et ton job est de tenir l'entree des fights pour proteger tes carries.", en: "The enemy team plays Jinx + Yasuo and your job is to hold the front of fights to protect your carries." },
    question: { fr: "Quel item de tank est le plus rentable ?", en: "Which tank item is the most efficient purchase?" },
    explanation: { fr: "Randuin's Omen est le meilleur parce que la reduction des critiques cible exactement la menace principale et t'aide a tenir l'engage adverse.", en: "Randuin's Omen is best because the crit reduction targets the main threat directly and helps you hold the enemy engage." },
    role: Role.TOP,
    moduleKey: "anti-comp",
    championSlug: "malphite",
    allyTeam: ["malphite", "jhin", "lulu", "ahri", "nautilus"],
    enemyTeam: ["jinx", "zed", "leona", "aatrox", "ahri"],
    gameContext: { minute: 25, gold: 2700, lane: "top", objective: "soul-fight", currentBuild: ["plated-steelcaps", "frozen-heart"], scoreboard: "2/3/8", fedEnemies: ["jinx"], notes: ["double-crit", "frontline-role"] },
    tags: ["tank", "anti-crit", "frontline", "teamfight"],
    choices: [
      { itemSlug: "randuins-omen", choiceType: PuzzleChoiceType.ITEM, label: { fr: "Randuin's Omen", en: "Randuin's Omen" }, explanation: { fr: "Correct. Tu reponds exactement a Jinx avec une stat et un effet tres cibles.", en: "Correct. You answer Jinx with a very targeted stat line and effect." }, isCorrect: true },
      { itemSlug: "dead-mans-plate", choiceType: PuzzleChoiceType.ITEM, label: { fr: "Dead Man's Plate", en: "Dead Man's Plate" }, explanation: { fr: "Bonne mobilite, mais moins precis contre des carrys crit.", en: "Good mobility, but less precise against crit carries." }, isCorrect: false },
      { itemSlug: "thornmail", choiceType: PuzzleChoiceType.ITEM, label: { fr: "Thornmail", en: "Thornmail" }, explanation: { fr: "Moins utile si le probleme principal est le crit plutot que le sustain.", en: "Less useful if the main problem is crit rather than sustain." }, isCorrect: false },
      { itemSlug: "force-of-nature", choiceType: PuzzleChoiceType.ITEM, label: { fr: "Force of Nature", en: "Force of Nature" }, explanation: { fr: "Mauvaise priorite: la principale menace est physique et critique.", en: "Wrong priority: the main threat is physical and crit-based." }, isCorrect: false },
    ],
  },
];

async function main() {
  await prisma.puzzleAttempt.deleteMany();
  await prisma.puzzleTagOnPuzzle.deleteMany();
  await prisma.puzzleChoice.deleteMany();
  await prisma.puzzle.deleteMany();
  await prisma.puzzleTag.deleteMany();
  await prisma.itemRelation.deleteMany();
  await prisma.item.deleteMany();
  await prisma.champion.deleteMany();
  await prisma.user.deleteMany();

  const championMap = new Map<string, string>();
  for (const champion of champions) {
    const created = await prisma.champion.create({
      data: {
        riotId: champion.riotId,
        riotKey: champion.riotKey,
        slug: champion.slug,
        name: champion.name,
        title: champion.title,
        primaryRole: champion.primaryRole,
        roles: champion.roles,
        damageType: champion.damageType,
        image: champion.image,
        tags: champion.tags,
        threatJson: champion.threat,
      },
    });
    championMap.set(champion.slug, created.id);
  }

  const itemMap = new Map<string, string>();
  for (const item of items) {
    const created = await prisma.item.create({
      data: {
        riotItemId: item.riotItemId,
        slug: item.slug,
        name: item.name,
        shortDescription: item.shortDescription,
        fullDescription: item.fullDescription,
        goldTotal: item.goldTotal,
        goldBase: item.goldBase,
        goldSell: item.goldSell,
        combineCost: item.combineCost,
        category: item.category,
        statsJson: item.stats,
        image: item.image,
        isMythic: item.isMythic ?? false,
        isLegendary: item.isLegendary ?? true,
        isBoots: item.isBoots ?? false,
        activeEffect: item.activeEffect,
        passiveEffect: item.passiveEffect,
        activeName: item.activeName,
        passiveName: item.passiveName,
        componentsJson: item.components ?? [],
        tags: item.tags,
        patch,
      },
    });
    itemMap.set(item.slug, created.id);
  }

  const tagMap = new Map<string, string>();
  const tagSeeds = Array.from(new Set(puzzles.flatMap((puzzle) => puzzle.tags))).sort();
  for (const tagSlug of tagSeeds) {
    const created = await prisma.puzzleTag.create({
      data: {
        slug: tagSlug,
        name: tagSlug.replace(/-/g, " "),
      },
    });
    tagMap.set(tagSlug, created.id);
  }

  const demoUser = await prisma.user.create({
    data: {
      username: process.env.DEMO_USER_USERNAME || "SummonerCoach",
      email: "coach@example.com",
      preferredRoles: [Role.ADC, Role.MID, Role.SUPPORT],
      targetSkills: ["itemization", "tempo", "anti-heal", "front-to-back"],
      language: LanguageCode.fr,
    },
  });

  for (const puzzle of puzzles) {
    const createdPuzzle = await prisma.puzzle.create({
      data: {
        slug: puzzle.slug,
        title: puzzle.title,
        difficulty: puzzle.difficulty,
        patch,
        description: puzzle.description,
        situation: puzzle.situation,
        question: puzzle.question,
        explanation: puzzle.explanation,
        role: puzzle.role,
        moduleKey: puzzle.moduleKey,
        championId: puzzle.championSlug ? championMap.get(puzzle.championSlug) : undefined,
        allyTeamJson: puzzle.allyTeam,
        enemyTeamJson: puzzle.enemyTeam,
        gameContextJson: puzzle.gameContext,
        isPublished: true,
      },
    });

    for (const [index, choice] of puzzle.choices.entries()) {
      const createdChoice = await prisma.puzzleChoice.create({
        data: {
          puzzleId: createdPuzzle.id,
          label: choice.label,
          choiceType: choice.choiceType,
          itemId: choice.itemSlug ? itemMap.get(choice.itemSlug) : undefined,
          textFallback: choice.textFallback,
          explanation: choice.explanation,
          isCorrect: choice.isCorrect,
          displayOrder: index + 1,
        },
      });

      if (choice.isCorrect && index % 2 === 0) {
        await prisma.puzzleAttempt.create({
          data: {
            userId: demoUser.id,
            puzzleId: createdPuzzle.id,
            selectedChoiceId: createdChoice.id,
            isCorrect: true,
          },
        });
      }
    }

    for (const tagSlug of puzzle.tags) {
      await prisma.puzzleTagOnPuzzle.create({
        data: {
          puzzleId: createdPuzzle.id,
          puzzleTagId: tagMap.get(tagSlug)!,
        },
      });
    }
  }

  const relations = [
    ["kraken-slayer", "lord-dominiks-regards", ItemRelationType.CORE_BUILD, "Front-to-back ADC sequencing against armor."],
    ["ludens-companion", "morellonomicon", ItemRelationType.CORE_BUILD, "Classic AP anti-heal pivot when sustain is high."],
    ["youmuus-ghostblade", "the-collector", ItemRelationType.SYNERGY, "Snowball lethality pairing for squishy targets."],
    ["plated-steelcaps", "randuins-omen", ItemRelationType.SYNERGY, "Layered answer against crit-based carries."],
    ["moonstone-renewer", "redemption", ItemRelationType.SYNERGY, "Extended sustain stack for enchanters."],
  ] as const;

  for (const [sourceSlug, targetSlug, relationType, note] of relations) {
    await prisma.itemRelation.create({
      data: {
        sourceItemId: itemMap.get(sourceSlug)!,
        targetItemId: itemMap.get(targetSlug)!,
        relationType,
        note,
      },
    });
  }

  console.log(`Seed complete: ${champions.length} champions, ${items.length} items, ${puzzles.length} puzzles.`);
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

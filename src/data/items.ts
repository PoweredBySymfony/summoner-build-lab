export interface ItemStat {
  label: string;
  value: string;
}

export interface ItemComponent {
  name: string;
  cost: number;
  icon: string;
}

export interface GameItem {
  id: string;
  name: string;
  cost: number;
  icon: string;
  stats: ItemStat[];
  passive?: string;
  passiveName?: string;
  components: ItemComponent[];
  tags: string[];
  description?: string;
}

// Using Data Dragon CDN for item icons (public Riot API assets)
const DDRAGON = "https://ddragon.leagueoflegends.com/cdn/14.10.1/img/item";

export const ITEMS: Record<string, GameItem> = {
  infinity_edge: {
    id: "infinity_edge",
    name: "Infinity Edge",
    cost: 3400,
    icon: `${DDRAGON}/3031.png`,
    stats: [
      { label: "Attack Damage", value: "+70" },
      { label: "Critical Strike Chance", value: "+25%" },
    ],
    passiveName: "Perfection",
    passive: "Si ta chance de coup critique est supérieure ou égale à 60%, tes coups critiques infligent 35% de dégâts supplémentaires.",
    components: [
      { name: "B.F. Sword", cost: 1300, icon: `${DDRAGON}/1038.png` },
      { name: "Pickaxe", cost: 875, icon: `${DDRAGON}/1037.png` },
      { name: "Cloak of Agility", cost: 600, icon: `${DDRAGON}/1018.png` },
    ],
    tags: ["AD", "Crit", "Legendary"],
  },
  kraken_slayer: {
    id: "kraken_slayer",
    name: "Kraken Slayer",
    cost: 3100,
    icon: `${DDRAGON}/6672.png`,
    stats: [
      { label: "Attack Damage", value: "+40" },
      { label: "Attack Speed", value: "+35%" },
      { label: "Critical Strike Chance", value: "+25%" },
    ],
    passiveName: "Bring It Down",
    passive: "Toutes les 3 attaques de base, inflige des dégâts physiques supplémentaires.",
    components: [
      { name: "Noonquiver", cost: 1100, icon: `${DDRAGON}/6670.png` },
      { name: "Pickaxe", cost: 875, icon: `${DDRAGON}/1037.png` },
    ],
    tags: ["AD", "Attack Speed", "Crit", "Legendary"],
  },
  rabadons: {
    id: "rabadons",
    name: "Rabadon's Deathcap",
    cost: 3600,
    icon: `${DDRAGON}/3089.png`,
    stats: [
      { label: "Ability Power", value: "+120" },
    ],
    passiveName: "Magical Opus",
    passive: "Augmente ta puissance (AP) totale de 35%.",
    components: [
      { name: "Needlessly Large Rod", cost: 1250, icon: `${DDRAGON}/1058.png` },
      { name: "Needlessly Large Rod", cost: 1250, icon: `${DDRAGON}/1058.png` },
    ],
    tags: ["AP", "Legendary"],
  },
  zhonyas: {
    id: "zhonyas",
    name: "Zhonya's Hourglass",
    cost: 3250,
    icon: `${DDRAGON}/3157.png`,
    stats: [
      { label: "Ability Power", value: "+105" },
      { label: "Armor", value: "+50" },
      { label: "Ability Haste", value: "+10" },
    ],
    passiveName: "Stasis",
    passive: "Actif: Te rend invulnérable et intargetable pendant 2.5s mais tu ne peux pas bouger ni utiliser de sorts.",
    components: [
      { name: "Seeker's Armguard", cost: 1000, icon: `${DDRAGON}/3191.png` },
      { name: "Fiendish Codex", cost: 900, icon: `${DDRAGON}/3108.png` },
    ],
    tags: ["AP", "Armor", "Active", "Legendary"],
  },
  plated_steelcaps: {
    id: "plated_steelcaps",
    name: "Plated Steelcaps",
    cost: 1100,
    icon: `${DDRAGON}/3047.png`,
    stats: [
      { label: "Armor", value: "+25" },
      { label: "Move Speed", value: "+45" },
    ],
    passive: "Réduit les dégâts des attaques de base entrantes de 12%.",
    components: [
      { name: "Boots", cost: 300, icon: `${DDRAGON}/1001.png` },
      { name: "Cloth Armor", cost: 300, icon: `${DDRAGON}/1029.png` },
    ],
    tags: ["Armor", "Boots"],
  },
  guardian_angel: {
    id: "guardian_angel",
    name: "Guardian Angel",
    cost: 3200,
    icon: `${DDRAGON}/3026.png`,
    stats: [
      { label: "Attack Damage", value: "+55" },
      { label: "Armor", value: "+40" },
    ],
    passiveName: "Resurrect",
    passive: "À la mort, tu ressuscites après 4s avec 50% de tes PV de base et 30% de ton mana max. Cooldown: 300s.",
    components: [
      { name: "B.F. Sword", cost: 1300, icon: `${DDRAGON}/1038.png` },
      { name: "Cloth Armor", cost: 300, icon: `${DDRAGON}/1029.png` },
    ],
    tags: ["AD", "Armor", "Legendary"],
  },
  blade_of_the_ruined_king: {
    id: "blade_of_the_ruined_king",
    name: "Blade of the Ruined King",
    cost: 3200,
    icon: `${DDRAGON}/3153.png`,
    stats: [
      { label: "Attack Damage", value: "+40" },
      { label: "Attack Speed", value: "+25%" },
      { label: "Life Steal", value: "+8%" },
    ],
    passiveName: "Mist's Edge",
    passive: "Tes attaques de base infligent des dégâts physiques bonus égaux à 9% des PV actuels de la cible.",
    components: [
      { name: "Bilgewater Cutlass", cost: 1500, icon: `${DDRAGON}/3144.png` },
      { name: "Recurve Bow", cost: 1000, icon: `${DDRAGON}/1043.png` },
    ],
    tags: ["AD", "Attack Speed", "Life Steal", "Legendary"],
  },
  morellonomicon: {
    id: "morellonomicon",
    name: "Morellonomicon",
    cost: 2500,
    icon: `${DDRAGON}/3165.png`,
    stats: [
      { label: "Ability Power", value: "+80" },
      { label: "Health", value: "+300" },
    ],
    passiveName: "Affliction",
    passive: "Les dégâts magiques infligés aux champions ennemis appliquent Brûlure Grevée, réduisant les soins reçus de 40% pendant 3s.",
    components: [
      { name: "Oblivion Orb", cost: 800, icon: `${DDRAGON}/3916.png` },
      { name: "Blasting Wand", cost: 850, icon: `${DDRAGON}/1026.png` },
    ],
    tags: ["AP", "Health", "Grievous Wounds", "Legendary"],
  },
};

export const getItem = (id: string): GameItem | undefined => ITEMS[id];
export const getAllItems = (): GameItem[] => Object.values(ITEMS);

export interface Champion {
  name: string;
  icon: string;
  role: string;
  damageType: "AD" | "AP" | "Mixed" | "True";
  threat: string;
}

const CHAMP_ICON = "https://ddragon.leagueoflegends.com/cdn/14.10.1/img/champion";

export const CHAMPIONS: Record<string, Champion> = {
  jinx: { name: "Jinx", icon: `${CHAMP_ICON}/Jinx.png`, role: "ADC", damageType: "AD", threat: "DPS élevé" },
  lux: { name: "Lux", icon: `${CHAMP_ICON}/Lux.png`, role: "Support", damageType: "AP", threat: "Burst / CC" },
  darius: { name: "Darius", icon: `${CHAMP_ICON}/Darius.png`, role: "Top", damageType: "AD", threat: "All-in bruiser" },
  ahri: { name: "Ahri", icon: `${CHAMP_ICON}/Ahri.png`, role: "Mid", damageType: "AP", threat: "Burst / Pick" },
  leona: { name: "Leona", icon: `${CHAMP_ICON}/Leona.png`, role: "Support", damageType: "Mixed", threat: "Engage / CC" },
  yasuo: { name: "Yasuo", icon: `${CHAMP_ICON}/Yasuo.png`, role: "Mid", damageType: "AD", threat: "Crit DPS / Windwall" },
  thresh: { name: "Thresh", icon: `${CHAMP_ICON}/Thresh.png`, role: "Support", damageType: "Mixed", threat: "CC / Peel" },
  kaisa: { name: "Kaisa", icon: `${CHAMP_ICON}/KaiSa.png`, role: "ADC", damageType: "Mixed", threat: "Burst / DPS hybride" },
  zed: { name: "Zed", icon: `${CHAMP_ICON}/Zed.png`, role: "Mid", damageType: "AD", threat: "Assassin / Burst AD" },
  malphite: { name: "Malphite", icon: `${CHAMP_ICON}/Malphite.png`, role: "Top", damageType: "Mixed", threat: "Engage / Tank" },
};

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
  combineCost?: number;
  icon: string;
  stats: ItemStat[];
  passive?: { fr: string; en: string };
  passiveName?: string;
  active?: { fr: string; en: string };
  activeName?: string;
  components: ItemComponent[];
  tags: string[];
  category: string;
  patch: string;
  description?: { fr: string; en: string };
}

const DD = "https://ddragon.leagueoflegends.com/cdn/14.10.1/img/item";

export const ITEMS: Record<string, GameItem> = {
  infinity_edge: {
    id: "infinity_edge", name: "Infinity Edge", cost: 3400, combineCost: 625, icon: `${DD}/3031.png`,
    stats: [{ label: "Attack Damage", value: "+70" }, { label: "Critical Strike Chance", value: "+25%" }],
    passiveName: "Perfection",
    passive: {
      fr: "Si ta chance de coup critique est supérieure ou égale à 60%, tes coups critiques infligent 35% de dégâts supplémentaires.",
      en: "If you have at least 60% critical strike chance, your critical strikes deal 35% bonus damage."
    },
    components: [
      { name: "B.F. Sword", cost: 1300, icon: `${DD}/1038.png` },
      { name: "Pickaxe", cost: 875, icon: `${DD}/1037.png` },
      { name: "Cloak of Agility", cost: 600, icon: `${DD}/1018.png` },
    ],
    tags: ["AD", "Crit", "Legendary"], category: "Offense", patch: "14.10",
  },
  kraken_slayer: {
    id: "kraken_slayer", name: "Kraken Slayer", cost: 3100, combineCost: 625, icon: `${DD}/6672.png`,
    stats: [{ label: "Attack Damage", value: "+40" }, { label: "Attack Speed", value: "+35%" }, { label: "Critical Strike Chance", value: "+25%" }],
    passiveName: "Bring It Down",
    passive: {
      fr: "Toutes les 3 attaques de base, inflige des dégâts physiques supplémentaires proportionnels aux PV max de la cible.",
      en: "Every 3rd basic attack deals bonus physical damage based on the target's max health."
    },
    components: [
      { name: "Noonquiver", cost: 1100, icon: `${DD}/6670.png` },
      { name: "Pickaxe", cost: 875, icon: `${DD}/1037.png` },
    ],
    tags: ["AD", "Attack Speed", "Crit", "Legendary"], category: "Offense", patch: "14.10",
  },
  rabadons: {
    id: "rabadons", name: "Rabadon's Deathcap", cost: 3600, combineCost: 1100, icon: `${DD}/3089.png`,
    stats: [{ label: "Ability Power", value: "+120" }],
    passiveName: "Magical Opus",
    passive: {
      fr: "Augmente ta puissance (AP) totale de 35%. Idéal comme 2e ou 3e item AP pour un multiplicateur massif.",
      en: "Increases your total Ability Power by 35%. Best as 2nd or 3rd AP item for a massive multiplier."
    },
    components: [
      { name: "Needlessly Large Rod", cost: 1250, icon: `${DD}/1058.png` },
      { name: "Needlessly Large Rod", cost: 1250, icon: `${DD}/1058.png` },
    ],
    tags: ["AP", "Legendary"], category: "Offense", patch: "14.10",
  },
  zhonyas: {
    id: "zhonyas", name: "Zhonya's Hourglass", cost: 3250, combineCost: 1050, icon: `${DD}/3157.png`,
    stats: [{ label: "Ability Power", value: "+105" }, { label: "Armor", value: "+50" }, { label: "Ability Haste", value: "+10" }],
    activeName: "Stasis",
    active: {
      fr: "Te rend invulnérable et impossible à cibler pendant 2.5s, mais tu ne peux pas bouger, attaquer ni utiliser de sorts. CD: 120s.",
      en: "Become invulnerable and untargetable for 2.5s, but you cannot move, attack, or cast abilities. CD: 120s."
    },
    components: [
      { name: "Seeker's Armguard", cost: 1000, icon: `${DD}/3191.png` },
      { name: "Fiendish Codex", cost: 900, icon: `${DD}/3108.png` },
    ],
    tags: ["AP", "Armor", "Active", "Legendary"], category: "Defense", patch: "14.10",
  },
  plated_steelcaps: {
    id: "plated_steelcaps", name: "Plated Steelcaps", cost: 1100, icon: `${DD}/3047.png`,
    stats: [{ label: "Armor", value: "+25" }, { label: "Move Speed", value: "+45" }],
    passive: {
      fr: "Réduit les dégâts des attaques de base entrantes de 12%. Efficace contre les ADC et auto-attackers.",
      en: "Reduces incoming basic attack damage by 12%. Effective against ADCs and auto-attackers."
    },
    components: [
      { name: "Boots", cost: 300, icon: `${DD}/1001.png` },
      { name: "Cloth Armor", cost: 300, icon: `${DD}/1029.png` },
    ],
    tags: ["Armor", "Boots"], category: "Boots", patch: "14.10",
  },
  guardian_angel: {
    id: "guardian_angel", name: "Guardian Angel", cost: 3200, combineCost: 1100, icon: `${DD}/3026.png`,
    stats: [{ label: "Attack Damage", value: "+55" }, { label: "Armor", value: "+40" }],
    passiveName: "Resurrect",
    passive: {
      fr: "À la mort, tu ressuscites après 4s avec 50% de tes PV de base et 30% de ton mana max. CD: 300s.",
      en: "Upon death, resurrect after 4s with 50% base HP and 30% max mana. CD: 300s."
    },
    components: [
      { name: "B.F. Sword", cost: 1300, icon: `${DD}/1038.png` },
      { name: "Cloth Armor", cost: 300, icon: `${DD}/1029.png` },
    ],
    tags: ["AD", "Armor", "Legendary"], category: "Defense", patch: "14.10",
  },
  blade_of_the_ruined_king: {
    id: "blade_of_the_ruined_king", name: "Blade of the Ruined King", cost: 3200, combineCost: 700, icon: `${DD}/3153.png`,
    stats: [{ label: "Attack Damage", value: "+40" }, { label: "Attack Speed", value: "+25%" }, { label: "Life Steal", value: "+8%" }],
    passiveName: "Mist's Edge",
    passive: {
      fr: "Tes attaques de base infligent des dégâts physiques bonus égaux à 9% des PV actuels de la cible. Très efficace contre les tanks.",
      en: "Basic attacks deal bonus physical damage equal to 9% of the target's current HP. Very effective against tanks."
    },
    components: [
      { name: "Bilgewater Cutlass", cost: 1500, icon: `${DD}/3144.png` },
      { name: "Recurve Bow", cost: 1000, icon: `${DD}/1043.png` },
    ],
    tags: ["AD", "Attack Speed", "Life Steal", "Legendary"], category: "Offense", patch: "14.10",
  },
  morellonomicon: {
    id: "morellonomicon", name: "Morellonomicon", cost: 2500, combineCost: 550, icon: `${DD}/3165.png`,
    stats: [{ label: "Ability Power", value: "+80" }, { label: "Health", value: "+300" }],
    passiveName: "Affliction",
    passive: {
      fr: "Les dégâts magiques infligés aux champions ennemis appliquent Blessures Graves, réduisant les soins reçus de 40% pendant 3s.",
      en: "Magic damage dealt to enemy champions applies Grievous Wounds, reducing healing received by 40% for 3s."
    },
    components: [
      { name: "Oblivion Orb", cost: 800, icon: `${DD}/3916.png` },
      { name: "Blasting Wand", cost: 850, icon: `${DD}/1026.png` },
    ],
    tags: ["AP", "Health", "Grievous Wounds", "Legendary"], category: "Offense", patch: "14.10",
  },
  the_collector: {
    id: "the_collector", name: "The Collector", cost: 3000, combineCost: 425, icon: `${DD}/6676.png`,
    stats: [{ label: "Attack Damage", value: "+55" }, { label: "Critical Strike Chance", value: "+25%" }, { label: "Lethality", value: "+12" }],
    passiveName: "Death and Taxes",
    passive: {
      fr: "Si tes dégâts réduisent un champion ennemi en dessous de 5% de ses PV max, il est exécuté. Octroie 25 pièces d'or supplémentaires par élimination.",
      en: "If your damage reduces an enemy champion below 5% max HP, execute them. Grants 25 bonus gold per kill."
    },
    components: [
      { name: "Serrated Dirk", cost: 1100, icon: `${DD}/3134.png` },
      { name: "Pickaxe", cost: 875, icon: `${DD}/1037.png` },
      { name: "Cloak of Agility", cost: 600, icon: `${DD}/1018.png` },
    ],
    tags: ["AD", "Crit", "Lethality", "Legendary"], category: "Offense", patch: "14.10",
  },
  lord_dominiks: {
    id: "lord_dominiks", name: "Lord Dominik's Regards", cost: 3000, combineCost: 650, icon: `${DD}/3036.png`,
    stats: [{ label: "Attack Damage", value: "+35" }, { label: "Critical Strike Chance", value: "+25%" }],
    passiveName: "Giant Slayer",
    passive: {
      fr: "+30% pénétration d'armure. Tu infliges 0-15% de dégâts bonus en fonction de la différence de PV max entre toi et ta cible.",
      en: "+30% armor penetration. Deal 0-15% bonus damage based on max HP difference between you and your target."
    },
    components: [
      { name: "Last Whisper", cost: 1450, icon: `${DD}/3035.png` },
      { name: "Cloak of Agility", cost: 600, icon: `${DD}/1018.png` },
    ],
    tags: ["AD", "Crit", "Armor Pen", "Legendary"], category: "Offense", patch: "14.10",
  },
  mortal_reminder: {
    id: "mortal_reminder", name: "Mortal Reminder", cost: 2600, combineCost: 550, icon: `${DD}/3033.png`,
    stats: [{ label: "Attack Damage", value: "+35" }, { label: "Critical Strike Chance", value: "+25%" }],
    passiveName: "Sepsis",
    passive: {
      fr: "+30% pénétration d'armure. Les dégâts physiques appliquent Blessures Graves (40% réduction de soins) pendant 3s.",
      en: "+30% armor penetration. Physical damage applies Grievous Wounds (40% healing reduction) for 3s."
    },
    components: [
      { name: "Last Whisper", cost: 1450, icon: `${DD}/3035.png` },
      { name: "Executioner's Calling", cost: 800, icon: `${DD}/3123.png` },
    ],
    tags: ["AD", "Crit", "Armor Pen", "Grievous Wounds", "Legendary"], category: "Offense", patch: "14.10",
  },
  bloodthirster: {
    id: "bloodthirster", name: "Bloodthirster", cost: 3400, combineCost: 600, icon: `${DD}/3072.png`,
    stats: [{ label: "Attack Damage", value: "+80" }, { label: "Critical Strike Chance", value: "+25%" }],
    passiveName: "Ichorshield",
    passive: {
      fr: "+18% vol de vie. Le sur-soin crée un bouclier pouvant absorber jusqu'à 50-350 dégâts. Le bouclier se dissipe lentement hors combat.",
      en: "+18% life steal. Overhealing creates a shield absorbing up to 50-350 damage. Shield decays slowly out of combat."
    },
    components: [
      { name: "B.F. Sword", cost: 1300, icon: `${DD}/1038.png` },
      { name: "Cloak of Agility", cost: 600, icon: `${DD}/1018.png` },
      { name: "Vampiric Scepter", cost: 900, icon: `${DD}/1053.png` },
    ],
    tags: ["AD", "Crit", "Life Steal", "Legendary"], category: "Offense", patch: "14.10",
  },
  essence_reaver: {
    id: "essence_reaver", name: "Essence Reaver", cost: 2800, combineCost: 300, icon: `${DD}/3508.png`,
    stats: [{ label: "Attack Damage", value: "+45" }, { label: "Critical Strike Chance", value: "+25%" }, { label: "Ability Haste", value: "+20" }],
    passiveName: "Spellblade",
    passive: {
      fr: "Après avoir utilisé un sort, ta prochaine attaque de base inflige des dégâts physiques bonus et restaure du mana.",
      en: "After casting an ability, your next basic attack deals bonus physical damage and restores mana."
    },
    components: [
      { name: "Sheen", cost: 700, icon: `${DD}/3057.png` },
      { name: "Caulfield's Warhammer", cost: 1100, icon: `${DD}/3133.png` },
    ],
    tags: ["AD", "Crit", "Ability Haste", "Legendary"], category: "Offense", patch: "14.10",
  },
  youmuus: {
    id: "youmuus", name: "Youmuu's Ghostblade", cost: 2800, combineCost: 600, icon: `${DD}/3142.png`,
    stats: [{ label: "Attack Damage", value: "+55" }, { label: "Lethality", value: "+18" }, { label: "Ability Haste", value: "+15" }],
    activeName: "Wraith Step",
    active: {
      fr: "Octroie 20% de vitesse de déplacement et la capacité de traverser les unités pendant 6s.",
      en: "Grants 20% movement speed and the ability to move through units for 6s."
    },
    components: [
      { name: "Serrated Dirk", cost: 1100, icon: `${DD}/3134.png` },
      { name: "Caulfield's Warhammer", cost: 1100, icon: `${DD}/3133.png` },
    ],
    tags: ["AD", "Lethality", "Active", "Legendary"], category: "Offense", patch: "14.10",
  },
  ludens: {
    id: "ludens", name: "Luden's Companion", cost: 2900, combineCost: 550, icon: `${DD}/6655.png`,
    stats: [{ label: "Ability Power", value: "+80" }, { label: "Mana", value: "+600" }, { label: "Ability Haste", value: "+20" }],
    passiveName: "Fire",
    passive: {
      fr: "Charge en se déplaçant et en lançant des sorts. À pleine charge, le prochain sort inflige des dégâts magiques supplémentaires à la cible et jusqu'à 3 ennemis proches.",
      en: "Charges up while moving and casting. At full charge, next ability deals bonus magic damage to target and up to 3 nearby enemies."
    },
    components: [
      { name: "Lost Chapter", cost: 1100, icon: `${DD}/3802.png` },
      { name: "Blasting Wand", cost: 850, icon: `${DD}/1026.png` },
    ],
    tags: ["AP", "Mana", "Ability Haste", "Legendary"], category: "Offense", patch: "14.10",
  },
  liandrys: {
    id: "liandrys", name: "Liandry's Torment", cost: 3000, combineCost: 750, icon: `${DD}/6653.png`,
    stats: [{ label: "Ability Power", value: "+70" }, { label: "Health", value: "+300" }, { label: "Ability Haste", value: "+25" }],
    passiveName: "Torment",
    passive: {
      fr: "Les dégâts de sorts brûlent les ennemis, infligeant des dégâts magiques supplémentaires égaux à un pourcentage de leurs PV max sur 3s. Idéal contre les tanks.",
      en: "Ability damage burns enemies, dealing bonus magic damage based on their max HP over 3s. Ideal against tanks."
    },
    components: [
      { name: "Haunting Guise", cost: 1300, icon: `${DD}/3136.png` },
      { name: "Blasting Wand", cost: 850, icon: `${DD}/1026.png` },
    ],
    tags: ["AP", "Health", "Ability Haste", "Legendary"], category: "Offense", patch: "14.10",
  },
  void_staff: {
    id: "void_staff", name: "Void Staff", cost: 2800, combineCost: 600, icon: `${DD}/3135.png`,
    stats: [{ label: "Ability Power", value: "+65" }],
    passiveName: "Dissolve",
    passive: {
      fr: "+40% pénétration magique. Essentiel quand les ennemis construisent de la résistance magique.",
      en: "+40% magic penetration. Essential when enemies build magic resistance."
    },
    components: [
      { name: "Blighting Jewel", cost: 1250, icon: `${DD}/4630.png` },
      { name: "Amplifying Tome", cost: 435, icon: `${DD}/1052.png` },
    ],
    tags: ["AP", "Magic Pen", "Legendary"], category: "Offense", patch: "14.10",
  },
  nashors_tooth: {
    id: "nashors_tooth", name: "Nashor's Tooth", cost: 3000, combineCost: 700, icon: `${DD}/3115.png`,
    stats: [{ label: "Ability Power", value: "+100" }, { label: "Attack Speed", value: "+50%" }],
    passiveName: "Icathian Bite",
    passive: {
      fr: "Les attaques de base infligent 15 (+20% AP) dégâts magiques supplémentaires. Parfait pour les mages auto-attackers.",
      en: "Basic attacks deal 15 (+20% AP) bonus magic damage on-hit. Perfect for auto-attack mages."
    },
    components: [
      { name: "Recurve Bow", cost: 1000, icon: `${DD}/1043.png` },
      { name: "Blasting Wand", cost: 850, icon: `${DD}/1026.png` },
    ],
    tags: ["AP", "Attack Speed", "Legendary"], category: "Offense", patch: "14.10",
  },
  shadowflame: {
    id: "shadowflame", name: "Shadowflame", cost: 3000, combineCost: 700, icon: `${DD}/4645.png`,
    stats: [{ label: "Ability Power", value: "+100" }, { label: "Magic Penetration", value: "+12" }],
    passiveName: "Cinderbloom",
    passive: {
      fr: "Les dégâts magiques sur les champions dont les PV sont en dessous de 35% ont des chances de faire un coup critique magique.",
      en: "Magic damage to champions below 35% HP can critically strike for bonus magic damage."
    },
    components: [
      { name: "Hextech Alternator", cost: 1050, icon: `${DD}/3145.png` },
      { name: "Needlessly Large Rod", cost: 1250, icon: `${DD}/1058.png` },
    ],
    tags: ["AP", "Magic Pen", "Legendary"], category: "Offense", patch: "14.10",
  },
  banshees: {
    id: "banshees", name: "Banshee's Veil", cost: 2500, combineCost: 400, icon: `${DD}/3102.png`,
    stats: [{ label: "Ability Power", value: "+80" }, { label: "Magic Resist", value: "+45" }, { label: "Ability Haste", value: "+10" }],
    passiveName: "Annul",
    passive: {
      fr: "Un bouclier magique qui bloque le prochain sort ennemi. Se régénère après 40s sans subir de dégâts de champion.",
      en: "A spell shield blocks the next enemy ability. Regenerates after 40s without taking champion damage."
    },
    components: [
      { name: "Verdant Barrier", cost: 1000, icon: `${DD}/4632.png` },
      { name: "Blasting Wand", cost: 850, icon: `${DD}/1026.png` },
    ],
    tags: ["AP", "Magic Resist", "Legendary"], category: "Defense", patch: "14.10",
  },
  lich_bane: {
    id: "lich_bane", name: "Lich Bane", cost: 3000, combineCost: 750, icon: `${DD}/3100.png`,
    stats: [{ label: "Ability Power", value: "+85" }, { label: "Ability Haste", value: "+15" }, { label: "Move Speed", value: "+8%" }],
    passiveName: "Spellblade",
    passive: {
      fr: "Après avoir utilisé un sort, ta prochaine attaque de base inflige des dégâts magiques bonus égaux à 75% de ton AD de base + 50% AP.",
      en: "After casting an ability, next basic attack deals bonus magic damage equal to 75% base AD + 50% AP."
    },
    components: [
      { name: "Sheen", cost: 700, icon: `${DD}/3057.png` },
      { name: "Aether Wisp", cost: 850, icon: `${DD}/3113.png` },
    ],
    tags: ["AP", "Ability Haste", "Legendary"], category: "Offense", patch: "14.10",
  },
  thornmail: {
    id: "thornmail", name: "Thornmail", cost: 2700, combineCost: 750, icon: `${DD}/3075.png`,
    stats: [{ label: "Armor", value: "+70" }, { label: "Health", value: "+350" }],
    passiveName: "Thorns",
    passive: {
      fr: "Quand tu es touché par une attaque de base, inflige des dégâts magiques à l'attaquant et applique Blessures Graves (40%) pendant 3s. L'immobilisation augmente à 60%.",
      en: "When hit by basic attacks, deal magic damage to the attacker and apply Grievous Wounds (40%) for 3s. Immobilizing increases to 60%."
    },
    components: [
      { name: "Bramble Vest", cost: 800, icon: `${DD}/3076.png` },
      { name: "Ruby Crystal", cost: 400, icon: `${DD}/1028.png` },
    ],
    tags: ["Armor", "Health", "Grievous Wounds", "Legendary"], category: "Defense", patch: "14.10",
  },
  randuins: {
    id: "randuins", name: "Randuin's Omen", cost: 2700, combineCost: 600, icon: `${DD}/3143.png`,
    stats: [{ label: "Armor", value: "+60" }, { label: "Health", value: "+400" }],
    activeName: "Humility",
    active: {
      fr: "Réduit la vitesse d'attaque des ennemis proches de 20% et leur vitesse de déplacement de 99% pendant 0.25s.",
      en: "Reduces nearby enemies' attack speed by 20% and movement speed by 99% for 0.25s."
    },
    passiveName: "Rock Solid",
    passive: {
      fr: "Réduit les dégâts des coups critiques entrants de 30%. Réduit les dégâts des attaques de base en fonction de ton armure.",
      en: "Reduces incoming critical strike damage by 30%. Reduces basic attack damage based on your armor."
    },
    components: [
      { name: "Warden's Mail", cost: 1000, icon: `${DD}/3082.png` },
      { name: "Ruby Crystal", cost: 400, icon: `${DD}/1028.png` },
    ],
    tags: ["Armor", "Health", "Active", "Legendary"], category: "Defense", patch: "14.10",
  },
  dead_mans_plate: {
    id: "dead_mans_plate", name: "Dead Man's Plate", cost: 2900, combineCost: 1100, icon: `${DD}/3742.png`,
    stats: [{ label: "Armor", value: "+50" }, { label: "Health", value: "+400" }, { label: "Move Speed", value: "+5%" }],
    passiveName: "Shipwrecker",
    passive: {
      fr: "Accumule de la vélocité en marchant. À 100 stacks, ta prochaine attaque de base inflige des dégâts magiques bonus et ralentit la cible.",
      en: "Build Momentum while moving. At 100 stacks, next basic attack deals bonus magic damage and slows the target."
    },
    components: [
      { name: "Chain Vest", cost: 800, icon: `${DD}/1031.png` },
      { name: "Giant's Belt", cost: 900, icon: `${DD}/1011.png` },
    ],
    tags: ["Armor", "Health", "Legendary"], category: "Defense", patch: "14.10",
  },
  force_of_nature: {
    id: "force_of_nature", name: "Force of Nature", cost: 2800, combineCost: 600, icon: `${DD}/4401.png`,
    stats: [{ label: "Magic Resist", value: "+70" }, { label: "Health", value: "+400" }, { label: "Move Speed", value: "+5%" }],
    passiveName: "Absorb",
    passive: {
      fr: "Subir des dégâts magiques d'un sort te donne un stack. À 6 stacks, gagne +20% vitesse et réduit les dégâts magiques entrants de 25%.",
      en: "Taking magic damage from abilities gives a stack. At 6 stacks, gain +20% move speed and reduce incoming magic damage by 25%."
    },
    components: [
      { name: "Spectre's Cowl", cost: 1250, icon: `${DD}/3211.png` },
      { name: "Winged Moonplate", cost: 800, icon: `${DD}/2015.png` },
    ],
    tags: ["Magic Resist", "Health", "Legendary"], category: "Defense", patch: "14.10",
  },
  spirit_visage: {
    id: "spirit_visage", name: "Spirit Visage", cost: 2900, combineCost: 700, icon: `${DD}/3065.png`,
    stats: [{ label: "Magic Resist", value: "+60" }, { label: "Health", value: "+450" }, { label: "Ability Haste", value: "+10" }],
    passiveName: "Boundless Vitality",
    passive: {
      fr: "Augmente tous les soins et les boucliers reçus de 25%. Parfait sur les champions avec du sustain naturel.",
      en: "Increases all healing and shielding received by 25%. Perfect on champions with built-in sustain."
    },
    components: [
      { name: "Spectre's Cowl", cost: 1250, icon: `${DD}/3211.png` },
      { name: "Kindlegem", cost: 800, icon: `${DD}/3067.png` },
    ],
    tags: ["Magic Resist", "Health", "Ability Haste", "Legendary"], category: "Defense", patch: "14.10",
  },
  warmogs: {
    id: "warmogs", name: "Warmog's Armor", cost: 3000, combineCost: 500, icon: `${DD}/3083.png`,
    stats: [{ label: "Health", value: "+800" }, { label: "Ability Haste", value: "+10" }],
    passiveName: "Warmog's Heart",
    passive: {
      fr: "Si tu as au moins 1100 PV bonus, régénère 5% de tes PV max par seconde hors combat. Permet de se soigner entre les fights.",
      en: "If you have at least 1100 bonus HP, regenerate 5% max HP per second out of combat. Allows healing between fights."
    },
    components: [
      { name: "Giant's Belt", cost: 900, icon: `${DD}/1011.png` },
      { name: "Kindlegem", cost: 800, icon: `${DD}/3067.png` },
      { name: "Ruby Crystal", cost: 400, icon: `${DD}/1028.png` },
    ],
    tags: ["Health", "Ability Haste", "Legendary"], category: "Defense", patch: "14.10",
  },
  mercurys_treads: {
    id: "mercurys_treads", name: "Mercury's Treads", cost: 1100, icon: `${DD}/3111.png`,
    stats: [{ label: "Magic Resist", value: "+25" }, { label: "Move Speed", value: "+45" }],
    passiveName: "Tenacity",
    passive: {
      fr: "+30% ténacité (réduit la durée des contrôles de foule subis). Indispensable contre les compos avec beaucoup de CC.",
      en: "+30% tenacity (reduces duration of crowd control effects). Essential against heavy CC compositions."
    },
    components: [
      { name: "Boots", cost: 300, icon: `${DD}/1001.png` },
      { name: "Null-Magic Mantle", cost: 450, icon: `${DD}/1033.png` },
    ],
    tags: ["Magic Resist", "Boots", "Tenacity"], category: "Boots", patch: "14.10",
  },
  berserkers: {
    id: "berserkers", name: "Berserker's Greaves", cost: 1100, icon: `${DD}/3006.png`,
    stats: [{ label: "Attack Speed", value: "+35%" }, { label: "Move Speed", value: "+45" }],
    components: [
      { name: "Boots", cost: 300, icon: `${DD}/1001.png` },
      { name: "Dagger", cost: 300, icon: `${DD}/1042.png` },
    ],
    tags: ["Attack Speed", "Boots"], category: "Boots", patch: "14.10",
  },
  sorc_shoes: {
    id: "sorc_shoes", name: "Sorcerer's Shoes", cost: 1100, icon: `${DD}/3020.png`,
    stats: [{ label: "Magic Penetration", value: "+15" }, { label: "Move Speed", value: "+45" }],
    components: [
      { name: "Boots", cost: 300, icon: `${DD}/1001.png` },
      { name: "Amplifying Tome", cost: 435, icon: `${DD}/1052.png` },
    ],
    tags: ["Magic Pen", "Boots"], category: "Boots", patch: "14.10",
  },
  ionian_boots: {
    id: "ionian_boots", name: "Ionian Boots of Lucidity", cost: 950, icon: `${DD}/3158.png`,
    stats: [{ label: "Ability Haste", value: "+20" }, { label: "Move Speed", value: "+45" }],
    passive: {
      fr: "Réduit le temps de recharge des sorts d'invocateur de 12%.",
      en: "Reduces summoner spell cooldowns by 12%."
    },
    components: [
      { name: "Boots", cost: 300, icon: `${DD}/1001.png` },
    ],
    tags: ["Ability Haste", "Boots"], category: "Boots", patch: "14.10",
  },
  maw_of_malmortius: {
    id: "maw_of_malmortius", name: "Maw of Malmortius", cost: 2800, combineCost: 600, icon: `${DD}/3156.png`,
    stats: [{ label: "Attack Damage", value: "+55" }, { label: "Magic Resist", value: "+40" }, { label: "Ability Haste", value: "+15" }],
    passiveName: "Lifeline",
    passive: {
      fr: "Quand tu es sur le point de subir des dégâts qui te réduiraient en dessous de 30% PV, octroie un bouclier magique de 200-500. Octroie aussi du vol de vie pendant le bouclier.",
      en: "When about to take damage that would reduce you below 30% HP, gain a 200-500 magic damage shield. Also grants life steal while shielded."
    },
    components: [
      { name: "Hexdrinker", cost: 1300, icon: `${DD}/3155.png` },
      { name: "Caulfield's Warhammer", cost: 1100, icon: `${DD}/3133.png` },
    ],
    tags: ["AD", "Magic Resist", "Ability Haste", "Legendary"], category: "Defense", patch: "14.10",
  },
  steraks_gage: {
    id: "steraks_gage", name: "Sterak's Gage", cost: 3100, combineCost: 725, icon: `${DD}/3053.png`,
    stats: [{ label: "Attack Damage", value: "+50" }, { label: "Health", value: "+400" }],
    passiveName: "Lifeline",
    passive: {
      fr: "Quand tu subis des dégâts qui te réduiraient en dessous de 30% PV, octroie un bouclier basé sur tes PV bonus pendant 3.75s.",
      en: "When taking damage that would reduce you below 30% HP, gain a shield based on your bonus HP for 3.75s."
    },
    components: [
      { name: "Phage", cost: 1100, icon: `${DD}/3044.png` },
      { name: "Long Sword", cost: 350, icon: `${DD}/1036.png` },
      { name: "Ruby Crystal", cost: 400, icon: `${DD}/1028.png` },
    ],
    tags: ["AD", "Health", "Legendary"], category: "Defense", patch: "14.10",
  },
  trinity_force: {
    id: "trinity_force", name: "Trinity Force", cost: 3333, combineCost: 333, icon: `${DD}/3078.png`,
    stats: [{ label: "Attack Damage", value: "+35" }, { label: "Attack Speed", value: "+30%" }, { label: "Ability Haste", value: "+20" }, { label: "Health", value: "+300" }],
    passiveName: "Spellblade",
    passive: {
      fr: "Après avoir utilisé un sort, ta prochaine attaque de base inflige 200% de dégâts d'AD de base en bonus. Octroie aussi de la vitesse de déplacement.",
      en: "After casting an ability, next basic attack deals 200% base AD as bonus damage. Also grants movement speed."
    },
    components: [
      { name: "Sheen", cost: 700, icon: `${DD}/3057.png` },
      { name: "Phage", cost: 1100, icon: `${DD}/3044.png` },
      { name: "Hearthbound Axe", cost: 1100, icon: `${DD}/1037.png` },
    ],
    tags: ["AD", "Attack Speed", "Ability Haste", "Health", "Legendary"], category: "Offense", patch: "14.10",
  },
  redemption: {
    id: "redemption", name: "Redemption", cost: 2300, combineCost: 400, icon: `${DD}/3107.png`,
    stats: [{ label: "Health", value: "+200" }, { label: "Mana Regen", value: "+100%" }, { label: "Heal & Shield Power", value: "+15%" }],
    activeName: "Intervention",
    active: {
      fr: "Après un délai de 2.5s, une zone ciblée soigne les alliés et inflige des dégâts aux ennemis. Peut être utilisé même mort.",
      en: "After a 2.5s delay, heal allies and deal damage to enemies in target area. Can be used while dead."
    },
    components: [
      { name: "Forbidden Idol", cost: 800, icon: `${DD}/3114.png` },
      { name: "Kindlegem", cost: 800, icon: `${DD}/3067.png` },
    ],
    tags: ["Health", "Heal & Shield", "Active", "Support"], category: "Support", patch: "14.10",
  },
  frozen_heart: {
    id: "frozen_heart", name: "Frozen Heart", cost: 2500, combineCost: 500, icon: `${DD}/3110.png`,
    stats: [{ label: "Armor", value: "+80" }, { label: "Mana", value: "+400" }, { label: "Ability Haste", value: "+20" }],
    passiveName: "Winter's Caress",
    passive: {
      fr: "Réduit la vitesse d'attaque des ennemis proches de 20%. Réduit les dégâts des attaques de base entrantes d'un montant fixe.",
      en: "Reduces nearby enemies' attack speed by 20%. Reduces incoming basic attack damage by a flat amount."
    },
    components: [
      { name: "Warden's Mail", cost: 1000, icon: `${DD}/3082.png` },
      { name: "Glacial Buckler", cost: 900, icon: `${DD}/3024.png` },
    ],
    tags: ["Armor", "Mana", "Ability Haste", "Legendary"], category: "Defense", patch: "14.10",
  },
  gargoyle_stoneplate: {
    id: "gargoyle_stoneplate", name: "Gargoyle Stoneplate", cost: 3200, combineCost: 700, icon: `${DD}/3193.png`,
    stats: [{ label: "Armor", value: "+60" }, { label: "Magic Resist", value: "+60" }, { label: "Ability Haste", value: "+15" }],
    activeName: "Fortify",
    active: {
      fr: "Octroie un bouclier décroissant de 100 (+100% PV bonus) pendant 2.5s. Parfait pour initier les teamfights.",
      en: "Gain a decaying shield of 100 (+100% bonus HP) for 2.5s. Perfect for initiating teamfights."
    },
    components: [
      { name: "Chain Vest", cost: 800, icon: `${DD}/1031.png` },
      { name: "Null-Magic Mantle", cost: 450, icon: `${DD}/1033.png` },
      { name: "Aegis of the Legion", cost: 1200, icon: `${DD}/3105.png` },
    ],
    tags: ["Armor", "Magic Resist", "Active", "Legendary"], category: "Defense", patch: "14.10",
  },
};

export const getItem = (id: string): GameItem | undefined => ITEMS[id];
export const getAllItems = (): GameItem[] => Object.values(ITEMS);

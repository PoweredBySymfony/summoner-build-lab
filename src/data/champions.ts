export interface Champion {
  id: string;
  name: string;
  icon: string;
  roles: string[];
  damageType: "AD" | "AP" | "Mixed" | "True";
  threat: { fr: string; en: string };
  tags: string[];
}

const C = "https://ddragon.leagueoflegends.com/cdn/14.10.1/img/champion";

export const CHAMPIONS: Record<string, Champion> = {
  jinx: { id: "jinx", name: "Jinx", icon: `${C}/Jinx.png`, roles: ["ADC"], damageType: "AD", threat: { fr: "DPS élevé", en: "High DPS" }, tags: ["Crit", "Hypercarry", "Late"] },
  lux: { id: "lux", name: "Lux", icon: `${C}/Lux.png`, roles: ["Support", "Mid"], damageType: "AP", threat: { fr: "Burst / CC", en: "Burst / CC" }, tags: ["Burst", "CC", "Poke"] },
  darius: { id: "darius", name: "Darius", icon: `${C}/Darius.png`, roles: ["Top"], damageType: "AD", threat: { fr: "Bruiser all-in", en: "All-in bruiser" }, tags: ["Bruiser", "Juggernaut"] },
  ahri: { id: "ahri", name: "Ahri", icon: `${C}/Ahri.png`, roles: ["Mid"], damageType: "AP", threat: { fr: "Burst / Pick", en: "Burst / Pick" }, tags: ["Burst", "Assassin", "Mobile"] },
  leona: { id: "leona", name: "Leona", icon: `${C}/Leona.png`, roles: ["Support"], damageType: "Mixed", threat: { fr: "Engage / CC", en: "Engage / CC" }, tags: ["Tank", "Engage", "CC"] },
  yasuo: { id: "yasuo", name: "Yasuo", icon: `${C}/Yasuo.png`, roles: ["Mid", "ADC"], damageType: "AD", threat: { fr: "DPS Crit / Windwall", en: "Crit DPS / Windwall" }, tags: ["Crit", "Melee", "DPS"] },
  thresh: { id: "thresh", name: "Thresh", icon: `${C}/Thresh.png`, roles: ["Support"], damageType: "Mixed", threat: { fr: "CC / Peel", en: "CC / Peel" }, tags: ["CC", "Peel", "Engage"] },
  kaisa: { id: "kaisa", name: "Kai'Sa", icon: `${C}/Kaisa.png`, roles: ["ADC"], damageType: "Mixed", threat: { fr: "Burst / DPS hybride", en: "Hybrid burst / DPS" }, tags: ["Hybrid", "Burst", "DPS"] },
  zed: { id: "zed", name: "Zed", icon: `${C}/Zed.png`, roles: ["Mid"], damageType: "AD", threat: { fr: "Assassin / Burst AD", en: "AD Assassin / Burst" }, tags: ["Assassin", "Burst", "Lethality"] },
  malphite: { id: "malphite", name: "Malphite", icon: `${C}/Malphite.png`, roles: ["Top", "Support"], damageType: "Mixed", threat: { fr: "Engage / Tank", en: "Engage / Tank" }, tags: ["Tank", "Engage", "Armor"] },
  vayne: { id: "vayne", name: "Vayne", icon: `${C}/Vayne.png`, roles: ["ADC", "Top"], damageType: "AD", threat: { fr: "DPS % PV max / Anti-tank", en: "% Max HP DPS / Anti-tank" }, tags: ["DPS", "Anti-tank", "True Damage"] },
  syndra: { id: "syndra", name: "Syndra", icon: `${C}/Syndra.png`, roles: ["Mid"], damageType: "AP", threat: { fr: "Burst AP massif", en: "Massive AP burst" }, tags: ["Burst", "CC", "Zoning"] },
  lee_sin: { id: "lee_sin", name: "Lee Sin", icon: `${C}/LeeSin.png`, roles: ["Jungle"], damageType: "AD", threat: { fr: "Early aggro / Pick", en: "Early aggro / Pick" }, tags: ["Bruiser", "Mobile", "Early"] },
  nautilus: { id: "nautilus", name: "Nautilus", icon: `${C}/Nautilus.png`, roles: ["Support"], damageType: "AP", threat: { fr: "CC massif / Engage", en: "Heavy CC / Engage" }, tags: ["Tank", "CC", "Engage"] },
  caitlyn: { id: "caitlyn", name: "Caitlyn", icon: `${C}/Caitlyn.png`, roles: ["ADC"], damageType: "AD", threat: { fr: "Poke / Siège", en: "Poke / Siege" }, tags: ["Crit", "Poke", "Lane Bully"] },
  orianna: { id: "orianna", name: "Orianna", icon: `${C}/Orianna.png`, roles: ["Mid"], damageType: "AP", threat: { fr: "Teamfight / Zone", en: "Teamfight / Zone" }, tags: ["Control Mage", "CC", "Teamfight"] },
  jax: { id: "jax", name: "Jax", icon: `${C}/Jax.png`, roles: ["Top", "Jungle"], damageType: "Mixed", threat: { fr: "Duelliste / Split-push", en: "Duelist / Split-push" }, tags: ["Bruiser", "Duelist", "Late"] },
  viego: { id: "viego", name: "Viego", icon: `${C}/Viego.png`, roles: ["Jungle", "Mid"], damageType: "AD", threat: { fr: "Reset / Sustain", en: "Reset / Sustain" }, tags: ["Assassin", "Bruiser", "Sustain"] },
  lulu: { id: "lulu", name: "Lulu", icon: `${C}/Lulu.png`, roles: ["Support"], damageType: "AP", threat: { fr: "Enchanteur / Peel", en: "Enchanter / Peel" }, tags: ["Enchanter", "Peel", "Shield"] },
  garen: { id: "garen", name: "Garen", icon: `${C}/Garen.png`, roles: ["Top"], damageType: "AD", threat: { fr: "Tanky DPS", en: "Tanky DPS" }, tags: ["Juggernaut", "Tank", "Simple"] },
  katarina: { id: "katarina", name: "Katarina", icon: `${C}/Katarina.png`, roles: ["Mid"], damageType: "Mixed", threat: { fr: "Reset / Burst AoE", en: "Reset / AoE burst" }, tags: ["Assassin", "Burst", "Reset"] },
  ezreal: { id: "ezreal", name: "Ezreal", icon: `${C}/Ezreal.png`, roles: ["ADC"], damageType: "Mixed", threat: { fr: "Poke AD / Sûr", en: "AD Poke / Safe" }, tags: ["Poke", "Safe", "Hybrid"] },
  vi: { id: "vi", name: "Vi", icon: `${C}/Vi.png`, roles: ["Jungle"], damageType: "AD", threat: { fr: "Dive / Pick", en: "Dive / Pick" }, tags: ["Bruiser", "Engage", "Dive"] },
  soraka: { id: "soraka", name: "Soraka", icon: `${C}/Soraka.png`, roles: ["Support"], damageType: "AP", threat: { fr: "Soins massifs", en: "Massive heals" }, tags: ["Enchanter", "Heal", "Sustain"] },
  renekton: { id: "renekton", name: "Renekton", icon: `${C}/Renekton.png`, roles: ["Top"], damageType: "AD", threat: { fr: "Lane bully / Early", en: "Lane bully / Early" }, tags: ["Bruiser", "Early", "Lane Bully"] },
  senna: { id: "senna", name: "Senna", icon: `${C}/Senna.png`, roles: ["Support", "ADC"], damageType: "AD", threat: { fr: "Utility ADC / Soins", en: "Utility ADC / Heals" }, tags: ["ADC", "Heal", "Poke"] },
  veigar: { id: "veigar", name: "Veigar", icon: `${C}/Veigar.png`, roles: ["Mid"], damageType: "AP", threat: { fr: "Scaling AP infini", en: "Infinite AP scaling" }, tags: ["Burst", "Scaling", "CC"] },
  miss_fortune: { id: "miss_fortune", name: "Miss Fortune", icon: `${C}/MissFortune.png`, roles: ["ADC"], damageType: "AD", threat: { fr: "Ult teamfight / Burst", en: "Teamfight ult / Burst" }, tags: ["Burst", "Teamfight", "Lethality"] },
  sett: { id: "sett", name: "Sett", icon: `${C}/Sett.png`, roles: ["Top", "Support"], damageType: "AD", threat: { fr: "Bruiser / Anti-front", en: "Bruiser / Anti-front" }, tags: ["Bruiser", "Juggernaut", "CC"] },
  yone: { id: "yone", name: "Yone", icon: `${C}/Yone.png`, roles: ["Mid", "Top"], damageType: "Mixed", threat: { fr: "Crit DPS / Dive", en: "Crit DPS / Dive" }, tags: ["Crit", "DPS", "Dive"] },
  kayn: { id: "kayn", name: "Kayn", icon: `${C}/Kayn.png`, roles: ["Jungle"], damageType: "AD", threat: { fr: "Assassin ou Bruiser", en: "Assassin or Bruiser" }, tags: ["Assassin", "Bruiser", "Flexible"] },
  morgana: { id: "morgana", name: "Morgana", icon: `${C}/Morgana.png`, roles: ["Support", "Mid"], damageType: "AP", threat: { fr: "CC / Anti-engage", en: "CC / Anti-engage" }, tags: ["CC", "Anti-Engage", "Shield"] },
  draven: { id: "draven", name: "Draven", icon: `${C}/Draven.png`, roles: ["ADC"], damageType: "AD", threat: { fr: "Snowball / Lane bully", en: "Snowball / Lane bully" }, tags: ["DPS", "Snowball", "Lane Bully"] },
  nasus: { id: "nasus", name: "Nasus", icon: `${C}/Nasus.png`, roles: ["Top"], damageType: "AD", threat: { fr: "Scaling infini / Split", en: "Infinite scaling / Split" }, tags: ["Juggernaut", "Scaling", "Split Push"] },
  lissandra: { id: "lissandra", name: "Lissandra", icon: `${C}/Lissandra.png`, roles: ["Mid"], damageType: "AP", threat: { fr: "CC / Engage AP", en: "CC / AP Engage" }, tags: ["Control Mage", "CC", "Engage"] },
  fiora: { id: "fiora", name: "Fiora", icon: `${C}/Fiora.png`, roles: ["Top"], damageType: "AD", threat: { fr: "Duelliste / True damage", en: "Duelist / True damage" }, tags: ["Duelist", "True Damage", "Split Push"] },
  twisted_fate: { id: "twisted_fate", name: "Twisted Fate", icon: `${C}/TwistedFate.png`, roles: ["Mid"], damageType: "AP", threat: { fr: "Roam / Pick global", en: "Roam / Global pick" }, tags: ["Roam", "CC", "Global"] },
  camille: { id: "camille", name: "Camille", icon: `${C}/Camille.png`, roles: ["Top"], damageType: "Mixed", threat: { fr: "Dive / True damage", en: "Dive / True damage" }, tags: ["Bruiser", "Dive", "True Damage"] },
  aphelios: { id: "aphelios", name: "Aphelios", icon: `${C}/Aphelios.png`, roles: ["ADC"], damageType: "AD", threat: { fr: "DPS complexe / Teamfight", en: "Complex DPS / Teamfight" }, tags: ["Crit", "DPS", "Complex"] },
  brand: { id: "brand", name: "Brand", icon: `${C}/Brand.png`, roles: ["Support", "Mid"], damageType: "AP", threat: { fr: "Burst AoE / % PV", en: "AoE burst / % HP" }, tags: ["Burst", "AoE", "Damage"] },
  volibear: { id: "volibear", name: "Volibear", icon: `${C}/Volibear.png`, roles: ["Top", "Jungle"], damageType: "Mixed", threat: { fr: "Tank / Dive tour", en: "Tank / Tower dive" }, tags: ["Tank", "Bruiser", "Dive"] },
  aatrox: { id: "aatrox", name: "Aatrox", icon: `${C}/Aatrox.png`, roles: ["Top"], damageType: "AD", threat: { fr: "Drain tank / Sustain", en: "Drain tank / Sustain" }, tags: ["Bruiser", "Sustain", "Teamfight"] },
  graves: { id: "graves", name: "Graves", icon: `${C}/Graves.png`, roles: ["Jungle"], damageType: "AD", threat: { fr: "Burst / Résistant", en: "Burst / Durable" }, tags: ["Burst", "Bruiser", "Lethality"] },
  yuumi: { id: "yuumi", name: "Yuumi", icon: `${C}/Yuumi.png`, roles: ["Support"], damageType: "AP", threat: { fr: "Buff / Intargetable", en: "Buff / Untargetable" }, tags: ["Enchanter", "Heal", "Buff"] },
  hecarim: { id: "hecarim", name: "Hecarim", icon: `${C}/Hecarim.png`, roles: ["Jungle"], damageType: "AD", threat: { fr: "Engage rapide / Burst", en: "Fast engage / Burst" }, tags: ["Bruiser", "Engage", "Mobile"] },
  samira: { id: "samira", name: "Samira", icon: `${C}/Samira.png`, roles: ["ADC"], damageType: "AD", threat: { fr: "All-in / Reset", en: "All-in / Reset" }, tags: ["Crit", "Burst", "All-in"] },
  kassadin: { id: "kassadin", name: "Kassadin", icon: `${C}/Kassadin.png`, roles: ["Mid"], damageType: "AP", threat: { fr: "Hypercarry AP / Late", en: "AP Hypercarry / Late" }, tags: ["Assassin", "Scaling", "Mobile"] },
};

export const getChampion = (id: string): Champion | undefined => CHAMPIONS[id];
export const getAllChampions = (): Champion[] => Object.values(CHAMPIONS);

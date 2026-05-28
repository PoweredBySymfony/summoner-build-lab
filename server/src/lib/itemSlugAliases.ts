export const itemSlugAliases: Record<string, string> = {
  "abyssal-mask": "masque-abyssal",
  "ardent-censer": "encensoir-ardent",
  "banshees-veil": "voile-de-la-banshee",
  "black-cleaver": "couperet-noir",
  "blackfire-torch": "torche-noire",
  "bloodthirster": "soif-de-sang",
  "chempunk-chainsword": "epee-dentelee-chimico-punk",
  "cosmic-drive": "volonte-cosmique",
  "dead-mans-plate": "plaque-du-mort",
  "force-of-nature": "force-de-la-nature",
  "frozen-heart": "c-ur-gele",
  "guardian-angel": "ange-gardien",
  "hollow-radiance": "rayonnement-du-vide",
  "infinity-edge": "lame-dinfini",
  "kaenic-rookern": "rookern-kaenique",
  "knights-vow": "v-u-du-chevalier",
  "kraken-slayer": "tueur-de-krakens",
  "liandrys-torment": "tourment-de-liandry",
  "locket-of-the-iron-solari": "medaillon-de-liron-solari",
  "lord-dominiks-regards": "salutations-de-dominik",
  "ludens-companion": "echo-de-luden",
  "maw-of-malmortius": "gueule-de-malmortius",
  "mercurys-treads": "sandales-de-mercure",
  "mortal-reminder": "rappel-mortel",
  "moonstone-renewer": "regenerateur-de-pierre-de-lune",
  "null-magic-mantle": "cape-de-neant",
  "plated-steelcaps": "coques-en-acier",
  "rabadons-deathcap": "coiffe-de-rabadon",
  "randuins-omen": "presage-de-randuin",
  "runaans-hurricane": "ouragan-de-runaan",
  "shadowflame": "flamme-ombre",
  "shurelyas-battlesong": "chant-de-guerre-de-shurelya",
  "sorcerers-shoes": "chaussures-de-sorcier",
  "spirit-visage": "visage-spirituel",
  "staff-of-flowing-water": "baton-des-flots",
  "steraks-gage": "gage-de-sterak",
  "stormsurge": "onde-orageuse",
  "sunfire-aegis": "egide-solaire",
  "thornmail": "armure-ronciere",
  "trailblazer": "traineau-du-solstice",
  "void-staff": "baton-du-vide",
  "warmogs-armor": "armure-de-warmog",
  "wits-end": "au-bout-du-rouleau",
  "zhonyas-hourglass": "sablier-de-zhonya",
};

function stripDynamicSuffix(slug: string) {
  return slug.replace(/-\d+(?:-\d+)*$/u, "");
}

export function resolveItemSlug(slug: string) {
  const resolved = itemSlugAliases[slug] ?? slug;
  return stripDynamicSuffix(resolved);
}

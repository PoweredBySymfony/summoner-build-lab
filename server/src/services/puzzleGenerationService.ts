import { GeneratedPuzzleRequestStatus, GeneratedPuzzleRequestType, Prisma, PuzzleChoiceType, PuzzleDifficulty, PuzzleMode, PuzzleSourceType, Role } from "@prisma/client";
import { resolveItemSlug } from "../lib/itemSlugAliases.js";
import { prisma } from "../lib/prisma.js";
import { slugify } from "../lib/slug.js";
import { HttpError } from "../utils/http.js";

type ChampionArchetype = "marksman" | "mage" | "fighter" | "tank" | "support";
type ScenarioSlot = "TOP" | "JUNGLE" | "MID" | "ADC" | "SUPPORT";

type ScenarioVariant = {
  key: string;
  title: string;
  shortPrompt: string;
  situation: string;
  question: string;
  explanation: string;
  tags: string[];
  minute: number;
  gold: number;
  currentBuild: string[];
  choices: string[];
  correctChoice: string;
  enemyItems: Partial<Record<ScenarioSlot, string[]>>;
  objectiveState: Record<string, string | boolean | number>;
  damageProfile: Record<string, string>;
  mapState: Record<string, string | boolean>;
  notes: string;
};

type ScenarioMember = {
  championSlug: string;
  role: ScenarioSlot;
  items: string[];
  note?: string;
};

type ScenarioStoredItem = {
  itemId: string;
  riotItemId: number;
  itemSlug: string;
};

type ScenarioStoredMember = {
  championId: string;
  riotChampionId: number | null;
  championKey: string | null;
  championSlug: string;
  role: ScenarioSlot;
  items: ScenarioStoredItem[];
  note?: string;
};

type GeneratedSeriesPayload = {
  slug: string;
  slugs: string[];
};

const scenarioSlots: ScenarioSlot[] = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];

const slotPools: Record<ScenarioSlot, string[]> = {
  TOP: ["aatrox", "camille", "ornn", "ksante", "gwen", "malphite", "darius", "renekton"],
  JUNGLE: ["vi", "viego", "lillia", "lee-sin", "sejuani", "jarvan-iv", "wukong", "maokai"],
  MID: ["ahri", "orianna", "syndra", "veigar", "viktor", "azir", "sylas", "zed"],
  ADC: ["jinx", "kaisa", "ezreal", "xayah", "ashe", "smolder", "caitlyn", "aphelios"],
  SUPPORT: ["nautilus", "leona", "thresh", "rakan", "lulu", "milio", "soraka", "rell"],
};

const slotRoleLabels: Record<ScenarioSlot, string> = {
  TOP: "Top",
  JUNGLE: "Jungle",
  MID: "Mid",
  ADC: "ADC",
  SUPPORT: "Support",
};

const championRoleOverrides: Partial<Record<string, ScenarioSlot>> = {
  "jarvan-iv": "JUNGLE",
  "lee-sin": "JUNGLE",
  lillia: "JUNGLE",
  maokai: "JUNGLE",
  rell: "SUPPORT",
  sejuani: "JUNGLE",
  vi: "JUNGLE",
  viego: "JUNGLE",
  wukong: "JUNGLE",
};

const defaultSlotItems: Record<ScenarioSlot, string[]> = {
  TOP: ["plated-steelcaps", "sunfire-aegis"],
  JUNGLE: ["plated-steelcaps", "black-cleaver"],
  MID: ["zhonyas-hourglass", "shadowflame"],
  ADC: ["infinity-edge", "bloodthirster"],
  SUPPORT: ["locket-of-the-iron-solari", "knights-vow"],
};

const archetypeVariants: Record<ChampionArchetype, ScenarioVariant[]> = {
  marksman: [
    {
      key: "frontline-armor",
      title: "Percer la front line",
      shortPrompt: "Deux tanks adverses ont déjà de l'armure et le prochain combat se joue en front-to-back.",
      situation: "La front line adverse empile l'armure et ton équipe a besoin que tu tombes les tanks avant de pouvoir accéder au backline.",
      question: "Quel achat maximise vraiment ton impact au prochain fight ?",
      explanation: "La pénétration d'armure est ici la réponse disciplinée. Tu dois d'abord passer la première ligne avant de penser au luxe.",
      tags: ["otp", "front-to-back", "pénétration", "teamfight"],
      minute: 24,
      gold: 3100,
      currentBuild: ["kraken-slayer", "runaans-hurricane"],
      choices: ["lord-dominiks-regards", "infinity-edge", "bloodthirster", "guardian-angel"],
      correctChoice: "lord-dominiks-regards",
      enemyItems: { TOP: ["plated-steelcaps", "thornmail", "sunfire-aegis"], JUNGLE: ["frozen-heart", "plated-steelcaps"] },
      objectiveState: { prochainObjectif: "Dragon", contesté: true, soulPointAdverse: true },
      damageProfile: { physique: "élevé", magique: "moyen" },
      mapState: { tempo: "combat groupé", prioritéMid: true },
      notes: "Lecture OTP axée ADC: si tu ne coupes pas la première ligne, tu n'auras pas de fenêtre propre sur les carries.",
    },
    {
      key: "anti-heal",
      title: "Punir la sustain adverse",
      shortPrompt: "Les trades s'allongent et la sustain ennemie retourne les escarmouches.",
      situation: "Le duo frontline + support adverse rallonge chaque fight, et sans blessures graves tes dégâts ne se convertissent pas.",
      question: "Quel achat stabilise le mieux le prochain enchaînement d'objectifs ?",
      explanation: "Les blessures graves sont ici une taxe obligatoire. Sans ça, tu laisses la sustain annuler ton avantage de DPS.",
      tags: ["otp", "anti-heal", "tempo", "objectif"],
      minute: 22,
      gold: 2800,
      currentBuild: ["kraken-slayer", "runaans-hurricane"],
      choices: ["mortal-reminder", "infinity-edge", "bloodthirster", "guardian-angel"],
      correctChoice: "mortal-reminder",
      enemyItems: { TOP: ["spirit-visage", "plated-steelcaps"], SUPPORT: ["moonstone-renewer", "redemption"] },
      objectiveState: { prochainObjectif: "Héraut / Nashor", contesté: true, fightLong: true },
      damageProfile: { physique: "moyen", magique: "moyen" },
      mapState: { tempo: "escarmouches longues", sideWave: "neutre" },
      notes: "La question n'est pas le plafond de dégâts théorique, mais la capacité à empêcher la sustain ennemie de casser le rythme.",
    },
    {
      key: "anti-burst",
      title: "Rester vivant contre la dive",
      shortPrompt: "Le problème n'est plus de DPS mais de survivre à l'engage initial.",
      situation: "La compo ennemie a suffisamment de backline access pour te sortir du fight avant ton second cycle d'auto-attacks.",
      question: "Quel achat garde ton plan de jeu en ligne sans te transformer en spectateur ?",
      explanation: "La valeur de survie est prioritaire parce qu'un carry mort à l'ouverture n'apporte aucun DPS.",
      tags: ["otp", "survie", "dive", "discipline"],
      minute: 27,
      gold: 3000,
      currentBuild: ["kraken-slayer", "runaans-hurricane", "lord-dominiks-regards"],
      choices: ["guardian-angel", "infinity-edge", "bloodthirster", "wits-end"],
      correctChoice: "guardian-angel",
      enemyItems: { TOP: ["dead-mans-plate", "trailblazer"], JUNGLE: ["black-cleaver", "steraks-gage"], MID: ["stormsurge", "zhonyas-hourglass"] },
      objectiveState: { prochainObjectif: "Nashor", contesté: true, flancsAdverses: true },
      damageProfile: { physique: "élevé", magique: "élevé" },
      mapState: { tempo: "engage explosif", visionLateral: "faible" },
      notes: "Quand la dive est garantie, la meilleure décision n'est pas toujours le plus gros chiffre sur la fiche d'item.",
    },
    {
      key: "mixed-damage",
      title: "Répondre au burst AP",
      shortPrompt: "La menace principale vient du burst magique et de la portée adverse.",
      situation: "Tu peux jouer le fight si tu encaisses la première rotation magique, sinon tu n'as jamais le temps d'installer ton DPS.",
      question: "Quel achat est le plus cohérent dans ce contexte ?",
      explanation: "Tu achètes le droit de rester dans le fight face à la menace magique dominante.",
      tags: ["otp", "ap-burst", "survie", "positionnement"],
      minute: 25,
      gold: 2900,
      currentBuild: ["kraken-slayer", "runaans-hurricane", "bloodthirster"],
      choices: ["wits-end", "infinity-edge", "guardian-angel", "lord-dominiks-regards"],
      correctChoice: "wits-end",
      enemyItems: { MID: ["shadowflame", "stormsurge", "zhonyas-hourglass"], SUPPORT: ["shurelyas-battlesong", "ardent-censer"] },
      objectiveState: { prochainObjectif: "Dragon", contesté: true, zoneEtroite: true },
      damageProfile: { physique: "moyen", magique: "élevé" },
      mapState: { tempo: "poke puis engage", contrôleVision: "adverse" },
      notes: "Cette lecture force à arbitrer entre dégâts purs et stabilité réelle sur le fight suivant.",
    },
    {
      key: "closing-damage",
      title: "Fermer la partie proprement",
      shortPrompt: "Tu as déjà les réponses défensives, il faut maintenant convertir l'avance en dégâts fiables.",
      situation: "L'équipe adverse n'a pas encore de réponse complète à ton DPS, mais la fenêtre de domination se referme.",
      question: "Quel achat est le meilleur pour accélérer la fermeture de partie ?",
      explanation: "Une fois les réponses utilitaires achetées, il faut savoir revenir sur un gros pic de dégâts pour convertir l'avantage.",
      tags: ["otp", "powerspike", "conversion", "snowball"],
      minute: 28,
      gold: 3400,
      currentBuild: ["kraken-slayer", "runaans-hurricane", "lord-dominiks-regards", "guardian-angel"],
      choices: ["infinity-edge", "bloodthirster", "mortal-reminder", "wits-end"],
      correctChoice: "infinity-edge",
      enemyItems: { TOP: ["sunfire-aegis", "thornmail"], ADC: ["bloodthirster", "infinity-edge"] },
      objectiveState: { prochainObjectif: "Nashor", contesté: false, avantageCarte: true },
      damageProfile: { physique: "élevé", magique: "moyen" },
      mapState: { tempo: "siège / Nashor", vaguesPoussées: true },
      notes: "Le bon choix peut aussi être agressif, à condition que les menaces critiques aient déjà été couvertes.",
    },
  ],
  mage: [
    {
      key: "mr-breakpoint",
      title: "Passer les seuils de résistance magique",
      shortPrompt: "Les cibles prioritaires ont atteint le seuil où la pénétration devient obligatoire.",
      situation: "Sans pénétration magique réelle, tu conserves du burst sur papier mais tu perds tes fenêtres de kill sur les cibles utiles.",
      question: "Quel achat redonne immédiatement de la valeur à ton cycle de sorts ?",
      explanation: "Une fois la MR installée, l'AP brut seul ne suffit plus. Tu dois rétablir ton létal sur les cibles prioritaires.",
      tags: ["otp", "mr", "burst", "objectif"],
      minute: 23,
      gold: 2850,
      currentBuild: ["blackfire-torch", "shadowflame"],
      choices: ["void-staff", "rabadons-deathcap", "zhonyas-hourglass", "banshees-veil"],
      correctChoice: "void-staff",
      enemyItems: { TOP: ["kaenic-rookern", "mercurys-treads"], MID: ["banshees-veil", "mercurys-treads"] },
      objectiveState: { prochainObjectif: "Dragon", contesté: true, teamfightDécisif: true },
      damageProfile: { physique: "moyen", magique: "moyen" },
      mapState: { tempo: "burst sur pick", contrôleRiver: "contesté" },
      notes: "Le bon achat ne sert pas à afficher plus d'AP, mais à retrouver un seuil de létalité réaliste.",
    },
    {
      key: "anti-dive",
      title: "Respecter la dive adverse",
      shortPrompt: "Tu restes la principale source de burst, mais on joue désormais pour te forcer défensivement.",
      situation: "Le prochain fight se joue autour de ta capacité à survivre au premier engage sans perdre ta zone d'influence.",
      question: "Quel achat est le plus discipliné ici ?",
      explanation: "Si tu meurs avant ton deuxième sort clé, ton build offensif ne sert à rien.",
      tags: ["otp", "survie", "dive", "tempo"],
      minute: 24,
      gold: 3000,
      currentBuild: ["blackfire-torch", "shadowflame"],
      choices: ["zhonyas-hourglass", "rabadons-deathcap", "void-staff", "banshees-veil"],
      correctChoice: "zhonyas-hourglass",
      enemyItems: { JUNGLE: ["black-cleaver", "steraks-gage"], SUPPORT: ["locket-of-the-iron-solari", "knights-vow"] },
      objectiveState: { prochainObjectif: "Nashor", contesté: true, flankAdverse: true },
      damageProfile: { physique: "élevé", magique: "moyen" },
      mapState: { tempo: "engage frontal", visionLateral: "menacée" },
      notes: "Une mage OTP doit savoir reconnaître quand le meilleur gain de DPS passe d'abord par la survie.",
    },
    {
      key: "anti-heal",
      title: "Couper les soins avant le reset",
      shortPrompt: "La sustain ennemie déforme trop les teamfights pour être ignorée.",
      situation: "Tes dégâts touchent, mais les reset de soin empêchent ton équipe de convertir les picks en objectif.",
      question: "Quel achat répond le plus proprement à ce pattern ?",
      explanation: "Les blessures graves sont prioritaires parce que le problème du fight n'est pas le manque de dégâts bruts.",
      tags: ["otp", "anti-heal", "macro", "teamfight"],
      minute: 21,
      gold: 2200,
      currentBuild: ["blackfire-torch", "sorcerers-shoes"],
      choices: ["morellonomicon", "shadowflame", "rabadons-deathcap", "void-staff"],
      correctChoice: "morellonomicon",
      enemyItems: { TOP: ["spirit-visage", "sunfire-aegis"], SUPPORT: ["moonstone-renewer", "redemption"] },
      objectiveState: { prochainObjectif: "Dragon", contesté: true, resetSoin: true },
      damageProfile: { physique: "moyen", magique: "moyen" },
      mapState: { tempo: "front-to-back", duréeFight: "longue" },
      notes: "La bonne lecture ici est macro: il faut rendre les dégâts déjà présents réellement décisifs.",
    },
    {
      key: "long-fight",
      title: "Punir les barres de PV",
      shortPrompt: "Le fight s'allonge et les cibles devant tiennent trop longtemps.",
      situation: "Tu peux rester à portée sur la durée, mais tes dégâts doivent mieux se projeter sur des cibles plus épaisses.",
      question: "Quel achat est le plus cohérent pour cette phase de partie ?",
      explanation: "Quand le combat s'étire contre des PV élevés, l'achat brûlure / DPS soutenu prend plus de valeur qu'un pur one-shot raté.",
      tags: ["otp", "long-fight", "frontline", "dps"],
      minute: 26,
      gold: 3000,
      currentBuild: ["shadowflame", "zhonyas-hourglass"],
      choices: ["liandrys-torment", "rabadons-deathcap", "banshees-veil", "stormsurge"],
      correctChoice: "liandrys-torment",
      enemyItems: { TOP: ["kaenic-rookern", "warmogs-armor"], JUNGLE: ["hollow-radiance", "spirit-visage"] },
      objectiveState: { prochainObjectif: "Nashor", contesté: true, frontlineAdverse: "épaisse" },
      damageProfile: { physique: "moyen", magique: "moyen" },
      mapState: { tempo: "fight étiré", espace: "restreint" },
      notes: "Cette variante apprend à distinguer un besoin de DPS soutenu d'une simple envie de gros chiffre.",
    },
    {
      key: "close-game",
      title: "Transformer l'avance en menace létale",
      shortPrompt: "Tu as la place pour reprendre un pic de dégâts pur et fermer la partie.",
      situation: "Les réponses défensives utiles existent déjà dans ton build ou sont moins urgentes. Il faut maintenant convertir l'avance.",
      question: "Quel achat maximise ta capacité à forcer une erreur ennemie ?",
      explanation: "Le bon timing pour l'AP pur, c'est quand les menaces bloquantes sont déjà couvertes.",
      tags: ["otp", "snowball", "burst", "conversion"],
      minute: 29,
      gold: 3600,
      currentBuild: ["blackfire-torch", "zhonyas-hourglass", "void-staff"],
      choices: ["rabadons-deathcap", "banshees-veil", "morellonomicon", "cosmic-drive"],
      correctChoice: "rabadons-deathcap",
      enemyItems: { MID: ["banshees-veil", "shadowflame"], ADC: ["bloodthirster", "guardian-angel"] },
      objectiveState: { prochainObjectif: "Nashor", contesté: false, siège: true },
      damageProfile: { physique: "moyen", magique: "moyen" },
      mapState: { tempo: "pression latérale + pick", visionCarte: "bonne" },
      notes: "Le snowball propre demande aussi de savoir quand revenir sur un achat purement offensif.",
    },
  ],
  fighter: [
    {
      key: "heal-cut",
      title: "Couper les soins avant tout",
      shortPrompt: "La sustain adverse transforme chaque fight en guerre d'usure perdante.",
      situation: "Tu peux prendre l'espace, mais tant que les soins adverses tiennent, ta pression de bruiser ne se convertit pas.",
      question: "Quel achat est le plus propre ici ?",
      explanation: "Les blessures graves sont obligatoires parce qu'elles changent la nature même des échanges.",
      tags: ["otp", "anti-heal", "tempo", "bruiser"],
      minute: 17,
      gold: 2400,
      currentBuild: ["black-cleaver"],
      choices: ["chempunk-chainsword", "steraks-gage", "guardian-angel", "plated-steelcaps"],
      correctChoice: "chempunk-chainsword",
      enemyItems: { TOP: ["spirit-visage", "plated-steelcaps"], SUPPORT: ["moonstone-renewer", "redemption"] },
      objectiveState: { prochainObjectif: "Dragon", contesté: true, escarmoucheContinue: true },
      damageProfile: { physique: "moyen", magique: "moyen" },
      mapState: { tempo: "river skirmish", sideLane: "secondaire" },
      notes: "Un OTP bruiser doit savoir payer le coût d'opportunité d'un achat utilitaire quand c'est lui qui débloque le reste.",
    },
    {
      key: "armor-break",
      title: "Passer l'armure sans perdre ton tempo",
      shortPrompt: "La front line adverse investit tôt dans l'armure et ralentit ton impact.",
      situation: "Tu entres bien dans le fight, mais tes dégâts s'écrasent sur les premiers achats défensifs ennemis.",
      question: "Quel achat garde le plus de cohérence avec ton rôle ?",
      explanation: "Tu dois continuer à toucher la front line tout en gardant un profil de bruiser capable de rester au contact.",
      tags: ["otp", "armure", "midgame", "teamfight"],
      minute: 22,
      gold: 3000,
      currentBuild: ["eclipse", "plated-steelcaps"],
      choices: ["black-cleaver", "steraks-gage", "guardian-angel", "maw-of-malmortius"],
      correctChoice: "black-cleaver",
      enemyItems: { TOP: ["thornmail", "sunfire-aegis"], JUNGLE: ["frozen-heart", "plated-steelcaps"] },
      objectiveState: { prochainObjectif: "Nashor", contesté: true, frontlineAdverse: "épaisse" },
      damageProfile: { physique: "élevé", magique: "moyen" },
      mapState: { tempo: "5v5 autour mid", accèsBackline: "difficile" },
      notes: "Quand l'accès au carry est compliqué, l'achat juste est souvent celui qui te laisse broyer proprement la première ligne.",
    },
    {
      key: "ap-survival",
      title: "Encaisser la menace magique",
      shortPrompt: "Le burst AP adverse menace ton entrée de fight plus que la front line.",
      situation: "Tu peux encore porter le fight, mais seulement si tu tiens la première rotation de dégâts magiques.",
      question: "Quel achat te donne la meilleure valeur immédiate ?",
      explanation: "Sans survie magique, tu sors trop tôt du combat.",
      tags: ["otp", "mr", "survie", "engage"],
      minute: 24,
      gold: 2900,
      currentBuild: ["black-cleaver", "plated-steelcaps"],
      choices: ["maw-of-malmortius", "steraks-gage", "guardian-angel", "black-cleaver"],
      correctChoice: "maw-of-malmortius",
      enemyItems: { MID: ["stormsurge", "shadowflame"], SUPPORT: ["ardent-censer", "staff-of-flowing-water"] },
      objectiveState: { prochainObjectif: "Dragon", contesté: true, chokePoint: true },
      damageProfile: { physique: "moyen", magique: "élevé" },
      mapState: { tempo: "engage explosif", flank: "possible" },
      notes: "Le bon achat n'augmente pas forcément ton plafond, mais il te donne le temps de l'atteindre.",
    },
    {
      key: "anti-burst",
      title: "Tenir la deuxième rotation",
      shortPrompt: "Tu gagnes l'entrée de fight mais tu manques de tenue pour finir l'échange.",
      situation: "Ton champion trouve bien la mêlée, toutefois la seconde phase du combat tourne trop vite contre toi.",
      question: "Quel achat solidifie le plus ton rôle dans ces fights ?",
      explanation: "La meilleure réponse est celle qui te permet de rester pertinent après ton premier burst.",
      tags: ["otp", "durabilité", "midfight", "discipline"],
      minute: 25,
      gold: 3100,
      currentBuild: ["black-cleaver", "steraks-gage"],
      choices: ["steraks-gage", "guardian-angel", "chempunk-chainsword", "randuins-omen"],
      correctChoice: "steraks-gage",
      enemyItems: { ADC: ["infinity-edge", "bloodthirster"], TOP: ["sunfire-aegis", "thornmail"] },
      objectiveState: { prochainObjectif: "Nashor", contesté: true, fightLong: true },
      damageProfile: { physique: "élevé", magique: "moyen" },
      mapState: { tempo: "midgame 5v5", reset: "peu probable" },
      notes: "Cette variante pousse à penser la durée utile sur le fight, pas seulement le premier contact.",
    },
    {
      key: "late-discipline",
      title: "Fermer la game sans overbuild",
      shortPrompt: "Tu as déjà assez de dégâts pour menacer, le sujet est maintenant la stabilité de ton exécution.",
      situation: "L'avance existe, mais les fights peuvent encore basculer si tu donnes trop d'ouverture aux carries adverses.",
      question: "Quel achat est le plus discipliné pour terminer proprement ?",
      explanation: "Quand tu es la pièce d'engage ou de tempo, le bon achat fiabilise la séquence complète.",
      tags: ["otp", "closing", "discipline", "macro"],
      minute: 29,
      gold: 3000,
      currentBuild: ["black-cleaver", "steraks-gage", "maw-of-malmortius"],
      choices: ["guardian-angel", "randuins-omen", "chempunk-chainsword", "black-cleaver"],
      correctChoice: "guardian-angel",
      enemyItems: { ADC: ["infinity-edge", "lord-dominiks-regards"], MID: ["void-staff", "zhonyas-hourglass"] },
      objectiveState: { prochainObjectif: "Nashor", contesté: false, avantageVision: true },
      damageProfile: { physique: "élevé", magique: "moyen" },
      mapState: { tempo: "closing", sideLane: "sous contrôle" },
      notes: "Le meilleur achat de fermeture n'est pas toujours le plus gourmand. Ici il sert à fiabiliser la fin de partie.",
    },
  ],
  tank: [
    {
      key: "anti-ad",
      title: "Casser le DPS auto-attaque",
      shortPrompt: "La menace principale est une source AD soutenue qui tape librement.",
      situation: "Ton rôle est de tenir l'espace et de couper le DPS auto-attaque sur l'objectif suivant.",
      question: "Quel achat te donne la meilleure valeur immédiate ?",
      explanation: "Le bon item est celui qui réduit le plus la pression réelle du carry adverse sur la durée du fight.",
      tags: ["otp", "tank", "anti-ad", "teamfight"],
      minute: 23,
      gold: 2900,
      currentBuild: ["sunfire-aegis", "plated-steelcaps"],
      choices: ["randuins-omen", "thornmail", "kaenic-rookern", "trailblazer"],
      correctChoice: "randuins-omen",
      enemyItems: { ADC: ["infinity-edge", "runaans-hurricane"], TOP: ["black-cleaver", "steraks-gage"] },
      objectiveState: { prochainObjectif: "Dragon", contesté: true, protectCarry: true },
      damageProfile: { physique: "élevé", magique: "moyen" },
      mapState: { tempo: "front-to-back", angleEngage: "simple" },
      notes: "La discipline tank consiste souvent à répondre au vrai carry adverse, pas à empiler l'item le plus générique.",
    },
    {
      key: "anti-heal",
      title: "Empêcher la sustain de gagner le front",
      shortPrompt: "La sustain ennemie pèse plus que le burst dans le prochain fight.",
      situation: "Si tu ne réduis pas les soins, la première ligne adverse ne tombera jamais avant les resets.",
      question: "Quel achat est le plus utile pour ton équipe ?",
      explanation: "Le bon tank item est ici celui qui coupe les soins sur la ligne de front et rend enfin les trades convertibles.",
      tags: ["otp", "anti-heal", "frontline", "objectif"],
      minute: 21,
      gold: 2700,
      currentBuild: ["sunfire-aegis", "plated-steelcaps"],
      choices: ["thornmail", "randuins-omen", "kaenic-rookern", "force-of-nature"],
      correctChoice: "thornmail",
      enemyItems: { TOP: ["spirit-visage", "warmogs-armor"], SUPPORT: ["moonstone-renewer", "redemption"] },
      objectiveState: { prochainObjectif: "Dragon", contesté: true, fightLong: true },
      damageProfile: { physique: "moyen", magique: "moyen" },
      mapState: { tempo: "escarmouche répétée", contrôleRiver: "contesté" },
      notes: "Ton utilité n'est pas seulement de tanker, mais aussi de rendre l'usure adverse beaucoup moins rentable.",
    },
    {
      key: "anti-ap",
      title: "Encaisser le burst magique avant d'engager",
      shortPrompt: "Le danger vient du burst AP et de la zone de contrôle ennemie.",
      situation: "Tu peux lancer le fight, mais seulement si tu ne perds pas instantanément trop de PV sur l'entrée.",
      question: "Quel achat te donne le meilleur timing ?",
      explanation: "Tu as besoin d'une vraie marche de survie magique pour engager sans céder l'espace immédiatement.",
      tags: ["otp", "mr", "engage", "stabilité"],
      minute: 24,
      gold: 3000,
      currentBuild: ["sunfire-aegis", "plated-steelcaps"],
      choices: ["kaenic-rookern", "force-of-nature", "randuins-omen", "thornmail"],
      correctChoice: "kaenic-rookern",
      enemyItems: { MID: ["stormsurge", "shadowflame"], SUPPORT: ["ardent-censer", "staff-of-flowing-water"] },
      objectiveState: { prochainObjectif: "Nashor", contesté: true, chokePoint: true },
      damageProfile: { physique: "moyen", magique: "élevé" },
      mapState: { tempo: "setup vision puis engage", vision: "instable" },
      notes: "Un tank qui ne survit pas à l'entrée ne crée aucun espace. L'achat correct rétablit ce droit à l'engage.",
    },
    {
      key: "anti-dot",
      title: "Gérer les dégâts prolongés",
      shortPrompt: "Le combat dure longtemps et la menace magique revient par ticks successifs.",
      situation: "Le problème n'est pas le one-shot mais l'usure continue, surtout sur les fights de zone.",
      question: "Quel achat répond le mieux à ce profil de dégâts ?",
      explanation: "Quand le combat s'étire, l'item de tenue MR prolongée dépasse la simple réponse à un burst unique.",
      tags: ["otp", "mr", "dot", "teamfight"],
      minute: 27,
      gold: 3000,
      currentBuild: ["sunfire-aegis", "kaenic-rookern"],
      choices: ["force-of-nature", "randuins-omen", "thornmail", "trailblazer"],
      correctChoice: "force-of-nature",
      enemyItems: { MID: ["liandrys-torment", "void-staff"], TOP: ["abyssal-mask", "hollow-radiance"] },
      objectiveState: { prochainObjectif: "Nashor", contesté: true, zoneFight: true },
      damageProfile: { physique: "moyen", magique: "élevé" },
      mapState: { tempo: "fight étiré", espace: "fermé" },
      notes: "Le bon item dépend aussi du mode d'application des dégâts, pas seulement de leur type.",
    },
    {
      key: "close-map",
      title: "Transformer l'avance en contrôle de carte",
      shortPrompt: "L'équipe a besoin d'une première ligne qui ouvre la carte sans s'exposer inutilement.",
      situation: "Tu n'as pas besoin d'un achat purement réactif, mais d'un item qui augmente ta qualité d'engage et de rotation.",
      question: "Quel achat est le plus cohérent pour terminer la partie ?",
      explanation: "La meilleure fin de build tank ne consiste pas toujours à contrer une menace brute, mais à augmenter ton contrôle opérationnel.",
      tags: ["otp", "macro", "closing", "engage"],
      minute: 30,
      gold: 2600,
      currentBuild: ["sunfire-aegis", "kaenic-rookern", "randuins-omen"],
      choices: ["trailblazer", "thornmail", "force-of-nature", "warmogs-armor"],
      correctChoice: "trailblazer",
      enemyItems: { ADC: ["bloodthirster", "guardian-angel"], SUPPORT: ["locket-of-the-iron-solari", "knights-vow"] },
      objectiveState: { prochainObjectif: "Nashor", contesté: false, siège: true },
      damageProfile: { physique: "moyen", magique: "moyen" },
      mapState: { tempo: "prise de zone", rotations: "rapides" },
      notes: "Fermer une partie demande parfois un item d'initiative plus qu'un item de pur tanking.",
    },
  ],
  support: [
    {
      key: "protect-carry",
      title: "Renforcer le carry principal",
      shortPrompt: "Le combat se gagne si ton carry survit au premier engage.",
      situation: "Ta value maximale vient de ta capacité à garder ton carry dans le fight plus que de chercher un spike personnel.",
      question: "Quel achat a le plus de valeur dans ce setup ?",
      explanation: "Quand toute la condition de victoire passe par ton carry, l'item le plus fort est celui qui sécurise son uptime.",
      tags: ["otp", "support", "peel", "carry"],
      minute: 22,
      gold: 2300,
      currentBuild: ["shurelyas-battlesong", "ardent-censer"],
      choices: ["redemption", "staff-of-flowing-water", "moonstone-renewer", "locket-of-the-iron-solari"],
      correctChoice: "redemption",
      enemyItems: { JUNGLE: ["black-cleaver", "steraks-gage"], MID: ["stormsurge", "shadowflame"] },
      objectiveState: { prochainObjectif: "Dragon", contesté: true, protectCarry: true },
      damageProfile: { physique: "moyen", magique: "élevé" },
      mapState: { tempo: "front-to-back", accèsBacklineAdverse: "fort" },
      notes: "Le bon support item est celui qui augmente le plus l'uptime de la vraie source de dégâts.",
    },
    {
      key: "anti-dive",
      title: "Encaisser l'entrée adverse",
      shortPrompt: "Tu dois absorber le premier impact pour que ton équipe joue le fight.",
      situation: "La compo ennemie engage vite et fort. Si tu cèdes trop tôt, tout le plan de peel s'écroule.",
      question: "Quel achat est le plus discipliné ?",
      explanation: "L'achat correct est celui qui sécurise le premier contact et laisse le temps à tes outils de peel d'exister.",
      tags: ["otp", "support", "engage", "survie"],
      minute: 20,
      gold: 2200,
      currentBuild: ["locket-of-the-iron-solari", "knights-vow"],
      choices: ["trailblazer", "redemption", "moonstone-renewer", "shurelyas-battlesong"],
      correctChoice: "trailblazer",
      enemyItems: { TOP: ["dead-mans-plate", "trailblazer"], JUNGLE: ["black-cleaver", "guardian-angel"] },
      objectiveState: { prochainObjectif: "Héraut / Dragon", contesté: true, engageAdverse: true },
      damageProfile: { physique: "élevé", magique: "moyen" },
      mapState: { tempo: "hard engage", vision: "limitée" },
      notes: "Ici, ton job n'est pas d'augmenter doucement le soin, mais de rendre l'entrée adverse beaucoup moins décisive.",
    },
    {
      key: "extended-fight",
      title: "Tenir les fights prolongés",
      shortPrompt: "Les échanges s'étirent et ton équipe gagne si elle garde sa ligne de vie haute.",
      situation: "Le prochain fight n'est pas un burst check. C'est un combat de durée où ton throughput défensif fait la différence.",
      question: "Quel achat optimise le mieux ce pattern ?",
      explanation: "Quand la durée devient le facteur clé, l'item de sustain prolongé prend logiquement le dessus.",
      tags: ["otp", "support", "long-fight", "sustain"],
      minute: 24,
      gold: 2300,
      currentBuild: ["shurelyas-battlesong", "redemption"],
      choices: ["moonstone-renewer", "staff-of-flowing-water", "ardent-censer", "locket-of-the-iron-solari"],
      correctChoice: "moonstone-renewer",
      enemyItems: { TOP: ["warmogs-armor", "spirit-visage"], SUPPORT: ["redemption", "moonstone-renewer"] },
      objectiveState: { prochainObjectif: "Nashor", contesté: true, duréeFight: "longue" },
      damageProfile: { physique: "moyen", magique: "moyen" },
      mapState: { tempo: "5v5 étiré", positionnement: "stable" },
      notes: "Le bon support build suit le rythme réel du fight, pas seulement la fiche de stats la plus flatteuse.",
    },
    {
      key: "double-ap",
      title: "Booster les menaces AP alliées",
      shortPrompt: "Deux sources AP alliées peuvent écraser le fight si tu amplifies leur tempo.",
      situation: "Tu n'as pas besoin d'un achat purement défensif: ton équipe gagne surtout si tes menaces AP arrivent plus vite à leur point de bascule.",
      question: "Quel achat sert le mieux ce plan ?",
      explanation: "L'achat juste n'est pas toujours un outil de survie. Ici il sert à amplifier le cœur du plan de dégâts allié.",
      tags: ["otp", "support", "buff", "tempo"],
      minute: 21,
      gold: 2400,
      currentBuild: ["shurelyas-battlesong", "ardent-censer"],
      choices: ["staff-of-flowing-water", "redemption", "moonstone-renewer", "locket-of-the-iron-solari"],
      correctChoice: "staff-of-flowing-water",
      enemyItems: { MID: ["banshees-veil", "shadowflame"], SUPPORT: ["locket-of-the-iron-solari", "redemption"] },
      objectiveState: { prochainObjectif: "Dragon", contesté: true, doubleCarryAP: true },
      damageProfile: { physique: "moyen", magique: "moyen" },
      mapState: { tempo: "poke puis engage", prioritéMid: true },
      notes: "Ce puzzle force à reconnaître quand la meilleure utilité passe par l'amplification du plan allié.",
    },
    {
      key: "close-game",
      title: "Sécuriser la fermeture de partie",
      shortPrompt: "Tu as déjà de la valeur utilitaire, il faut maintenant fiabiliser le dernier sprint.",
      situation: "La game est en avance et le vrai risque est un seul fight mal négocié. Tu cherches la solution la plus fiable.",
      question: "Quel achat est le plus cohérent pour verrouiller la partie ?",
      explanation: "La discipline support en fin de partie consiste souvent à acheter ce qui annule le plus de variance sur le fight décisif.",
      tags: ["otp", "support", "closing", "discipline"],
      minute: 28,
      gold: 2500,
      currentBuild: ["shurelyas-battlesong", "staff-of-flowing-water", "redemption"],
      choices: ["locket-of-the-iron-solari", "ardent-censer", "moonstone-renewer", "trailblazer"],
      correctChoice: "locket-of-the-iron-solari",
      enemyItems: { ADC: ["infinity-edge", "lord-dominiks-regards"], MID: ["void-staff", "stormsurge"] },
      objectiveState: { prochainObjectif: "Nashor", contesté: true, dernierFightAvantSoul: true },
      damageProfile: { physique: "élevé", magique: "élevé" },
      mapState: { tempo: "closing", erreurInterdite: true },
      notes: "Le bon item de fermeture support réduit les risques d'emballement adverse sur le fight charnière.",
    },
  ],
};

function randomFrom<T>(values: T[]) {
  return values[Math.floor(Math.random() * values.length)];
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function resolveChampionArchetype(tags: unknown): ChampionArchetype {
  const normalizedTags = Array.isArray(tags) ? tags.map((tag) => String(tag)) : [];
  if (normalizedTags.includes("Marksman")) return "marksman";
  if (normalizedTags.includes("Mage") || normalizedTags.includes("Assassin")) return "mage";
  if (normalizedTags.includes("Support")) return "support";
  if (normalizedTags.includes("Tank")) return "tank";
  return "fighter";
}

function resolveScenarioSlot(championSlug: string, tags: unknown): ScenarioSlot {
  const override = championRoleOverrides[championSlug];
  if (override) return override;
  const archetype = resolveChampionArchetype(tags);
  if (archetype === "marksman") return "ADC";
  if (archetype === "mage") return "MID";
  if (archetype === "support") return "SUPPORT";
  return "TOP";
}

async function getItemsBySlugs(slugs: string[]) {
  const requestedSlugs = unique(slugs);
  const slugsToQuery = unique(requestedSlugs.flatMap((slug) => [slug, resolveItemSlug(slug)]));
  const items = await prisma.item.findMany({
    where: {
      slug: {
        in: slugsToQuery,
      },
    },
  });

  const directIndex = new Map(items.map((item) => [item.slug, item]));
  return new Map(
    requestedSlugs.flatMap((slug) => {
      const item = directIndex.get(slug) ?? directIndex.get(resolveItemSlug(slug));
      return item ? [[slug, item] as const] : [];
    }),
  );
}

function buildTeamSkeleton(playerChampionSlug: string, playerSlot: ScenarioSlot) {
  const used = new Set([playerChampionSlug]);
  const allyTeam: ScenarioMember[] = [];
  const enemyTeam: ScenarioMember[] = [];

  for (const slot of scenarioSlots) {
    const allyChampionSlug =
      slot === playerSlot
        ? playerChampionSlug
        : slotPools[slot].find((slug) => !used.has(slug)) ?? randomFrom(slotPools[slot]);
    used.add(allyChampionSlug);
    allyTeam.push({
      championSlug: allyChampionSlug,
      role: slot,
      items: defaultSlotItems[slot],
      note: slot === playerSlot ? "Champion du joueur" : undefined,
    });
  }

  for (const slot of scenarioSlots) {
    const enemyChampionSlug = slotPools[slot].find((slug) => !used.has(slug)) ?? randomFrom(slotPools[slot]);
    used.add(enemyChampionSlug);
    enemyTeam.push({
      championSlug: enemyChampionSlug,
      role: slot,
      items: defaultSlotItems[slot],
    });
  }

  return { allyTeam, enemyTeam };
}

function enrichEnemyTeam(enemyTeam: ScenarioMember[], variant: ScenarioVariant) {
  return enemyTeam.map((member) => ({
    ...member,
    items: unique([...(variant.enemyItems[member.role] ?? []), ...member.items]).slice(0, 4),
  }));
}

async function createGeneratedPuzzle(
  championId: string,
  variant: ScenarioVariant,
  archetype: ChampionArchetype,
  playerSlot: ScenarioSlot,
  userId?: string,
  importedMatchId?: string,
) {
  const champion = await prisma.champion.findUnique({ where: { id: championId } });
  if (!champion) {
    throw new HttpError(404, "Champion introuvable.");
  }

  const { allyTeam, enemyTeam } = buildTeamSkeleton(champion.slug, playerSlot);
  const enrichedEnemyTeam = enrichEnemyTeam(enemyTeam, variant);
  const currentBuild = variant.currentBuild;
  const requiredSlugs = unique([
    ...variant.choices,
    ...currentBuild,
    ...enrichedEnemyTeam.flatMap((member) => member.items),
    ...allyTeam.flatMap((member) => member.items),
  ]);
  const itemIndex = await getItemsBySlugs(requiredSlugs);

  if (!variant.choices.every((slug) => itemIndex.has(slug))) {
    throw new HttpError(500, "Impossible de résoudre tous les items nécessaires à la génération du puzzle.");
  }

  const championSlugs = unique([
    champion.slug,
    ...allyTeam.map((member) => member.championSlug),
    ...enrichedEnemyTeam.map((member) => member.championSlug),
  ]);
  const scenarioChampions = await prisma.champion.findMany({
    where: { slug: { in: championSlugs } },
    select: { id: true, riotChampionId: true, championKey: true, slug: true },
  });
  const championScenarioIndex = new Map(scenarioChampions.map((entry) => [entry.slug, entry]));

  const serializeScenarioItem = (itemSlug: string): ScenarioStoredItem => {
    const item = itemIndex.get(itemSlug);
    if (!item) {
      throw new HttpError(500, `Item de scenario introuvable: ${itemSlug}`);
    }

    return {
      itemId: item.id,
      riotItemId: item.riotItemId,
      itemSlug: item.slug,
    };
  };

  const serializeScenarioMember = (member: ScenarioMember): ScenarioStoredMember => {
    const scenarioChampion = championScenarioIndex.get(member.championSlug);
    if (!scenarioChampion) {
      throw new HttpError(500, `Champion de scenario introuvable: ${member.championSlug}`);
    }

    return {
      championId: scenarioChampion.id,
      riotChampionId: scenarioChampion.riotChampionId,
      championKey: scenarioChampion.championKey,
      championSlug: scenarioChampion.slug,
      role: member.role,
      items: member.items.map(serializeScenarioItem),
      note: member.note,
    };
  };

  const serializedCurrentBuild = currentBuild.map(serializeScenarioItem);
  const serializedAllyTeam = allyTeam.map(serializeScenarioMember);
  const serializedEnemyTeam = enrichedEnemyTeam.map(serializeScenarioMember);

  if (serializedAllyTeam.length !== scenarioSlots.length || serializedEnemyTeam.length !== scenarioSlots.length) {
    throw new HttpError(500, "Generation de puzzle invalide: equipes de scenario incompletes.");
  }

  const generatedSlug = `${champion.slug}-${variant.key}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const correctItem = itemIndex.get(variant.correctChoice)!;
  const playerRole = Role[playerSlot];

  const puzzle = await prisma.puzzle.create({
    data: {
      title: `${champion.name} OTP: ${variant.title}`,
      slug: slugify(generatedSlug),
      mode: importedMatchId ? PuzzleMode.PERSONALIZED : PuzzleMode.CHAMPION_SPECIFIC,
      sourceType: importedMatchId ? PuzzleSourceType.IMPORTED_MATCH : PuzzleSourceType.GENERATED,
      difficulty: PuzzleDifficulty.INTERMEDIATE,
      patch: champion.patch,
      description: `Série OTP ${champion.name}: ${variant.shortPrompt}`,
      shortPrompt: variant.shortPrompt,
      situation: `Tu joues ${champion.name} (${slotRoleLabels[playerSlot]}) vers ${variant.minute} min. ${variant.situation}`,
      question: variant.question,
      explanation: `${correctItem.name} est l'achat le plus cohérent ici. ${variant.explanation}`,
      role: playerRole,
      championId: champion.id,
      isPublished: true,
      isDailyEligible: !importedMatchId,
      choices: {
        create: variant.choices.map((choiceSlug, index) => {
          const item = itemIndex.get(choiceSlug)!;
          const isCorrect = choiceSlug === variant.correctChoice;
          return {
            label: item.name,
            choiceType: item.isBoots ? PuzzleChoiceType.BOOTS : PuzzleChoiceType.ITEM,
            itemId: item.id,
            textFallback: item.shortDescription || undefined,
            explanation: isCorrect
              ? `${item.name} répond le mieux au vrai problème de ce scénario.`
              : `${item.name} reste jouable, mais perd en valeur dans ce contexte précis.`,
            isCorrect,
            displayOrder: index + 1,
          };
        }),
      },
      scenario: {
        create: {
          playerChampionId: champion.id,
          playerRole,
          gameMinute: variant.minute,
          playerGold: Math.max(variant.gold, correctItem.goldTotal),
          playerLevel: playerSlot === "SUPPORT" ? 11 : 14,
          kills: playerSlot === "SUPPORT" ? 1 : 5,
          deaths: 2,
          assists: playerSlot === "SUPPORT" ? 10 : 6,
          cs: playerSlot === "SUPPORT" ? 38 : playerSlot === "JUNGLE" ? 142 : 184,
          currentBuild: serializedCurrentBuild as Prisma.InputJsonValue,
          allyTeam: serializedAllyTeam as Prisma.InputJsonValue,
          enemyTeam: serializedEnemyTeam as Prisma.InputJsonValue,
          allyItems: serializedAllyTeam as Prisma.InputJsonValue,
          enemyItems: serializedEnemyTeam as Prisma.InputJsonValue,
          notableThreats: { archétype: archetype, angles: variant.tags } as Prisma.InputJsonValue,
          objectiveState: variant.objectiveState as Prisma.InputJsonValue,
          damageProfile: variant.damageProfile as Prisma.InputJsonValue,
          mapState: variant.mapState as Prisma.InputJsonValue,
          notes: importedMatchId ? `Variante générée à partir d'une partie importée. ${variant.notes}` : variant.notes,
        },
      },
      tags: {
        create: variant.tags.map((tag) => ({
          tag: {
            connectOrCreate: {
              where: { slug: slugify(tag) },
              create: { slug: slugify(tag), name: tag },
            },
          },
        })),
      },
    },
    include: {
      scenario: true,
      choices: true,
      champion: true,
      tags: { include: { tag: true } },
    },
  });

  if (userId) {
    await prisma.generatedPuzzleRequest.create({
      data: {
        userId,
        type: importedMatchId ? GeneratedPuzzleRequestType.MATCH_BASED : GeneratedPuzzleRequestType.CHAMPION,
        championId: champion.id,
        importedMatchId,
        parameters: { variant: variant.key, playerSlot, enemyTeam: serializedEnemyTeam },
        status: GeneratedPuzzleRequestStatus.COMPLETED,
        resultPuzzleId: puzzle.id,
      },
    });
  }

  return puzzle;
}

async function buildChampionSeries(championId: string, userId?: string, importedMatchId?: string, count = 5): Promise<GeneratedSeriesPayload> {
  const champion = await prisma.champion.findUnique({ where: { id: championId } });
  if (!champion) {
    throw new HttpError(404, "Champion introuvable.");
  }

  const archetype = resolveChampionArchetype(champion.tags);
  const playerSlot = resolveScenarioSlot(champion.slug, champion.tags);
  const variants = archetypeVariants[archetype].slice(0, count);
  const created = [];

  for (const variant of variants) {
    created.push(await createGeneratedPuzzle(championId, variant, archetype, playerSlot, userId, importedMatchId));
  }

  return {
    slug: created[0]?.slug ?? "",
    slugs: created.map((entry) => entry.slug),
  };
}

export const puzzleGenerationService = {
  async generateChampionPuzzle(championId: string, userId?: string) {
    const champion = await prisma.champion.findUnique({ where: { id: championId } });
    if (!champion) {
      throw new HttpError(404, "Champion introuvable.");
    }

    const archetype = resolveChampionArchetype(champion.tags);
    const playerSlot = resolveScenarioSlot(champion.slug, champion.tags);
    return createGeneratedPuzzle(championId, archetypeVariants[archetype][0], archetype, playerSlot, userId);
  },

  generateChampionPuzzleSeries(championId: string, userId?: string) {
    return buildChampionSeries(championId, userId, undefined, 5);
  },

  async generateMatchBasedPuzzle(importedMatchId: string, userId: string) {
    const match = await prisma.importedMatch.findUnique({ where: { id: importedMatchId } });
    if (!match) {
      throw new HttpError(404, "Partie importée introuvable.");
    }

    const matchData = match.matchData as Prisma.JsonObject;
    const championSlug = String(matchData.playerChampionSlug ?? "");
    const champion = await prisma.champion.findUnique({ where: { slug: championSlug } });
    if (!champion) {
      throw new HttpError(400, "La partie importée ne référence pas un champion connu.");
    }

    return buildChampionSeries(champion.id, userId, importedMatchId, 5);
  },
};

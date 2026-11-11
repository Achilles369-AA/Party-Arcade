"use strict";
/* Party Arcade - dependency-free multiplayer party games server (Node 18+) */
const http = require("http");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const FAST = Math.max(1, Number(process.env.FAST) || 1); // test-only time scale
const MAX_PLAYERS = 10;

/* ====================== DATA ====================== */

// [question, truth, [fake answers used by bots / to pad options]]
const FACTS = [
  ["A group of flamingos is called a ___.", "flamboyance", ["parade", "sunset", "pinkery"]],
  ["A group of owls is called a ___.", "parliament", ["library", "midnight", "hootenanny"]],
  ["A group of porcupines is called a ___.", "prickle", ["quill", "needle", "spikeful"]],
  ["A group of jellyfish is called a ___.", "smack", ["wobble", "splash", "drift"]],
  ["A group of hedgehogs is called an ___.", "array", ["acorn", "huddle", "thorn"]],
  ["The shortest war in history (Britain vs Zanzibar) lasted about ___ minutes.", "38", ["4", "120", "17"]],
  ["The heart of a blue whale is about the size of a ___.", "small car", ["beach ball", "microwave", "dustbin"]],
  ["Octopuses have ___ hearts.", "three", ["five", "two", "eight"]],
  ["A day on Venus is longer than its ___.", "year", ["month", "winter", "rainy season"]],
  ["Bananas are technically a type of ___.", "berry", ["nut", "bean", "tuber"]],
  ["The Eiffel Tower grows about 15 cm taller in summer because of ___.", "heat expansion", ["tourist weight", "fresh paint", "humidity"]],
  ["The first item ever sold on eBay was a broken ___.", "laser pointer", ["bicycle", "toaster", "guitar"]],
  ["In Japan you can buy square ___ so they fit neatly in the fridge.", "watermelons", ["pumpkins", "cakes", "pineapples"]],
  ["Wombat poop is shaped like ___.", "cubes", ["stars", "spirals", "pyramids"]],
  ["The national animal of Scotland is the ___.", "unicorn", ["stag", "highland cow", "golden eagle"]],
  ["Sloths can hold their breath longer than ___.", "dolphins", ["whales", "turtles", "penguins"]],
  ["The dot over the letter i is called a ___.", "tittle", ["jot", "nib", "pip"]],
  ["The plastic tips on shoelaces are called ___.", "aglets", ["tippets", "glints", "lacers"]],
  ["Honey bees communicate by doing a ___.", "waggle dance", ["tail spin", "buzz tango", "zigzag salute"]],
  ["A baby kangaroo is called a ___.", "joey", ["pouchling", "kitt", "jumpy"]],
  ["The only letter missing from every US state name is ___.", "Q", ["Z", "X", "J"]],
  ["Mount Everest grows about ___ every year.", "4 millimetres", ["4 metres", "4 centimetres", "40 centimetres"]],
  ["Butterflies taste with their ___.", "feet", ["antennae", "wings", "tongues"]],
  ["The word 'quarantine' comes from the Italian for ___ days.", "forty", ["ten", "twenty", "thirty"]],
  ["The tongue of a blue whale weighs about as much as an ___.", "elephant", ["ostrich", "piano", "minibus"]],
  ["Cats cannot taste ___.", "sweetness", ["salt", "bitterness", "water"]],
  ["Jaipur is nicknamed the ___ City.", "Pink", ["Golden", "Blue", "Silver"]],
  ["The game of chess has its roots in ancient ___.", "India", ["Persia", "China", "Egypt"]],
  ["A koala's fingerprints are almost identical to a ___ fingerprint.", "human", ["dog", "panda", "cat"]],
  ["Percy Spencer invented the ___ after a chocolate bar melted in his pocket.", "microwave oven", ["toaster", "hair dryer", "thermos"]],
  ["Lightning strikes the Earth about ___ times every second.", "100", ["5", "10000", "1"]],
  ["Hot water sometimes freezes faster than cold water, called the ___ effect.", "Mpemba", ["Quillan", "Brandt", "Vollmer"]],
  ["The most stolen food in the world is ___.", "cheese", ["chocolate", "rice", "coffee"]],
  ["The smell of rain on dry ground is called ___.", "petrichor", ["aquaroma", "ozonia", "nimbose"]],
  ["Bubble wrap was first invented as ___.", "wallpaper", ["swimming float", "hat padding", "baby mattress"]],
];

// [left, right, leftEmoji, rightEmoji, [[position, clue], ...]]
const SPECTRA = [
  ["Cold", "Hot", "🥶", "🔥", [[10, "Penguin"], [30, "Autumn evening"], [55, "Cup of chai"], [75, "Sunny beach"], [93, "Volcano"]]],
  ["Terrible movie", "Masterpiece", "💩", "🏆", [[8, "Sharknado"], [28, "A sequel nobody asked for"], [52, "Fine for a Sunday"], [76, "Oscar nominee"], [95, "Titanic"]]],
  ["Easy", "Hard", "😴", "😰", [[8, "Tying a shoe"], [30, "Riding a bike"], [55, "Learning guitar"], [78, "Chess grandmaster"], [95, "Landing on Mars"]]],
  ["Cheap", "Expensive", "🪙", "💎", [[7, "A pebble"], [30, "Samosa"], [52, "Sneakers"], [75, "A car"], [94, "Private island"]]],
  ["Slow", "Fast", "🐌", "🚀", [[6, "Snail"], [25, "Walking"], [50, "Bicycle"], [73, "Cheetah"], [96, "Rocket"]]],
  ["Boring", "Exciting", "🥱", "🤩", [[8, "Watching paint dry"], [28, "Waiting in line"], [52, "Board game night"], [75, "Concert"], [94, "Skydiving"]]],
  ["Tiny", "Giant", "🐜", "🐘", [[6, "Ant"], [25, "Cat"], [50, "Horse"], [75, "Elephant"], [95, "Blue whale"]]],
  ["Mild", "Spicy", "🍦", "🌶️", [[8, "Vanilla ice cream"], [30, "Pasta"], [55, "Butter chicken"], [78, "Vindaloo"], [95, "Ghost pepper"]]],
  ["Scary", "Adorable", "👻", "🐼", [[8, "Shark attack"], [30, "Big spider"], [52, "Hamster"], [75, "Puppy"], [95, "Baby panda"]]],
  ["Old-fashioned", "Futuristic", "📜", "🤖", [[6, "Sundial"], [28, "Landline phone"], [52, "Smartphone"], [76, "Self-driving car"], [95, "Teleporter"]]],
  ["Useless", "Essential", "🗑️", "🆘", [[8, "Chocolate teapot"], [28, "Fidget spinner"], [52, "Umbrella"], [75, "Phone charger"], [95, "Water"]]],
  ["Monday morning", "Saturday night", "💼", "🎉", [[6, "Alarm clock"], [28, "Tuesday"], [52, "Friday afternoon"], [76, "Sunday brunch"], [95, "Party time"]]],
];

const LETTERS = "ABCDEFGHIKLMNOPRSTW".split("");
const SCAT_RAW = {
  "🐾 Animal": "A:ant,antelope;B:bear,buffalo;C:cat,camel;D:dog,dolphin;E:eagle,elephant;F:fox,frog;G:goat,giraffe;H:horse,hippo;I:iguana,impala;K:kangaroo,koala;L:lion,lizard;M:monkey,mouse;N:newt,narwhal;O:owl,otter;P:panda,parrot;R:rabbit,rhino;S:snake,shark;T:tiger,turtle;W:wolf,whale",
  "🍔 Food or drink": "A:apple,almond;B:banana,bread;C:cake,cheese;D:donut,dosa;E:egg,eclair;F:fries,falafel;G:grapes,garlic;H:honey,hamburger;I:ice cream,idli;K:kebab,kiwi;L:lemon,lassi;M:mango,milk;N:noodles,naan;O:orange,omelette;P:pizza,paneer;R:rice,raita;S:samosa,soup;T:tea,tacos;W:waffle,watermelon",
  "🌍 City or country": "A:Australia,Agra;B:Brazil,Bangalore;C:Canada,Chennai;D:Delhi,Denmark;E:Egypt,England;F:France,Finland;G:Germany,Goa;H:Hyderabad,Hawaii;I:India,Italy;K:Kenya,Kolkata;L:London,Lucknow;M:Mumbai,Mexico;N:Nepal,Nigeria;O:Oman,Oslo;P:Paris,Pune;R:Russia,Rome;S:Spain,Sydney;T:Tokyo,Turkey;W:Wales,Warsaw",
  "🧑 A person's name": "A:Aarav,Anna;B:Bella,Ben;C:Chloe,Charlie;D:David,Diya;E:Emma,Ethan;F:Fiona,Farhan;G:George,Gita;H:Harry,Hannah;I:Isha,Ivan;K:Kavya,Kevin;L:Liam,Lily;M:Maya,Mohan;N:Nina,Noah;O:Oliver,Olivia;P:Priya,Peter;R:Riya,Ryan;S:Sara,Sam;T:Tara,Tom;W:Will,Wendy",
  "💼 Job": "A:actor,artist;B:baker,banker;C:chef,cleaner;D:doctor,driver;E:engineer,editor;F:farmer,fireman;G:guard,gardener;H:hairdresser,host;I:inventor,illustrator;K:karate coach,kebab seller;L:lawyer,librarian;M:mechanic,musician;N:nurse,newsreader;O:optician,officer;P:pilot,plumber;R:reporter,receptionist;S:singer,scientist;T:teacher,tailor;W:waiter,writer",
  "🏠 Thing in a house": "A:armchair,alarm clock;B:bed,bucket;C:chair,curtain;D:door,desk;E:extension cord,exhaust fan;F:fan,fridge;G:geyser,glass;H:heater,hanger;I:iron,inverter;K:kettle,key;L:lamp,laptop;M:mirror,mattress;N:newspaper,notebook;O:oven,ottoman;P:pillow,plate;R:radio,remote;S:sofa,stove;T:table,television;W:wardrobe,window",
  "👕 Something you wear": "A:apron,anklet;B:belt,boots;C:cap,coat;D:dress,dupatta;E:earrings,earmuffs;F:frock,flip flops;G:gloves,gown;H:hat,hoodie;I:innerwear,insoles;K:kurta,kilt;L:leggings,lehenga;M:mittens,muffler;N:necktie,nightgown;O:overcoat,overalls;P:pants,pyjamas;R:robe,raincoat;S:shirt,socks;T:tshirt,turban;W:watch,waistcoat",
  "⚽ Sport or game": "A:archery,athletics;B:badminton,basketball;C:cricket,chess;D:darts,diving;E:esports,equestrian;F:football,fencing;G:golf,gymnastics;H:hockey,handball;I:ice hockey,ice skating;K:kabaddi,karate;L:ludo,luge;M:marathon,mahjong;N:netball,ninepins;O:orienteering,outrigger;P:polo,ping pong;R:rugby,rowing;S:squash,swimming;T:tennis,table tennis;W:wrestling,weightlifting",
};
const SCAT = {};
for (const cat of Object.keys(SCAT_RAW)) {
  SCAT[cat] = {};
  for (const part of SCAT_RAW[cat].split(";")) { const [L, w] = part.split(":"); SCAT[cat][L] = w.split(","); }
}
const CAT_NAMES = Object.keys(SCAT);

// [word, emoji sequence]
const DRAW_WORDS = [
  ["pizza", "🍕 🧀"], ["elephant", "🐘"], ["rainbow", "🌈"], ["volcano", "🌋"], ["rocket", "🚀"], ["snowman", "⛄ ❄️"],
  ["camera", "📷"], ["guitar", "🎸"], ["bicycle", "🚲"], ["butterfly", "🦋"], ["umbrella", "☂️"], ["pirate", "🏴‍☠️ 🦜"],
  ["dragon", "🐉 🔥"], ["castle", "🏰"], ["ghost", "👻"], ["robot", "🤖"], ["cactus", "🌵"], ["sunflower", "🌻"],
  ["football", "⚽"], ["cricket", "🏏"], ["birthday cake", "🎂 🎈"], ["ice cream", "🍦"], ["popcorn", "🍿"], ["spider", "🕷️"],
  ["shark", "🦈"], ["tornado", "🌪️"], ["mermaid", "🧜‍♀️ 🌊"], ["vampire", "🧛 🦇"], ["alien", "👽 🛸"], ["treasure", "💎 🗺️"],
  ["airplane", "✈️"], ["train", "🚂"], ["moon", "🌙"], ["telescope", "🔭 ⭐"], ["headphones", "🎧"], ["skeleton", "💀"],
  ["fireworks", "🎆"], ["clock", "⏰"], ["crown", "👑"], ["banana", "🍌"], ["watermelon", "🍉"], ["octopus", "🐙"],
  ["penguin", "🐧 ❄️"], ["owl", "🦉"], ["peacock", "🦚"], ["kite", "🪁"], ["tent", "⛺ 🔥"], ["bridge", "🌉"],
  ["Harry Potter", "⚡ 🧙"], ["Titanic", "🚢 🧊 💔"], ["Spider Man", "🕷️ 🧑"], ["Frozen", "❄️ 👸"], ["Lion King", "🦁 👑"],
  ["Finding Nemo", "🐠 🔍"], ["Jurassic Park", "🦖 🌴"], ["Santa Claus", "🎅 🎁"],
].map(a => [a[0], a[1].split(" ")]);

const CODE_RAW = {
  ocean: "whale shark wave beach ship coral pearl anchor",
  space: "moon star rocket planet comet orbit alien galaxy",
  food: "pizza burger bread cheese pasta cake rice soup",
  animal: "tiger lion horse zebra monkey rabbit camel panda",
  fire: "flame match torch ash smoke volcano dragon candle",
  winter: "snow ice coat sled frost mitten igloo penguin",
  music: "piano drum guitar song band flute violin choir",
  school: "teacher desk pencil book class exam bell chalk",
  medical: "doctor nurse pill bandage hospital vaccine ambulance needle",
  sport: "cricket football tennis goal racket helmet medal referee",
  magic: "wizard wand spell potion ghost witch crystal cape",
  royal: "king queen crown castle throne prince palace knight",
  city: "bridge tower taxi subway street market museum skyscraper",
  farm: "cow barn tractor hay sheep farmer field goat",
  money: "bank coin gold wallet cash rich diamond treasure",
  water: "river lake rain pond fountain bottle stream wave",
  travel: "airport passport ticket hotel suitcase train map bus",
  kitchen: "knife fork spoon plate oven kettle pan fridge",
  body: "hand foot eye heart brain nose tooth knee",
  weather: "storm cloud thunder wind rainbow lightning fog sun",
  electric: "battery wire plug lamp switch robot computer laser",
  building: "brick door window roof wall ladder hammer nail",
  crime: "robber mask jail police key safe detective handcuff",
  party: "balloon cake dance gift candle music confetti drum",
  horror: "vampire zombie skeleton coffin bat spider grave ghost",
  garden: "flower seed bee tree leaf rose grass worm",
  bird: "eagle owl parrot duck feather nest wing egg",
  story: "page author library novel poem cover shelf book",
  game: "chess dice card board puzzle joker token maze",
  clothes: "shirt shoe hat sock scarf belt glove jeans",
  desert: "sand camel cactus oasis dune scorpion pyramid mirage",
  hero: "cape mask shield villain power cave flight strength",
  phone: "call screen camera signal message charger selfie apple",
  india: "curry temple saree spice monsoon bollywood yoga chai",
  car: "wheel engine brake road driver horn tyre fuel",
  sleep: "bed pillow dream blanket night snore alarm pajama",
};
const CODE_GROUPS = Object.entries(CODE_RAW).map(([k, v]) => [k, v.split(" ")]);
const CODE_POOL = [...new Set(CODE_GROUPS.flatMap(g => g[1]))];

const CHAIN_RAW = {
  a: "apple anchor animal angel ancient answer autumn artist airport april arrow amber album alarm actor",
  b: "banana bridge butter basket button bottle bread brain beach bubble blanket bicycle bird bakery",
  c: "castle candle camera circle cookie cloud coffee cabin carpet cheese cherry clock cactus comet",
  d: "dragon doctor dinner dolphin desert donkey diamond dance dream drum daisy dentist dust",
  e: "eagle engine energy elbow empire earth elephant echo effort eleven exam easter evening",
  f: "forest flower finger friend fabric falcon feather fruit fire future fridge fiddle frog",
  g: "garden guitar ginger galaxy glass grape ghost gold giraffe gentle glove grass goblin",
  h: "house honey hammer hunter harbor heart hotel hungry hill horse helmet hockey hobby",
  i: "island insect iron ivory ignore image idea igloo invent indigo ink iris",
  j: "jungle jacket jelly jewel journey juice jaguar jumper jester jigsaw jolly",
  k: "kitchen kettle kingdom kitten knight kite koala kernel keyboard knife knot kayak",
  l: "lemon ladder lizard lantern lesson lunch lion lamp laptop leopard lobster lucky lake",
  m: "monkey mountain magic marble mirror muffin market music mango mouse meadow melon mask",
  n: "nature needle night noodle nephew number nest napkin nickel novel nurse narrow nylon",
  o: "orange ocean otter object online orbit oyster onion office opera olive oven owl",
  p: "purple pencil planet pocket pepper pirate pillow potato puzzle pigeon parrot palace piano",
  q: "quiz queen quick quiet quilt quartz quote quest quack quarter",
  r: "rabbit rocket river ribbon robot rainbow rose ranger rubber ruler rice rumor",
  s: "summer spider silver sunset shadow spoon sugar spice snake sailor seven soap salad",
  t: "tiger tunnel turtle table ticket tomato temple thunder toast tower travel tulip trumpet",
  u: "umbrella uncle unicorn unique upper urban usual under useful union unit upset",
  v: "village violin velvet valley vanilla vision voice vulture vapor vendor vest video",
  w: "window winter wizard walnut whale wallet wagon whisper water wonder wolf wheel wind",
  x: "xylophone xenon xerox",
  y: "yellow yogurt yacht yawn yarn young youth yoga yodel yeti",
  z: "zebra zero zone zoom zipper zigzag zombie zodiac",
};
const CHAIN = {};
for (const k of Object.keys(CHAIN_RAW)) CHAIN[k] = CHAIN_RAW[k].split(" ");
const CHAIN_SEEDS = Object.values(CHAIN).flat().filter(w => !"xqzjv".includes(w[w.length - 1]));

const BOT_NAMES = ["Robo Ravi", "Byte", "Pixel", "Nova", "Turbo", "Zippy", "Echo", "Glitch", "Sparky", "Mochi"];
const BOT_AV = ["🤖", "👾", "🦾", "🛸", "🧠", "⚡", "🎮", "🪄", "🧩", "📡"];
const AVATARS = ["😎", "🦊", "🐼", "🐯", "🦄", "🐸", "🐵", "🦁", "🐙", "🦉", "🐧", "🐲", "👻", "👽", "🤠", "🥷", "🧙", "🧛", "🦸", "🧜", "🐝", "🦋", "🍕", "🌈"];

/* ====================== HELPERS ====================== */
const R = n => Math.floor(Math.random() * n);
const pick = a => a[R(a.length)];
const rid = (n = 8) => crypto.randomBytes(12).toString("base64url").slice(0, n);
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = R(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const norm = s => String(s == null ? "" : s).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
const clean = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const T = ms => Math.max(40, Math.round(ms / FAST));
class Fail extends Error { constructor(m, s) { super(m); this.status = s || 400; } }
function lev(a, b) {
  if (a === b) return 0; if (Math.abs(a.length - b.length) > 2) return 3;
  const d = []; for (let i = 0; i <= a.length; i++) { d[i] = [i]; }
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/* ====================== LOBBIES ====================== */
const lobbies = new Map();
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genCode() {
  for (let k = 0; k < 60; k++) {
    let c = ""; for (let i = 0; i < 4; i++) c += CODE_CHARS[R(CODE_CHARS.length)];
    if (!lobbies.has(c)) return c;
  }
  return null;
}
function getLobby(code) {
  const l = lobbies.get(String(code || "").toUpperCase().trim());
  if (!l) throw new Fail("No lobby with that code. Check the letters and try again.", 404);
  l.touched = Date.now(); return l;
}
const humans = l => [...l.players.values()].filter(p => !p.bot).map(p => p.id);
const bots = l => [...l.players.values()].filter(p => p.bot).map(p => p.id);
const pname = (l, id) => (l.players.get(id) || {}).name || "Someone";

function freeAvatar(l) {
  const used = new Set([...l.players.values()].map(p => p.avatar));
  return AVATARS.find(a => !used.has(a)) || pick(AVATARS);
}
function addPlayer(l, id, name) {
  l.players.set(id, { id, name, avatar: freeAvatar(l), bot: false, joinedAt: Date.now() });
  l.scores[id] = 0; l.hearts[id] = 0;
}
function addBot(l) {
  if (l.players.size >= MAX_PLAYERS) throw new Fail("The lobby is full.");
  const usedN = new Set([...l.players.values()].map(p => p.name));
  const usedA = new Set([...l.players.values()].map(p => p.avatar));
  const name = BOT_NAMES.find(n => !usedN.has(n)) || ("Bot " + (l.players.size + 1));
  const avatar = BOT_AV.find(a => !usedA.has(a)) || "🤖";
  const id = "bot" + rid(6);
  l.players.set(id, { id, name, avatar, bot: true, joinedAt: Date.now() });
  l.scores[id] = 0; l.hearts[id] = 0;
  return id;
}
function newLobby(code, pid, name, solo) {
  const l = {
    code, host: pid, players: new Map(), phase: "lobby", game: null,
    settings: { game: "bluff", rounds: 5, turns: 1, scat: 3, style: "mix", lives: 3 },
    scores: {}, hearts: {}, chat: [], items: [], run: 0, iid: 0, cid: 0,
    clients: new Map(), tok: 0, timers: new Set(), touched: Date.now(), solo: !!solo,
  };
  addPlayer(l, pid, name);
  lobbies.set(code, l);
  if (solo) { for (let i = 0; i < 3; i++) addBot(l); sys(l, "🤖 Solo mode: you are playing with 3 computer players."); }
  sys(l, "🎉 " + name + " created the lobby " + code);
  return l;
}

/* ---------- chat / items ---------- */
function sys(l, text) { l.chat.push({ id: ++l.cid, sys: true, text, t: Date.now() }); if (l.chat.length > 200) l.chat.shift(); }
function say(l, by, text) { l.chat.push({ id: ++l.cid, by, text, t: Date.now() }); if (l.chat.length > 200) l.chat.shift(); }
function mkItem(l, o) {
  const it = { id: ++l.iid, run: l.run, author: o.author, text: clean(o.text, 160), label: clean(o.label, 80), game: o.game, likes: [], comments: [] };
  l.items.push(it); if (l.items.length > 400) l.items.shift();
  return it.id;
}
function recountHearts(l) {
  for (const id of Object.keys(l.hearts)) l.hearts[id] = 0;
  for (const it of l.items) if (it.author in l.hearts) l.hearts[it.author] += it.likes.filter(x => x !== it.author).length;
}
function itemView(it, pid) {
  return { id: it.id, author: it.author, text: it.text, label: it.label, game: it.game, likes: it.likes.length, liked: it.likes.includes(pid), comments: it.comments.slice(-25).map(c => ({ id: c.id, by: c.by, text: c.text })) };
}
function hall(l, pid) {
  return l.items.filter(i => i.likes.length > 0).sort((a, b) => b.likes.length - a.likes.length || b.id - a.id).slice(0, 5).map(i => itemView(i, pid));
}

/* ---------- scheduler ---------- */
function clearT(l) { for (const t of l.timers) clearTimeout(t); l.timers.clear(); }
function newPhase(l) { l.tok++; clearT(l); }
function after(l, ms, fn) {
  const tok = l.tok;
  const t = setTimeout(() => {
    l.timers.delete(t);
    if (l.tok !== tok || !lobbies.has(l.code)) return;
    try { fn(); } catch (e) { console.error(e); }
    broadcast(l);
  }, T(ms));
  l.timers.add(t); return t;
}
function timed(l, ms, fn) { l.game.deadline = Date.now() + T(ms); l.game.total = T(ms); after(l, ms, fn); }
const leftMs = g => (g.deadline ? Math.max(0, g.deadline - Date.now()) : 0);

function award(l, pid, n) {
  const g = l.game; if (!g || !l.players.has(pid) || !n) return;
  l.scores[pid] = (l.scores[pid] || 0) + n;
  g.pts[pid] = (g.pts[pid] || 0) + n;
  g.delta[pid] = (g.delta[pid] || 0) + n;
}

/* ====================== GAME REGISTRY ====================== */
const GAMES = {};
const GAME_META = {
  bluff: { min: 3 }, wave: { min: 2 }, scat: { min: 2 }, draw: { min: 2 }, code: { min: 2 }, chain: { min: 2 },
};

function startGame(l) {
  const meta = GAME_META[l.settings.game]; if (!meta) throw new Fail("Pick a game first.");
  if (l.players.size < meta.min) throw new Fail("This game needs at least " + meta.min + " players. Invite a friend or add a computer player!");
  newPhase(l);
  l.run++; l.phase = "game"; l.game = null;
  GAMES[l.settings.game].start(l);
  sys(l, "🎮 Game started!");
}
function toLobby(l) {
  newPhase(l); l.phase = "lobby"; l.game = null;
}
function endGame(l) {
  const g = l.game; newPhase(l); g.phase = "over"; g.deadline = 0;
  const ranked = Object.keys(g.pts).filter(id => l.players.has(id)).sort((a, b) => g.pts[b] - g.pts[a]);
  if (ranked.length) sys(l, "🏆 " + pname(l, ranked[0]) + " won with " + g.pts[ranked[0]] + " points!");
  const b = bots(l); if (b.length) say(l, pick(b), pick(["gg! 🔥", "well played 👏", "rematch? 😈", "my circuits are tired 🤖", "that was fun! 🎉"]));
}

/* ====================== VIEWS / SENDING ====================== */
function view(l, pid) {
  const players = [...l.players.values()].map(p => ({ id: p.id, name: p.name, avatar: p.avatar, bot: !!p.bot, score: l.scores[p.id] || 0, hearts: l.hearts[p.id] || 0 }));
  const v = {
    code: l.code, you: pid, host: l.host, solo: l.solo, players, phase: l.phase, settings: l.settings,
    mins: Object.fromEntries(Object.entries(GAME_META).map(([k, m]) => [k, m.min])),
    game: l.phase === "game" && l.game ? GAMES[l.game.type].view(l, pid) : null,
    chat: l.chat.slice(-80), items: l.items.filter(i => i.run === l.run).map(i => itemView(i, pid)), hall: hall(l, pid), run: l.run,
  };
  return v;
}
function send(res, event, data) {
  if (event) res.write("event: " + event + "\n");
  res.write("data: " + JSON.stringify(data) + "\n\n");
}
function broadcast(l) {
  for (const [pid, set] of l.clients) {
    if (!l.players.has(pid)) continue;
    const v = view(l, pid);
    for (const res of set) { try { send(res, null, v); } catch (e) {} }
  }
}
function relay(l, event, data, exceptPid) {
  for (const [pid, set] of l.clients) {
    if (pid === exceptPid) continue;
    for (const res of set) { try { send(res, event, data); } catch (e) {} }
  }
}

/* ====================== LOBBY ACTIONS ====================== */
const SETTING_RULES = {
  rounds: [3, 5, 8], turns: [1, 2], scat: [3, 5], lives: [2, 3, 5], style: ["draw", "emoji", "mix"],
};
function removePlayer(l, pid, kicked) {
  const set = l.clients.get(pid);
  if (set) { for (const res of set) { try { send(res, kicked ? "kicked" : "left", {}); res.end(); } catch (e) {} } l.clients.delete(pid); }
  const was = l.players.get(pid); l.players.delete(pid); delete l.scores[pid]; delete l.hearts[pid];
  if (!was) return;
  if (!humans(l).length) { newPhase(l); lobbies.delete(l.code); return false; }
  if (l.host === pid) { l.host = humans(l)[0]; sys(l, "👑 " + pname(l, l.host) + " is the host now"); }
  if (l.phase === "game") { toLobby(l); sys(l, "⚠️ " + was.name + " left, so the game went back to the lobby."); }
  else sys(l, was.name + (kicked ? " was removed" : " left the lobby"));
}

function act(l, pid, b) {
  const type = String(b.type || "");
  const isHost = pid === l.host;
  const me = l.players.get(pid);
  if (type.startsWith("g_")) {
    const g = l.game; if (l.phase !== "game" || !g) throw new Fail("No game is running right now.");
    return GAMES[g.type].act(l, pid, b);
  }
  switch (type) {
    case "pick": { if (!isHost) throw new Fail("Only the host can pick the game."); if (l.phase !== "lobby") throw new Fail("A game is running."); if (!GAME_META[b.game]) throw new Fail("Unknown game."); l.settings.game = b.game; return; }
    case "opt": {
      if (!isHost) throw new Fail("Only the host can change settings."); if (l.phase !== "lobby") throw new Fail("A game is running.");
      const rule = SETTING_RULES[b.k]; if (!rule) throw new Fail("Unknown setting.");
      const val = typeof rule[0] === "number" ? Number(b.v) : String(b.v);
      if (!rule.includes(val)) throw new Fail("Invalid value."); l.settings[b.k] = val; return;
    }
    case "start": case "again": {
      if (!isHost) throw new Fail("Only the host can start the game.");
      if (type === "start" && l.phase !== "lobby") throw new Fail("A game is already running.");
      if (type === "again" && !(l.game && l.game.phase === "over")) throw new Fail("The game isn't over yet.");
      startGame(l); return;
    }
    case "backLobby": { if (!isHost) throw new Fail("Only the host can do that."); toLobby(l); return; }
    case "addBot": {
      if (!isHost) throw new Fail("Only the host can add computer players."); if (l.phase !== "lobby") throw new Fail("Wait for the game to finish.");
      const id = addBot(l); sys(l, "🤖 " + pname(l, id) + " (computer) joined"); return;
    }
    case "rmBot": {
      if (!isHost) throw new Fail("Only the host can remove computer players."); if (l.phase !== "lobby") throw new Fail("Wait for the game to finish.");
      const p = l.players.get(String(b.id)); if (!p || !p.bot) throw new Fail("That isn't a computer player.");
      l.players.delete(p.id); delete l.scores[p.id]; delete l.hearts[p.id]; return;
    }
    case "kick": {
      if (!isHost) throw new Fail("Only the host can remove players."); if (l.phase !== "lobby") throw new Fail("Wait for the game to finish.");
      const id = String(b.id); if (id === pid) throw new Fail("You can't remove yourself.");
      const p = l.players.get(id); if (!p) return;
      if (p.bot) { l.players.delete(id); delete l.scores[id]; delete l.hearts[id]; return; }
      removePlayer(l, id, true); return;
    }
    case "rename": { const n = clean(b.name, 16); if (!n) throw new Fail("Name can't be empty."); me.name = n; return; }
    case "avatar": {
      const a = String(b.emoji || ""); if (!AVATARS.includes(a)) throw new Fail("Pick one of the avatars.");
      if ([...l.players.values()].some(p => p.avatar === a && p.id !== pid)) throw new Fail("Someone already has that one.");
      me.avatar = a; return;
    }
    case "chat": { const t = clean(b.text, 200); if (!t) return false; say(l, pid, t); return; }
    case "chatEdit": { const m = l.chat.find(x => x.id === Number(b.id)); if (!m || m.by !== pid) throw new Fail("You can only edit your own messages."); const t = clean(b.text, 200); if (!t) throw new Fail("Message can't be empty."); m.text = t; m.edited = true; return; }
    case "chatDel": { const i = l.chat.findIndex(x => x.id === Number(b.id)); if (i < 0) return; if (l.chat[i].by !== pid && !isHost) throw new Fail("Not your message."); l.chat.splice(i, 1); return; }
    case "like": {
      const it = l.items.find(x => x.id === Number(b.id)); if (!it) return;
      const k = it.likes.indexOf(pid); if (k >= 0) it.likes.splice(k, 1); else it.likes.push(pid);
      recountHearts(l); return;
    }
    case "comment": {
      const it = l.items.find(x => x.id === Number(b.id)); if (!it) throw new Fail("That moment is gone.");
      const t = clean(b.text, 140); if (!t) return false;
      it.comments.push({ id: ++l.cid, by: pid, text: t, t: Date.now() }); if (it.comments.length > 40) it.comments.shift(); return;
    }
    case "commentDel": {
      const it = l.items.find(x => x.id === Number(b.id)); if (!it) return;
      const i = it.comments.findIndex(c => c.id === Number(b.cid)); if (i < 0) return;
      if (it.comments[i].by !== pid && !isHost) throw new Fail("Not your comment."); it.comments.splice(i, 1); return;
    }
    case "leave": { if (removePlayer(l, pid, false) === false) return false; return; }
    default: throw new Fail("Unknown action.");
  }
}

/* ====================== GAME 1: BLUFF ====================== */
GAMES.bluff = {
  start(l) {
    const rounds = l.settings.rounds;
    const g = { type: "bluff", phase: "", round: 0, rounds, pts: {}, delta: {}, deadline: 0, qs: shuffle(FACTS).slice(0, rounds) };
    for (const id of l.players.keys()) g.pts[id] = 0;
    l.game = g; this.round(l);
  },
  round(l) {
    const g = l.game; newPhase(l);
    if (g.round >= g.rounds) return endGame(l);
    g.round++; g.q = g.qs[g.round - 1]; g.phase = "write"; g.lies = {}; g.options = null; g.picks = {}; g.delta = {};
    for (const b of bots(l)) after(l, 3000 + R(9000), () => { if (g.phase === "write" && !g.lies[b]) { g.lies[b] = pick(g.q[2]); this.checkWrite(l); } });
    timed(l, 50000, () => this.pickPhase(l));
  },
  checkWrite(l) { const g = l.game; if (g.phase === "write" && humans(l).every(h => g.lies[h])) this.pickPhase(l); },
  pickPhase(l) {
    const g = l.game; newPhase(l); g.phase = "pick";
    const fakes = shuffle(g.q[2]); let fi = 0;
    for (const b of bots(l)) if (!g.lies[b]) g.lies[b] = fakes[fi++ % fakes.length];
    const map = new Map();
    map.set(norm(g.q[1]), { text: g.q[1], truth: true, authors: [] });
    for (const [pid, text] of Object.entries(g.lies)) {
      if (!l.players.has(pid)) continue;
      const k = norm(text); if (!k) continue;
      if (map.has(k)) { if (!map.get(k).truth) map.get(k).authors.push(pid); continue; }
      map.set(k, { text, truth: false, authors: [pid] });
    }
    for (const f of shuffle(g.q[2])) { if (map.size >= 4) break; const k = norm(f); if (!map.has(k)) map.set(k, { text: f, truth: false, authors: [] }); }
    g.options = shuffle([...map.values()]).map((o, i) => Object.assign(o, { id: "o" + i }));
    for (const b of bots(l)) after(l, 3000 + R(8000), () => {
      if (g.phase !== "pick" || g.picks[b]) return;
      const truth = g.options.find(o => o.truth);
      const others = g.options.filter(o => !o.truth && !o.authors.includes(b));
      g.picks[b] = (Math.random() < 0.4 || !others.length ? truth : pick(others)).id; this.checkPick(l);
    });
    timed(l, 30000, () => this.reveal(l));
  },
  checkPick(l) { const g = l.game; if (g.phase === "pick" && humans(l).every(h => g.picks[h])) this.reveal(l); },
  reveal(l) {
    const g = l.game; newPhase(l); g.phase = "reveal";
    for (const [pid, oid] of Object.entries(g.picks)) {
      const o = g.options.find(x => x.id === oid); if (!o) continue;
      if (o.truth) award(l, pid, 2); else for (const a of o.authors) if (a !== pid) award(l, a, 1);
    }
    for (const o of g.options) if (!o.truth && o.authors.length) o.item = mkItem(l, { author: o.authors[0], text: o.text, label: "🎭 Bluff: " + g.q[0].replace("___", "…"), game: "bluff" });
    timed(l, 16000, () => this.round(l));
  },
  act(l, pid, b) {
    const g = l.game;
    if (b.type === "g_lie") {
      if (g.phase !== "write") throw new Fail("Too late to write a lie.");
      const t = clean(b.text, 60); if (!norm(t)) throw new Fail("Write something sneaky first.");
      if (norm(t) === norm(g.q[1])) throw new Fail("Oops, that's the REAL answer! Think of a lie.");
      g.lies[pid] = t; this.checkWrite(l); return;
    }
    if (b.type === "g_pick") {
      if (g.phase !== "pick") throw new Fail("Too late to pick.");
      if (g.picks[pid]) throw new Fail("You already locked in.");
      const o = g.options.find(x => x.id === String(b.opt)); if (!o) throw new Fail("Unknown option.");
      if (o.authors.includes(pid)) throw new Fail("That's your own lie! Pick another.");
      g.picks[pid] = o.id; this.checkPick(l); return;
    }
    if (b.type === "g_next") { if (pid !== l.host) throw new Fail("Only the host can skip."); if (g.phase === "reveal") this.round(l); return; }
    throw new Fail("Unknown game action.");
  },
  view(l, pid) {
    const g = l.game;
    const v = { type: "bluff", phase: g.phase, round: g.round, rounds: g.rounds, left: leftMs(g), total: g.total || 0, pts: g.pts, delta: g.delta, q: g.q ? g.q[0] : "" };
    if (g.phase === "write") { v.submitted = Object.keys(g.lies).filter(x => !l.players.get(x).bot); v.mine = g.lies[pid] || ""; }
    if (g.phase === "pick") { v.options = g.options.map(o => ({ id: o.id, text: o.text, mine: o.authors.includes(pid) })); v.picked = Object.keys(g.picks); v.myPick = g.picks[pid] || null; }
    if (g.phase === "reveal") v.options = g.options.map(o => ({ id: o.id, text: o.text, truth: o.truth, authors: o.authors, item: o.item || 0, pickers: Object.keys(g.picks).filter(p => g.picks[p] === o.id) }));
    return v;
  },
};

/* ====================== GAME 2: WAVELENGTH ====================== */
function waveScore(d) { return d <= 4 ? 4 : d <= 10 ? 3 : d <= 18 ? 2 : d <= 28 ? 1 : 0; }
GAMES.wave = {
  start(l) {
    const ids = shuffle([...l.players.keys()]); const order = [];
    for (let t = 0; t < l.settings.turns; t++) order.push(...ids);
    const g = { type: "wave", phase: "", round: 0, rounds: order.length, order, pts: {}, delta: {}, deadline: 0, specs: shuffle(SPECTRA) };
    for (const id of l.players.keys()) g.pts[id] = 0;
    l.game = g; this.round(l);
  },
  round(l) {
    const g = l.game; newPhase(l);
    if (g.round >= g.rounds) return endGame(l);
    g.round++; g.psy = g.order[g.round - 1]; g.spec = g.specs[(g.round - 1) % g.specs.length];
    g.target = 6 + R(89); g.clue = ""; g.guesses = {}; g.locked = {}; g.skipped = false; g.delta = {}; g.phase = "clue"; g.item = 0;
    if (!l.players.has(g.psy)) return this.round(l);
    if (l.players.get(g.psy).bot) after(l, 2500 + R(2500), () => { const c = pick(g.spec[4]); g.target = clamp(c[0] + R(7) - 3, 3, 97); g.clue = c[1]; this.guessPhase(l); });
    timed(l, 45000, () => { g.clue = ""; g.skipped = true; this.reveal(l); });
  },
  guessers(l) { const g = l.game; return [...l.players.keys()].filter(x => x !== g.psy); },
  guessPhase(l) {
    const g = l.game; newPhase(l); g.phase = "guess";
    for (const b of this.guessers(l).filter(x => l.players.get(x).bot)) after(l, 4000 + R(14000), () => {
      if (g.phase !== "guess" || g.locked[b]) return; g.guesses[b] = clamp(g.target + R(37) - 18, 0, 100); g.locked[b] = true; this.check(l);
    });
    timed(l, 40000, () => this.reveal(l));
  },
  check(l) { const g = l.game; if (g.phase === "guess" && this.guessers(l).filter(x => !l.players.get(x).bot).every(h => g.locked[h])) this.reveal(l); },
  reveal(l) {
    const g = l.game; newPhase(l); g.phase = "reveal"; g.results = [];
    if (!g.skipped) {
      let sum = 0, n = 0;
      for (const id of this.guessers(l)) {
        const has = g.locked[id]; const d = has ? Math.abs(g.guesses[id] - g.target) : null; const p = has ? waveScore(d) : 0;
        if (has) award(l, id, p); sum += p; n++;
        g.results.push({ id, v: has ? g.guesses[id] : null, d, p });
      }
      award(l, g.psy, n ? Math.round(sum / n) : 0);
      g.item = mkItem(l, { author: g.psy, text: g.clue, label: "📡 Wavelength: " + g.spec[0] + " ↔ " + g.spec[1], game: "wave" });
    }
    timed(l, 13000, () => this.round(l));
  },
  act(l, pid, b) {
    const g = l.game;
    if (b.type === "g_clue") {
      if (g.phase !== "clue" || pid !== g.psy) throw new Fail("It's not your turn to give a clue.");
      const t = clean(b.text, 40); if (!t) throw new Fail("Type a clue first.");
      g.clue = t; this.guessPhase(l); return;
    }
    if (b.type === "g_lock") {
      if (g.phase !== "guess" || pid === g.psy) throw new Fail("You can't lock in right now.");
      if (g.locked[pid]) throw new Fail("Already locked in.");
      g.guesses[pid] = clamp(Math.round(Number(b.v)), 0, 100); g.locked[pid] = true; this.check(l); return;
    }
    if (b.type === "g_next") { if (pid !== l.host) throw new Fail("Only the host can skip."); if (g.phase === "reveal") this.round(l); return; }
    throw new Fail("Unknown game action.");
  },
  view(l, pid) {
    const g = l.game;
    const v = { type: "wave", phase: g.phase, round: g.round, rounds: g.rounds, left: leftMs(g), total: g.total || 0, pts: g.pts, delta: g.delta, psy: g.psy, spec: g.spec ? g.spec.slice(0, 4) : null, clue: g.clue };
    if (g.phase === "clue" && pid === g.psy) v.target = g.target;
    if (g.phase === "guess") { v.locked = Object.keys(g.locked); v.mine = g.guesses[pid] == null ? null : g.guesses[pid]; if (pid === g.psy) v.target = g.target; }
    if (g.phase === "reveal") { v.target = g.target; v.results = g.results; v.skipped = g.skipped; v.item = g.item; }
    return v;
  },
};

/* ====================== GAME 3: SCATTERGORIES ====================== */
const strip = s => norm(s).replace(/s$/, "");
GAMES.scat = {
  start(l) {
    const rounds = l.settings.scat;
    const g = { type: "scat", phase: "", round: 0, rounds, pts: {}, delta: {}, deadline: 0, letters: shuffle(LETTERS).slice(0, rounds) };
    for (const id of l.players.keys()) g.pts[id] = 0;
    l.game = g; this.round(l);
  },
  round(l) {
    const g = l.game; newPhase(l);
    if (g.round >= g.rounds) return endGame(l);
    g.round++; g.letter = g.letters[g.round - 1]; g.cats = shuffle(CAT_NAMES).slice(0, 5);
    g.ans = {}; g.done = {}; g.rejects = {}; g.judged = {}; g.entries = []; g.delta = {}; g.phase = "write";
    for (const b of bots(l)) after(l, 6000 + R(28000), () => {
      if (g.phase !== "write") return;
      g.ans[b] = g.cats.map(c => Math.random() < 0.78 ? pick(SCAT[c][g.letter]) : ""); g.done[b] = true; this.checkWrite(l);
    });
    timed(l, 75000, () => this.judge(l));
  },
  checkWrite(l) { const g = l.game; if (g.phase === "write" && humans(l).every(h => g.done[h])) this.judge(l); },
  valid(g, text) { const n = norm(text); return n.length >= 2 && n[0] === g.letter.toLowerCase(); },
  judge(l) {
    const g = l.game; newPhase(l); g.phase = "judge";
    for (const b of bots(l)) if (!g.ans[b]) g.ans[b] = g.cats.map(c => Math.random() < 0.78 ? pick(SCAT[c][g.letter]) : "");
    g.entries = [];
    g.cats.forEach((c, ci) => { for (const pid of l.players.keys()) { const t = (g.ans[pid] || [])[ci]; if (t && this.valid(g, t)) g.entries.push({ key: ci + ":" + pid, ci, pid, text: t, status: "ok", pts: 0 }); } });
    timed(l, 40000, () => this.score(l));
    if (!g.entries.length) this.score(l);
  },
  score(l) {
    const g = l.game; newPhase(l); g.phase = "reveal";
    const hs = humans(l);
    for (const e of g.entries) {
      const voters = hs.filter(h => h !== e.pid).length; const rej = (g.rejects[e.key] || new Set()).size;
      if (voters > 0 && rej * 2 > voters) e.status = "rejected";
    }
    g.cats.forEach((c, ci) => {
      const ok = g.entries.filter(e => e.ci === ci && e.status !== "rejected"); const cnt = {};
      for (const e of ok) cnt[strip(e.text)] = (cnt[strip(e.text)] || 0) + 1;
      for (const e of ok) { e.status = cnt[strip(e.text)] > 1 ? "dup" : "ok"; e.pts = e.status === "dup" ? 1 : 2; award(l, e.pid, e.pts); e.item = mkItem(l, { author: e.pid, text: e.text, label: "🔤 " + g.letter + " · " + c.replace(/^\S+\s/, ""), game: "scat" }); }
    });
    timed(l, 16000, () => this.round(l));
  },
  act(l, pid, b) {
    const g = l.game;
    if (b.type === "g_scat") {
      if (g.phase !== "write") throw new Fail("Time's up for this round.");
      if (g.done[pid]) throw new Fail("You already locked your answers.");
      const a = Array.isArray(b.answers) ? b.answers.slice(0, 5).map(x => clean(x, 30)) : []; while (a.length < 5) a.push("");
      g.ans[pid] = a; if (b.done) { g.done[pid] = true; this.checkWrite(l); } return;
    }
    if (b.type === "g_reject") {
      if (g.phase !== "judge") throw new Fail("Judging is over.");
      const e = g.entries.find(x => x.key === String(b.key)); if (!e) return;
      if (e.pid === pid) throw new Fail("You can't reject your own answer.");
      const s = g.rejects[e.key] || (g.rejects[e.key] = new Set()); if (s.has(pid)) s.delete(pid); else s.add(pid); return;
    }
    if (b.type === "g_judged") {
      if (g.phase !== "judge") return; g.judged[pid] = true;
      if (humans(l).every(h => g.judged[h])) this.score(l); return;
    }
    if (b.type === "g_next") { if (pid !== l.host) throw new Fail("Only the host can skip."); if (g.phase === "reveal") this.round(l); return; }
    throw new Fail("Unknown game action.");
  },
  view(l, pid) {
    const g = l.game;
    const v = { type: "scat", phase: g.phase, round: g.round, rounds: g.rounds, left: leftMs(g), total: g.total || 0, pts: g.pts, delta: g.delta, letter: g.letter, cats: g.cats };
    if (g.phase === "write") { v.mine = g.ans[pid] || ["", "", "", "", ""]; v.locked = !!g.done[pid]; v.done = Object.keys(g.done).filter(x => !l.players.get(x).bot); }
    if (g.phase === "judge") { v.judged = Object.keys(g.judged); v.entries = g.entries.map(e => ({ key: e.key, ci: e.ci, pid: e.pid, text: e.text, rej: (g.rejects[e.key] || new Set()).size, mineRej: (g.rejects[e.key] || new Set()).has(pid) })); }
    if (g.phase === "reveal") v.entries = g.entries.map(e => ({ key: e.key, ci: e.ci, pid: e.pid, text: e.text, status: e.status, pts: e.pts, item: e.item || 0 }));
    return v;
  },
};

/* ====================== GAME 4: DRAW & CHARADES ====================== */
GAMES.draw = {
  start(l) {
    const ids = shuffle([...l.players.keys()]); const order = [];
    for (let t = 0; t < l.settings.turns; t++) order.push(...ids);
    const g = { type: "draw", phase: "", round: 0, rounds: order.length, order, pts: {}, delta: {}, deadline: 0, words: shuffle(DRAW_WORDS), strokes: [], pcount: 0 };
    for (const id of l.players.keys()) g.pts[id] = 0;
    l.game = g; this.turn(l);
  },
  turn(l) {
    const g = l.game; newPhase(l);
    if (g.round >= g.rounds) return endGame(l);
    g.round++; g.perf = g.order[g.round - 1];
    if (!l.players.has(g.perf)) return this.turn(l);
    g.w = g.words[(g.round - 1) % g.words.length]; g.turnId = rid(5);
    const perfBot = l.players.get(g.perf).bot;
    const st = l.settings.style;
    g.mode = perfBot ? "emoji" : st === "mix" ? (g.round % 2 ? "draw" : "emoji") : st;
    g.strokes = []; g.pcount = 0; g.emo = []; g.guessed = []; g.guesses = []; g.hints = []; g.close = {}; g.perfPts = 0; g.delta = {}; g.phase = "play";
    const total = g.mode === "draw" ? 90000 : 60000;
    relay(l, "strokes", { turn: g.turnId, strokes: [] });
    g.expect = humans(l).filter(h => h !== g.perf);
    if (perfBot) after(l, 2500, () => { g.emo = g.w[1].slice(); });
    else for (const b of bots(l)) if (b !== g.perf && Math.random() < 0.75) {
      g.expect.push(b);
      after(l, total * (0.3 + Math.random() * 0.55), () => { if (g.phase === "play" && !g.guessed.includes(b)) this.correct(l, b); });
    }
    after(l, total * 0.35, () => this.hint(l)); after(l, total * 0.68, () => this.hint(l));
    timed(l, total, () => this.reveal(l));
  },
  hint(l) {
    const g = l.game; if (g.phase !== "play") return;
    const idx = []; for (let i = 0; i < g.w[0].length; i++) if (g.w[0][i] !== " " && !g.hints.includes(i)) idx.push(i);
    if (idx.length > 2) g.hints.push(pick(idx));
  },
  mask(g) { return g.w[0].split("").map((ch, i) => ch === " " ? " " : g.hints.includes(i) ? ch : "_"); },
  correct(l, pid) {
    const g = l.game; if (g.phase !== "play" || g.guessed.includes(pid) || pid === g.perf) return;
    g.guessed.push(pid); award(l, pid, [4, 3, 2, 1][g.guessed.length - 1] || 1);
    if (g.perfPts < 6) { award(l, g.perf, 2); g.perfPts += 2; }
    g.guesses.push({ by: pid, ok: true });
    if (g.expect.every(x => g.guessed.includes(x))) this.reveal(l);
  },
  reveal(l) {
    const g = l.game; newPhase(l); g.phase = "reveal";
    g.item = mkItem(l, { author: g.perf, text: g.w[0] + "  " + g.w[1].join(""), label: g.mode === "draw" ? "🎨 Drawing" : "😜 Emoji charades", game: "draw" });
    timed(l, 9000, () => this.turn(l));
  },
  act(l, pid, b) {
    const g = l.game;
    if (b.type === "g_guess") {
      if (g.phase !== "play") throw new Fail("No guessing right now.");
      if (pid === g.perf) throw new Fail("You are the performer!");
      if (g.guessed.includes(pid)) throw new Fail("You already got it. Shh! 🤫");
      const t = clean(b.text, 40); if (!t) return false;
      const n = norm(t), w = norm(g.w[0]);
      if (n === w || (w.length >= 6 && lev(n, w) <= 1)) { g.close[pid] = false; this.correct(l, pid); return; }
      g.close[pid] = w.length >= 5 && lev(n, w) <= 2;
      g.guesses.push({ by: pid, text: t }); if (g.guesses.length > 40) g.guesses.shift(); return;
    }
    if (b.type === "g_emo") {
      if (g.phase !== "play" || pid !== g.perf || g.mode !== "emoji") throw new Fail("Not now.");
      g.emo = (Array.isArray(b.list) ? b.list : []).slice(0, 14).map(x => clean(x, 12)).filter(Boolean); return;
    }
    if (b.type === "g_stroke") {
      if (g.phase !== "play" || pid !== g.perf || g.mode !== "draw") return false;
      const msg = { turn: g.turnId };
      if (b.clear) { g.strokes = []; g.pcount = 0; msg.clear = true; }
      else if (b.undo) { g.strokes.pop(); msg.undo = true; }
      else if (Array.isArray(b.p) && b.p.length) {
        const p = b.p.slice(0, 200).map(q => [clamp(Math.round(Number(q[0]) || 0), 0, 1000), clamp(Math.round(Number(q[1]) || 0), 0, 700)]);
        if (g.pcount > 12000) return false;
        g.pcount += p.length;
        const c = /^#[0-9a-fA-F]{6}$/.test(b.c) ? b.c : "#111111"; const w = clamp(Math.round(Number(b.w) || 6), 2, 40); const sid = clean(b.sid, 12);
        const last = g.strokes[g.strokes.length - 1];
        if (last && last.sid === sid) last.p.push(...p); else { g.strokes.push({ sid, c, w, p }); if (g.strokes.length > 600) g.strokes.shift(); }
        msg.s = { sid, c, w, p };
      } else return false;
      relay(l, "draw", msg, pid); return false;
    }
    if (b.type === "g_next") { if (pid !== l.host && pid !== g.perf) throw new Fail("Only the host or performer can skip."); if (g.phase === "reveal" || g.phase === "play") { if (g.phase === "play") this.reveal(l); else this.turn(l); } return; }
    throw new Fail("Unknown game action.");
  },
  view(l, pid) {
    const g = l.game;
    const v = { type: "draw", phase: g.phase, round: g.round, rounds: g.rounds, left: leftMs(g), total: g.total || 0, pts: g.pts, delta: g.delta, turn: g.turnId, perf: g.perf, mode: g.mode, emo: g.emo, guessed: g.guessed, guesses: g.guesses.slice(-30).map(x => x.ok ? { by: x.by, ok: true } : { by: x.by, text: x.text }), close: !!g.close[pid], len: g.w ? g.w[0].length : 0 };
    const sees = pid === g.perf || g.guessed.includes(pid) || g.phase !== "play";
    if (sees) { v.word = g.w[0]; v.wordEmoji = g.w[1]; } else v.mask = this.mask(g);
    if (g.phase === "reveal") v.item = g.item;
    return v;
  },
};

/* ====================== GAME 5: CODENAMES ====================== */
const other = t => (t === "red" ? "blue" : "red");
GAMES.code = {
  start(l) {
    const ids = shuffle([...l.players.keys()]).sort((a, b) => (l.players.get(a).bot ? 1 : 0) - (l.players.get(b).bot ? 1 : 0));
    const per = Math.max(2, Math.ceil(ids.length / 2));
    while (ids.length < per * 2) { ids.push(addBot(l)); }
    // humans first so they spread across teams
    const team = {}; const members = { red: [], blue: [] };
    ids.forEach((id, i) => { const t = i % 2 ? "blue" : "red"; team[id] = t; members[t].push(id); });
    const sm = { red: pick(members.red), blue: pick(members.blue) };
    const first = pick(["red", "blue"]);
    const colors = shuffle([].concat(Array(9).fill(first), Array(8).fill(other(first)), Array(7).fill("neutral"), ["assassin"]));
    const board = new Array(25).fill(null); const used = new Set(); const groups = shuffle(CODE_GROUPS); let gi = 0;
    const idx = { red: [], blue: [], neutral: [], assassin: [] }; colors.forEach((c, i) => idx[c].push(i));
    const grab = (color, need, take) => {
      let left = take; const slots = idx[color].slice();
      for (let n = 0; n < 2 && left > 0 && gi < groups.length; n++, gi++) {
        const ws = shuffle(groups[gi][1].filter(w => !used.has(w))); const k = Math.min(n === 0 ? 4 : 3, ws.length, left);
        for (let j = 0; j < k; j++) { const slot = slots.shift(); board[slot] = ws[j]; used.add(ws[j]); left--; }
      }
    };
    grab("red", 0, 7); grab("blue", 0, 7);
    const pool = shuffle(CODE_POOL.filter(w => !used.has(w)));
    for (let i = 0; i < 25; i++) if (!board[i]) { board[i] = pool.pop(); }
    const g = {
      type: "code", phase: "", round: 1, pts: {}, delta: {}, deadline: 0, team, sm, first, turn: first,
      board: board.map((w, i) => ({ w, c: colors[i], rev: false })), left: { red: colors.filter(c => c === "red").length, blue: colors.filter(c => c === "blue").length },
      clue: null, made: 0, gl: 0, log: [], winner: null,
    };
    for (const id of l.players.keys()) g.pts[id] = 0;
    l.game = g; this.startTurn(l);
    const names = t => members[t].map(i => pname(l, i)).join(", ");
    sys(l, "🔴 Red: " + names("red") + "  |  🔵 Blue: " + names("blue"));
  },
  startTurn(l) {
    const g = l.game; newPhase(l); g.phase = "clue"; g.clue = null; g.made = 0; g.gl = 0;
    const sm = g.sm[g.turn];
    if (l.players.get(sm).bot) after(l, 3000 + R(3000), () => this.botClue(l));
    timed(l, 100000, () => { g.log.unshift({ t: g.turn, text: "⏰ no clue given, turn skipped" }); g.turn = other(g.turn); this.startTurn(l); });
  },
  botClue(l) {
    const g = l.game; const t = g.turn; let best = null;
    const unrev = g.board.filter(c => !c.rev);
    for (const [key, ws] of CODE_GROUPS) {
      if (unrev.some(c => c.w === key)) continue;
      const cards = unrev.filter(c => ws.includes(c.w)); if (!cards.length) continue;
      const own = cards.filter(c => c.c === t).length; const bad = cards.filter(c => c.c === "assassin").length, opp = cards.filter(c => c.c === other(t)).length;
      const score = own * 2 - bad * 6 - opp * 2 + Math.random(); if (own > 0 && (!best || score > best.score)) best = { key, own, score };
    }
    if (!best) best = { key: "hmm", own: 1, score: 0 };
    this.setClue(l, g.sm[t], best.key, best.own);
  },
  setClue(l, pid, word, n) {
    const g = l.game; newPhase(l); g.phase = "guess"; g.clue = { word, n }; g.gl = n + 1; g.made = 0;
    g.log.unshift({ t: g.turn, text: pname(l, pid) + " says " + word.toUpperCase() + " " + n });
    mkItem(l, { author: pid, text: word.toUpperCase() + " " + n, label: (g.turn === "red" ? "🔴" : "🔵") + " Codenames clue", game: "code" });
    timed(l, 120000, () => this.endTurn(l));
    const ops = Object.keys(g.team).filter(x => g.team[x] === g.turn && x !== g.sm[g.turn] && l.players.has(x));
    if (ops.length && ops.every(o => l.players.get(o).bot)) after(l, 2500 + R(2000), () => this.botStep(l, ops[0]));
  },
  botStep(l, bot) {
    const g = l.game; if (g.phase !== "guess" || g.team[bot] !== g.turn) return;
    const t0 = g.turn;
    const grp = CODE_GROUPS.find(x => x[0] === norm(g.clue.word)); const unrev = g.board.map((c, i) => ({ c, i })).filter(x => !x.c.rev);
    let cands = grp ? unrev.filter(x => grp[1].includes(x.c.w)) : [];
    let choice;
    if (cands.length) { const own = cands.filter(x => x.c.c === g.turn); choice = (own.length && Math.random() < 0.8) ? pick(own) : pick(cands); }
    else choice = pick(unrev);
    this.guess(l, bot, choice.i);
    if (g.phase === "guess" && g.turn === t0 && g.board[choice.i].c === t0) {
      if (g.made >= g.clue.n && Math.random() < 0.7) return this.endTurn(l);
      after(l, 2200 + R(1800), () => this.botStep(l, bot));
    }
  },
  guess(l, pid, i) {
    const g = l.game; const card = g.board[i]; card.rev = true; g.made++;
    const who = pname(l, pid); const icon = { red: "🔴", blue: "🔵", neutral: "⚪", assassin: "💀" }[card.c];
    g.log.unshift({ t: g.turn, text: who + " picked " + card.w.toUpperCase() + " " + icon });
    if (card.c === "assassin") return this.finish(l, other(g.turn), "💀 " + who + " hit the assassin!");
    if (card.c === "red" || card.c === "blue") { g.left[card.c]--; if (g.left[card.c] === 0) return this.finish(l, card.c, "All words found!"); }
    if (card.c === g.turn) { g.gl--; if (g.gl <= 0) this.endTurn(l); return; }
    this.endTurn(l);
  },
  endTurn(l) { const g = l.game; if (g.phase === "over") return; g.turn = other(g.turn); this.startTurn(l); },
  finish(l, winner, why) {
    const g = l.game; g.winner = winner; g.why = why;
    for (const id of Object.keys(g.team)) if (l.players.has(id)) award(l, id, g.team[id] === winner ? 5 : 1);
    sys(l, (winner === "red" ? "🔴 Red" : "🔵 Blue") + " team wins! " + why);
    endGame(l);
  },
  act(l, pid, b) {
    const g = l.game;
    if (b.type === "g_clue") {
      if (g.phase !== "clue" || g.sm[g.turn] !== pid) throw new Fail("It's not your turn to give a clue.");
      const w = clean(b.word, 20); const n = Math.round(Number(b.n));
      if (!/^[A-Za-zÀ-ɏ-]{2,20}$/.test(w)) throw new Fail("A clue must be ONE word (letters only).");
      if (!(n >= 1 && n <= 9)) throw new Fail("Pick a number from 1 to 9.");
      if (g.board.some(c => !c.rev && (norm(c.w) === norm(w)))) throw new Fail("You can't use a word that's on the board!");
      this.setClue(l, pid, w, n); return;
    }
    if (b.type === "g_reveal") {
      if (g.phase !== "guess") throw new Fail("Wait for the clue first.");
      if (g.team[pid] !== g.turn || g.sm[g.turn] === pid) throw new Fail("Only the operatives on the guessing team can pick.");
      const i = Number(b.i); const card = g.board[i]; if (!card || card.rev) throw new Fail("Pick an unrevealed word.");
      this.guess(l, pid, i); return;
    }
    if (b.type === "g_end") {
      if (g.phase !== "guess" || g.team[pid] !== g.turn || g.sm[g.turn] === pid) throw new Fail("Not now.");
      if (g.made < 1) throw new Fail("Make at least one guess first."); this.endTurn(l); return;
    }
    throw new Fail("Unknown game action.");
  },
  view(l, pid) {
    const g = l.game; const over = g.phase === "over"; const isSM = g.sm.red === pid || g.sm.blue === pid;
    return {
      type: "code", phase: g.phase, left: leftMs(g), total: g.total || 0, pts: g.pts, delta: g.delta, turn: g.turn, clue: g.clue, gl: g.gl, made: g.made, remain: g.left, winner: g.winner, why: g.why || "",
      team: g.team, sm: g.sm, myTeam: g.team[pid] || null, spy: isSM, log: g.log.slice(0, 8),
      board: g.board.map(c => ({ w: c.w, rev: c.rev, c: (c.rev || isSM || over) ? c.c : null })),
    };
  },
};

/* ====================== GAME 6: WORD CHAIN ====================== */
GAMES.chain = {
  start(l) {
    const order = shuffle([...l.players.keys()]); const lives = {}; for (const id of order) lives[id] = l.settings.lives;
    const seed = pick(CHAIN_SEEDS);
    const g = { type: "chain", phase: "play", round: 1, pts: {}, delta: {}, deadline: 0, order, lives, out: [], used: new Set([seed]), chain: [{ w: seed, by: null }], req: seed[seed.length - 1], i: -1, event: null };
    for (const id of order) g.pts[id] = 0;
    l.game = g; this.next(l);
  },
  alive(g) { return g.order.filter(x => !g.out.includes(x)); },
  next(l) {
    const g = l.game; newPhase(l);
    for (let k = 0; k < g.order.length; k++) { g.i = (g.i + 1) % g.order.length; if (!g.out.includes(g.order[g.i])) break; }
    g.cur = g.order[g.i]; const count = g.chain.length - 1;
    timed(l, Math.max(8, 20 - Math.floor(count / 4)) * 1000, () => this.fail(l, g.cur, "ran out of time ⏰"));
    if (l.players.get(g.cur).bot) after(l, 2200 + R(3500), () => {
      if (count >= 5 && Math.random() < 0.1) return this.fail(l, g.cur, "couldn't think of a word 🤔");
      const words = (CHAIN[g.req] || []).filter(w => !g.used.has(w));
      if (!words.length) return this.fail(l, g.cur, "couldn't think of a word 🤔");
      this.submit(l, g.cur, pick(words));
    });
  },
  submit(l, pid, raw) {
    const g = l.game; const w = clean(raw, 24).toLowerCase();
    if (!/^[a-z]+$/.test(w)) throw new Fail("Letters only, one word please.");
    if (w.length < 3) throw new Fail("Use at least 3 letters.");
    if (w[0] !== g.req) throw new Fail("The word must start with “" + g.req.toUpperCase() + "”.");
    if (!/[aeiouy]/.test(w) || /(.)\1\1/.test(w)) throw new Fail("That doesn't look like a real word. 🤨");
    if (g.used.has(w)) throw new Fail("That word was already used!");
    g.used.add(w); g.chain.push({ w, by: pid }); g.req = w[w.length - 1]; g.event = null;
    award(l, pid, 1); this.next(l);
  },
  fail(l, pid, why) {
    const g = l.game; if (g.phase !== "play") return;
    g.lives[pid]--; g.event = { pid, why };
    if (g.lives[pid] <= 0) { g.out.push(pid); }
    const alive = this.alive(g);
    if (alive.length <= 1) {
      if (alive[0]) award(l, alive[0], 5);
      const best = g.chain.slice(1).sort((a, b) => b.w.length - a.w.length)[0];
      if (best && best.by) mkItem(l, { author: best.by, text: best.w, label: "🔗 Longest word in the chain", game: "chain" });
      return endGame(l);
    }
    this.next(l);
  },
  act(l, pid, b) {
    const g = l.game;
    if (b.type === "g_word") {
      if (g.phase !== "play" || g.cur !== pid) throw new Fail("It's not your turn!");
      this.submit(l, pid, b.text); return;
    }
    throw new Fail("Unknown game action.");
  },
  view(l, pid) {
    const g = l.game;
    return { type: "chain", phase: g.phase, left: leftMs(g), total: g.total || 0, pts: g.pts, delta: g.delta, cur: g.cur, req: g.req, lives: g.lives, out: g.out, maxLives: l.settings.lives, order: g.order, chain: g.chain.slice(-30), count: g.chain.length - 1, event: g.event };
  },
};

/* ====================== HTTP SERVER ====================== */
const HTML = "<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover,maximum-scale=1\">\n<meta name=\"theme-color\" content=\"#120a2a\">\n<link rel=\"manifest\" href=\"/manifest.json\">\n<link rel=\"icon\" href=\"/icon.svg\">\n<title>Party Arcade</title>\n<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\"><link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n<link href=\"https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap\" rel=\"stylesheet\">\n<style>\n:root{--bg:#120a2a;--bg2:#1d1042;--card:rgba(255,255,255,.075);--line:rgba(255,255,255,.15);--txt:#f6f3ff;--mut:#a79fd2;--pink:#ff4fa3;--cyan:#22d3ee;--lime:#a3e635;--gold:#fbbf24;--vio:#8b5cf6;--red:#ef4444;--blue:#3b82f6;--r:20px}\n*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}\nhtml,body{margin:0;min-height:100%;background:var(--bg);color:var(--txt);font-family:\"Fredoka\",system-ui,-apple-system,\"Segoe UI\",Roboto,sans-serif;font-size:16px}\nbody{overflow-x:hidden}\n#bg{position:fixed;inset:0;z-index:0;background:radial-gradient(60% 45% at 12% 0%,rgba(255,79,163,.35),transparent 70%),radial-gradient(55% 45% at 100% 20%,rgba(34,211,238,.28),transparent 70%),radial-gradient(70% 55% at 50% 110%,rgba(139,92,246,.45),transparent 70%),linear-gradient(180deg,var(--bg2),var(--bg));overflow:hidden}\n#bg i{position:absolute;font-style:normal;opacity:.13;animation:float 18s linear infinite;filter:blur(.3px)}\n@keyframes float{from{transform:translateY(110vh) rotate(0)}to{transform:translateY(-20vh) rotate(360deg)}}\n.app{position:relative;z-index:1;max-width:580px;margin:0 auto;padding:12px 14px calc(92px + env(safe-area-inset-bottom))}\nh1,h2,h3{margin:0;font-weight:700;letter-spacing:.2px}\n.logo{font-size:44px;line-height:1;text-align:center;font-weight:700;background:linear-gradient(90deg,var(--pink),var(--gold),var(--cyan));-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 4px 24px rgba(255,79,163,.35))}\n.sub{color:var(--mut);text-align:center;margin:6px 0 18px}\n.card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:14px;margin:12px 0;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 10px 30px rgba(0,0,0,.25)}\n.card h3{font-size:17px;margin-bottom:8px}\n.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}\n.grow{flex:1;min-width:0}\n.mut{color:var(--mut)}.small{font-size:13px}.c{text-align:center}\ninput,textarea{width:100%;font:inherit;color:var(--txt);background:rgba(0,0,0,.28);border:1.5px solid var(--line);border-radius:14px;padding:12px 14px;outline:none;transition:border .15s,box-shadow .15s}\ninput:focus,textarea:focus{border-color:var(--cyan);box-shadow:0 0 0 3px rgba(34,211,238,.2)}\n::placeholder{color:#7d74ad}\n.btn{font:inherit;font-weight:600;color:#fff;border:0;border-radius:999px;padding:12px 20px;cursor:pointer;background:linear-gradient(135deg,var(--vio),var(--pink));box-shadow:0 6px 20px rgba(255,79,163,.35);transition:transform .08s,filter .15s}\n.btn:active{transform:scale(.96)}.btn:hover{filter:brightness(1.08)}\n.btn.big{width:100%;padding:15px;font-size:18px}\n.btn.alt{background:linear-gradient(135deg,#0ea5e9,#22d3ee);box-shadow:0 6px 20px rgba(34,211,238,.3)}\n.btn.good{background:linear-gradient(135deg,#10b981,var(--lime));color:#0b2a12;box-shadow:0 6px 20px rgba(163,230,53,.3)}\n.btn.ghost{background:rgba(255,255,255,.1);box-shadow:none;border:1px solid var(--line)}\n.btn.sm{padding:7px 12px;font-size:14px}\n.btn[disabled]{opacity:.45;pointer-events:none}\n.pill{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.1);border:1px solid var(--line);font-size:13px}\n.code{font-size:34px;font-weight:700;letter-spacing:7px;background:linear-gradient(90deg,var(--gold),var(--pink));-webkit-background-clip:text;background-clip:text;color:transparent}\n.top{display:flex;align-items:center;gap:10px;margin:2px 0 4px}\n.top .t{flex:1;font-weight:700;font-size:18px}\n.tabs{position:fixed;left:0;right:0;bottom:0;z-index:5;display:flex;justify-content:center;gap:8px;padding:8px 12px calc(8px + env(safe-area-inset-bottom));background:linear-gradient(180deg,transparent,rgba(18,10,42,.92) 35%)}\n.tabs .in{display:flex;gap:6px;width:100%;max-width:560px;background:rgba(30,18,66,.85);border:1px solid var(--line);border-radius:999px;padding:5px;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}\n.tab{flex:1;position:relative;font:inherit;font-weight:600;color:var(--mut);background:transparent;border:0;border-radius:999px;padding:10px 4px;cursor:pointer}\n.tab.on{color:#fff;background:linear-gradient(135deg,var(--vio),var(--pink));box-shadow:0 4px 16px rgba(139,92,246,.5)}\n.badge{position:absolute;top:2px;right:10px;min-width:18px;height:18px;border-radius:9px;background:var(--gold);color:#3b2a00;font-size:11px;line-height:18px;text-align:center;font-weight:700;padding:0 4px}\n.tiles{display:grid;grid-template-columns:1fr 1fr;gap:10px}\n.tile{position:relative;border-radius:18px;padding:12px;border:2px solid transparent;cursor:pointer;color:#fff;text-align:left;font:inherit;min-height:112px;overflow:hidden;background:var(--bgc);opacity:.62;transition:transform .12s,opacity .15s,box-shadow .2s}\n.tile.on{opacity:1;border-color:#fff;box-shadow:0 0 0 3px rgba(255,255,255,.2),0 10px 30px var(--glow);transform:translateY(-2px)}\n.tile .e{font-size:30px;display:block}.tile b{display:block;font-size:16px;margin-top:2px}.tile span.d{display:block;font-size:12px;opacity:.9;line-height:1.25;margin-top:2px}\n.tile .mn{position:absolute;top:8px;right:8px;font-size:11px;background:rgba(0,0,0,.3);padding:2px 7px;border-radius:99px}\n.chips{display:flex;gap:6px;flex-wrap:wrap}\n.chip{font:inherit;color:var(--txt);background:rgba(255,255,255,.08);border:1.5px solid var(--line);border-radius:999px;padding:6px 14px;cursor:pointer}\n.chip.on{background:linear-gradient(135deg,var(--vio),var(--pink));border-color:transparent;color:#fff}\n.plist{display:flex;flex-direction:column;gap:8px}\n.pl{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:16px;background:rgba(255,255,255,.06);border:1px solid var(--line)}\n.av{font-size:26px;width:42px;height:42px;display:grid;place-items:center;border-radius:50%;background:rgba(255,255,255,.1);flex:none}\n.pl .nm{font-weight:600}.pl .sc{margin-left:auto;text-align:right;font-weight:700}\n.avgrid{display:grid;grid-template-columns:repeat(8,1fr);gap:6px;margin-top:8px}\n.avgrid button{font-size:22px;padding:5px;border-radius:12px;border:1.5px solid var(--line);background:rgba(255,255,255,.07);cursor:pointer}\n.avgrid button.me{border-color:var(--cyan);background:rgba(34,211,238,.2)}.avgrid button[disabled]{opacity:.25}\n/* game */\n.ghead{display:flex;align-items:center;gap:10px}\n.ghead .gt{flex:1}.ghead .gt b{font-size:18px;display:block}.ghead .gt span{font-size:13px;color:var(--mut)}\n.timer{min-width:54px;height:54px;border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:20px;background:conic-gradient(var(--pink) var(--p,100%),rgba(255,255,255,.12) 0);position:relative}\n.timer::after{content:\"\";position:absolute;inset:5px;border-radius:50%;background:var(--bg2)}\n.timer span{position:relative;z-index:1}\n.timer.low{animation:pulse .6s infinite}\n@keyframes pulse{50%{transform:scale(1.1)}}\n.q{font-size:22px;font-weight:600;line-height:1.3;text-align:center;padding:6px 4px}\n.q em{font-style:normal;color:var(--gold);border-bottom:3px dotted var(--gold)}\n.opt{display:flex;width:100%;align-items:center;gap:10px;text-align:left;font:inherit;font-weight:500;color:var(--txt);padding:14px;margin:8px 0;border-radius:16px;border:1.5px solid var(--line);background:rgba(255,255,255,.07);cursor:pointer}\n.opt:active{transform:scale(.98)}\n.opt.mine{opacity:.4;pointer-events:none}.opt.sel{border-color:var(--cyan);background:rgba(34,211,238,.18)}\n.opt.truth{border-color:var(--lime);background:rgba(163,230,53,.18);box-shadow:0 0 22px rgba(163,230,53,.3)}\n.opt .by{margin-left:auto;font-size:13px;color:var(--mut);text-align:right}\n.delta{color:var(--lime);font-weight:700}\n.sb{display:flex;gap:8px;overflow-x:auto;padding:2px 0 4px;scrollbar-width:none}\n.sb::-webkit-scrollbar{display:none}\n.sbp{flex:none;display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.08);border:1px solid var(--line);border-radius:999px;padding:4px 10px 4px 5px;font-size:14px}\n.sbp .a{font-size:20px}.sbp b{font-weight:700}\n.sbp.you{border-color:var(--cyan)}\n.wbar{position:relative;height:60px;border-radius:16px;background:linear-gradient(90deg,#38bdf8,#a78bfa,#f472b6);overflow:hidden;margin:6px 0}\n.wlab{display:flex;justify-content:space-between;font-weight:700;font-size:15px}\n.zone{position:absolute;top:0;bottom:0;background:rgba(255,255,255,.22)}\n.zone.z4{background:rgba(255,255,255,.65)}.zone.z3{background:rgba(255,255,255,.45)}\n.mk{position:absolute;top:50%;transform:translate(-50%,-50%);font-size:24px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.5));pointer-events:none}\n.mk.tg{font-size:34px;top:50%}\ninput[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:46px;background:transparent;border:0;padding:0;box-shadow:none;touch-action:pan-y}\ninput[type=range]::-webkit-slider-runnable-track{height:12px;border-radius:6px;background:rgba(255,255,255,.25)}\ninput[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:42px;height:42px;margin-top:-15px;border-radius:50%;background:linear-gradient(135deg,var(--gold),var(--pink));border:3px solid #fff;box-shadow:0 4px 14px rgba(0,0,0,.4)}\ninput[type=range]::-moz-range-track{height:12px;border-radius:6px;background:rgba(255,255,255,.25)}\ninput[type=range]::-moz-range-thumb{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--gold),var(--pink));border:3px solid #fff}\n.cat{display:flex;gap:8px;align-items:center;margin:8px 0}\n.cat .cl{flex:0 0 42%;font-weight:600;font-size:14px;line-height:1.2}\n.ent{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:12px;background:rgba(255,255,255,.06);margin:5px 0;font-size:15px}\n.ent.bad{opacity:.45;text-decoration:line-through}.ent.dup{background:rgba(251,191,36,.12)}.ent.ok{background:rgba(163,230,53,.1)}\n.rej{margin-left:auto;font:inherit;font-size:13px;border-radius:99px;border:1.5px solid var(--line);background:transparent;color:var(--txt);padding:4px 10px;cursor:pointer}\n.rej.on{background:var(--red);border-color:var(--red)}\n#cvhost canvas{width:100%;height:auto;display:block;border-radius:18px;border:3px solid rgba(255,255,255,.3);background:#fffdf6;touch-action:none;box-shadow:0 8px 28px rgba(0,0,0,.35)}\n.tools{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px}\n.sw{width:30px;height:30px;border-radius:50%;border:3px solid rgba(255,255,255,.35);cursor:pointer;padding:0}.sw.on{border-color:#fff;transform:scale(1.18)}\n.mask{font-size:30px;letter-spacing:5px;text-align:center;font-weight:700;margin:6px 0;word-break:break-all}\n.emoline{font-size:44px;text-align:center;min-height:62px;line-height:1.3;word-break:break-all}\n.epal{display:grid;grid-template-columns:repeat(8,1fr);gap:5px}\n.epal button{font-size:24px;padding:4px;border-radius:10px;border:1px solid var(--line);background:rgba(255,255,255,.07);cursor:pointer}\n.feed{max-height:150px;overflow:auto;display:flex;flex-direction:column;gap:4px;font-size:14px}\n.feed div{padding:4px 10px;border-radius:12px;background:rgba(255,255,255,.06)}.feed .ok{background:rgba(163,230,53,.18);color:var(--lime);font-weight:600}\n.cn-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:5px}\n.cn{font:inherit;font-weight:700;font-size:11.5px;min-height:56px;border-radius:12px;border:2px solid rgba(255,255,255,.2);background:rgba(255,255,255,.1);color:var(--txt);padding:2px;cursor:pointer;word-break:break-word;text-transform:uppercase;position:relative}\n.cn.spy.red{border-color:var(--red);background:rgba(239,68,68,.15)}.cn.spy.blue{border-color:var(--blue);background:rgba(59,130,246,.18)}.cn.spy.assassin{border-color:#000;background:#000;color:#fff}.cn.spy.neutral{opacity:.75}\n.cn.rev{cursor:default}.cn.rev.red{background:var(--red);color:#fff;border-color:#fff}.cn.rev.blue{background:var(--blue);color:#fff;border-color:#fff}.cn.rev.neutral{background:#d6c8a0;color:#4b3f1e}.cn.rev.assassin{background:#000;color:#fff;border-color:var(--red)}\n.cn.rev{opacity:.92}\n.team-red{color:#ff7b7b}.team-blue{color:#7db4ff}\n.clue{font-size:30px;font-weight:700;text-align:center;letter-spacing:1px}\n.chain{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}\n.cw{padding:5px 11px;border-radius:99px;background:rgba(255,255,255,.1);border:1px solid var(--line);font-weight:600}.cw b{color:var(--gold)}.cw.cur{background:linear-gradient(135deg,var(--vio),var(--pink));border-color:transparent}\n.bigl{width:78px;height:78px;border-radius:24px;background:linear-gradient(135deg,var(--gold),var(--pink));display:grid;place-items:center;font-size:46px;font-weight:700;color:#fff;margin:0 auto;box-shadow:0 8px 28px rgba(255,79,163,.5);animation:bob 1.4s ease-in-out infinite}\n@keyframes bob{50%{transform:translateY(-5px) rotate(-3deg)}}\n.pod{display:flex;align-items:flex-end;justify-content:center;gap:10px;margin:10px 0 4px}\n.pod>div{text-align:center;flex:1;max-width:120px}.pod .blk{border-radius:14px 14px 0 0;display:grid;place-items:start center;padding-top:6px;font-weight:700;font-size:22px}\n.pod .a{font-size:40px;display:block}.pod .n{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.b1{height:96px;background:linear-gradient(180deg,#fcd34d,#f59e0b)}.b2{height:70px;background:linear-gradient(180deg,#e5e7eb,#9ca3af)}.b3{height:52px;background:linear-gradient(180deg,#f0a868,#b45309)}\n/* chat + moments */\n.msgs{display:flex;flex-direction:column;gap:8px;max-height:calc(100vh - 290px);min-height:200px;overflow-y:auto;padding:2px}\n.m{display:flex;gap:8px;align-items:flex-end}.m.me{flex-direction:row-reverse}\n.m .bub{max-width:78%;padding:8px 12px;border-radius:18px 18px 18px 4px;background:rgba(255,255,255,.1);border:1px solid var(--line);word-break:break-word}\n.m.me .bub{border-radius:18px 18px 4px 18px;background:linear-gradient(135deg,rgba(139,92,246,.7),rgba(255,79,163,.6))}\n.m .who{font-size:12px;color:var(--mut)}.m .tools2{font-size:12px;opacity:.7;margin-top:2px}.m .tools2 button{background:none;border:0;color:inherit;font:inherit;cursor:pointer;padding:0 6px 0 0}\n.sysm{text-align:center;font-size:12px;color:var(--mut);padding:2px}\n.quick{display:flex;gap:6px;overflow-x:auto;margin:8px 0 2px}.quick button{flex:none;font-size:20px;background:rgba(255,255,255,.08);border:1px solid var(--line);border-radius:12px;padding:3px 9px;cursor:pointer}\n.item{border-radius:18px;border:1px solid var(--line);background:rgba(255,255,255,.06);padding:12px;margin:10px 0}\n.item .ih{display:flex;gap:8px;align-items:center;font-size:14px}.item .lab{color:var(--mut);font-size:12px;display:block}\n.item .tx{font-size:19px;font-weight:600;margin:8px 0;word-break:break-word}\n.like{font:inherit;font-weight:600;color:var(--txt);border-radius:99px;border:1.5px solid var(--line);background:rgba(255,255,255,.07);padding:6px 14px;cursor:pointer}\n.like.on{border-color:var(--pink);background:rgba(255,79,163,.22)}\n.cm{font-size:14px;padding:6px 10px;border-radius:12px;background:rgba(0,0,0,.2);margin:5px 0;display:flex;gap:6px;align-items:flex-start}.cm button{margin-left:auto;background:none;border:0;color:var(--mut);cursor:pointer}\n#toast{position:fixed;left:50%;top:14px;transform:translate(-50%,-90px);z-index:20;background:#2b1a5e;border:1px solid var(--pink);color:#fff;padding:11px 18px;border-radius:16px;font-weight:500;max-width:90vw;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.5);transition:transform .25s}\n#toast.show{transform:translate(-50%,0)}\n#fx{position:fixed;inset:0;pointer-events:none;z-index:15}\n.pulse-in{animation:pin .35s ease-out}@keyframes pin{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}\n.spin{display:inline-block;animation:sp 1s linear infinite}@keyframes sp{to{transform:rotate(360deg)}}\n</style>\n</head>\n<body>\n<div id=\"bg\"></div>\n<canvas id=\"fx\"></canvas>\n<div id=\"toast\"></div>\n<div class=\"app\" id=\"app\"></div>\n<script>\n\"use strict\";\nvar GAME_INFO = {\n  bluff: { n: \"Bluff Master\", e: \"🎭\", d: \"Invent believable lies and fool your friends!\", c: \"#ff4fa3,#f97316\", g: \"rgba(255,79,163,.55)\" },\n  wave: { n: \"Wavelength\", e: \"📡\", d: \"Read your psychic's mind on the dial.\", c: \"#22d3ee,#8b5cf6\", g: \"rgba(34,211,238,.55)\" },\n  scat: { n: \"Scattergories\", e: \"🔤\", d: \"Same letter, fast answers. Be unique!\", c: \"#84cc16,#10b981\", g: \"rgba(163,230,53,.5)\" },\n  draw: { n: \"Draw & Charades\", e: \"🎨\", d: \"Sketch it, or act it out with emojis.\", c: \"#fbbf24,#ef4444\", g: \"rgba(251,191,36,.55)\" },\n  code: { n: \"Codenames\", e: \"🕵️\", d: \"One-word clues. Red vs Blue!\", c: \"#3b82f6,#ef4444\", g: \"rgba(96,165,250,.55)\" },\n  chain: { n: \"Word Chain\", e: \"🔗\", d: \"Start with the last letter. Beat the clock!\", c: \"#ec4899,#f59e0b\", g: \"rgba(236,72,153,.55)\" }\n};\nvar MINS = { bluff: 3, wave: 2, scat: 2, draw: 2, code: 2, chain: 2 };\nvar AVATARS = [\"😎\",\"🦊\",\"🐼\",\"🐯\",\"🦄\",\"🐸\",\"🐵\",\"🦁\",\"🐙\",\"🦉\",\"🐧\",\"🐲\",\"👻\",\"👽\",\"🤠\",\"🥷\",\"🧙\",\"🧛\",\"🦸\",\"🧜\",\"🐝\",\"🦋\",\"🍕\",\"🌈\"];\nvar EMOJI_PAL = [\"😀\",\"😂\",\"😍\",\"😡\",\"😱\",\"😴\",\"🤔\",\"😎\",\"👀\",\"👂\",\"👃\",\"👄\",\"🖐️\",\"👍\",\"🏃\",\"🕺\",\"🐶\",\"🐱\",\"🐭\",\"🐸\",\"🦁\",\"🐘\",\"🍎\",\"🍕\",\"🍔\",\"🍟\",\"🍦\",\"🎂\",\"☕\",\"🥤\",\"⚽\",\"🏀\",\"🎸\",\"🎤\",\"🚗\",\"✈️\",\"🚀\",\"🏠\",\"🌳\",\"🌊\",\"🔥\",\"❄️\",\"⭐\",\"🌙\",\"☀️\",\"💧\",\"💡\",\"🔑\",\"💰\",\"📱\",\"🎁\",\"👑\",\"🧙\",\"🦖\",\"🚢\",\"💔\"];\nvar SWATCH = [\"#111111\", \"#ef4444\", \"#f97316\", \"#facc15\", \"#22c55e\", \"#3b82f6\", \"#a855f7\", \"#ec4899\", \"#8b5a2b\", \"#ffffff\"];\n\nvar S = null, recvAt = 0, tab = \"game\", code = \"\", pid = \"\", myName = \"\", es = null, drafts = {}, openC = {}, avOpen = false, wv = 50, holding = false, pending = false, seenChat = 0, lastFx = \"\", connected = false, lastMsgAt = 0;\nvar app = document.getElementById(\"app\");\nfunction LS(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} return null; }\nfunction esc(s) { return String(s == null ? \"\" : s).replace(/[&<>\"']/g, function (c) { return { \"&\": \"&amp;\", \"<\": \"&lt;\", \">\": \"&gt;\", '\"': \"&quot;\", \"'\": \"&#39;\" }[c]; }); }\nfunction P(id) { return (S && S.players.filter(function (p) { return p.id === id; })[0]) || { id: id, name: \"?\", avatar: \"👤\" }; }\nfunction who(id) { var p = P(id); return '<span class=\"pill\">' + p.avatar + \" \" + esc(p.name) + (id === pid ? \" (you)\" : \"\") + \"</span>\"; }\nfunction isHost() { return S && S.host === pid; }\nfunction toast(msg) { var t = document.getElementById(\"toast\"); t.textContent = msg; t.className = \"show\"; clearTimeout(toast.t); toast.t = setTimeout(function () { t.className = \"\"; }, 2800); }\n\n/* background emojis */\n(function () {\n  var em = [\"🎮\", \"🎲\", \"🎭\", \"🎨\", \"🕵️\", \"🔗\", \"📡\", \"🔤\", \"⭐\", \"🎉\", \"💜\", \"🧩\", \"👾\", \"🚀\"], bg = document.getElementById(\"bg\");\n  for (var i = 0; i < 16; i++) { var s = document.createElement(\"i\"); s.textContent = em[i % em.length]; s.style.left = (i * 6.7 + Math.random() * 4) + \"%\"; s.style.fontSize = (22 + Math.random() * 34) + \"px\"; s.style.animationDuration = (16 + Math.random() * 22) + \"s\"; s.style.animationDelay = (-Math.random() * 30) + \"s\"; bg.appendChild(s); }\n})();\n\n/* confetti */\nfunction confetti() {\n  var c = document.getElementById(\"fx\"), x = c.getContext(\"2d\"); c.width = innerWidth; c.height = innerHeight;\n  var cols = [\"#ff4fa3\", \"#fbbf24\", \"#22d3ee\", \"#a3e635\", \"#8b5cf6\", \"#fff\"], ps = [];\n  for (var i = 0; i < 110; i++) ps.push({ x: innerWidth / 2 + (Math.random() - .5) * 120, y: innerHeight * .35, vx: (Math.random() - .5) * 14, vy: -Math.random() * 14 - 4, s: 5 + Math.random() * 7, c: cols[i % cols.length], r: Math.random() * 6 });\n  var t0 = performance.now();\n  (function f(t) { var d = t - t0; x.clearRect(0, 0, c.width, c.height); if (d > 2400) return; ps.forEach(function (p) { p.vy += .35; p.x += p.vx; p.y += p.vy; p.r += .2; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.globalAlpha = Math.max(0, 1 - d / 2400); x.fillRect(-p.s / 2, -p.s / 3, p.s, p.s / 1.6); x.restore(); }); requestAnimationFrame(f); })(t0);\n}\n\n/* ---------- networking ---------- */\nfunction api(path, body) {\n  return fetch(path, { method: \"POST\", headers: { \"Content-Type\": \"application/json\" }, body: JSON.stringify(body) }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || \"Something went wrong\"); return j; }); });\n}\nfunction act(type, extra) {\n  var b = Object.assign({ code: code, pid: pid, type: type }, extra || {});\n  return api(\"/api/act\", b).catch(function (e) { toast(e.message); throw e; });\n}\nfunction connect() {\n  if (es) { try { es.close(); } catch (e) {} }\n  es = new EventSource(\"/events?code=\" + encodeURIComponent(code) + \"&pid=\" + encodeURIComponent(pid));\n  es.onopen = function () { connected = true; };\n  es.onmessage = function (ev) { lastMsgAt = Date.now(); recvAt = Date.now(); S = JSON.parse(ev.data); onState(); };\n  es.addEventListener(\"draw\", function (ev) { lastMsgAt = Date.now(); remoteDraw(JSON.parse(ev.data)); });\n  es.addEventListener(\"strokes\", function (ev) { var d = JSON.parse(ev.data); curTurn = d.turn; strokes = d.strokes || []; redraw(); });\n  es.addEventListener(\"kicked\", function () { toast(\"You were removed from the lobby.\"); leaveLocal(); });\n  es.addEventListener(\"left\", function () { leaveLocal(); });\n  es.onerror = function () {\n    connected = false; fetch(\"/api/state?code=\" + encodeURIComponent(code) + \"&pid=\" + encodeURIComponent(pid)).then(function (r) { if (r.status === 404) { toast(\"That lobby ended.\"); leaveLocal(); } }).catch(function () {});\n  };\n}\nsetInterval(function () { // fallback poll if the stream looks dead\n  if (!code || !pid) return;\n  if (Date.now() - lastMsgAt > 20000) fetch(\"/api/state?code=\" + encodeURIComponent(code) + \"&pid=\" + encodeURIComponent(pid)).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j) { S = j; recvAt = Date.now(); lastMsgAt = Date.now(); onState(); } }).catch(function () {});\n}, 8000);\nfunction leaveLocal() { try { es && es.close(); } catch (e) {} es = null; S = null; code = \"\"; pid = \"\"; LS(\"pa.code\", null); LS(\"pa.pid\", null); tab = \"game\"; history.replaceState(null, \"\", \"/\"); render(); }\nfunction enter(c, p) { code = c; pid = p; LS(\"pa.code\", c); LS(\"pa.pid\", p); connect(); }\n\n/* ---------- state handling ---------- */\nvar lastRun = -1, lastPhaseKey = \"\";\nfunction onState() {\n  var g = S.game;\n  if (S.run !== lastRun) { lastRun = S.run; openC = {}; }\n  if (g && g.type === \"draw\" && g.turn !== curTurn) { curTurn = g.turn; strokes = []; redraw(); }\n  if (g && g.type === \"wave\") { var k = \"w\" + S.run + g.round + g.phase; if (k !== lastPhaseKey) { lastPhaseKey = k; if (g.phase === \"guess\") wv = 50; } }\n  var fx = g ? S.run + \":\" + g.type + \":\" + g.phase + \":\" + (g.round || \"\") + (g.turn && g.type === \"draw\" ? g.turn : \"\") : \"\";\n  if (fx !== lastFx) {\n    lastFx = fx;\n    if (g && g.phase === \"over\") confetti();\n    else if (g && g.phase === \"reveal\" && g.delta && g.delta[pid] > 0) confetti();\n  }\n  if (tab === \"chat\") seenChat = S.chat.length ? S.chat[S.chat.length - 1].id : 0;\n  render();\n}\nfunction curLeft() { var g = S && S.game; if (!g || !g.left) return 0; return Math.max(0, g.left - (Date.now() - recvAt)); }\nsetInterval(function () {\n  var g = S && S.game; var els = document.querySelectorAll(\".timer\"); if (!g || !els.length) return;\n  var L = curLeft(), tot = g.total || 1;\n  els.forEach(function (el) { el.style.setProperty(\"--p\", Math.max(0, Math.min(100, L / tot * 100)) + \"%\"); el.firstChild.textContent = Math.ceil(L / 1000); el.classList.toggle(\"low\", L < 8000 && L > 0); });\n}, 200);\n\n/* ---------- drafts / render ---------- */\ndocument.addEventListener(\"input\", function (e) {\n  var t = e.target; if (t.id === \"wslide\") { wv = +t.value; var m = document.getElementById(\"wme\"); if (m) m.style.left = Math.min(94, Math.max(6, wv)) + \"%\"; return; }\n  if (t.dataset && t.dataset.keep) { drafts[t.id] = t.value; if (t.id.indexOf(\"sc\") === 0) scheduleScat(); }\n});\nfunction scheduleScat() { clearTimeout(scheduleScat.t); scheduleScat.t = setTimeout(function () { saveScat(false); }, 1400); }\ndocument.addEventListener(\"pointerdown\", function (e) { if (e.target.closest && e.target.closest(\"input[type=range],#cvhost canvas\")) holding = true; }, true);\nfunction release() { if (holding) { holding = false; if (pending) { pending = false; render(); } } }\ndocument.addEventListener(\"pointerup\", release, true); document.addEventListener(\"pointercancel\", release, true); document.addEventListener(\"touchend\", release, true);\n\nfunction render() {\n  if (holding) { pending = true; return; }\n  var ae = document.activeElement, aid = ae && ae.id, sel = ae && ae.selectionStart != null ? [ae.selectionStart, ae.selectionEnd] : null;\n  var msgs = app.querySelector(\".msgs\"), nearBottom = !msgs || (msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 60), oldScroll = msgs ? msgs.scrollTop : 0;\n  var sy = window.scrollY;\n  app.innerHTML = S ? mainHTML() : homeHTML();\n  app.querySelectorAll(\"[data-keep]\").forEach(function (el) { if (drafts[el.id] !== undefined) el.value = drafts[el.id]; });\n  var host = document.getElementById(\"cvhost\"); if (host) { host.appendChild(cv); sizeDrawUI(); }\n  if (aid) { var el = document.getElementById(aid); if (el) { try { el.focus({ preventScroll: true }); if (sel && el.setSelectionRange) el.setSelectionRange(sel[0], sel[1]); } catch (e) {} } }\n  var m2 = app.querySelector(\".msgs\"); if (m2) { m2.scrollTop = nearBottom ? m2.scrollHeight : oldScroll; }\n  window.scrollTo(0, sy);\n}\n\n/* ---------- screens ---------- */\nfunction homeHTML() {\n  var q = new URLSearchParams(location.search).get(\"code\") || \"\";\n  return '<div class=\"pulse-in\"><div style=\"height:10px\"></div><div class=\"logo\">🎮 Party Arcade</div><p class=\"sub\">Six party games • chat • likes • play with friends or the computer</p>' +\n    '<div class=\"card\"><h3>👋 What\\'s your name?</h3><input id=\"hname\" data-keep=\"1\" maxlength=\"16\" placeholder=\"Your name\" autocomplete=\"off\" value=\"' + esc(LS(\"pa.name\") || \"\") + '\"></div>' +\n    '<div class=\"card\"><button class=\"btn big\" data-do=\"solo\">🤖 Play solo vs computer</button><p class=\"small mut c\" style=\"margin:8px 0 0\">Instant game with 3 computer players</p></div>' +\n    '<div class=\"card\"><h3>🧑‍🤝‍🧑 Play with friends</h3><button class=\"btn big alt\" data-do=\"create\">✨ Create a lobby</button><div class=\"c mut\" style=\"margin:10px 0\">— or join one —</div>' +\n    '<div class=\"row\"><input id=\"hcode\" data-keep=\"1\" data-enter=\"join\" maxlength=\"4\" placeholder=\"CODE\" style=\"text-transform:uppercase;letter-spacing:6px;text-align:center;font-weight:700;font-size:22px\" autocomplete=\"off\" value=\"' + esc(q.toUpperCase()) + '\"><button class=\"btn good\" data-do=\"join\">Join</button></div></div></div>';\n}\nfunction mainHTML() {\n  var unread = S.chat.filter(function (m) { return m.id > seenChat && m.by !== pid; }).length;\n  if (tab === \"chat\") unread = 0;\n  var head = '<div class=\"top\"><div class=\"t\">🎮 <span style=\"color:var(--gold)\">' + esc(S.code) + '</span></div><button class=\"btn ghost sm\" data-do=\"invite\">📨 Invite</button><button class=\"btn ghost sm\" data-do=\"leave\">🚪</button></div>';\n  var body = tab === \"chat\" ? chatHTML() : tab === \"moments\" ? momentsHTML() : (S.phase === \"game\" && S.game ? gameHTML(S.game) : lobbyHTML());\n  var tabs = '<nav class=\"tabs\"><div class=\"in\">' +\n    ['game', 'chat', 'moments'].map(function (t) { var lab = { game: \"🎮 Play\", chat: \"💬 Chat\", moments: \"❤️ Moments\" }[t]; var b = t === \"chat\" && unread ? '<span class=\"badge\">' + unread + \"</span>\" : \"\"; return '<button class=\"tab ' + (tab === t ? \"on\" : \"\") + '\" data-do=\"tab\" data-v=\"' + t + '\">' + lab + b + \"</button>\"; }).join(\"\") + \"</div></nav>\";\n  return head + '<div class=\"pulse-in\" id=\"pane\">' + body + \"</div>\" + tabs;\n}\n\nfunction lobbyHTML() {\n  var host = isHost(), sel = S.settings.game;\n  var tiles = Object.keys(GAME_INFO).map(function (k) {\n    var gi = GAME_INFO[k]; var cc = gi.c.split(\",\");\n    return '<button class=\"tile ' + (sel === k ? \"on\" : \"\") + '\" data-do=\"pickgame\" data-v=\"' + k + '\" style=\"--bgc:linear-gradient(135deg,' + cc[0] + \",\" + cc[1] + \");--glow:\" + gi.g + '\"><span class=\"mn\">👥 ' + MINS[k] + \"+</span><span class=\\\"e\\\">\" + gi.e + \"</span><b>\" + gi.n + '</b><span class=\"d\">' + gi.d + \"</span></button>\";\n  }).join(\"\");\n  var opts = settingsHTML(sel, host);\n  var need = Math.max(0, MINS[sel] - S.players.length);\n  var start = host ? '<button class=\"btn big good\" data-do=\"start\">' + (need ? \"🤖 Add \" + need + \" computer player\" + (need > 1 ? \"s\" : \"\") + \" & start\" : \"🚀 Start \" + GAME_INFO[sel].n) + \"</button>\" : '<div class=\"c mut\">⏳ Waiting for the host to start <b>' + GAME_INFO[sel].n + \"</b>…</div>\";\n  var pl = S.players.map(function (p) {\n    return '<div class=\"pl\"><div class=\"av\">' + p.avatar + '</div><div><div class=\"nm\">' + esc(p.name) + (p.id === S.host ? \" 👑\" : \"\") + (p.id === pid ? \" (you)\" : \"\") + (p.bot ? ' <span class=\"pill\">🤖 computer</span>' : \"\") + '</div><div class=\"small mut\">' + p.score + \" pts · ❤️ \" + p.hearts + \"</div></div>\" +\n      '<div class=\"sc\">' + (p.id === pid ? '<button class=\"btn ghost sm\" data-do=\"rename\">✏️</button> <button class=\"btn ghost sm\" data-do=\"avtoggle\">😀</button>' : (host ? '<button class=\"btn ghost sm\" data-do=\"' + (p.bot ? \"rmbot\" : \"kick\") + '\" data-id=\"' + p.id + '\">✖</button>' : \"\")) + \"</div></div>\";\n  }).join(\"\");\n  var av = \"\";\n  if (avOpen) { var taken = {}; S.players.forEach(function (p) { if (p.id !== pid) taken[p.avatar] = 1; }); av = '<div class=\"avgrid\">' + AVATARS.map(function (a) { return '<button data-do=\"avatar\" data-v=\"' + a + '\" ' + (taken[a] ? \"disabled\" : \"\") + (P(pid).avatar === a ? ' class=\"me\"' : \"\") + \">\" + a + \"</button>\"; }).join(\"\") + \"</div>\"; }\n  var hall = S.hall.length ? '<div class=\"card\"><h3>🏆 Hall of Fame</h3>' + S.hall.map(function (it) { return itemCard(it); }).join(\"\") + \"</div>\" : \"\";\n  return '<div class=\"card c\"><div class=\"mut small\">Share this code with friends</div><div class=\"code\">' + esc(S.code) + \"</div></div>\" +\n    '<div class=\"card\"><h3>🎲 Pick a game' + (host ? \"\" : \" <span class=\\\"mut small\\\">(host chooses)</span>\") + '</h3><div class=\"tiles\" ' + (host ? \"\" : 'style=\"pointer-events:none\"') + \">\" + tiles + \"</div>\" + (opts ? '<div style=\"margin-top:12px\">' + opts + \"</div>\" : \"\") + \"</div>\" +\n    '<div class=\"card\">' + start + (host && S.players.length < 10 ? '<div class=\"c\" style=\"margin-top:10px\"><button class=\"btn ghost sm\" data-do=\"addbot\">➕ Add computer player</button></div>' : \"\") + \"</div>\" +\n    '<div class=\"card\"><h3>👥 Players (' + S.players.length + \"/10)</h3><div class=\\\"plist\\\">\" + pl + \"</div>\" + av + \"</div>\" + hall;\n}\nfunction chipsFor(k, vals, labels) {\n  return '<div class=\"chips\">' + vals.map(function (v, i) { return '<button class=\"chip ' + (S.settings[k] === v ? \"on\" : \"\") + '\" data-do=\"opt\" data-k=\"' + k + '\" data-v=\"' + v + '\" ' + (isHost() ? \"\" : \"disabled\") + \">\" + (labels ? labels[i] : v) + \"</button>\"; }).join(\"\") + \"</div>\";\n}\nfunction settingsHTML(sel) {\n  var o = \"\";\n  if (sel === \"bluff\") o = '<div class=\"small mut\">Rounds</div>' + chipsFor(\"rounds\", [3, 5, 8]);\n  if (sel === \"wave\") o = '<div class=\"small mut\">Psychic turns each</div>' + chipsFor(\"turns\", [1, 2]);\n  if (sel === \"scat\") o = '<div class=\"small mut\">Rounds</div>' + chipsFor(\"scat\", [3, 5]);\n  if (sel === \"draw\") o = '<div class=\"small mut\">Turns each</div>' + chipsFor(\"turns\", [1, 2]) + '<div class=\"small mut\" style=\"margin-top:8px\">Style</div>' + chipsFor(\"style\", [\"draw\", \"emoji\", \"mix\"], [\"🎨 Draw\", \"😜 Emoji charades\", \"🔀 Mix\"]);\n  if (sel === \"chain\") o = '<div class=\"small mut\">Lives each</div>' + chipsFor(\"lives\", [2, 3, 5], [\"❤️❤️\", \"❤️❤️❤️\", \"❤️×5\"]);\n  if (sel === \"code\") o = '<div class=\"small mut\">Teams are made automatically. Computer players fill empty spots, even as spymasters! 🕵️</div>';\n  return o;\n}\n\n/* ---------- game shell ---------- */\nfunction sbHTML(g) {\n  var ids = S.players.map(function (p) { return p.id; }).sort(function (a, b) { return (g.pts[b] || 0) - (g.pts[a] || 0); });\n  return '<div class=\"sb\">' + ids.map(function (id) { var p = P(id), d = g.delta && g.delta[id]; return '<div class=\"sbp ' + (id === pid ? \"you\" : \"\") + '\"><span class=\"a\">' + p.avatar + \"</span>\" + esc(p.name.slice(0, 9)) + \" <b>\" + (g.pts[id] || 0) + \"</b>\" + (d ? ' <span class=\"delta\">+' + d + \"</span>\" : \"\") + \"</div>\"; }).join(\"\") + \"</div>\";\n}\nfunction ghead(g, sub) {\n  var gi = GAME_INFO[g.type];\n  return '<div class=\"card\"><div class=\"ghead\"><div class=\"av\" style=\"background:linear-gradient(135deg,' + gi.c + ')\">' + gi.e + '</div><div class=\"gt\"><b>' + gi.n + \"</b><span>\" + sub + '</span></div>' + (g.left ? '<div class=\"timer\"><span>0</span></div>' : \"\") + \"</div>\" + sbHTML(g) + \"</div>\";\n}\nfunction hostBtn(txt, what) { return isHost() ? '<div class=\"c\" style=\"margin-top:8px\"><button class=\"btn ghost sm\" data-do=\"' + (what || \"gnext\") + '\">' + txt + \"</button></div>\" : \"\"; }\nfunction gameHTML(g) {\n  if (g.phase === \"over\") return overHTML(g);\n  return { bluff: bluffHTML, wave: waveHTML, scat: scatHTML, draw: drawHTML, code: codeHTML, chain: chainHTML }[g.type](g);\n}\nfunction overHTML(g) {\n  var ids = S.players.map(function (p) { return p.id; }).sort(function (a, b) { return (g.pts[b] || 0) - (g.pts[a] || 0); });\n  var top = ids.slice(0, 3), order = [1, 0, 2].filter(function (i) { return top[i]; });\n  var pod = '<div class=\"pod\">' + order.map(function (i) { var p = P(top[i]); return '<div><span class=\"a\">' + p.avatar + (i === 0 ? \"👑\" : \"\") + '</span><div class=\"n\">' + esc(p.name) + '</div><div class=\"blk b' + (i + 1) + '\">' + (g.pts[top[i]] || 0) + \"</div></div>\"; }).join(\"\") + \"</div>\";\n  var extra = \"\";\n  if (g.type === \"code\") extra = '<div class=\"c\" style=\"font-size:20px;margin:6px 0\">' + (g.winner === \"red\" ? '<span class=\"team-red\">🔴 Red</span>' : '<span class=\"team-blue\">🔵 Blue</span>') + \" team wins!<br><span class=\\\"small mut\\\">\" + esc(g.why) + \"</span></div>\";\n  var rest = ids.slice(3).map(function (id, i) { return '<div class=\"pl\"><div class=\"av\">' + P(id).avatar + \"</div><div class=\\\"nm\\\">\" + (i + 4) + \". \" + esc(P(id).name) + '</div><div class=\"sc\">' + (g.pts[id] || 0) + \"</div></div>\"; }).join(\"\");\n  var btns = isHost() ? '<button class=\"btn big good\" data-do=\"again\">🔁 Play again</button><div style=\"height:8px\"></div><button class=\"btn big ghost\" data-do=\"backlobby\">🏠 Back to lobby (pick another game)</button>' : '<div class=\"c mut\">⏳ Waiting for the host…</div>';\n  var m = S.items.length ? '<div class=\"c small mut\" style=\"margin-top:10px\">❤️ Check the <b>Moments</b> tab to like & comment on the best bits!</div>' : \"\";\n  return '<div class=\"card c\"><h2 style=\"font-size:26px\">🏆 ' + GAME_INFO[g.type].n + ' results</h2>' + extra + pod + (rest ? '<div class=\"plist\" style=\"margin-top:12px\">' + rest + \"</div>\" : \"\") + \"</div>\" + '<div class=\"card\">' + btns + m + \"</div>\";\n}\n\n/* ---------- BLUFF ---------- */\nfunction bluffHTML(g) {\n  var q = esc(g.q).replace(\"___\", \"<em>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</em>\");\n  var h = ghead(g, \"Round \" + g.round + \" of \" + g.rounds + \" · \" + { write: \"Write a lie ✍️\", pick: \"Find the truth 🔍\", reveal: \"The reveal! 🎉\" }[g.phase]);\n  h += '<div class=\"card\"><div class=\"q\">' + q + \"</div></div>\";\n  if (g.phase === \"write\") {\n    var sub = g.submitted.indexOf(pid) >= 0;\n    h += '<div class=\"card\"><h3>✍️ Invent a believable fake answer</h3><input id=\"lie\" data-keep=\"1\" data-enter=\"lie\" maxlength=\"60\" placeholder=\"Type your lie…\" autocomplete=\"off\">' +\n      '<div style=\"height:8px\"></div><button class=\"btn big\" data-do=\"lie\">' + (sub ? \"✅ Locked in — tap to change\" : \"🔒 Lock it in\") + '</button><p class=\"small mut c\">' + g.submitted.length + \" human lie(s) in. Computers always bluff too! 🤖</p></div>\";\n  }\n  if (g.phase === \"pick\") {\n    h += '<div class=\"card\"><h3>🔍 Which one is the TRUTH?</h3>' + g.options.map(function (o) { return '<button class=\"opt ' + (o.mine ? \"mine\" : \"\") + (g.myPick === o.id ? \" sel\" : \"\") + '\" data-do=\"bpick\" data-id=\"' + o.id + '\"><span>' + esc(o.text) + \"</span>\" + (o.mine ? '<span class=\"by\">your lie</span>' : \"\") + \"</button>\"; }).join(\"\") +\n      '<p class=\"small mut c\">' + (g.myPick ? \"🔒 Locked. Waiting for others… (\" + g.picked.length + \"/\" + S.players.length + \")\" : \"Tap an answer. You can't pick your own lie.\") + \"</p></div>\";\n  }\n  if (g.phase === \"reveal\") {\n    h += '<div class=\"card\">' + g.options.map(function (o) {\n      var by = o.truth ? \"✅ THE TRUTH\" : (o.authors.length ? \"🎭 \" + o.authors.map(function (a) { return P(a).avatar + \" \" + esc(P(a).name); }).join(\", \") : \"🤖 filler\");\n      var pk = o.pickers.length ? \"<div class=\\\"small mut\\\" style=\\\"margin:-4px 0 6px 6px\\\">picked by \" + o.pickers.map(function (p) { return P(p).avatar + \" \" + esc(P(p).name); }).join(\", \") + \"</div>\" : \"\";\n      var it = o.item ? itemById(o.item) : null;\n      return '<div class=\"opt ' + (o.truth ? \"truth\" : \"\") + '\" style=\"cursor:default\"><span>' + esc(o.text) + '</span><span class=\"by\">' + by + \"</span></div>\" + pk + (it ? '<div style=\"margin:-2px 0 6px 6px\">' + likeBar(it) + \"</div>\" : \"\");\n    }).join(\"\") + hostBtn(\"⏭ Next round\") + \"</div>\";\n  }\n  return h;\n}\n\n/* ---------- WAVELENGTH ---------- */\nfunction waveBarHTML(g, o) {\n  var zones = \"\";\n  if (o.target != null) [[28, \"z1\"], [18, \"z2\"], [10, \"z3\"], [4, \"z4\"]].forEach(function (z) { var a = Math.max(0, o.target - z[0]), b = Math.min(100, o.target + z[0]); zones += '<div class=\"zone ' + z[1] + '\" style=\"left:' + a + \"%;width:\" + (b - a) + '%\"></div>'; });\n  var mk = \"\";\n  if (o.target != null) mk += '<div class=\"mk tg\" style=\"left:' + Math.min(94, Math.max(6, o.target)) + '%\">🎯</div>';\n  (o.marks || []).forEach(function (m) { mk += '<div class=\"mk\" style=\"left:' + Math.min(94, Math.max(6, m.v)) + '%\">' + P(m.id).avatar + \"</div>\"; });\n  if (o.me) mk += '<div class=\"mk\" id=\"wme\" style=\"left:' + Math.min(94, Math.max(6, wv)) + '%\">📍</div>';\n  return '<div class=\"wlab\"><span>' + g.spec[2] + \" \" + esc(g.spec[0]) + \"</span><span>\" + esc(g.spec[1]) + \" \" + g.spec[3] + '</span></div><div class=\"wbar\">' + zones + mk + \"</div>\";\n}\nfunction waveHTML(g) {\n  var psy = g.psy === pid;\n  var h = ghead(g, \"Round \" + g.round + \" of \" + g.rounds + \" · \" + who(g.psy) + \" is the psychic 🔮\");\n  if (g.phase === \"clue\") {\n    h += '<div class=\"card\">' + waveBarHTML(g, { target: psy ? g.target : null });\n    h += psy ? '<p class=\"c\">🎯 Only <b>you</b> can see the target! Give a clue (word or phrase) that points to it.</p><input id=\"clue\" data-keep=\"1\" data-enter=\"wclue\" maxlength=\"40\" placeholder=\"Your clue…\" autocomplete=\"off\"><div style=\"height:8px\"></div><button class=\"btn big\" data-do=\"wclue\">📡 Send clue</button>' : '<p class=\"c mut\">⏳ ' + esc(P(g.psy).name) + \" is thinking of a clue…</p>\";\n    h += \"</div>\";\n  }\n  if (g.phase === \"guess\") {\n    var locked = g.locked.indexOf(pid) >= 0;\n    h += '<div class=\"card\"><div class=\"c small mut\">The clue is</div><div class=\"clue\">“' + esc(g.clue) + \"”</div>\" + waveBarHTML(g, { target: psy ? g.target : null, me: !psy });\n    if (psy) h += '<p class=\"c mut\">Your friends are guessing… (' + g.locked.length + \" locked)</p>\";\n    else if (locked) h += '<p class=\"c\">🔒 Locked in! Waiting… (' + g.locked.length + \")</p>\";\n    else h += '<input type=\"range\" id=\"wslide\" min=\"0\" max=\"100\" value=\"' + wv + '\"><button class=\"btn big\" data-do=\"wlock\">🔒 Lock in my guess</button>';\n    h += \"</div>\";\n  }\n  if (g.phase === \"reveal\") {\n    var it = g.item ? itemById(g.item) : null;\n    h += '<div class=\"card\">' + (g.skipped ? '<p class=\"c\">⏰ No clue this time.</p>' : '<div class=\"c small mut\">The clue was</div><div class=\"clue\">“' + esc(g.clue) + \"”</div>\") +\n      waveBarHTML(g, { target: g.target, marks: (g.results || []).filter(function (r) { return r.v != null; }).map(function (r) { return { id: r.id, v: r.v }; }) });\n    (g.results || []).forEach(function (r) { h += '<div class=\"ent\">' + P(r.id).avatar + \" \" + esc(P(r.id).name) + '<span style=\"margin-left:auto\">' + (r.v == null ? \"no guess\" : \"off by \" + r.d + \" → <b class=\\\"delta\\\">+\" + r.p + \"</b>\") + \"</span></div>\"; });\n    if (it) h += '<div style=\"margin-top:8px\">' + likeBar(it) + \"</div>\";\n    h += hostBtn(\"⏭ Next round\") + \"</div>\";\n  }\n  return h;\n}\n\n/* ---------- SCATTERGORIES ---------- */\nfunction saveScat(done) {\n  var g = S && S.game; if (!g || g.type !== \"scat\" || g.phase !== \"write\" || g.locked) return Promise.resolve();\n  var a = []; for (var i = 0; i < 5; i++) { var el = document.getElementById(\"sc\" + i); a.push(el ? el.value : (drafts[\"sc\" + i] || \"\")); }\n  return act(\"g_scat\", { answers: a, done: !!done });\n}\nfunction scatHTML(g) {\n  var h = ghead(g, \"Round \" + g.round + \" of \" + g.rounds);\n  h += '<div class=\"card c\"><div class=\"small mut\">Every answer must start with</div><div class=\"bigl\">' + g.letter + \"</div></div>\";\n  if (g.phase === \"write\") {\n    h += '<div class=\"card\">' + g.cats.map(function (c, i) { var id = \"sc\" + i; if (drafts[id] === undefined && g.mine[i]) drafts[id] = g.mine[i]; return '<div class=\"cat\"><div class=\"cl\">' + esc(c) + '</div><input id=\"' + id + '\" data-keep=\"1\" data-enter=\"scatdone\" maxlength=\"30\" placeholder=\"' + g.letter + '…\" autocomplete=\"off\" ' + (g.locked ? \"disabled\" : \"\") + \"></div>\"; }).join(\"\") +\n      (g.locked ? '<p class=\"c\">🔒 Locked in. Waiting for others… (' + g.done.length + \" done)</p>\" : '<button class=\"btn big good\" data-do=\"scatdone\">✅ I\\'m done!</button>') + '<p class=\"small mut c\">Unique answers = 2 pts, same as someone else = 1 pt.</p></div>';\n  }\n  if (g.phase === \"judge\") {\n    var done = g.judged.indexOf(pid) >= 0;\n    h += '<div class=\"card\"><h3>⚖️ Judge time</h3><p class=\"small mut\">Tap 🚫 on answers that are wrong or silly. If most players reject it, it scores 0.</p>' +\n      g.cats.map(function (c, ci) { var es2 = g.entries.filter(function (e) { return e.ci === ci; }); return '<div style=\"margin-top:10px\"><b>' + esc(c) + \"</b>\" + (es2.length ? es2.map(function (e) { return '<div class=\"ent\">' + P(e.pid).avatar + \" <b>\" + esc(e.text) + \"</b>\" + (e.pid === pid ? \"\" : '<button class=\"rej ' + (e.mineRej ? \"on\" : \"\") + '\" data-do=\"reject\" data-key=\"' + e.key + '\">🚫 ' + (e.rej || \"\") + \"</button>\") + \"</div>\"; }).join(\"\") : '<div class=\"small mut\">nobody answered 😬</div>') + \"</div>\"; }).join(\"\") +\n      '<div style=\"height:10px\"></div><button class=\"btn big good\" ' + (done ? \"disabled\" : \"\") + ' data-do=\"judged\">' + (done ? \"✅ Waiting for others…\" : \"👍 Done judging\") + \"</button></div>\";\n  }\n  if (g.phase === \"reveal\") {\n    h += '<div class=\"card\"><h3>📊 Round results</h3>' + g.cats.map(function (c, ci) { var es2 = g.entries.filter(function (e) { return e.ci === ci; }); return '<div style=\"margin-top:10px\"><b>' + esc(c) + \"</b>\" + es2.map(function (e) { var it = e.item ? itemById(e.item) : null; return '<div class=\"ent ' + (e.status === \"rejected\" ? \"bad\" : e.status) + '\">' + P(e.pid).avatar + \" \" + esc(e.text) + '<span style=\"margin-left:auto\">' + (e.status === \"rejected\" ? \"🚫 0\" : e.status === \"dup\" ? \"👯 +1\" : \"⭐ +2\") + \"</span>\" + (it ? \" \" + likeMini(it) : \"\") + \"</div>\"; }).join(\"\") + \"</div>\"; }).join(\"\") + hostBtn(\"⏭ Next round\") + \"</div>\";\n  }\n  return h;\n}\n\n/* ---------- DRAW & CHARADES ---------- */\nvar cv = document.createElement(\"canvas\"); cv.width = 1000; cv.height = 700;\nvar cx = cv.getContext(\"2d\"), strokes = [], curTurn = \"\", penC = \"#111111\", penW = 7, cur = null, sentIdx = 0, flushT = null;\nfunction strokeDraw(s, from) {\n  cx.strokeStyle = s.c; cx.fillStyle = s.c; cx.lineWidth = s.w; cx.lineCap = \"round\"; cx.lineJoin = \"round\";\n  var p = s.p; if (!p.length) return;\n  if (p.length === 1) { cx.beginPath(); cx.arc(p[0][0], p[0][1], s.w / 2, 0, 6.3); cx.fill(); return; }\n  cx.beginPath(); var st = Math.max(0, (from || 0) - 1); cx.moveTo(p[st][0], p[st][1]);\n  for (var i = st + 1; i < p.length; i++) cx.lineTo(p[i][0], p[i][1]); cx.stroke();\n}\nfunction redraw() { cx.clearRect(0, 0, 1000, 700); strokes.forEach(function (s) { strokeDraw(s, 0); }); }\nfunction remoteDraw(m) {\n  if (m.turn !== curTurn) return;\n  if (m.clear) { strokes = []; redraw(); return; }\n  if (m.undo) { strokes.pop(); redraw(); return; }\n  var s = m.s, last = strokes[strokes.length - 1];\n  if (last && last.sid === s.sid) { var from = last.p.length; last.p = last.p.concat(s.p); strokeDraw(last, from); }\n  else { strokes.push({ sid: s.sid, c: s.c, w: s.w, p: s.p.slice() }); strokeDraw(strokes[strokes.length - 1], 0); }\n}\nfunction isPerf() { var g = S && S.game; return !!g && g.type === \"draw\" && g.phase === \"play\" && g.perf === pid && g.mode === \"draw\"; }\nfunction pt(e) { var r = cv.getBoundingClientRect(); return [Math.round((e.clientX - r.left) / r.width * 1000), Math.round((e.clientY - r.top) / r.height * 700)]; }\nfunction flush(final) {\n  if (!cur) return; var p = cur.p.slice(Math.max(0, sentIdx - 1)); if (p.length < 1 || (p.length === 1 && sentIdx > 0)) return;\n  sentIdx = cur.p.length;\n  fetch(\"/api/act\", { method: \"POST\", headers: { \"Content-Type\": \"application/json\" }, keepalive: true, body: JSON.stringify({ code: code, pid: pid, type: \"g_stroke\", sid: cur.sid, c: cur.c, w: cur.w, p: p }) }).catch(function () {});\n}\ncv.addEventListener(\"pointerdown\", function (e) {\n  if (!isPerf()) return; e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) {}\n  cur = { sid: Math.random().toString(36).slice(2, 8), c: penC, w: penW, p: [pt(e)] }; sentIdx = 0; strokes.push(cur); strokeDraw(cur, 0);\n  clearInterval(flushT); flushT = setInterval(flush, 140);\n});\ncv.addEventListener(\"pointermove\", function (e) {\n  if (!cur || !isPerf()) return; e.preventDefault();\n  var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]; if (!evs.length) evs = [e];\n  evs.forEach(function (ev) { var from = cur.p.length; cur.p.push(pt(ev)); strokeDraw(cur, from); });\n});\nfunction endStroke() { if (!cur) return; clearInterval(flushT); flush(true); cur = null; }\ncv.addEventListener(\"pointerup\", endStroke); cv.addEventListener(\"pointercancel\", endStroke);\nfunction sizeDrawUI() { cv.style.pointerEvents = isPerf() ? \"auto\" : \"none\"; }\nfunction emoPush(e) { var g = S.game; var l = g.emo.slice(); if (l.length >= 14) return; l.push(e); act(\"g_emo\", { list: l }); }\nfunction drawHTML(g) {\n  var perf = g.perf === pid, got = g.guessed.indexOf(pid) >= 0;\n  var h = ghead(g, \"Turn \" + g.round + \" of \" + g.rounds + \" · \" + who(g.perf) + (g.mode === \"draw\" ? \" is drawing 🎨\" : \" is acting with emojis 😜\"));\n  var info = \"\";\n  if (g.phase === \"play\" || g.phase === \"reveal\") {\n    if (g.word) info = perf || g.phase === \"reveal\" || got ? '<div class=\"c small mut\">' + (g.phase === \"reveal\" ? \"The word was\" : perf ? \"Your word (don't say it!)\" : \"You got it! 🎉\") + '</div><div class=\"q\" style=\"padding:0\">' + esc(g.word) + \"</div>\" : \"\";\n    else info = '<div class=\"mask\">' + g.mask.map(function (ch) { return ch === \" \" ? \"&nbsp;&nbsp;\" : ch; }).join(\" \") + '</div><div class=\"c small mut\">' + g.len + \" letters</div>\";\n  }\n  h += '<div class=\"card\">' + info;\n  if (g.mode === \"draw\") {\n    h += '<div id=\"cvhost\" style=\"margin-top:8px\"></div>';\n    if (perf && g.phase === \"play\") h += '<div class=\"tools\">' + SWATCH.map(function (c) { return '<button class=\"sw ' + (penC === c ? \"on\" : \"\") + '\" style=\"background:' + c + '\" data-do=\"pen\" data-v=\"' + c + '\"></button>'; }).join(\"\") + '<button class=\"btn ghost sm\" data-do=\"penw\" data-v=\"4\">•</button><button class=\"btn ghost sm\" data-do=\"penw\" data-v=\"9\">●</button><button class=\"btn ghost sm\" data-do=\"penw\" data-v=\"22\">⬤</button><button class=\"btn ghost sm\" data-do=\"undo\">↩️</button><button class=\"btn ghost sm\" data-do=\"clr\">🗑️</button></div>';\n  } else {\n    h += '<div class=\"emoline\">' + (g.emo.length ? g.emo.join(\" \") : '<span class=\"mut\" style=\"font-size:16px\">' + (perf ? \"Tap emojis below to build your clue 👇\" : \"Waiting for emoji clues…\") + \"</span>\") + \"</div>\";\n    if (perf && g.phase === \"play\") h += '<div class=\"epal\">' + EMOJI_PAL.map(function (e) { return '<button data-do=\"emo\" data-v=\"' + e + '\">' + e + \"</button>\"; }).join(\"\") + '</div><div class=\"c\" style=\"margin-top:8px\"><button class=\"btn ghost sm\" data-do=\"emoundo\">↩️ Undo</button> <button class=\"btn ghost sm\" data-do=\"emoclr\">🗑️ Clear</button></div>';\n  }\n  h += \"</div>\";\n  if (g.phase === \"play\") {\n    if (!perf && !got) h += '<div class=\"card\"><div class=\"row\"><input id=\"gs\" data-keep=\"1\" data-enter=\"guess\" maxlength=\"40\" placeholder=\"' + (g.close ? \"🔥 So close! Try again…\" : \"Type your guess…\") + '\" autocomplete=\"off\"><button class=\"btn\" data-do=\"guess\">Guess</button></div></div>';\n    if (perf) h += hostBtn(\"⏭ Skip turn (everyone gave up)\", \"gnext\").replace('data-do=\"gnext\"', 'data-do=\"gnext\"');\n  }\n  if (g.guesses.length) h += '<div class=\"card\"><h3>💭 Guesses</h3><div class=\"feed\">' + g.guesses.slice().reverse().map(function (x) { return x.ok ? '<div class=\"ok\">🎉 ' + esc(P(x.by).name) + \" got it!</div>\" : \"<div>\" + P(x.by).avatar + \" <b>\" + esc(P(x.by).name) + \":</b> \" + esc(x.text) + \"</div>\"; }).join(\"\") + \"</div></div>\";\n  if (g.phase === \"reveal\" && g.item) { var it = itemById(g.item); if (it) h += '<div class=\"card\"><div class=\"c small mut\">Liked the performance?</div>' + likeBar(it) + \"</div>\"; }\n  return h;\n}\n\n/* ---------- CODENAMES ---------- */\nfunction codeHTML(g) {\n  var t = g.turn, tn = t === \"red\" ? '<span class=\"team-red\">🔴 Red</span>' : '<span class=\"team-blue\">🔵 Blue</span>';\n  var mine = g.myTeam === t && !g.spy, spyTurn = g.sm[t] === pid;\n  var h = ghead(g, tn + \" team's turn · 🔴 \" + g.remain.red + \" left · 🔵 \" + g.remain.blue + \" left\");\n  var role = g.spy ? \"🕵️ You are the <b>Spymaster</b> for \" + (g.myTeam === \"red\" ? \"🔴 Red\" : \"🔵 Blue\") + \" — you can see the colors!\" : \"🧭 You are an <b>Operative</b> on \" + (g.myTeam === \"red\" ? \"🔴 Red\" : \"🔵 Blue\");\n  h += '<div class=\"card\"><div class=\"small c\" style=\"margin-bottom:8px\">' + role + '</div><div class=\"cn-grid\">' + g.board.map(function (c, i) {\n    var cls = \"cn\" + (c.rev ? \" rev \" + c.c : (g.spy && c.c ? \" spy \" + c.c : \"\")); var can = g.phase === \"guess\" && mine && !c.rev;\n    return '<button class=\"' + cls + '\" ' + (can ? 'data-do=\"reveal\" data-i=\"' + i + '\"' : \"\") + \">\" + esc(c.w) + (c.rev && c.c === \"assassin\" ? \" 💀\" : \"\") + \"</button>\";\n  }).join(\"\") + \"</div></div>\";\n  if (g.phase === \"clue\") {\n    h += '<div class=\"card c\">' + (spyTurn ? '<h3>🕵️ Give a one-word clue</h3><div class=\"row\"><input id=\"cw\" data-keep=\"1\" data-enter=\"cclue\" maxlength=\"20\" placeholder=\"Clue word\" autocomplete=\"off\"><input id=\"cn\" data-keep=\"1\" type=\"number\" min=\"1\" max=\"9\" inputmode=\"numeric\" placeholder=\"#\" style=\"width:70px;text-align:center\"></div><div style=\"height:8px\"></div><button class=\"btn big\" data-do=\"cclue\">📣 Send clue</button><p class=\"small mut\">The number tells how many words match your clue.</p>' : '<p class=\"mut\">⏳ ' + esc(P(g.sm[t]).name) + \" (spymaster) is thinking of a clue…</p>\") + \"</div>\";\n  }\n  if (g.phase === \"guess\") {\n    h += '<div class=\"card c\"><div class=\"small mut\">Clue</div><div class=\"clue\">' + esc(g.clue.word.toUpperCase()) + \" <span style=\\\"color:var(--gold)\\\">\" + g.clue.n + \"</span></div><div class=\\\"small mut\\\">\" + g.made + \" guessed · up to \" + (g.gl) + \" more</div>\" + (mine ? '<div style=\"height:8px\"></div><button class=\"btn ghost\" ' + (g.made < 1 ? \"disabled\" : \"\") + ' data-do=\"cend\">✋ End turn</button><p class=\"small mut\">Tap a word to guess it.</p>' : '<p class=\"small mut\">' + (g.myTeam === t ? \"Your spymaster is quiet, the operatives are guessing.\" : \"Opponents are guessing…\") + \"</p>\") + \"</div>\";\n  }\n  if (g.log.length) h += '<div class=\"card\"><h3>📜 Log</h3><div class=\"feed\">' + g.log.map(function (x) { return '<div class=\"' + (x.t === \"red\" ? \"team-red\" : \"team-blue\") + '\">' + esc(x.text) + \"</div>\"; }).join(\"\") + \"</div></div>\";\n  var teams = '<div class=\"small mut c\">🔴 ' + S.players.filter(function (p) { return g.team[p.id] === \"red\"; }).map(function (p) { return p.avatar + esc(p.name) + (g.sm.red === p.id ? \"🕵️\" : \"\"); }).join(\" · \") + \"<br>🔵 \" + S.players.filter(function (p) { return g.team[p.id] === \"blue\"; }).map(function (p) { return p.avatar + esc(p.name) + (g.sm.blue === p.id ? \"🕵️\" : \"\"); }).join(\" · \") + \"</div>\";\n  return h + '<div class=\"card\">' + teams + \"</div>\";\n}\n\n/* ---------- WORD CHAIN ---------- */\nfunction chainHTML(g) {\n  var me = g.cur === pid;\n  var h = ghead(g, \"Chain length \" + g.count + \" · \" + who(g.cur) + \"'s turn\");\n  h += '<div class=\"card c\"><div class=\"small mut\">' + (me ? \"Your word must start with\" : \"Next word must start with\") + '</div><div class=\"bigl\">' + g.req.toUpperCase() + \"</div>\";\n  if (g.event) h += '<p class=\"c\" style=\"margin:8px 0 0\">💥 ' + esc(P(g.event.pid).name) + \" \" + esc(g.event.why) + \" −1 ❤️</p>\";\n  if (me) h += '<div class=\"row\" style=\"margin-top:12px\"><input id=\"cwd\" data-keep=\"1\" data-enter=\"cword\" maxlength=\"24\" placeholder=\"' + g.req.toUpperCase() + '…\" autocomplete=\"off\" autocapitalize=\"off\"><button class=\"btn\" data-do=\"cword\">Go!</button></div>';\n  h += \"</div>\";\n  h += '<div class=\"card\"><h3>❤️ Lives</h3><div class=\"plist\">' + g.order.map(function (id) { var out = g.out.indexOf(id) >= 0; var hearts = out ? \"💀\" : new Array(g.lives[id] + 1).join(\"❤️\"); return '<div class=\"pl\" style=\"' + (id === g.cur ? \"border-color:var(--gold);background:rgba(251,191,36,.15)\" : \"\") + (out ? \";opacity:.45\" : \"\") + '\"><div class=\"av\">' + P(id).avatar + '</div><div class=\"nm\">' + esc(P(id).name) + (id === pid ? \" (you)\" : \"\") + '</div><div class=\"sc\">' + hearts + \"</div></div>\"; }).join(\"\") + \"</div></div>\";\n  h += '<div class=\"card\"><h3>🔗 The chain</h3><div class=\"chain\">' + g.chain.map(function (c, i) { var w = esc(c.w); return '<span class=\"cw ' + (i === g.chain.length - 1 ? \"cur\" : \"\") + '\">' + w.slice(0, -1) + \"<b>\" + w.slice(-1) + \"</b></span>\"; }).join(\"\") + \"</div></div>\";\n  return h;\n}\n\n/* ---------- chat / moments ---------- */\nfunction chatHTML() {\n  var list = S.chat.map(function (m) {\n    if (m.sys) return '<div class=\"sysm\">' + esc(m.text) + \"</div>\";\n    var me = m.by === pid, p = P(m.by);\n    return '<div class=\"m ' + (me ? \"me\" : \"\") + '\"><div class=\"av\" style=\"width:34px;height:34px;font-size:20px\">' + p.avatar + '</div><div class=\"bub\">' + (me ? \"\" : '<div class=\"who\">' + esc(p.name) + (p.bot ? \" 🤖\" : \"\") + \"</div>\") + esc(m.text) + (m.edited ? ' <span class=\"small mut\">(edited)</span>' : \"\") +\n      (me || isHost() ? '<div class=\"tools2\">' + (me ? '<button data-do=\"cedit\" data-id=\"' + m.id + '\">✏️ edit</button>' : \"\") + '<button data-do=\"cdel\" data-id=\"' + m.id + '\">🗑️</button></div>' : \"\") + \"</div></div>\";\n  }).join(\"\");\n  var q = [\"😂\", \"🔥\", \"😮\", \"👏\", \"❤️\", \"😎\", \"🎉\", \"🤯\", \"😈\", \"🥲\"].map(function (e) { return '<button data-do=\"cquick\" data-v=\"' + e + '\">' + e + \"</button>\"; }).join(\"\");\n  return '<div class=\"card\"><h3>💬 Lobby chat</h3><div class=\"msgs\">' + (list || '<div class=\"sysm\">No messages yet. Say hi! 👋</div>') + '</div><div class=\"quick\">' + q + '</div><div class=\"row\"><input id=\"cin\" data-keep=\"1\" data-enter=\"csend\" maxlength=\"200\" placeholder=\"Message…\" autocomplete=\"off\" class=\"grow\"><button class=\"btn\" data-do=\"csend\">Send</button></div></div>';\n}\nfunction itemById(id) { var a = S.items.concat(S.hall).filter(function (i) { return i.id === id; }); return a[0] || null; }\nfunction likeMini(it) { return '<button class=\"like\" style=\"padding:2px 9px\" data-do=\"like\" data-id=\"' + it.id + '\">' + (it.liked ? \"❤️\" : \"🤍\") + \" \" + it.likes + \"</button>\"; }\nfunction likeBar(it) {\n  var o = openC[it.id];\n  return '<div class=\"row\"><button class=\"like ' + (it.liked ? \"on\" : \"\") + '\" data-do=\"like\" data-id=\"' + it.id + '\">' + (it.liked ? \"❤️\" : \"🤍\") + \" \" + it.likes + '</button><button class=\"like\" data-do=\"cmt\" data-id=\"' + it.id + '\">💬 ' + it.comments.length + \"</button></div>\" +\n    (o ? commentsHTML(it) : \"\");\n}\nfunction commentsHTML(it) {\n  return '<div style=\"margin-top:8px\">' + it.comments.map(function (c) { return '<div class=\"cm\">' + P(c.by).avatar + \" <span><b>\" + esc(P(c.by).name) + \":</b> \" + esc(c.text) + \"</span>\" + (c.by === pid || isHost() ? '<button data-do=\"cmdel\" data-id=\"' + it.id + '\" data-cid=\"' + c.id + '\">✖</button>' : \"\") + \"</div>\"; }).join(\"\") +\n    '<div class=\"row\" style=\"margin-top:6px\"><input id=\"cm' + it.id + '\" data-keep=\"1\" data-enter=\"cmsend\" data-id=\"' + it.id + '\" maxlength=\"140\" placeholder=\"Add a comment…\" autocomplete=\"off\" class=\"grow\"><button class=\"btn sm\" data-do=\"cmsend\" data-id=\"' + it.id + '\">Post</button></div></div>';\n}\nfunction itemCard(it) {\n  return '<div class=\"item\"><div class=\"ih\"><div class=\"av\" style=\"width:34px;height:34px;font-size:20px\">' + P(it.author).avatar + \"</div><div><b>\" + esc(P(it.author).name) + '</b><span class=\"lab\">' + esc(it.label) + '</span></div></div><div class=\"tx\">' + esc(it.text) + \"</div>\" + likeBar(it) + \"</div>\";\n}\nfunction momentsHTML() {\n  var h = \"\";\n  if (S.hall.length) h += '<div class=\"card\"><h3>🏆 Hall of Fame</h3><p class=\"small mut\" style=\"margin-top:-4px\">Most-liked moments of this lobby</p>' + S.hall.map(itemCard).join(\"\") + \"</div>\";\n  h += '<div class=\"card\"><h3>❤️ Moments from this game</h3><p class=\"small mut\" style=\"margin-top:-4px\">Like and comment on the funniest lies, clues and drawings!</p>' + (S.items.length ? S.items.slice().reverse().map(itemCard).join(\"\") : '<div class=\"c mut\" style=\"padding:20px\">Nothing yet — play a round and the best moments show up here ✨</div>') + \"</div>\";\n  return h;\n}\n\n/* ---------- actions ---------- */\nfunction val(id) { var el = document.getElementById(id); return el ? el.value : (drafts[id] || \"\"); }\nfunction clearDraft() { for (var i = 0; i < arguments.length; i++) { delete drafts[arguments[i]]; var el = document.getElementById(arguments[i]); if (el) el.value = \"\"; } }\nfunction run(name, d, el) {\n  switch (name) {\n    case \"solo\": case \"create\": {\n      var n = val(\"hname\").trim(); if (!n) return toast(\"Type your name first 😊\"); LS(\"pa.name\", n); myName = n;\n      api(\"/api/create\", { name: n, solo: name === \"solo\" }).then(function (j) { enter(j.code, j.pid); }).catch(function (e) { toast(e.message); }); return;\n    }\n    case \"join\": {\n      var n2 = val(\"hname\").trim(), c = val(\"hcode\").trim().toUpperCase(); if (!n2) return toast(\"Type your name first 😊\"); if (c.length < 4) return toast(\"Enter the 4-letter lobby code\");\n      LS(\"pa.name\", n2); api(\"/api/join\", { name: n2, code: c }).then(function (j) { enter(j.code, j.pid); }).catch(function (e) { toast(e.message); }); return;\n    }\n    case \"tab\": tab = d.v; if (tab === \"chat\" && S) seenChat = S.chat.length ? S.chat[S.chat.length - 1].id : 0; render(); window.scrollTo(0, 0); return;\n    case \"invite\": {\n      var url = location.origin + \"/?code=\" + S.code, txt = \"Join my Party Arcade lobby! Code: \" + S.code;\n      if (navigator.share) navigator.share({ title: \"Party Arcade\", text: txt, url: url }).catch(function () {});\n      else if (navigator.clipboard) navigator.clipboard.writeText(txt + \" \" + url).then(function () { toast(\"Invite link copied! 📋\"); }, function () { toast(txt); });\n      else toast(txt); return;\n    }\n    case \"leave\": if (confirm(S.phase === \"game\" ? \"Leave? The game will end for everyone.\" : \"Leave this lobby?\")) { act(\"leave\").then(leaveLocal, leaveLocal); } return;\n    case \"pickgame\": act(\"pick\", { game: d.v }); return;\n    case \"opt\": act(\"opt\", { k: d.k, v: d.v }); return;\n    case \"start\": {\n      var need = Math.max(0, MINS[S.settings.game] - S.players.length), p = Promise.resolve();\n      for (var i = 0; i < need; i++) p = p.then(function () { return act(\"addBot\"); });\n      p.then(function () { return act(\"start\"); }).catch(function () {}); return;\n    }\n    case \"addbot\": act(\"addBot\"); return;\n    case \"rmbot\": act(\"rmBot\", { id: d.id }); return;\n    case \"kick\": if (confirm(\"Remove this player?\")) act(\"kick\", { id: d.id }); return;\n    case \"rename\": { var nn = prompt(\"New name:\", P(pid).name); if (nn && nn.trim()) { LS(\"pa.name\", nn.trim()); act(\"rename\", { name: nn.trim() }); } return; }\n    case \"avtoggle\": avOpen = !avOpen; render(); return;\n    case \"avatar\": avOpen = false; act(\"avatar\", { emoji: d.v }); return;\n    case \"again\": act(\"again\"); return;\n    case \"backlobby\": act(\"backLobby\"); return;\n    case \"gnext\": act(\"g_next\"); return;\n    /* bluff */\n    case \"lie\": { var t = val(\"lie\").trim(); if (!t) return toast(\"Write a lie first!\"); act(\"g_lie\", { text: t }).then(function () { toast(\"Locked in! 🔒\"); }, function () {}); return; }\n    case \"bpick\": act(\"g_pick\", { opt: d.id }); return;\n    /* wave */\n    case \"wclue\": { var c2 = val(\"clue\").trim(); if (!c2) return toast(\"Type a clue first\"); act(\"g_clue\", { text: c2 }).then(function () { clearDraft(\"clue\"); }, function () {}); return; }\n    case \"wlock\": act(\"g_lock\", { v: wv }); return;\n    /* scat */\n    case \"scatdone\": saveScat(true).then(function () { toast(\"Locked in! 🔒\"); }); return;\n    case \"reject\": act(\"g_reject\", { key: d.key }); return;\n    case \"judged\": act(\"g_judged\"); return;\n    /* draw */\n    case \"guess\": { var gs = val(\"gs\").trim(); if (!gs) return; clearDraft(\"gs\"); act(\"g_guess\", { text: gs }).catch(function () {}); var el2 = document.getElementById(\"gs\"); if (el2) el2.focus(); return; }\n    case \"pen\": penC = d.v; render(); return;\n    case \"penw\": penW = +d.v; toast(\"Brush size set\"); return;\n    case \"undo\": strokes.pop(); redraw(); act(\"g_stroke\", { undo: true }); return;\n    case \"clr\": strokes = []; redraw(); act(\"g_stroke\", { clear: true }); return;\n    case \"emo\": emoPush(d.v); return;\n    case \"emoundo\": { var l = S.game.emo.slice(); l.pop(); act(\"g_emo\", { list: l }); return; }\n    case \"emoclr\": act(\"g_emo\", { list: [] }); return;\n    /* code */\n    case \"cclue\": { var w = val(\"cw\").trim(), n3 = val(\"cn\").trim() || \"1\"; if (!w) return toast(\"Type a clue word\"); act(\"g_clue\", { word: w, n: n3 }).then(function () { clearDraft(\"cw\", \"cn\"); }, function () {}); return; }\n    case \"reveal\": act(\"g_reveal\", { i: d.i }); return;\n    case \"cend\": act(\"g_end\"); return;\n    /* chain */\n    case \"cword\": { var cw = val(\"cwd\").trim(); if (!cw) return; act(\"g_word\", { text: cw }).then(function () { clearDraft(\"cwd\"); }, function () {}); return; }\n    /* chat */\n    case \"csend\": { var m = val(\"cin\").trim(); if (!m) return; clearDraft(\"cin\"); act(\"chat\", { text: m }); return; }\n    case \"cquick\": act(\"chat\", { text: d.v }); return;\n    case \"cedit\": { var old = S.chat.filter(function (x) { return x.id == d.id; })[0]; var nt = prompt(\"Edit message:\", old ? old.text : \"\"); if (nt && nt.trim()) act(\"chatEdit\", { id: d.id, text: nt.trim() }); return; }\n    case \"cdel\": act(\"chatDel\", { id: d.id }); return;\n    /* items */\n    case \"like\": act(\"like\", { id: d.id }); return;\n    case \"cmt\": openC[d.id] = !openC[d.id]; render(); return;\n    case \"cmsend\": { var key = \"cm\" + d.id, ct = val(key).trim(); if (!ct) return; clearDraft(key); act(\"comment\", { id: d.id, text: ct }); return; }\n    case \"cmdel\": act(\"commentDel\", { id: d.id, cid: d.cid }); return;\n  }\n}\nvar ENTER_MAP = { join: \"join\", lie: \"lie\", wclue: \"wclue\", scatdone: \"scatdone\", guess: \"guess\", cclue: \"cclue\", cword: \"cword\", csend: \"csend\", cmsend: \"cmsend\" };\ndocument.addEventListener(\"click\", function (e) {\n  var b = e.target.closest ? e.target.closest(\"[data-do]\") : null; if (!b) return; run(b.dataset.do, b.dataset, b);\n});\ndocument.addEventListener(\"keydown\", function (e) {\n  if (e.key !== \"Enter\" || e.shiftKey) return; var t = e.target; if (!t.dataset || !t.dataset.enter) return;\n  e.preventDefault(); run(ENTER_MAP[t.dataset.enter] || t.dataset.enter, t.dataset, t);\n});\n\n/* ---------- boot ---------- */\n(function () {\n  var c = LS(\"pa.code\"), p = LS(\"pa.pid\");\n  if (c && p) {\n    fetch(\"/api/state?code=\" + encodeURIComponent(c) + \"&pid=\" + encodeURIComponent(p)).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) { S = j; recvAt = Date.now(); enter(c, p); onState(); }).catch(function () { LS(\"pa.code\", null); LS(\"pa.pid\", null); render(); });\n  } else render();\n})();\n</script>\n</body>\n</html>\n";
const MANIFEST = JSON.stringify({ name: "Party Arcade", short_name: "Arcade", start_url: "/", display: "standalone", background_color: "#120a2a", theme_color: "#120a2a", icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }] });
const ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#ec4899"/></linearGradient></defs><rect width="512" height="512" fill="url(#g)"/><text x="256" y="340" font-size="280" text-anchor="middle">🎮</text></svg>';

function json(res, status, obj) { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(obj)); }
function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = ""; req.on("data", c => { data += c; if (data.length > 60000) { reject(new Fail("Request too large.", 413)); req.destroy(); } });
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(new Fail("Bad request.")); } });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  try {
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" }); return res.end(HTML); }
    if (req.method === "GET" && url.pathname === "/manifest.json") { res.writeHead(200, { "Content-Type": "application/manifest+json" }); return res.end(MANIFEST); }
    if (req.method === "GET" && url.pathname === "/icon.svg") { res.writeHead(200, { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" }); return res.end(ICON); }
    if (req.method === "GET" && url.pathname === "/healthz") return json(res, 200, { ok: true, lobbies: lobbies.size });

    if (req.method === "GET" && url.pathname === "/events") {
      const l = getLobby(url.searchParams.get("code")); const pid = url.searchParams.get("pid") || "";
      if (!l.players.has(pid)) throw new Fail("You are not in this lobby.", 404);
      res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "Connection": "keep-alive", "X-Accel-Buffering": "no" });
      res.write("retry: 2000\n\n");
      if (!l.clients.has(pid)) l.clients.set(pid, new Set());
      l.clients.get(pid).add(res);
      send(res, null, view(l, pid));
      if (l.phase === "game" && l.game && l.game.type === "draw") send(res, "strokes", { turn: l.game.turnId, strokes: l.game.strokes });
      const beat = setInterval(() => { try { res.write(": ping\n\n"); } catch (e) {} }, 15000);
      req.on("close", () => { clearInterval(beat); const set = l.clients.get(pid); if (set) { set.delete(res); if (!set.size) l.clients.delete(pid); } });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/state") {
      const l = getLobby(url.searchParams.get("code")); const pid = url.searchParams.get("pid") || "";
      if (!l.players.has(pid)) throw new Fail("You are not in this lobby.", 404);
      return json(res, 200, view(l, pid));
    }
    if (req.method === "POST" && url.pathname === "/api/create") {
      const b = await readJson(req); const name = clean(b.name, 16);
      if (!name) throw new Fail("Enter your name first.");
      if (lobbies.size >= 500) throw new Fail("The server is busy. Try again in a few minutes.", 503);
      const code = genCode(); if (!code) throw new Fail("Couldn't find a free code. Try again.", 503);
      const pid = rid(12); newLobby(code, pid, name, !!b.solo);
      return json(res, 200, { code, pid });
    }
    if (req.method === "POST" && url.pathname === "/api/join") {
      const b = await readJson(req); const name = clean(b.name, 16);
      if (!name) throw new Fail("Enter your name first.");
      const l = getLobby(b.code);
      if (b.pid && l.players.has(b.pid) && !l.players.get(b.pid).bot) { l.players.get(b.pid).name = name; broadcast(l); return json(res, 200, { code: l.code, pid: b.pid }); }
      if (l.phase !== "lobby") throw new Fail("That game already started. Wait for it to finish, then join!", 409);
      if (l.players.size >= MAX_PLAYERS) throw new Fail("That lobby is full (" + MAX_PLAYERS + " players).", 409);
      const pid = rid(12); addPlayer(l, pid, name);
      sys(l, "👋 " + name + " joined the lobby"); broadcast(l);
      return json(res, 200, { code: l.code, pid });
    }
    if (req.method === "POST" && url.pathname === "/api/act") {
      const b = await readJson(req); const l = getLobby(b.code);
      if (!l.players.has(String(b.pid))) throw new Fail("You are not in this lobby.", 404);
      const r = act(l, String(b.pid), b);
      if (r !== false) broadcast(l);
      return json(res, 200, { ok: true });
    }
    json(res, 404, { error: "Not found." });
  } catch (e) {
    const status = e instanceof Fail ? e.status : 500;
    if (!(e instanceof Fail)) console.error(e);
    if (res.headersSent) { try { res.end(); } catch (x) {} return; }
    json(res, status, { error: e instanceof Fail ? e.message : "Something went wrong." });
  }
});

setInterval(() => {
  const cutoff = Date.now() - 8 * 3600 * 1000;
  for (const [code, l] of lobbies) if (l.touched < cutoff && !l.clients.size) { newPhase(l); lobbies.delete(code); }
}, 600000).unref();

server.listen(PORT, () => console.log("Party Arcade is running on port " + PORT));

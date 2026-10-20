import type { ShelfTitle } from './game-board'

// DEVELOPMENT ONLY. A stand-in games list so the /games library, cover wall
// and detail sheet can be built and checked before staff have filled in the
// real list. Used only when NODE_ENV !== 'production', PARK_GAMES_DEMO=1 and
// the real list is empty (app/(park)/games/page.tsx). The "covers" are park
// photos, clearly not box art.

const P = (f: string) => `/images/park/${f}`
const COVERS = [
  'gallery-pool-ladder.jpg',
  'gallery-greens.jpg',
  'gallery-futsal.jpg',
  'gallery-evening-walk.jpg',
  'gallery-path.jpg',
  'gallery-plaza.jpg',
  'gallery-lane-bluehour.jpg',
  'gallery-market.jpg',
].map(P)

type Seed = Omit<ShelfTitle, 'id' | 'coverUrl'> & { cover?: boolean }

const SEEDS: Seed[] = [
  { title: 'EA Sports FC 26', platforms: ['PS4', 'PS5'], genre: 'sports', maxPlayers: 4, isNew: true, isPopular: true, localCoop: true, online: true, featured: true, descriptionEn: 'Pick your club and settle it on one screen. Four controllers, one sofa.', descriptionMy: 'သင့်အသင်းကို ရွေးပြီး မျက်နှာပြင်တစ်ခုတည်းမှာ ယှဉ်ကစားပါ။ ကွန်ထရိုလာ လေးခု၊ ဆိုဖာတစ်လုံး။' },
  { title: 'Black Myth: Wukong', platforms: ['PS5'], genre: 'action', maxPlayers: 1, isNew: true, isPopular: true, localCoop: false, online: false, featured: true, descriptionEn: 'Take the staff as the Destined One through a mythic China. Hard, beautiful, best on the big screen.', descriptionMy: 'ဒဏ္ဍာရီဆန်သော တရုတ်ပြည်ကို တုတ်ကိုင်ကာ ဖြတ်သန်းပါ။ ခက်သော်လည်း လှပပြီး မျက်နှာပြင်ကြီးနှင့် အကောင်းဆုံး။' },
  { title: 'It Takes Two', platforms: ['PS4', 'PS5'], genre: 'adventure', maxPlayers: 2, isNew: false, isPopular: true, localCoop: true, online: false, featured: true, descriptionEn: 'A two-player adventure you can only finish together. Bring a friend.', descriptionMy: 'နှစ်ယောက်အတူ ကစားမှသာ ပြီးဆုံးနိုင်သော စွန့်စားခန်း။ သူငယ်ချင်းတစ်ယောက် ခေါ်လာပါ။' },
  { title: 'Tekken 8', platforms: ['PS5'], genre: 'fighting', maxPlayers: 2, isNew: true, isPopular: false, localCoop: true, online: true, featured: false, descriptionEn: 'Head-to-head fighting. Loser buys the next drink.', descriptionMy: 'တစ်ယောက်ချင်း ယှဉ်တိုက်ပွဲ။ ရှုံးသူက နောက်ထပ်အချိုရည် ဝယ်ရမည်။' },
  { title: 'Gran Turismo 7', platforms: ['PS4', 'PS5'], genre: 'racing', maxPlayers: 2, isNew: false, isPopular: false, localCoop: true, online: true, featured: false, descriptionEn: 'Real cars, real tracks, split screen for two.', descriptionMy: 'ကားအစစ်၊ ပြိုင်ကွင်းအစစ်၊ နှစ်ယောက် မျက်နှာပြင်ခွဲ ကစားနိုင်။' },
  { title: 'eFootball', platforms: ['PS4', 'PS5'], genre: 'sports', maxPlayers: 4, isNew: false, isPopular: true, localCoop: true, online: true, featured: false, descriptionEn: null, descriptionMy: null },
  { title: 'Grand Theft Auto V', platforms: ['PS4', 'PS5'], genre: 'action', maxPlayers: 1, isNew: false, isPopular: true, localCoop: false, online: true, featured: false, descriptionEn: 'Los Santos, three stories, endless trouble.', descriptionMy: 'လော့စ်ဆန်းတို့စ်၊ ဇာတ်လမ်းသုံးပုဒ်၊ ပြဿနာမဆုံး။' },
  { title: 'God of War Ragnarök', platforms: ['PS4', 'PS5'], genre: 'adventure', maxPlayers: 1, isNew: false, isPopular: false, localCoop: false, online: false, featured: false, descriptionEn: 'Kratos and Atreus face the end of the Norse world.', descriptionMy: 'ခရေတိုးစ်နှင့် အာထရီးယပ်စ်တို့ နော့စ်ကမ္ဘာ၏ အဆုံးကို ရင်ဆိုင်ကြသည်။' },
  { title: 'Mortal Kombat 1', platforms: ['PS5'], genre: 'fighting', maxPlayers: 2, isNew: false, isPopular: false, localCoop: true, online: true, featured: false, descriptionEn: null, descriptionMy: null },
  { title: "Marvel's Spider-Man 2", platforms: ['PS5'], genre: 'action', maxPlayers: 1, isNew: false, isPopular: true, localCoop: false, online: false, featured: false, descriptionEn: 'Swing across New York as both Spider-Men.', descriptionMy: 'စပိုက်ဒါမင်း နှစ်ယောက်လုံးအဖြစ် နယူးယောက်မြို့ကို လွှဲကူးပါ။' },
  { title: 'Crash Team Racing Nitro-Fueled', platforms: ['PS4'], genre: 'racing', maxPlayers: 4, isNew: false, isPopular: false, localCoop: true, online: true, featured: false, descriptionEn: 'Kart racing for the whole family, four at once.', descriptionMy: 'မိသားစုလိုက် လေးယောက်တစ်ပြိုင်နက် ကစားနိုင်သော ကတ်ကားပြိုင်ပွဲ။' },
  { title: 'Call of Duty: Modern Warfare III', platforms: ['PS4', 'PS5'], genre: 'shooter', maxPlayers: 2, isNew: false, isPopular: true, localCoop: true, online: true, featured: false, descriptionEn: null, descriptionMy: null },
  { title: 'Ghost of Tsushima', platforms: ['PS4', 'PS5'], genre: 'adventure', maxPlayers: 1, isNew: false, isPopular: false, localCoop: false, online: true, featured: false, descriptionEn: 'A lone samurai, wind in the grass, a whole island to free.', descriptionMy: 'တစ်ကိုယ်တော် ဆာမူရိုင်း၊ မြက်ခင်းထဲက လေ၊ လွတ်မြောက်စေရမည့် ကျွန်းတစ်ကျွန်း။' },
  { title: 'A Way Out', platforms: ['PS4', 'PS5'], genre: 'adventure', maxPlayers: 2, isNew: false, isPopular: false, localCoop: true, online: false, featured: false, descriptionEn: 'Two prisoners, one plan, split screen the whole way.', descriptionMy: 'အကျဉ်းသား နှစ်ယောက်၊ အစီအစဉ်တစ်ခု၊ အစအဆုံး မျက်နှာပြင်ခွဲ ကစားရသည်။' },
  { title: 'NBA 2K26', platforms: ['PS5'], genre: 'sports', maxPlayers: 4, isNew: true, isPopular: false, localCoop: true, online: true, featured: false, descriptionEn: null, descriptionMy: null },
  { title: 'Overcooked! All You Can Eat', platforms: ['PS4', 'PS5'], genre: 'party', maxPlayers: 4, isNew: false, isPopular: false, localCoop: true, online: true, featured: false, descriptionEn: 'Run a chaotic kitchen with up to four friends. Shouting encouraged.', descriptionMy: 'သူငယ်ချင်း လေးယောက်အထိနှင့် ရှုပ်ယှက်ခတ်နေသော မီးဖိုချောင်ကို လည်ပတ်ပါ။' },
]

export const DEMO_SHELF: ShelfTitle[] = SEEDS.map((s, i) => ({
  ...s,
  id: `demo-${i}`,
  // Leave a couple without covers so the no-cover look is exercised too.
  coverUrl: i === 5 || i === 11 ? null : COVERS[i % COVERS.length],
}))

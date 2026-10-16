// Park showcase strings (app/(park)). Burmese drafted by hand; have a native
// speaker review before launch (docs/park/client-content-checklist.md).
export const parkEN = {
  'park.brand': 'MyaThida Park',
  'park.nav.label': 'Main',
  'park.nav.home': 'Park home',
  'park.nav.poolFood': 'Pool and food',
  'park.nav.futsal': 'Futsal',
  'park.nav.games': 'Game shop',
  'park.nav.billiards': 'Billiards',
  'park.nav.visit': 'Visit',
  'park.nav.bookFutsal': 'Book futsal',
  'park.lang.label': 'Language',

  'park.footer.tagline': 'A family park with a pool, food, futsal, games and billiards.',
  'park.footer.places': 'Places',
  'park.footer.contact': 'Contact',
  'park.footer.viber': 'Message us on Viber',
  'park.footer.call': 'Call {phone}',
  'park.footer.facebook': 'Facebook page',
  'park.footer.rights': '© {year} MyaThida Park',

  'park.shell.building': 'This page is being built.',
  'park.home.title': 'Stay the whole day.',
  'park.games.title': 'Nine screens and a room of your own',
  'park.billiards.title': 'Three tables under warm lamps',
} as const

export const parkMY: { [K in keyof typeof parkEN]: string } = {
  'park.brand': 'မြသီတာ ပန်းခြံ',
  'park.nav.label': 'ပင်မ',
  'park.nav.home': 'ပန်းခြံ ပင်မစာမျက်နှာ',
  'park.nav.poolFood': 'ရေကူးကန်နှင့် စားသောက်ဆိုင်',
  'park.nav.futsal': 'ဖူဆယ်',
  'park.nav.games': 'ဂိမ်းဆိုင်',
  'park.nav.billiards': 'ဘီလိယက်',
  'park.nav.visit': 'လာရောက်ရန်',
  'park.nav.bookFutsal': 'ဖူဆယ်ကွင်း ဘိုကင်လုပ်ရန်',
  'park.lang.label': 'ဘာသာစကား',

  'park.footer.tagline': 'ရေကူးကန်၊ စားသောက်ဆိုင်၊ ဖူဆယ်၊ ဂိမ်းနှင့် ဘီလိယက် ပါဝင်သော မိသားစု ပန်းခြံ။',
  'park.footer.places': 'နေရာများ',
  'park.footer.contact': 'ဆက်သွယ်ရန်',
  'park.footer.viber': 'Viber မှ မက်ဆေ့ချ် ပို့ရန်',
  'park.footer.call': '{phone} သို့ ဖုန်းခေါ်ရန်',
  'park.footer.facebook': 'Facebook စာမျက်နှာ',
  'park.footer.rights': '© {year} မြသီတာ ပန်းခြံ',

  'park.shell.building': 'ဤစာမျက်နှာကို ပြင်ဆင်နေဆဲ ဖြစ်ပါသည်။',
  'park.home.title': 'တစ်နေ့လုံး ပျော်ရွှင်ဖို့ လာခဲ့ပါ။',
  'park.games.title': 'မျက်နှာပြင် ကိုးခုနှင့် သီးသန့်အခန်း',
  'park.billiards.title': 'မီးရောင်နွေးနွေးအောက်က စားပွဲ သုံးလုံး',
}

// The six signs posted around the pool, word for word from the client's
// photos (client_photos/park/pool_rules). They stay bilingual whatever the
// site language, like the physical signs, so they live here rather than in
// the EN/MY string tables.
//
// `kind` follows the ISO 7010 convention the real signs use: `ban` is a
// red prohibition sign, `must` a blue mandatory one.

export type PoolRuleIcon = 'pet' | 'shower' | 'unwell' | 'swimwear' | 'glass' | 'outsideFood'

export type PoolRule = {
  key: PoolRuleIcon
  kind: 'ban' | 'must'
  title: string
  en: string
  my: string
}

export const POOL_RULES: PoolRule[] = [
  {
    key: 'pet',
    kind: 'ban',
    title: 'No Pets',
    en: 'No pets allowed in the pool area.',
    my: 'ရေကူးကန်ဧရိယာအတွင်း အိမ်မွေးတိရိစ္ဆာန်များ ပေးမဝင်ပါ။',
  },
  {
    key: 'shower',
    kind: 'must',
    title: 'Shower First',
    en: 'Take a shower before entering the pool.',
    my: 'ရေမကူးမှီ ရေချိုးပါ။',
  },
  {
    key: 'unwell',
    kind: 'ban',
    title: 'Stay Out If Unwell',
    en: 'Persons with diarrhea or contagious skin diseases are not permitted.',
    my: 'ဝမ်းပျက်ဝမ်းလျှောခြင်းနှင့် ကူးစက်တတ်သော အရေပြားရောဂါရှိသူများ ရေကူးခြင်းမှ ရှောင်ကြဉ်ပါ။',
  },
  {
    key: 'swimwear',
    kind: 'must',
    title: 'Swimwear Only',
    en: 'Proper swimwear is required.',
    my: 'ရေကူးဝတ်စုံ အပြည့်အစုံဖြင့်သာ ရေကူးခွင့်ရှိသည်။',
  },
  {
    key: 'glass',
    kind: 'ban',
    title: 'No Food or Glass',
    en: 'No food, drinks or glassware in the pool area.',
    my: 'ရေကန်အတွင်း/အနီးသို့ အစားအစာများနှင့် ဖန်ပုလင်း၊ ဖန်ခွက်များ ယူဆောင်ခွင့်မပြု။',
  },
  {
    key: 'outsideFood',
    kind: 'ban',
    title: 'No Outside Food',
    en: 'Outside food is not allowed.',
    my: 'ပြင်ပမှ အစားအသောက်များကို ယူဆောင်ခွင့်မပြုပါ။',
  },
]

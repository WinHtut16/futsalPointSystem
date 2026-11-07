/**
 * Points & rewards for the game shop and billiards, managed from the hub
 * (/admin/loyalty/<app>). Futsal's own loyalty screens keep their admin.* keys.
 */
export const loyaltyEN = {
  'loyalty.title': 'Points & rewards',
  'loyalty.subtitle': 'Rewards, requests and customer balances for this business. Points never mix with the other businesses.',
  'loyalty.tabRequests': 'Requests',
  'loyalty.tabRewards': 'Rewards',
  'loyalty.tabCustomers': 'Customers',
  'loyalty.allBusinesses': 'All businesses',
  'loyalty.portalLink': 'Points & rewards',
  'loyalty.rewardsEmpty': 'No rewards for this business yet.',
  'loyalty.customerSearch': 'Customer phone, e.g. 09…',
  'loyalty.customerSearchButton': 'Find',
  'loyalty.customerHint': 'Find a registered customer by their exact phone number.',
  'loyalty.customerNotFound': 'No registered customer has that phone number.',
  'loyalty.customerInvalidPhone': 'Enter a valid Myanmar phone number (e.g. 09XXXXXXXXX).',
  'loyalty.balance': 'Balance here',
  'loyalty.history': 'Points history here',
  'loyalty.historyEmpty': 'No points at this business yet.',
  'loyalty.earnedSession': 'Session',
  'loyalty.redeemed': 'Redeemed',
  'loyalty.adjusted': 'Adjusted',
} as const

export const loyaltyMY: { [K in keyof typeof loyaltyEN]: string } = {
  'loyalty.title': 'ပွိုင့်နှင့် ဆုလက်ဆောင်များ',
  'loyalty.subtitle': 'ဤလုပ်ငန်းအတွက် ဆုလက်ဆောင်များ၊ တောင်းဆိုမှုများနှင့် ဖောက်သည် ပွိုင့်လက်ကျန်များ။ အခြားလုပ်ငန်းများ၏ ပွိုင့်နှင့် မရောပါ။',
  'loyalty.tabRequests': 'တောင်းဆိုမှုများ',
  'loyalty.tabRewards': 'ဆုလက်ဆောင်များ',
  'loyalty.tabCustomers': 'ဖောက်သည်များ',
  'loyalty.allBusinesses': 'လုပ်ငန်းအားလုံး',
  'loyalty.portalLink': 'ပွိုင့်နှင့် ဆုလက်ဆောင်များ',
  'loyalty.rewardsEmpty': 'ဤလုပ်ငန်းအတွက် ဆုလက်ဆောင် မရှိသေးပါ။',
  'loyalty.customerSearch': 'ဖောက်သည် ဖုန်းနံပါတ်၊ ဥပမာ 09…',
  'loyalty.customerSearchButton': 'ရှာမည်',
  'loyalty.customerHint': 'အကောင့်ဖွင့်ထားသော ဖောက်သည်ကို ဖုန်းနံပါတ် အတိအကျဖြင့် ရှာပါ။',
  'loyalty.customerNotFound': 'ဤဖုန်းနံပါတ်ဖြင့် အကောင့်ဖွင့်ထားသော ဖောက်သည် မရှိပါ။',
  'loyalty.customerInvalidPhone': 'မှန်ကန်သော မြန်မာဖုန်းနံပါတ် ထည့်ပါ (ဥပမာ 09XXXXXXXXX)။',
  'loyalty.balance': 'ဤလုပ်ငန်းရှိ ပွိုင့်လက်ကျန်',
  'loyalty.history': 'ဤလုပ်ငန်းရှိ ပွိုင့်မှတ်တမ်း',
  'loyalty.historyEmpty': 'ဤလုပ်ငန်းတွင် ပွိုင့် မရှိသေးပါ။',
  'loyalty.earnedSession': 'Session',
  'loyalty.redeemed': 'လဲလှယ်ပြီး',
  'loyalty.adjusted': 'ပြင်ဆင်ပြီး',
}

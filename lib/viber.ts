const VIBER_DEEP_CHAT = 'viber://chat?number=%2B959797272000'
const VIBER_DEEP_IOS = 'viber://contact?number=%2B959797272000'
const STORE_IOS = 'https://apps.apple.com/app/viber-messenger/id382617920'
const STORE_ANDROID = 'https://play.google.com/store/apps/details?id=com.viber.voip'

export function openViber() {
  const ua = navigator.userAgent
  const isIOS = /iPhone|iPad|iPod/i.test(ua)
  const isAndroid = /Android/i.test(ua)

  // iOS requires viber://contact, Android/Desktop use viber://chat
  window.location.href = isIOS ? VIBER_DEEP_IOS : VIBER_DEEP_CHAT

  if (isIOS || isAndroid) {
    const storeUrl = isIOS ? STORE_IOS : STORE_ANDROID
    const timer = setTimeout(() => {
      if (!document.hidden) window.location.href = storeUrl
    }, 2500)
    // App opened → page hidden → cancel store redirect
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearTimeout(timer)
    }, { once: true })
  }
}

import type { Catalog } from "../types"

export const scopes: Catalog["scopes"] = {
  openid: "Gezcez'de kim olduğunuzu bilmek",
  profile: "Adınızı görmek",
  email: "E-posta adresinizi görmek",
  offline_access: "Oturumunuzu açık tutmak",
  dash: "Gezcez paneline sizin adınıza erişmek",
  transit: "Kaydettiğiniz durakları, hatları ve ayarları eşitlemek",
  cards: "Ulaşım kartlarınızı görmek",
  unknown: "Erişim: {scope}",
}

/** Dictionary namespace owned by this plugin. */
export const NS = "width-tiers";

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
	"tier.standard": "标准",
	"tier.medium": "中等",
	"tier.wide": "宽",
	"tier.ultra": "超宽",
	"tier.full": "全宽",
	"tier.custom": "自定义",
	"value.custom.unset": "未设置",
	"guide.hint": "拖拽右侧边缘调整对话宽度",
	"button.aria": "对话区宽度档位：{label}（{value}），点击选择档位",
	"button.title.summary": "对话区宽度档位：{label}（{value}）",
	"button.title.hint": "点击选择：{list}",
} as const;

/** One translatable key owned by this namespace. */
export type CopyKey = keyof typeof zh;

/** English dictionary, checked complete against the zh key set. */
export const en: Record<CopyKey, string> = {
	"tier.standard": "Standard",
	"tier.medium": "Medium",
	"tier.wide": "Wide",
	"tier.ultra": "Ultra",
	"tier.full": "Full",
	"tier.custom": "Custom",
	"value.custom.unset": "Not set",
	"guide.hint": "Drag the right edge to resize",
	"button.aria": "Chat width tier: {label} ({value}). Click to choose a tier.",
	"button.title.summary": "Chat width tier: {label} ({value})",
	"button.title.hint": "Click to choose: {list}",
};

/** Japanese dictionary, checked complete against the zh key set. */
export const ja: Record<CopyKey, string> = {
	"tier.standard": "標準",
	"tier.medium": "中",
	"tier.wide": "ワイド",
	"tier.ultra": "ウルトラワイド",
	"tier.full": "全幅",
	"tier.custom": "カスタム",
	"value.custom.unset": "未設定",
	"guide.hint": "右端をドラッグして会話幅を調整",
	"button.aria": "会話エリアの幅設定：{label}（{value}）。クリックして選択",
	"button.title.summary": "会話エリアの幅設定：{label}（{value}）",
	"button.title.hint": "クリックして選択：{list}",
};

/** Spanish dictionary, checked complete against the zh key set. */
export const es: Record<CopyKey, string> = {
	"tier.standard": "Estándar",
	"tier.medium": "Medio",
	"tier.wide": "Ancho",
	"tier.ultra": "Muy ancho",
	"tier.full": "Completo",
	"tier.custom": "Personalizado",
	"value.custom.unset": "Sin definir",
	"guide.hint": "Arrastra el borde derecho para ajustar el ancho",
	"button.aria": "Ancho del área de chat: {label} ({value}). Haz clic para elegir un nivel.",
	"button.title.summary": "Ancho del área de chat: {label} ({value})",
	"button.title.hint": "Haz clic para elegir: {list}",
};

/** French dictionary, checked complete against the zh key set. */
export const fr: Record<CopyKey, string> = {
	"tier.standard": "Standard",
	"tier.medium": "Moyen",
	"tier.wide": "Large",
	"tier.ultra": "Très large",
	"tier.full": "Pleine largeur",
	"tier.custom": "Personnalisé",
	"value.custom.unset": "Non défini",
	"guide.hint": "Faites glisser le bord droit pour ajuster la largeur",
	"button.aria": "Largeur de la zone de chat : {label} ({value}). Cliquez pour choisir un palier.",
	"button.title.summary": "Largeur de la zone de chat : {label} ({value})",
	"button.title.hint": "Cliquez pour choisir : {list}",
};

/** German dictionary, checked complete against the zh key set. */
export const de: Record<CopyKey, string> = {
	"tier.standard": "Standard",
	"tier.medium": "Mittel",
	"tier.wide": "Breit",
	"tier.ultra": "Sehr breit",
	"tier.full": "Volle Breite",
	"tier.custom": "Benutzerdefiniert",
	"value.custom.unset": "Nicht festgelegt",
	"guide.hint": "Rechten Rand ziehen, um die Breite anzupassen",
	"button.aria": "Chatbreite: {label} ({value}). Klicken, um eine Stufe zu wählen.",
	"button.title.summary": "Chatbreite: {label} ({value})",
	"button.title.hint": "Klicken zum Auswählen: {list}",
};

/** Russian dictionary, checked complete against the zh key set. */
export const ru: Record<CopyKey, string> = {
	"tier.standard": "Стандартная",
	"tier.medium": "Средняя",
	"tier.wide": "Широкая",
	"tier.ultra": "Очень широкая",
	"tier.full": "На всю ширину",
	"tier.custom": "Своя",
	"value.custom.unset": "Не задано",
	"guide.hint": "Перетащите правый край, чтобы изменить ширину",
	"button.aria": "Ширина области чата: {label} ({value}). Нажмите, чтобы выбрать уровень.",
	"button.title.summary": "Ширина области чата: {label} ({value})",
	"button.title.hint": "Нажмите, чтобы выбрать: {list}",
};

/** Brazilian Portuguese dictionary, checked complete against the zh key set. */
export const pt: Record<CopyKey, string> = {
	"tier.standard": "Padrão",
	"tier.medium": "Médio",
	"tier.wide": "Largo",
	"tier.ultra": "Muito largo",
	"tier.full": "Largura total",
	"tier.custom": "Personalizado",
	"value.custom.unset": "Não definido",
	"guide.hint": "Arraste a borda direita para ajustar a largura",
	"button.aria": "Largura da área de chat: {label} ({value}). Clique para escolher um nível.",
	"button.title.summary": "Largura da área de chat: {label} ({value})",
	"button.title.hint": "Clique para escolher: {list}",
};

/**
 * Every shipped dictionary, keyed by the locale id the DSH locale service
 * accepts. The set matches the languages DSH 0.2.2 ships (zh, en, ja, es,
 * fr, de, ru, pt); other languages fall back through English.
 */
export const dictionaries: Record<string, Record<CopyKey, string>> = {
	zh,
	en,
	ja,
	es,
	fr,
	de,
	ru,
	pt,
};

/** Translate one key of this namespace, with optional `{name}` placeholders. */
export type TFunction = (key: CopyKey, values?: Record<string, string>) => string;

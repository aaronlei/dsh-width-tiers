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

/** Translate one key of this namespace, with optional `{name}` placeholders. */
export type TFunction = (key: CopyKey, values?: Record<string, string>) => string;

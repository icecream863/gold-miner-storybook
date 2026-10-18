export type UpgradeId = "strength" | "rockBook" | "lucky" | "diamondPolish";
export type LevelUpgrades = Record<UpgradeId, boolean>;
type Product = {
    name: string;
    minPrice: number;
    maxPrice: number;
    icon: string;
    description: string;
} & ({
    kind: "consumable";
    quantity: number;
} | {
    kind: "level";
    upgrade: UpgradeId;
});
// 报价只在开店时生成一次；购买事务发放标记，效果由关卡入口和回收速度执行。
export const SHOP = {
    bomb: { name: "一枚炸药", minPrice: 60, maxPrice: 140, icon: "🧨", kind: "consumable", quantity: 1,
        description: "增加一枚炸药。↑ 销毁所抓物品，空钩快速返回，不获得金钱；余量跨关保留。" },
    strength: { name: "力量药水", minPrice: 120, maxPrice: 240, icon: "🧪", kind: "level", upgrade: "strength",
        description: "下一关载物回收速度 ×1.5；空钩速度不变。" },
    rockBook: { name: "石头收藏书", minPrice: 15, maxPrice: 45, icon: "📕", kind: "level", upgrade: "rockBook",
        description: "下一关石头价值 ×3（$15 → $45），重量不变；骨头不算石头。" },
    lucky: { name: "幸运草", minPrice: 50, maxPrice: 150, icon: "🍀", kind: "level", upgrade: "lucky",
        description: "下一关问号袋更容易开出高额金币，但不保证每袋都有好运。" },
    diamondPolish: { name: "钻石抛光剂", minPrice: 150, maxPrice: 350, icon: "💎", kind: "level", upgrade: "diamondPolish",
        description: "下一关钻石及携钻动物价值 ×1.5（$650 → $975），重量不变。" },
} as const satisfies Record<string, Product>;
export type ProductId = keyof typeof SHOP;
export interface ShopOffer {
    readonly id: ProductId;
    readonly price: number;
}
export const PRODUCT_IDS = Object.keys(SHOP) as ProductId[];
export const emptyPurchases = (): Record<ProductId, boolean> => Object.fromEntries(PRODUCT_IDS.map(id => [id, false])) as Record<ProductId, boolean>;
export const emptyUpgrades = (): LevelUpgrades => ({ strength: false, rockBook: false, lucky: false, diamondPolish: false });
export function makeOffers(random: () => number): Readonly<Record<ProductId, ShopOffer>> {
    return Object.freeze(Object.fromEntries(PRODUCT_IDS.map(id => {
        const { minPrice, maxPrice } = SHOP[id];
        return [id, Object.freeze({ id, price: minPrice + Math.floor(random() * ((maxPrice - minPrice) / 5 + 1)) * 5 })];
    })) as Record<ProductId, ShopOffer>);
}
export const BAG_VALUES = [50, 100, 250, 500, 800] as const;
export const BAG_WEIGHTS = { normal: [35, 30, 20, 10, 5], lucky: [10, 15, 30, 25, 20] } as const;
export function bagValue(random: () => number, lucky: boolean): number {
    let cursor = random() * 100;
    const weights = BAG_WEIGHTS[lucky ? "lucky" : "normal"];
    for (let i = 0; i < weights.length; i++) {
        cursor -= weights[i];
        if (cursor < 0)
            return BAG_VALUES[i];
    }
    return BAG_VALUES[BAG_VALUES.length - 1];
}
export function seededRandom(seed: number): () => number {
    let state = seed >>> 0 || 1;
    return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
}

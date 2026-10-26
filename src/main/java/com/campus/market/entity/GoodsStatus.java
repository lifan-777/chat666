package com.campus.market.entity;

/**
 * 商品状态。
 * <pre>
 * 发布/编辑 → PENDING —审核通过→ ON_SALE —下单→ RESERVED —确认收货→ SOLD
 *                    └—驳回→ REJECTED            └—取消订单→ ON_SALE
 * ON_SALE / PENDING / REJECTED —下架→ OFF_SHELF —重新上架→ PENDING
 * </pre>
 */
public enum GoodsStatus {
    PENDING("待审核"),
    ON_SALE("在售"),
    REJECTED("审核未通过"),
    RESERVED("交易中"),
    SOLD("已售出"),
    OFF_SHELF("已下架");

    private final String label;

    GoodsStatus(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}

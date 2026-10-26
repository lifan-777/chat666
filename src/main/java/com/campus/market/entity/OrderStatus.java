package com.campus.market.entity;

/**
 * 订单状态。
 * <pre>
 * PENDING(待卖家确认) —卖家确认→ CONFIRMED(待交易) —买家确认收货→ COMPLETED
 * PENDING / CONFIRMED —买家或卖家取消→ CANCELLED
 * </pre>
 */
public enum OrderStatus {
    PENDING("待卖家确认"),
    CONFIRMED("待交易"),
    COMPLETED("已完成"),
    CANCELLED("已取消");

    private final String label;

    OrderStatus(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}

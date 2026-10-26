package com.campus.market.entity;

/**
 * 商品成色。
 */
public enum ConditionLevel {
    NEW("全新"),
    LIKE_NEW("几乎全新"),
    LIGHTLY_USED("轻微使用痕迹"),
    USED("明显使用痕迹");

    private final String label;

    ConditionLevel(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}

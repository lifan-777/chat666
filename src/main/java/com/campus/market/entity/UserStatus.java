package com.campus.market.entity;

/**
 * 账号状态。
 */
public enum UserStatus {
    NORMAL("正常"),
    BANNED("已封禁");

    private final String label;

    UserStatus(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}

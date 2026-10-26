package com.campus.market.controller;

/**
 * 分页参数工具：限制每页最多 50 条，防止一次查询过多数据。
 */
public final class Pages {

    public static final int MAX_SIZE = 50;

    private Pages() {
    }

    public static int limit(int size) {
        return Math.min(Math.max(size, 1), MAX_SIZE);
    }
}

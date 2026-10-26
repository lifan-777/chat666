package com.campus.market.dto;

import java.math.BigDecimal;

/**
 * 商品搜索条件。sort 取值：newest（默认）、price_asc、price_desc、hot。
 */
public record GoodsQuery(String keyword, Long categoryId, BigDecimal minPrice, BigDecimal maxPrice,
                         String sort, Integer page, Integer size) {

    public int pageOrDefault() {
        return page == null || page < 1 ? 1 : page;
    }

    public int sizeOrDefault() {
        return size == null || size < 1 ? 12 : Math.min(size, 50);
    }
}

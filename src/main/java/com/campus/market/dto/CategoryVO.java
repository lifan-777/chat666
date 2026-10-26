package com.campus.market.dto;

import com.campus.market.entity.Category;

public record CategoryVO(Long id, String name, String icon, Integer sortOrder, long goodsCount) {

    public static CategoryVO from(Category c, long goodsCount) {
        return new CategoryVO(c.getId(), c.getName(), c.getIcon(), c.getSortOrder(), goodsCount);
    }
}

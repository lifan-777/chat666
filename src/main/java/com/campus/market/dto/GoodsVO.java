package com.campus.market.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import com.campus.market.entity.ConditionLevel;
import com.campus.market.entity.Goods;
import com.campus.market.entity.GoodsStatus;

/**
 * 商品视图对象。favorited / favoriteCount 只在详情接口中填充。
 */
public record GoodsVO(Long id, String title, String description, BigDecimal price, BigDecimal originalPrice,
                      Long categoryId, String categoryName,
                      ConditionLevel conditionLevel, String conditionText,
                      String tradeLocation, List<String> images, String coverImage,
                      GoodsStatus status, String statusText, String rejectReason,
                      UserBrief seller, Integer viewCount,
                      Boolean favorited, Long favoriteCount,
                      LocalDateTime createdAt, LocalDateTime updatedAt) {

    public static GoodsVO from(Goods g) {
        return of(g, g.getViewCount(), null, null);
    }

    public static GoodsVO of(Goods g, Integer viewCount, Boolean favorited, Long favoriteCount) {
        List<String> images = List.copyOf(g.getImages());
        return new GoodsVO(g.getId(), g.getTitle(), g.getDescription(), g.getPrice(), g.getOriginalPrice(),
                g.getCategory().getId(), g.getCategory().getName(),
                g.getConditionLevel(), g.getConditionLevel().getLabel(),
                g.getTradeLocation(), images, images.isEmpty() ? null : images.get(0),
                g.getStatus(), g.getStatus().getLabel(), g.getRejectReason(),
                UserBrief.from(g.getSeller()), viewCount,
                favorited, favoriteCount,
                g.getCreatedAt(), g.getUpdatedAt());
    }
}

package com.campus.market.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * 管理后台数据概览。
 */
public record StatsVO(long userCount, long goodsCount, long onSaleCount, long pendingCount,
                      long orderCount, long completedOrderCount, BigDecimal turnover,
                      List<NameValue> categoryDistribution,
                      List<NameValue> statusDistribution,
                      List<NameValue> orderTrend) {

    public record NameValue(String name, long value) {
    }
}

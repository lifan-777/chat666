package com.campus.market.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateOrderRequest(
        @NotNull(message = "商品不能为空") Long goodsId,
        @Size(max = 200, message = "留言不能超过 200 个字符") String remark) {
}

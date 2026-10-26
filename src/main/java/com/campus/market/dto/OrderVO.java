package com.campus.market.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.campus.market.entity.OrderStatus;
import com.campus.market.entity.TradeOrder;

public record OrderVO(Long id, String orderNo, Long goodsId, String goodsTitle, String goodsImage,
                      BigDecimal price, String tradeLocation,
                      OrderStatus status, String statusText,
                      UserContact buyer, UserContact seller,
                      String buyerRemark, String cancelReason,
                      LocalDateTime createdAt, LocalDateTime confirmedAt,
                      LocalDateTime completedAt, LocalDateTime cancelledAt) {

    public static OrderVO from(TradeOrder o) {
        return new OrderVO(o.getId(), o.getOrderNo(), o.getGoods().getId(), o.getGoodsTitle(), o.getGoodsImage(),
                o.getPrice(), o.getGoods().getTradeLocation(),
                o.getStatus(), o.getStatus().getLabel(),
                UserContact.from(o.getBuyer()), UserContact.from(o.getSeller()),
                o.getBuyerRemark(), o.getCancelReason(),
                o.getCreatedAt(), o.getConfirmedAt(), o.getCompletedAt(), o.getCancelledAt());
    }
}

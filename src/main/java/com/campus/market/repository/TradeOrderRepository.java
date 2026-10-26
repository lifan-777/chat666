package com.campus.market.repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.campus.market.entity.OrderStatus;
import com.campus.market.entity.TradeOrder;

public interface TradeOrderRepository extends JpaRepository<TradeOrder, Long> {

    Page<TradeOrder> findByBuyerId(Long buyerId, Pageable pageable);

    Page<TradeOrder> findByBuyerIdAndStatus(Long buyerId, OrderStatus status, Pageable pageable);

    Page<TradeOrder> findBySellerId(Long sellerId, Pageable pageable);

    Page<TradeOrder> findBySellerIdAndStatus(Long sellerId, OrderStatus status, Pageable pageable);

    long countByStatus(OrderStatus status);

    @Query("select coalesce(sum(o.price), 0) from TradeOrder o where o.status = :status")
    BigDecimal sumPriceByStatus(@Param("status") OrderStatus status);

    @Query("select o.createdAt from TradeOrder o where o.createdAt >= :since")
    List<LocalDateTime> findCreatedTimesSince(@Param("since") LocalDateTime since);
}

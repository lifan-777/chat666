package com.campus.market.repository;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.campus.market.entity.Goods;
import com.campus.market.entity.GoodsStatus;

public interface GoodsRepository extends JpaRepository<Goods, Long>, JpaSpecificationExecutor<Goods> {

    Page<Goods> findBySellerId(Long sellerId, Pageable pageable);

    Page<Goods> findBySellerIdAndStatus(Long sellerId, GoodsStatus status, Pageable pageable);

    long countByStatus(GoodsStatus status);

    boolean existsByCategoryId(Long categoryId);

    /**
     * 带条件的状态更新（乐观并发控制）：只有当前状态等于 from 时才会更新成功，
     * 用于防止同一件商品被多个买家同时下单。
     *
     * @return 受影响的行数，0 表示状态已被其他请求修改
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update Goods g set g.status = :to where g.id = :id and g.status = :from")
    int compareAndSetStatus(@Param("id") Long id, @Param("from") GoodsStatus from, @Param("to") GoodsStatus to);

    @Modifying
    @Query("update Goods g set g.viewCount = g.viewCount + 1 where g.id = :id")
    void increaseViewCount(@Param("id") Long id);

    @Query("select g.category.id, count(g) from Goods g group by g.category.id")
    List<Object[]> countGroupByCategory();

    @Query("select g.status, count(g) from Goods g group by g.status")
    List<Object[]> countGroupByStatus();
}

package com.campus.market.repository;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import com.campus.market.entity.Favorite;

public interface FavoriteRepository extends JpaRepository<Favorite, Long> {

    boolean existsByUserIdAndGoodsId(Long userId, Long goodsId);

    Optional<Favorite> findByUserIdAndGoodsId(Long userId, Long goodsId);

    Page<Favorite> findByUserId(Long userId, Pageable pageable);

    long countByGoodsId(Long goodsId);
}

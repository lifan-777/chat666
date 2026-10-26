package com.campus.market.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.campus.market.entity.Comment;

public interface CommentRepository extends JpaRepository<Comment, Long> {

    List<Comment> findByGoodsIdOrderByCreatedAtAsc(Long goodsId);
}

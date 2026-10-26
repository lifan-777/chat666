package com.campus.market.dto;

import java.time.LocalDateTime;

import com.campus.market.entity.Comment;

public record CommentVO(Long id, String content, UserBrief user, UserBrief replyTo, LocalDateTime createdAt) {

    public static CommentVO from(Comment c) {
        return new CommentVO(c.getId(), c.getContent(), UserBrief.from(c.getUser()),
                UserBrief.from(c.getReplyTo()), c.getCreatedAt());
    }
}

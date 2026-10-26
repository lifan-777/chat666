package com.campus.market.dto;

import com.campus.market.entity.User;

/**
 * 公开的用户简要信息（不含手机号）。
 */
public record UserBrief(Long id, String nickname) {

    public static UserBrief from(User u) {
        return u == null ? null : new UserBrief(u.getId(), u.getNickname());
    }
}

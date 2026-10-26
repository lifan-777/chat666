package com.campus.market.dto;

import com.campus.market.entity.User;

/**
 * 交易双方可见的联系方式。
 */
public record UserContact(Long id, String nickname, String phone) {

    public static UserContact from(User u) {
        return new UserContact(u.getId(), u.getNickname(), u.getPhone());
    }
}

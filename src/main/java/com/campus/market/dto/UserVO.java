package com.campus.market.dto;

import java.time.LocalDateTime;

import com.campus.market.entity.Role;
import com.campus.market.entity.User;
import com.campus.market.entity.UserStatus;

/**
 * 用户完整信息，仅返回给本人或管理员。
 */
public record UserVO(Long id, String username, String nickname, String phone,
                     Role role, String roleText, UserStatus status, String statusText,
                     LocalDateTime createdAt) {

    public static UserVO from(User u) {
        return new UserVO(u.getId(), u.getUsername(), u.getNickname(), u.getPhone(),
                u.getRole(), u.getRole().getLabel(), u.getStatus(), u.getStatus().getLabel(),
                u.getCreatedAt());
    }
}

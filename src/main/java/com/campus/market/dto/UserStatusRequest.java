package com.campus.market.dto;

import com.campus.market.entity.UserStatus;

import jakarta.validation.constraints.NotNull;

public record UserStatusRequest(@NotNull(message = "状态不能为空") UserStatus status) {
}

package com.campus.market.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateProfileRequest(
        @NotBlank(message = "昵称不能为空")
        @Size(max = 20, message = "昵称不能超过 20 个字符")
        String nickname,

        @Pattern(regexp = "^$|^1\\d{10}$", message = "手机号格式不正确")
        String phone) {
}

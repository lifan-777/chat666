package com.campus.market.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CommentRequest(
        @NotBlank(message = "留言内容不能为空")
        @Size(max = 300, message = "留言不能超过 300 个字符")
        String content,

        Long replyToUserId) {
}

package com.campus.market.dto;

import jakarta.validation.constraints.Size;

/**
 * 只包含一个原因字段的请求体，用于取消订单、强制下架等操作。
 */
public record ReasonRequest(@Size(max = 200, message = "原因不能超过 200 个字符") String reason) {
}

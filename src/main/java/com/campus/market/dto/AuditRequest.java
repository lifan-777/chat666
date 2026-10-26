package com.campus.market.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 管理员审核商品：approved=false 时必须填写驳回原因。
 */
public record AuditRequest(
        @NotNull(message = "请选择审核结果") Boolean approved,
        @Size(max = 200, message = "原因不能超过 200 个字符") String reason) {
}

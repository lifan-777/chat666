package com.campus.market.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CategoryRequest(
        @NotBlank(message = "分类名称不能为空")
        @Size(max = 20, message = "分类名称不能超过 20 个字符")
        String name,

        @Size(max = 30, message = "图标名称过长")
        String icon,

        @Min(value = 0, message = "排序值不能小于 0")
        @Max(value = 999, message = "排序值不能大于 999")
        Integer sortOrder) {
}

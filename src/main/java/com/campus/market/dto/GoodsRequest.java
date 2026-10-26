package com.campus.market.dto;

import java.math.BigDecimal;
import java.util.List;

import com.campus.market.entity.ConditionLevel;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 发布 / 编辑商品的请求体。
 */
public record GoodsRequest(
        @NotBlank(message = "标题不能为空")
        @Size(max = 50, message = "标题不能超过 50 个字符")
        String title,

        @NotBlank(message = "商品描述不能为空")
        @Size(max = 2000, message = "商品描述不能超过 2000 个字符")
        String description,

        @NotNull(message = "价格不能为空")
        @DecimalMin(value = "0.01", message = "价格必须大于 0")
        @DecimalMax(value = "99999.99", message = "价格不能超过 99999.99")
        @Digits(integer = 5, fraction = 2, message = "价格最多保留两位小数")
        BigDecimal price,

        @DecimalMin(value = "0.01", message = "原价必须大于 0")
        @DecimalMax(value = "99999.99", message = "原价不能超过 99999.99")
        @Digits(integer = 5, fraction = 2, message = "原价最多保留两位小数")
        BigDecimal originalPrice,

        @NotNull(message = "请选择分类")
        Long categoryId,

        @NotNull(message = "请选择成色")
        ConditionLevel conditionLevel,

        @NotBlank(message = "交易地点不能为空")
        @Size(max = 50, message = "交易地点不能超过 50 个字符")
        String tradeLocation,

        @NotEmpty(message = "请至少上传一张图片")
        @Size(max = 6, message = "最多上传 6 张图片")
        List<@NotBlank String> images) {
}

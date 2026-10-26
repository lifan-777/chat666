package com.campus.market.security;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 标注在 Controller 方法上，表示该接口无需登录即可访问（游客可用）。
 * 若请求携带了有效 Token，仍会解析出当前用户，便于返回“是否已收藏”等个性化信息。
 */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface PublicApi {
}

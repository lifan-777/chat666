package com.campus.market.security;

import java.util.Optional;

import com.campus.market.common.BusinessException;
import com.campus.market.entity.User;

/**
 * 保存当前请求的登录用户（基于 ThreadLocal），由 {@link AuthInterceptor} 设置和清理。
 */
public final class UserContext {

    private static final ThreadLocal<User> CURRENT = new ThreadLocal<>();

    private UserContext() {
    }

    static void set(User user) {
        CURRENT.set(user);
    }

    static void clear() {
        CURRENT.remove();
    }

    /** 当前用户，游客访问公开接口时为空 */
    public static Optional<User> current() {
        return Optional.ofNullable(CURRENT.get());
    }

    /** 当前用户，未登录时抛出 401 */
    public static User require() {
        return current().orElseThrow(() -> BusinessException.unauthorized("请先登录"));
    }
}

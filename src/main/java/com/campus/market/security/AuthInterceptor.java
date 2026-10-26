package com.campus.market.security;

import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

import com.campus.market.common.BusinessException;
import com.campus.market.entity.User;
import com.campus.market.repository.UserRepository;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * 登录与权限拦截器：
 * <ol>
 *     <li>从 Authorization: Bearer &lt;token&gt; 中解析用户；</li>
 *     <li>未标注 {@link PublicApi} 的接口必须登录；</li>
 *     <li>/api/admin/** 接口只允许管理员访问；</li>
 *     <li>被封禁的账号不能访问任何需要身份的接口。</li>
 * </ol>
 * 抛出的 {@link BusinessException} 由全局异常处理器转换为 JSON 响应。
 */
@Component
public class AuthInterceptor implements HandlerInterceptor {

    private static final String BEARER = "Bearer ";

    private final JwtTokenProvider tokenProvider;
    private final UserRepository userRepository;

    public AuthInterceptor(JwtTokenProvider tokenProvider, UserRepository userRepository) {
        this.tokenProvider = tokenProvider;
        this.userRepository = userRepository;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!(handler instanceof HandlerMethod method)) {
            return true;
        }
        User user = resolveUser(request);
        boolean isPublic = method.hasMethodAnnotation(PublicApi.class)
                || method.getBeanType().isAnnotationPresent(PublicApi.class);

        if (user == null) {
            if (isPublic) {
                return true;
            }
            throw BusinessException.unauthorized("请先登录");
        }
        if (user.isBanned()) {
            throw BusinessException.forbidden("账号已被封禁，请联系管理员");
        }
        if (request.getRequestURI().startsWith("/api/admin") && !user.isAdmin()) {
            throw BusinessException.forbidden("需要管理员权限");
        }
        UserContext.set(user);
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        UserContext.clear();
    }

    private User resolveUser(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith(BEARER)) {
            return null;
        }
        return tokenProvider.parseUserId(header.substring(BEARER.length()).trim())
                .flatMap(userRepository::findById)
                .orElse(null);
    }
}

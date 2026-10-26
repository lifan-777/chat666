package com.campus.market.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * application.yml 中以 app 开头的自定义配置。
 */
@ConfigurationProperties(prefix = "app")
public record AppProperties(Jwt jwt, String uploadDir, boolean seedDemoData) {

    public record Jwt(String secret, int expireHours) {
    }
}

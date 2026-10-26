package com.campus.market.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.campus.market.config.AppProperties;

@DisplayName("JWT 令牌 JwtTokenProvider 单元测试")
class JwtTokenProviderTest {

    private static final String SECRET = "unit-test-secret-key-0123456789-abcdefghijklmnopqrstuvwxyz";

    private static JwtTokenProvider provider(String secret, int expireHours) {
        return new JwtTokenProvider(new AppProperties(new AppProperties.Jwt(secret, expireHours), "./target/x", false));
    }

    @Test
    @DisplayName("签发的令牌可以解析出用户 ID")
    void createAndParse() {
        JwtTokenProvider provider = provider(SECRET, 1);

        String token = provider.createToken(42L);

        assertThat(token.split("\\.")).hasSize(3);
        assertThat(provider.parseUserId(token)).contains(42L);
    }

    @Test
    @DisplayName("被篡改的令牌解析失败")
    void tamperedToken() {
        JwtTokenProvider provider = provider(SECRET, 1);
        String token = provider.createToken(42L);
        String[] parts = token.split("\\.");
        // 把载荷替换成另一个用户的令牌载荷，签名不再匹配
        String forged = parts[0] + "." + provider.createToken(1L).split("\\.")[1] + "." + parts[2];

        assertThat(provider.parseUserId(forged)).isEmpty();
    }

    @Test
    @DisplayName("使用其他密钥签发的令牌解析失败")
    void wrongKey() {
        String token = provider("another-secret-key-0123456789-abcdefghijklmnopqrstuvwxyz", 1).createToken(42L);

        assertThat(provider(SECRET, 1).parseUserId(token)).isEmpty();
    }

    @Test
    @DisplayName("已过期的令牌解析失败")
    void expiredToken() {
        JwtTokenProvider expired = provider(SECRET, -1);

        assertThat(expired.parseUserId(expired.createToken(42L))).isEmpty();
    }

    @Test
    @DisplayName("格式错误的令牌解析失败而不是抛出异常")
    void malformedToken() {
        JwtTokenProvider provider = provider(SECRET, 1);

        assertThat(provider.parseUserId("not-a-jwt")).isEmpty();
        assertThat(provider.parseUserId("")).isEmpty();
    }
}

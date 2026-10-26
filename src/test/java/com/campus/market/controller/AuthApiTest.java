package com.campus.market.controller;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

@DisplayName("认证接口 /api/auth 集成测试")
class AuthApiTest extends ApiTestSupport {

    @Test
    @DisplayName("注册 → 登录 → 获取当前用户信息")
    void registerLoginMe() throws Exception {
        String username = unique("user");
        postJson("/api/auth/register", Map.of("username", username, "password", "123456", "nickname", "新同学"), null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.username").value(username))
                .andExpect(jsonPath("$.data.role").value("USER"))
                .andExpect(jsonPath("$.data.password").doesNotExist());

        String token = login(username, "123456");

        getWith("/api/auth/me", token)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.username").value(username))
                .andExpect(jsonPath("$.data.nickname").value("新同学"))
                .andExpect(jsonPath("$.data.createdAt").value(org.hamcrest.Matchers.matchesPattern("\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}")));
    }

    @Test
    @DisplayName("重复注册同一用户名返回 409")
    void duplicateRegister() throws Exception {
        String username = unique("dup");
        registerAndLogin(username);

        postJson("/api/auth/register", Map.of("username", username, "password", "123456", "nickname", "x"), null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("用户名已被注册"));
    }

    @Test
    @DisplayName("未登录访问受保护接口返回 401")
    void unauthorizedWithoutToken() throws Exception {
        getWith("/api/auth/me", null)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401))
                .andExpect(jsonPath("$.message").value("请先登录"));
        postJson("/api/orders", Map.of("goodsId", 1), null).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("伪造的 Token 视为未登录，返回 401")
    void forgedToken() throws Exception {
        getWith("/api/auth/me", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.forged-signature")
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("公开接口无需登录即可访问")
    void publicApiWithoutToken() throws Exception {
        getWith("/api/categories", null).andExpect(status().isOk());
        getWith("/api/goods?page=1&size=5", null).andExpect(status().isOk()).andExpect(jsonPath("$.data.page").value(1));
    }

    @Test
    @DisplayName("注册参数校验失败返回 400 和中文提示")
    void registerValidation() throws Exception {
        postJson("/api/auth/register", Map.of("username", "ab", "password", "123", "nickname", "", "phone", "12345"), null)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value(containsString("用户名须为 4-20 位字母、数字或下划线")))
                .andExpect(jsonPath("$.message").value(containsString("密码长度须为 6-32 位")))
                .andExpect(jsonPath("$.message").value(containsString("手机号格式不正确")));
    }

    @Test
    @DisplayName("请求体不是合法 JSON 时返回 400")
    void malformedJson() throws Exception {
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON).content("{bad json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("请求参数格式错误"));
    }

    @Test
    @DisplayName("密码错误登录返回 401")
    void wrongPassword() throws Exception {
        String username = unique("pwd");
        registerAndLogin(username);

        postJson("/api/auth/login", Map.of("username", username, "password", "000000"), null)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("用户名或密码错误"));
    }

    @Test
    @DisplayName("账号被封禁后，已签发的 Token 立即失效（403）且无法再登录")
    void bannedUserToken() throws Exception {
        String username = unique("ban");
        String token = registerAndLogin(username);
        Long userId = read(getWith("/api/auth/me", token)).at("/data/id").asLong();

        mockMvc.perform(auth(put("/api/admin/users/" + userId + "/status")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"BANNED\"}"), adminToken()))
                .andExpect(status().isOk());

        getWith("/api/auth/me", token)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("账号已被封禁，请联系管理员"));
        postJson("/api/auth/login", Map.of("username", username, "password", "123456"), null)
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("修改个人资料和密码，修改密码后需使用新密码登录")
    void updateProfileAndPassword() throws Exception {
        String username = unique("prof");
        String token = registerAndLogin(username);

        mockMvc.perform(auth(put("/api/users/me").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("nickname", "改名了", "phone", "13700000000"))), token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.nickname").value("改名了"));

        mockMvc.perform(auth(put("/api/users/me/password").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("oldPassword", "123456", "newPassword", "abcdef"))), token))
                .andExpect(status().isOk());

        postJson("/api/auth/login", Map.of("username", username, "password", "123456"), null)
                .andExpect(status().isUnauthorized());
        login(username, "abcdef");
    }
}

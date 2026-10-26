package com.campus.market.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

@DisplayName("管理后台接口 /api/admin 集成测试")
class AdminApiTest extends ApiTestSupport {

    private String adminToken;
    private String userToken;

    @BeforeEach
    void setUp() throws Exception {
        adminToken = adminToken();
        userToken = registerAndLogin(unique("normal"));
    }

    @Test
    @DisplayName("普通用户访问管理接口返回 403")
    void normalUserForbidden() throws Exception {
        getWith("/api/admin/stats", userToken)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("需要管理员权限"));
        getWith("/api/admin/users", userToken).andExpect(status().isForbidden());
        postJson("/api/admin/categories", Map.of("name", "越权分类"), userToken).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("未登录访问管理接口返回 401")
    void anonymousUnauthorized() throws Exception {
        getWith("/api/admin/stats", null).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("管理员查看数据概览：包含 7 天趋势和全部商品状态")
    void adminStats() throws Exception {
        getWith("/api/admin/stats", adminToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.userCount").isNumber())
                .andExpect(jsonPath("$.data.orderTrend.length()").value(7))
                .andExpect(jsonPath("$.data.statusDistribution.length()").value(6));
    }

    @Test
    @DisplayName("管理员按关键词查询用户，并封禁、解封用户")
    void banAndUnban() throws Exception {
        String username = unique("target");
        registerAndLogin(username);
        Long userId = read(getWith("/api/admin/users?keyword=" + username, adminToken)
                .andExpect(jsonPath("$.data.total").value(1))).at("/data/records/0/id").asLong();

        mockMvc.perform(auth(put("/api/admin/users/" + userId + "/status").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"BANNED\"}"), adminToken))
                .andExpect(jsonPath("$.data.status").value("BANNED"));
        postJson("/api/auth/login", Map.of("username", username, "password", "123456"), null)
                .andExpect(status().isForbidden());

        mockMvc.perform(auth(put("/api/admin/users/" + userId + "/status").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"NORMAL\"}"), adminToken))
                .andExpect(jsonPath("$.data.status").value("NORMAL"));
        login(username, "123456");
    }

    @Test
    @DisplayName("分类管理：新增、重名校验、修改、删除")
    void categoryCrud() throws Exception {
        String name = unique("乐器");
        Long id = read(postJson("/api/admin/categories", Map.of("name", name, "icon", "Headset", "sortOrder", 10), adminToken)
                .andExpect(status().isOk())).at("/data/id").asLong();

        postJson("/api/admin/categories", Map.of("name", name), adminToken).andExpect(status().isConflict());

        mockMvc.perform(auth(put("/api/admin/categories/" + id).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("name", name + "改", "icon", "Box", "sortOrder", 3))), adminToken))
                .andExpect(jsonPath("$.data.name").value(name + "改"));

        mockMvc.perform(auth(delete("/api/admin/categories/" + id), adminToken)).andExpect(status().isOk());
        mockMvc.perform(auth(delete("/api/admin/categories/" + id), adminToken)).andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("分类下有商品时不能删除")
    void cannotDeleteCategoryInUse() throws Exception {
        Long categoryId = createCategory();
        publish(userToken, categoryId, unique("占用分类"), "9.9");

        mockMvc.perform(auth(delete("/api/admin/categories/" + categoryId), adminToken))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("该分类下仍有商品，无法删除"));
    }

    @Test
    @DisplayName("管理员查询待审核商品并强制下架违规商品")
    void auditListAndForceOffShelf() throws Exception {
        Long goodsId = publish(userToken, createCategory(), unique("违规"), "1");
        getWith("/api/admin/goods?status=PENDING&keyword=违规", adminToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").isNumber());

        postJson("/api/admin/goods/" + goodsId + "/off-shelf", Map.of("reason", "疑似违禁品"), adminToken)
                .andExpect(jsonPath("$.data.status").value("OFF_SHELF"))
                .andExpect(jsonPath("$.data.rejectReason").value("管理员下架：疑似违禁品"));
    }
}

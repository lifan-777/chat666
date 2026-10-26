package com.campus.market.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.campus.market.entity.Category;
import com.campus.market.entity.Role;
import com.campus.market.entity.User;
import com.campus.market.entity.UserStatus;
import com.campus.market.repository.CategoryRepository;
import com.campus.market.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * 接口集成测试基类：启动完整 Spring 上下文 + 内存 H2，通过 MockMvc 调用真实接口。
 * 各测试类共享同一个数据库，因此测试数据使用唯一的用户名和分类名，互不干扰。
 */
@SpringBootTest
@AutoConfigureMockMvc
public abstract class ApiTestSupport {

    private static final AtomicInteger SEQ = new AtomicInteger();

    @Autowired
    protected MockMvc mockMvc;
    @Autowired
    protected ObjectMapper objectMapper;
    @Autowired
    protected UserRepository userRepository;
    @Autowired
    protected CategoryRepository categoryRepository;
    @Autowired
    protected PasswordEncoder passwordEncoder;

    protected static String unique(String prefix) {
        return prefix + System.nanoTime() % 100000 + SEQ.incrementAndGet();
    }

    protected String json(Object body) throws Exception {
        return objectMapper.writeValueAsString(body);
    }

    protected JsonNode read(ResultActions actions) throws Exception {
        return objectMapper.readTree(actions.andReturn().getResponse().getContentAsString());
    }

    protected MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder builder, String token) {
        return token == null ? builder : builder.header("Authorization", "Bearer " + token);
    }

    protected ResultActions postJson(String url, Object body, String token) throws Exception {
        return mockMvc.perform(auth(post(url).contentType(MediaType.APPLICATION_JSON).content(json(body)), token));
    }

    protected ResultActions getWith(String url, String token) throws Exception {
        return mockMvc.perform(auth(get(url), token));
    }

    /** 通过注册接口创建普通用户并登录，返回 Token */
    protected String registerAndLogin(String username) throws Exception {
        postJson("/api/auth/register", Map.of("username", username, "password", "123456",
                "nickname", "用户" + username.substring(Math.max(0, username.length() - 4)), "phone", "13900000000"), null)
                .andExpect(status().isOk());
        return login(username, "123456");
    }

    protected String login(String username, String password) throws Exception {
        JsonNode body = read(postJson("/api/auth/login", Map.of("username", username, "password", password), null)
                .andExpect(status().isOk()));
        return body.at("/data/token").asText();
    }

    /** 直接写库创建管理员（系统没有开放注册管理员的接口）并登录 */
    protected String adminToken() throws Exception {
        String username = unique("admin");
        User admin = new User();
        admin.setUsername(username);
        admin.setPassword(passwordEncoder.encode("admin123"));
        admin.setNickname("管理员");
        admin.setRole(Role.ADMIN);
        admin.setStatus(UserStatus.NORMAL);
        userRepository.save(admin);
        return login(username, "admin123");
    }

    protected Long createCategory() {
        Category category = new Category();
        category.setName(unique("分类"));
        category.setIcon("Goods");
        category.setSortOrder(1);
        return categoryRepository.save(category).getId();
    }

    protected Map<String, Object> goodsBody(Long categoryId, String title, String price) {
        return Map.of("title", title, "description", "集成测试商品描述", "price", price, "originalPrice", "199",
                "categoryId", categoryId, "conditionLevel", "LIKE_NEW", "tradeLocation", "图书馆一楼",
                "images", java.util.List.of("/demo-images/ipad.jpg"));
    }

    /** 发布商品并返回商品 ID */
    protected Long publish(String token, Long categoryId, String title, String price) throws Exception {
        return read(postJson("/api/goods", goodsBody(categoryId, title, price), token).andExpect(status().isOk()))
                .at("/data/id").asLong();
    }
}

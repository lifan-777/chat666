package com.campus.market.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

@DisplayName("图片上传接口 /api/files 集成测试")
class FileUploadApiTest extends ApiTestSupport {

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0x0D};

    @Test
    @DisplayName("上传合法 PNG 图片成功，返回的地址可以直接访问")
    void uploadPng() throws Exception {
        String token = registerAndLogin(unique("up"));

        String url = read(mockMvc.perform(auth(multipart("/api/files/images")
                        .file(new MockMultipartFile("file", "a.png", "image/png", PNG)), token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.url").value(org.hamcrest.Matchers.startsWith("/uploads/"))))
                .at("/data/url").asText();

        mockMvc.perform(get(url)).andExpect(status().isOk()).andExpect(content().bytes(PNG));
    }

    @Test
    @DisplayName("上传伪装成 .jpg 的文本文件返回 400")
    void uploadFakeJpg() throws Exception {
        String token = registerAndLogin(unique("up"));

        mockMvc.perform(auth(multipart("/api/files/images").file(new MockMultipartFile("file", "evil.jpg", "image/jpeg",
                        "<?php echo 1; ?>".getBytes(StandardCharsets.UTF_8))), token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("文件内容不是有效的图片"));
    }

    @Test
    @DisplayName("未登录不能上传图片")
    void uploadRequiresLogin() throws Exception {
        mockMvc.perform(multipart("/api/files/images").file(new MockMultipartFile("file", "a.png", "image/png", PNG)))
                .andExpect(status().isUnauthorized());
    }
}

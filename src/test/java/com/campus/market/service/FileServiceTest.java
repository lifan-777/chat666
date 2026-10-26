package com.campus.market.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import com.campus.market.common.BusinessException;
import com.campus.market.config.AppProperties;

@DisplayName("文件服务 FileService 单元测试")
class FileServiceTest {

    static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0};
    static final byte[] JPG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 0x10, 'J', 'F', 'I', 'F', 0, 0};
    static final byte[] GIF = {'G', 'I', 'F', '8', '9', 'a', 0, 0, 0, 0, 0, 0};
    static final byte[] WEBP = {'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P'};

    @TempDir
    Path tempDir;

    private FileService fileService;

    @BeforeEach
    void setUp() {
        fileService = new FileService(new AppProperties(new AppProperties.Jwt("x", 1), tempDir.toString(), false));
    }

    @Test
    @DisplayName("根据文件头识别 JPEG / PNG / GIF / WEBP 图片")
    void recognizeMagicNumbers() {
        assertThat(FileService.looksLikeImage(JPG)).isTrue();
        assertThat(FileService.looksLikeImage(PNG)).isTrue();
        assertThat(FileService.looksLikeImage(GIF)).isTrue();
        assertThat(FileService.looksLikeImage(WEBP)).isTrue();
        assertThat(FileService.looksLikeImage("hello world!".getBytes(StandardCharsets.UTF_8))).isFalse();
        assertThat(FileService.looksLikeImage(new byte[0])).isFalse();
    }

    @Test
    @DisplayName("上传合法 PNG：保存到按月份划分的目录，返回 /uploads 开头的地址")
    void storePng() throws Exception {
        String url = fileService.storeImage(new MockMultipartFile("file", "photo.PNG", "image/png", PNG));

        assertThat(url).matches("/uploads/\\d{6}/[0-9a-f]{32}\\.png");
        Path saved = tempDir.resolve(url.substring("/uploads/".length()));
        assertThat(Files.readAllBytes(saved)).isEqualTo(PNG);
    }

    @Test
    @DisplayName("拒绝扩展名伪装成 .jpg 的文本文件")
    void rejectFakeImage() {
        MockMultipartFile fake = new MockMultipartFile("file", "virus.jpg", "image/jpeg",
                "<script>alert(1)</script>".getBytes(StandardCharsets.UTF_8));

        assertThatThrownBy(() -> fileService.storeImage(fake))
                .isInstanceOf(BusinessException.class)
                .hasMessage("文件内容不是有效的图片");
    }

    @Test
    @DisplayName("拒绝不支持的扩展名（如 .exe）")
    void rejectExtension() {
        MockMultipartFile exe = new MockMultipartFile("file", "app.exe", "application/octet-stream", PNG);

        assertThatThrownBy(() -> fileService.storeImage(exe))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("只支持");
    }

    @Test
    @DisplayName("拒绝空文件")
    void rejectEmpty() {
        MockMultipartFile empty = new MockMultipartFile("file", "a.png", "image/png", new byte[0]);

        assertThatThrownBy(() -> fileService.storeImage(empty))
                .isInstanceOf(BusinessException.class)
                .hasMessage("请选择要上传的图片");
    }

    @Test
    @DisplayName("拒绝超过 5MB 的图片")
    void rejectTooLarge() {
        byte[] big = new byte[(int) FileService.MAX_SIZE + 1];
        System.arraycopy(PNG, 0, big, 0, PNG.length);
        MockMultipartFile file = new MockMultipartFile("file", "big.png", "image/png", big);

        assertThatThrownBy(() -> fileService.storeImage(file))
                .isInstanceOf(BusinessException.class)
                .hasMessage("图片不能超过 5MB");
    }
}

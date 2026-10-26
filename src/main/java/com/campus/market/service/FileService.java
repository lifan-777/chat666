package com.campus.market.service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import com.campus.market.common.BusinessException;
import com.campus.market.config.AppProperties;

/**
 * 图片上传。文件按月份分目录保存，文件名使用随机 UUID，避免覆盖和路径穿越。
 */
@Service
public class FileService {

    static final long MAX_SIZE = 5L * 1024 * 1024;
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("jpg", "jpeg", "png", "gif", "webp");
    private static final DateTimeFormatter MONTH_DIR = DateTimeFormatter.ofPattern("yyyyMM");

    private final Path root;

    public FileService(AppProperties properties) {
        this.root = Path.of(properties.uploadDir()).toAbsolutePath().normalize();
    }

    /**
     * 保存上传的图片。
     *
     * @return 可直接访问的相对 URL，例如 /uploads/202610/xxx.jpg
     */
    public String storeImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw BusinessException.badRequest("请选择要上传的图片");
        }
        if (file.getSize() > MAX_SIZE) {
            throw BusinessException.badRequest("图片不能超过 5MB");
        }
        String extension = StringUtils.getFilenameExtension(file.getOriginalFilename());
        extension = extension == null ? "" : extension.toLowerCase(Locale.ROOT);
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw BusinessException.badRequest("只支持 jpg、png、gif、webp 格式的图片");
        }
        try (InputStream in = file.getInputStream()) {
            if (!looksLikeImage(in.readNBytes(12))) {
                throw BusinessException.badRequest("文件内容不是有效的图片");
            }
        } catch (IOException e) {
            throw BusinessException.badRequest("读取上传文件失败");
        }

        String month = YearMonth.now().format(MONTH_DIR);
        String filename = UUID.randomUUID().toString().replace("-", "") + "." + extension;
        try {
            Path dir = Files.createDirectories(root.resolve(month));
            file.transferTo(dir.resolve(filename));
        } catch (IOException e) {
            throw new IllegalStateException("保存上传文件失败", e);
        }
        return "/uploads/" + month + "/" + filename;
    }

    /** 根据文件头（魔数）判断是否为 JPEG / PNG / GIF / WEBP 图片，不信任客户端声明的类型 */
    static boolean looksLikeImage(byte[] head) {
        if (head.length >= 3 && (head[0] & 0xFF) == 0xFF && (head[1] & 0xFF) == 0xD8 && (head[2] & 0xFF) == 0xFF) {
            return true;
        }
        if (head.length >= 8 && (head[0] & 0xFF) == 0x89 && head[1] == 'P' && head[2] == 'N' && head[3] == 'G') {
            return true;
        }
        if (head.length >= 4 && head[0] == 'G' && head[1] == 'I' && head[2] == 'F' && head[3] == '8') {
            return true;
        }
        return head.length >= 12 && head[0] == 'R' && head[1] == 'I' && head[2] == 'F' && head[3] == 'F'
                && head[8] == 'W' && head[9] == 'E' && head[10] == 'B' && head[11] == 'P';
    }
}

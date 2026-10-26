package com.campus.market.controller;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.campus.market.common.ApiResponse;
import com.campus.market.dto.UploadResult;
import com.campus.market.service.FileService;

@RestController
@RequestMapping("/api/files")
public class FileController {

    private final FileService fileService;

    public FileController(FileService fileService) {
        this.fileService = fileService;
    }

    @PostMapping("/images")
    public ApiResponse<UploadResult> uploadImage(@RequestParam("file") MultipartFile file) {
        return ApiResponse.ok(new UploadResult(fileService.storeImage(file)));
    }
}

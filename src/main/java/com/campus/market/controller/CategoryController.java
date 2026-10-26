package com.campus.market.controller;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.campus.market.common.ApiResponse;
import com.campus.market.dto.CategoryVO;
import com.campus.market.security.PublicApi;
import com.campus.market.service.CategoryService;

@RestController
@RequestMapping("/api/categories")
public class CategoryController {

    private final CategoryService categoryService;

    public CategoryController(CategoryService categoryService) {
        this.categoryService = categoryService;
    }

    @PublicApi
    @GetMapping
    public ApiResponse<List<CategoryVO>> list() {
        return ApiResponse.ok(categoryService.listAll());
    }
}

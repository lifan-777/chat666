package com.campus.market.controller.admin;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.campus.market.common.ApiResponse;
import com.campus.market.common.PageResult;
import com.campus.market.controller.Pages;
import com.campus.market.dto.AuditRequest;
import com.campus.market.dto.GoodsVO;
import com.campus.market.dto.ReasonRequest;
import com.campus.market.entity.GoodsStatus;
import com.campus.market.service.GoodsService;

import jakarta.validation.Valid;

/**
 * 管理后台：商品审核与违规下架。
 */
@RestController
@RequestMapping("/api/admin/goods")
public class AdminGoodsController {

    private final GoodsService goodsService;

    public AdminGoodsController(GoodsService goodsService) {
        this.goodsService = goodsService;
    }

    @GetMapping
    public ApiResponse<PageResult<GoodsVO>> list(@RequestParam(required = false) GoodsStatus status,
                                                 @RequestParam(required = false) String keyword,
                                                 @RequestParam(defaultValue = "1") int page,
                                                 @RequestParam(defaultValue = "10") int size) {
        return ApiResponse.ok(goodsService.adminSearch(status, keyword, page, Pages.limit(size)));
    }

    @PostMapping("/{id}/audit")
    public ApiResponse<GoodsVO> audit(@PathVariable Long id, @Valid @RequestBody AuditRequest request) {
        return ApiResponse.ok(goodsService.audit(id, request));
    }

    @PostMapping("/{id}/off-shelf")
    public ApiResponse<GoodsVO> offShelf(@PathVariable Long id,
                                         @Valid @RequestBody(required = false) ReasonRequest request) {
        return ApiResponse.ok(goodsService.forceOffShelf(id, request == null ? null : request.reason()));
    }
}

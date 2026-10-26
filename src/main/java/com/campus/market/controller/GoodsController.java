package com.campus.market.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.campus.market.common.ApiResponse;
import com.campus.market.common.PageResult;
import com.campus.market.dto.GoodsQuery;
import com.campus.market.dto.GoodsRequest;
import com.campus.market.dto.GoodsVO;
import com.campus.market.entity.GoodsStatus;
import com.campus.market.security.PublicApi;
import com.campus.market.security.UserContext;
import com.campus.market.service.GoodsService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/goods")
public class GoodsController {

    private final GoodsService goodsService;

    public GoodsController(GoodsService goodsService) {
        this.goodsService = goodsService;
    }

    /** 搜索在售商品 */
    @PublicApi
    @GetMapping
    public ApiResponse<PageResult<GoodsVO>> search(@ModelAttribute GoodsQuery query) {
        return ApiResponse.ok(goodsService.search(query));
    }

    @PublicApi
    @GetMapping("/{id}")
    public ApiResponse<GoodsVO> detail(@PathVariable Long id) {
        return ApiResponse.ok(goodsService.detail(id, UserContext.current().orElse(null)));
    }

    /** 我发布的商品 */
    @GetMapping("/mine")
    public ApiResponse<PageResult<GoodsVO>> mine(@RequestParam(required = false) GoodsStatus status,
                                                 @RequestParam(defaultValue = "1") int page,
                                                 @RequestParam(defaultValue = "10") int size) {
        return ApiResponse.ok(goodsService.listBySeller(UserContext.require().getId(), status, page, Pages.limit(size)));
    }

    @PostMapping
    public ApiResponse<GoodsVO> publish(@Valid @RequestBody GoodsRequest request) {
        return ApiResponse.ok(goodsService.publish(UserContext.require(), request));
    }

    @PutMapping("/{id}")
    public ApiResponse<GoodsVO> update(@PathVariable Long id, @Valid @RequestBody GoodsRequest request) {
        return ApiResponse.ok(goodsService.update(UserContext.require(), id, request));
    }

    @PostMapping("/{id}/off-shelf")
    public ApiResponse<GoodsVO> offShelf(@PathVariable Long id) {
        return ApiResponse.ok(goodsService.offShelf(UserContext.require(), id));
    }

    @PostMapping("/{id}/on-shelf")
    public ApiResponse<GoodsVO> reShelf(@PathVariable Long id) {
        return ApiResponse.ok(goodsService.reShelf(UserContext.require(), id));
    }
}

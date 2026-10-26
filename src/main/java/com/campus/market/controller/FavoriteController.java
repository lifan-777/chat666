package com.campus.market.controller;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.campus.market.common.ApiResponse;
import com.campus.market.common.PageResult;
import com.campus.market.dto.GoodsVO;
import com.campus.market.security.UserContext;
import com.campus.market.service.FavoriteService;

@RestController
@RequestMapping("/api/favorites")
public class FavoriteController {

    private final FavoriteService favoriteService;

    public FavoriteController(FavoriteService favoriteService) {
        this.favoriteService = favoriteService;
    }

    @GetMapping
    public ApiResponse<PageResult<GoodsVO>> list(@RequestParam(defaultValue = "1") int page,
                                                 @RequestParam(defaultValue = "10") int size) {
        return ApiResponse.ok(favoriteService.list(UserContext.require(), page, Pages.limit(size)));
    }

    @PostMapping("/{goodsId}")
    public ApiResponse<Void> add(@PathVariable Long goodsId) {
        favoriteService.add(UserContext.require(), goodsId);
        return ApiResponse.ok();
    }

    @DeleteMapping("/{goodsId}")
    public ApiResponse<Void> remove(@PathVariable Long goodsId) {
        favoriteService.remove(UserContext.require(), goodsId);
        return ApiResponse.ok();
    }
}

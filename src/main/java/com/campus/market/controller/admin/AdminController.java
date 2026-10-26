package com.campus.market.controller.admin;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.campus.market.common.ApiResponse;
import com.campus.market.common.PageResult;
import com.campus.market.controller.Pages;
import com.campus.market.dto.StatsVO;
import com.campus.market.dto.UserStatusRequest;
import com.campus.market.dto.UserVO;
import com.campus.market.service.StatsService;
import com.campus.market.service.UserService;

import jakarta.validation.Valid;

/**
 * 管理后台：数据概览与用户管理。/api/admin/** 由拦截器限制为管理员访问。
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final StatsService statsService;
    private final UserService userService;

    public AdminController(StatsService statsService, UserService userService) {
        this.statsService = statsService;
        this.userService = userService;
    }

    @GetMapping("/stats")
    public ApiResponse<StatsVO> stats() {
        return ApiResponse.ok(statsService.overview());
    }

    @GetMapping("/users")
    public ApiResponse<PageResult<UserVO>> users(@RequestParam(required = false) String keyword,
                                                 @RequestParam(defaultValue = "1") int page,
                                                 @RequestParam(defaultValue = "10") int size) {
        return ApiResponse.ok(userService.search(keyword, page, Pages.limit(size)));
    }

    @PutMapping("/users/{id}/status")
    public ApiResponse<UserVO> updateUserStatus(@PathVariable Long id, @Valid @RequestBody UserStatusRequest request) {
        return ApiResponse.ok(userService.updateStatus(id, request.status()));
    }
}

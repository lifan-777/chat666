package com.campus.market.controller;

import java.util.List;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.campus.market.common.ApiResponse;
import com.campus.market.dto.CommentRequest;
import com.campus.market.dto.CommentVO;
import com.campus.market.security.PublicApi;
import com.campus.market.security.UserContext;
import com.campus.market.service.CommentService;

import jakarta.validation.Valid;

@RestController
public class CommentController {

    private final CommentService commentService;

    public CommentController(CommentService commentService) {
        this.commentService = commentService;
    }

    @PublicApi
    @GetMapping("/api/goods/{goodsId}/comments")
    public ApiResponse<List<CommentVO>> list(@PathVariable Long goodsId) {
        return ApiResponse.ok(commentService.list(goodsId));
    }

    @PostMapping("/api/goods/{goodsId}/comments")
    public ApiResponse<CommentVO> add(@PathVariable Long goodsId, @Valid @RequestBody CommentRequest request) {
        return ApiResponse.ok(commentService.add(UserContext.require(), goodsId, request));
    }

    @DeleteMapping("/api/comments/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        commentService.delete(UserContext.require(), id);
        return ApiResponse.ok();
    }
}

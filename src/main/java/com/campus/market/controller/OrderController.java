package com.campus.market.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.campus.market.common.ApiResponse;
import com.campus.market.common.PageResult;
import com.campus.market.dto.CreateOrderRequest;
import com.campus.market.dto.OrderVO;
import com.campus.market.dto.ReasonRequest;
import com.campus.market.entity.OrderStatus;
import com.campus.market.entity.User;
import com.campus.market.security.UserContext;
import com.campus.market.service.OrderService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping
    public ApiResponse<OrderVO> create(@Valid @RequestBody CreateOrderRequest request) {
        return ApiResponse.ok(orderService.create(UserContext.require(), request));
    }

    /**
     * 订单列表。role=buyer 查询我买到的，role=seller 查询我卖出的。
     */
    @GetMapping
    public ApiResponse<PageResult<OrderVO>> list(@RequestParam(defaultValue = "buyer") String role,
                                                 @RequestParam(required = false) OrderStatus status,
                                                 @RequestParam(defaultValue = "1") int page,
                                                 @RequestParam(defaultValue = "10") int size) {
        User user = UserContext.require();
        int limited = Pages.limit(size);
        return ApiResponse.ok("seller".equals(role)
                ? orderService.listAsSeller(user, status, page, limited)
                : orderService.listAsBuyer(user, status, page, limited));
    }

    @GetMapping("/{id}")
    public ApiResponse<OrderVO> detail(@PathVariable Long id) {
        return ApiResponse.ok(orderService.detail(UserContext.require(), id));
    }

    @PostMapping("/{id}/confirm")
    public ApiResponse<OrderVO> confirm(@PathVariable Long id) {
        return ApiResponse.ok(orderService.confirm(UserContext.require(), id));
    }

    @PostMapping("/{id}/complete")
    public ApiResponse<OrderVO> complete(@PathVariable Long id) {
        return ApiResponse.ok(orderService.complete(UserContext.require(), id));
    }

    @PostMapping("/{id}/cancel")
    public ApiResponse<OrderVO> cancel(@PathVariable Long id,
                                       @Valid @RequestBody(required = false) ReasonRequest request) {
        return ApiResponse.ok(orderService.cancel(UserContext.require(), id, request == null ? null : request.reason()));
    }
}

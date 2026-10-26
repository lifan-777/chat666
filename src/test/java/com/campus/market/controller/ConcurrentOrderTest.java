package com.campus.market.controller;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.RepeatedTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

import com.campus.market.common.BusinessException;
import com.campus.market.dto.CreateOrderRequest;
import com.campus.market.entity.ConditionLevel;
import com.campus.market.entity.Goods;
import com.campus.market.entity.GoodsStatus;
import com.campus.market.entity.OrderStatus;
import com.campus.market.entity.Role;
import com.campus.market.entity.User;
import com.campus.market.entity.UserStatus;
import com.campus.market.repository.GoodsRepository;
import com.campus.market.repository.TradeOrderRepository;
import com.campus.market.service.OrderService;

@DisplayName("并发下单（防超卖）测试")
class ConcurrentOrderTest extends ApiTestSupport {

    private static final int BUYERS = 10;

    @Autowired
    private OrderService orderService;
    @Autowired
    private GoodsRepository goodsRepository;
    @Autowired
    private TradeOrderRepository orderRepository;

    private User newUser(String prefix) {
        User u = new User();
        u.setUsername(unique(prefix));
        u.setPassword("x");
        u.setNickname(prefix);
        u.setRole(Role.USER);
        u.setStatus(UserStatus.NORMAL);
        return userRepository.save(u);
    }

    @RepeatedTest(value = 5, name = "第 {currentRepetition}/{totalRepetitions} 轮")
    @DisplayName("10 个买家同时抢购同一件商品，只有 1 人下单成功，其余返回 409（重复 5 轮）")
    void onlyOneBuyerWins() throws Exception {
        User seller = newUser("cseller");
        Goods goods = new Goods();
        goods.setTitle("抢购测试商品");
        goods.setDescription("并发测试");
        goods.setPrice(new BigDecimal("1.00"));
        goods.setCategory(categoryRepository.findById(createCategory()).orElseThrow());
        goods.setConditionLevel(ConditionLevel.NEW);
        goods.setTradeLocation("操场");
        goods.setImages(new ArrayList<>(List.of("/demo-images/ipad.jpg")));
        goods.setSeller(seller);
        goods.setStatus(GoodsStatus.ON_SALE);
        Long goodsId = goodsRepository.save(goods).getId();

        List<User> buyers = new ArrayList<>();
        for (int i = 0; i < BUYERS; i++) {
            buyers.add(newUser("cbuyer"));
        }

        ExecutorService pool = Executors.newFixedThreadPool(BUYERS);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<HttpStatus>> results = new ArrayList<>();
        for (User buyer : buyers) {
            results.add(pool.submit(() -> {
                start.await();
                try {
                    orderService.create(buyer, new CreateOrderRequest(goodsId, null));
                    return HttpStatus.OK;
                } catch (BusinessException e) {
                    return e.getStatus();
                }
            }));
        }
        start.countDown();

        int success = 0;
        int conflict = 0;
        for (Future<HttpStatus> f : results) {
            HttpStatus status = f.get();
            if (status == HttpStatus.OK) {
                success++;
            } else if (status == HttpStatus.CONFLICT) {
                conflict++;
            }
        }
        pool.shutdown();

        assertThat(success).isEqualTo(1);
        assertThat(conflict).isEqualTo(BUYERS - 1);
        assertThat(goodsRepository.findById(goodsId).orElseThrow().getStatus()).isEqualTo(GoodsStatus.RESERVED);
        long activeOrders = orderRepository.findAll().stream()
                .filter(o -> o.getGoods().getId().equals(goodsId) && o.getStatus() != OrderStatus.CANCELLED)
                .count();
        assertThat(activeOrders).isEqualTo(1);
    }
}

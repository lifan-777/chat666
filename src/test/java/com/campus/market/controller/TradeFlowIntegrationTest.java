package com.campus.market.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;

@DisplayName("交易全流程集成测试")
class TradeFlowIntegrationTest extends ApiTestSupport {

    private String sellerToken;
    private String buyerToken;
    private String adminToken;
    private Long categoryId;

    @BeforeEach
    void setUp() throws Exception {
        sellerToken = registerAndLogin(unique("seller"));
        buyerToken = registerAndLogin(unique("buyer"));
        adminToken = adminToken();
        categoryId = createCategory();
    }

    private boolean searchContains(String keyword, Long goodsId) throws Exception {
        JsonNode records = read(getWith("/api/goods?keyword=" + keyword + "&categoryId=" + categoryId, null)
                .andExpect(status().isOk())).at("/data/records");
        for (JsonNode node : records) {
            if (node.get("id").asLong() == goodsId) {
                return true;
            }
        }
        return false;
    }

    private void audit(Long goodsId) throws Exception {
        postJson("/api/admin/goods/" + goodsId + "/audit", Map.of("approved", true), adminToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ON_SALE"));
    }

    private BigDecimal turnover() throws Exception {
        return new BigDecimal(read(getWith("/api/admin/stats", adminToken)).at("/data/turnover").asText());
    }

    @Test
    @DisplayName("发布 → 审核 → 搜索 → 下单 → 卖家确认 → 买家确认收货，商品售出且成交额增加")
    void fullTradeFlow() throws Exception {
        String title = unique("全流程台灯");
        BigDecimal before = turnover();

        // 1. 卖家发布商品，进入待审核，首页搜不到
        Long goodsId = publish(sellerToken, categoryId, title, "88.50");
        getWith("/api/goods/" + goodsId, sellerToken).andExpect(jsonPath("$.data.status").value("PENDING"));
        assertThat(searchContains(title, goodsId)).isFalse();
        getWith("/api/goods/" + goodsId, buyerToken).andExpect(status().isNotFound());

        // 2. 管理员审核通过后，首页可以搜到
        audit(goodsId);
        assertThat(searchContains(title, goodsId)).isTrue();

        // 3. 买家收藏并留言
        mockMvc.perform(auth(post("/api/favorites/" + goodsId), buyerToken)).andExpect(status().isOk());
        postJson("/api/goods/" + goodsId + "/comments", Map.of("content", "还在吗？"), buyerToken).andExpect(status().isOk());
        getWith("/api/goods/" + goodsId, buyerToken)
                .andExpect(jsonPath("$.data.favorited").value(true))
                .andExpect(jsonPath("$.data.favoriteCount").value(1));
        getWith("/api/goods/" + goodsId + "/comments", null).andExpect(jsonPath("$.data.length()").value(1));

        // 4. 买家下单，商品变为交易中，搜索不可见
        JsonNode order = read(postJson("/api/orders", Map.of("goodsId", goodsId, "remark", "明天中午"), buyerToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.price").value(88.5)));
        Long orderId = order.at("/data/id").asLong();
        getWith("/api/goods/" + goodsId, null).andExpect(jsonPath("$.data.status").value("RESERVED"));
        assertThat(searchContains(title, goodsId)).isFalse();

        // 卖家在“我卖出的”中能看到订单和买家联系方式
        getWith("/api/orders?role=seller", sellerToken)
                .andExpect(jsonPath("$.data.records[0].id").value(orderId))
                .andExpect(jsonPath("$.data.records[0].buyer.phone").value("13900000000"));

        // 5. 买家不能替卖家确认；卖家确认订单
        postJson("/api/orders/" + orderId + "/confirm", Map.of(), buyerToken).andExpect(status().isForbidden());
        postJson("/api/orders/" + orderId + "/confirm", Map.of(), sellerToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CONFIRMED"));

        // 6. 买家确认收货，交易完成
        postJson("/api/orders/" + orderId + "/complete", Map.of(), buyerToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"))
                .andExpect(jsonPath("$.data.completedAt").isNotEmpty());

        getWith("/api/goods/" + goodsId, null).andExpect(jsonPath("$.data.status").value("SOLD"));
        getWith("/api/orders?role=buyer&status=COMPLETED", buyerToken)
                .andExpect(jsonPath("$.data.records[0].id").value(orderId));
        assertThat(turnover().subtract(before)).isEqualByComparingTo("88.50");

        // 已完成的订单不能再取消
        postJson("/api/orders/" + orderId + "/cancel", Map.of("reason", "反悔"), buyerToken)
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("取消订单后商品恢复在售，可以被其他同学再次购买")
    void cancelRestoresOnSale() throws Exception {
        String title = unique("取消测试");
        Long goodsId = publish(sellerToken, categoryId, title, "20");
        audit(goodsId);

        Long orderId = read(postJson("/api/orders", Map.of("goodsId", goodsId), buyerToken)
                .andExpect(status().isOk())).at("/data/id").asLong();
        // 同一商品不能重复下单
        postJson("/api/orders", Map.of("goodsId", goodsId), registerAndLogin(unique("late"))).andExpect(status().isConflict());

        postJson("/api/orders/" + orderId + "/cancel", Map.of("reason", "时间约不上"), sellerToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CANCELLED"))
                .andExpect(jsonPath("$.data.cancelReason").value("卖家取消：时间约不上"));

        getWith("/api/goods/" + goodsId, null).andExpect(jsonPath("$.data.status").value("ON_SALE"));
        assertThat(searchContains(title, goodsId)).isTrue();
        postJson("/api/orders", Map.of("goodsId", goodsId), registerAndLogin(unique("again"))).andExpect(status().isOk());
    }

    @Test
    @DisplayName("卖家不能购买自己的商品，也不能收藏自己的商品")
    void sellerCannotBuyOwnGoods() throws Exception {
        Long goodsId = publish(sellerToken, categoryId, unique("自购"), "10");
        audit(goodsId);

        postJson("/api/orders", Map.of("goodsId", goodsId), sellerToken)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("不能购买自己发布的商品"));
        mockMvc.perform(auth(post("/api/favorites/" + goodsId), sellerToken)).andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("被驳回的商品修改后重新进入待审核；下架后可重新上架")
    void rejectEditAndShelf() throws Exception {
        Long goodsId = publish(sellerToken, categoryId, unique("驳回"), "30");
        postJson("/api/admin/goods/" + goodsId + "/audit", Map.of("approved", false), adminToken)
                .andExpect(status().isBadRequest());
        postJson("/api/admin/goods/" + goodsId + "/audit", Map.of("approved", false, "reason", "图片不清晰"), adminToken)
                .andExpect(jsonPath("$.data.status").value("REJECTED"));
        getWith("/api/goods/mine?status=REJECTED", sellerToken)
                .andExpect(jsonPath("$.data.records[0].rejectReason").value("图片不清晰"));

        mockMvc.perform(auth(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/goods/" + goodsId)
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content(json(goodsBody(categoryId, "重新上传实拍图", "28"))), sellerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.rejectReason").isEmpty());

        postJson("/api/goods/" + goodsId + "/off-shelf", Map.of(), sellerToken).andExpect(jsonPath("$.data.status").value("OFF_SHELF"));
        postJson("/api/goods/" + goodsId + "/on-shelf", Map.of(), sellerToken).andExpect(jsonPath("$.data.status").value("PENDING"));
        // 其他用户不能操作
        postJson("/api/goods/" + goodsId + "/off-shelf", Map.of(), buyerToken).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("留言删除权限：他人不能删除，作者可以删除；取消收藏")
    void commentAndFavorite() throws Exception {
        Long goodsId = publish(sellerToken, categoryId, unique("留言"), "15");
        audit(goodsId);
        Long commentId = read(postJson("/api/goods/" + goodsId + "/comments", Map.of("content", "能便宜点吗"), buyerToken))
                .at("/data/id").asLong();

        mockMvc.perform(auth(delete("/api/comments/" + commentId), registerAndLogin(unique("other"))))
                .andExpect(status().isForbidden());
        mockMvc.perform(auth(delete("/api/comments/" + commentId), buyerToken)).andExpect(status().isOk());

        mockMvc.perform(auth(post("/api/favorites/" + goodsId), buyerToken)).andExpect(status().isOk());
        getWith("/api/favorites", buyerToken).andExpect(jsonPath("$.data.total").value(1));
        mockMvc.perform(auth(delete("/api/favorites/" + goodsId), buyerToken)).andExpect(status().isOk());
        getWith("/api/favorites", buyerToken).andExpect(jsonPath("$.data.total").value(0));
    }

    @Test
    @DisplayName("商品搜索：按价格区间筛选并按价格升序排序")
    void searchByPrice() throws Exception {
        String keyword = unique("价格");
        for (String price : new String[]{"50", "10", "30", "80"}) {
            audit(publish(sellerToken, categoryId, keyword + price, price));
        }

        getWith("/api/goods?keyword=" + keyword + "&minPrice=20&maxPrice=60&sort=price_asc", null)
                .andExpect(jsonPath("$.data.total").value(2))
                .andExpect(jsonPath("$.data.records[0].price").value(30))
                .andExpect(jsonPath("$.data.records[1].price").value(50));
    }

    @Test
    @DisplayName("发布商品参数校验：价格为负、缺少图片时返回 400")
    void publishValidation() throws Exception {
        postJson("/api/goods", Map.of("title", "x", "description", "y", "price", "-1", "categoryId", categoryId,
                        "conditionLevel", "NEW", "tradeLocation", "z", "images", java.util.List.of()), sellerToken)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("价格必须大于 0")))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("请至少上传一张图片")));
    }
}

package com.campus.market;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import com.campus.market.entity.Category;
import com.campus.market.entity.ConditionLevel;
import com.campus.market.entity.Goods;
import com.campus.market.entity.GoodsStatus;
import com.campus.market.entity.OrderStatus;
import com.campus.market.entity.Role;
import com.campus.market.entity.TradeOrder;
import com.campus.market.entity.User;
import com.campus.market.entity.UserStatus;
import com.campus.market.dto.GoodsRequest;

/**
 * 单元测试使用的实体构造工具。
 */
public final class TestFixtures {

    private TestFixtures() {
    }

    public static User user(long id, String username) {
        User u = new User();
        u.setId(id);
        u.setUsername(username);
        u.setNickname(username);
        u.setPassword("encoded");
        u.setPhone("1380000000" + (id % 10));
        u.setRole(Role.USER);
        u.setStatus(UserStatus.NORMAL);
        return u;
    }

    public static User admin(long id) {
        User u = user(id, "admin" + id);
        u.setRole(Role.ADMIN);
        return u;
    }

    public static Category category(long id, String name) {
        Category c = new Category();
        c.setId(id);
        c.setName(name);
        c.setIcon("Goods");
        c.setSortOrder(1);
        return c;
    }

    public static Goods goods(long id, User seller, GoodsStatus status) {
        Goods g = new Goods();
        g.setId(id);
        g.setTitle("测试商品" + id);
        g.setDescription("描述");
        g.setPrice(new BigDecimal("99.00"));
        g.setOriginalPrice(new BigDecimal("199.00"));
        g.setCategory(category(1, "数码电子"));
        g.setConditionLevel(ConditionLevel.LIKE_NEW);
        g.setTradeLocation("图书馆");
        g.setImages(new ArrayList<>(List.of("/uploads/a.jpg", "/uploads/b.jpg")));
        g.setSeller(seller);
        g.setStatus(status);
        g.setViewCount(10);
        return g;
    }

    public static TradeOrder order(long id, Goods goods, User buyer, OrderStatus status) {
        TradeOrder o = new TradeOrder();
        o.setId(id);
        o.setOrderNo("NO" + id);
        o.setGoods(goods);
        o.setBuyer(buyer);
        o.setSeller(goods.getSeller());
        o.setGoodsTitle(goods.getTitle());
        o.setGoodsImage(goods.getImages().get(0));
        o.setPrice(goods.getPrice());
        o.setStatus(status);
        return o;
    }

    public static GoodsRequest goodsRequest(long categoryId) {
        return new GoodsRequest("二手台灯", "九成新，宿舍可用", new BigDecimal("35.50"), new BigDecimal("99"),
                categoryId, ConditionLevel.LIGHTLY_USED, "东区宿舍楼下", List.of("/uploads/lamp.jpg"));
    }
}

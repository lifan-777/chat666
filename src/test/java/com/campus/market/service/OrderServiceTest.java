package com.campus.market.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import com.campus.market.TestFixtures;
import com.campus.market.common.BusinessException;
import com.campus.market.dto.CreateOrderRequest;
import com.campus.market.dto.OrderVO;
import com.campus.market.entity.Goods;
import com.campus.market.entity.GoodsStatus;
import com.campus.market.entity.OrderStatus;
import com.campus.market.entity.TradeOrder;
import com.campus.market.entity.User;
import com.campus.market.repository.GoodsRepository;
import com.campus.market.repository.TradeOrderRepository;

@ExtendWith(MockitoExtension.class)
@DisplayName("订单服务 OrderService 单元测试")
class OrderServiceTest {

    @Mock
    private TradeOrderRepository orderRepository;
    @Mock
    private GoodsRepository goodsRepository;
    @Mock
    private GoodsService goodsService;
    @InjectMocks
    private OrderService orderService;

    private User seller;
    private User buyer;
    private User stranger;
    private Goods goods;

    @BeforeEach
    void setUp() {
        seller = TestFixtures.user(1, "seller");
        buyer = TestFixtures.user(2, "buyer");
        stranger = TestFixtures.user(3, "stranger");
        goods = TestFixtures.goods(10, seller, GoodsStatus.ON_SALE);
    }

    private TradeOrder stubOrder(OrderStatus status) {
        goods.setStatus(GoodsStatus.RESERVED);
        TradeOrder order = TestFixtures.order(100, goods, buyer, status);
        when(orderRepository.findById(100L)).thenReturn(Optional.of(order));
        return order;
    }

    @Test
    @DisplayName("下单成功：商品被锁定为交易中，订单保存标题、图片、价格快照")
    void createOrderSuccess() {
        when(goodsService.getEntity(10L)).thenReturn(goods);
        when(goodsRepository.compareAndSetStatus(10L, GoodsStatus.ON_SALE, GoodsStatus.RESERVED)).thenReturn(1);
        when(orderRepository.save(any(TradeOrder.class))).thenAnswer(inv -> inv.getArgument(0));

        OrderVO vo = orderService.create(buyer, new CreateOrderRequest(10L, "  今晚七点  "));

        ArgumentCaptor<TradeOrder> captor = ArgumentCaptor.forClass(TradeOrder.class);
        verify(orderRepository).save(captor.capture());
        TradeOrder saved = captor.getValue();
        assertThat(saved.getStatus()).isEqualTo(OrderStatus.PENDING);
        assertThat(saved.getGoodsTitle()).isEqualTo(goods.getTitle());
        assertThat(saved.getGoodsImage()).isEqualTo("/uploads/a.jpg");
        assertThat(saved.getPrice()).isEqualByComparingTo(new BigDecimal("99.00"));
        assertThat(saved.getBuyer()).isSameAs(buyer);
        assertThat(saved.getSeller()).isSameAs(seller);
        assertThat(saved.getBuyerRemark()).isEqualTo("今晚七点");
        assertThat(saved.getOrderNo()).hasSize(20).containsOnlyDigits();
        assertThat(vo.statusText()).isEqualTo("待卖家确认");
    }

    @Test
    @DisplayName("不能购买自己发布的商品")
    void cannotBuyOwnGoods() {
        when(goodsService.getEntity(10L)).thenReturn(goods);

        assertThatThrownBy(() -> orderService.create(seller, new CreateOrderRequest(10L, null)))
                .isInstanceOf(BusinessException.class)
                .hasMessage("不能购买自己发布的商品");
        verify(goodsRepository, never()).compareAndSetStatus(anyLong(), any(), any());
    }

    @Test
    @DisplayName("商品不是在售状态时下单失败（409）")
    void cannotBuyNotOnSale() {
        goods.setStatus(GoodsStatus.SOLD);
        when(goodsService.getEntity(10L)).thenReturn(goods);

        assertThatThrownBy(() -> orderService.create(buyer, new CreateOrderRequest(10L, null)))
                .isInstanceOf(BusinessException.class)
                .hasMessage("商品当前不可购买")
                .extracting("status").isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    @DisplayName("并发下单：条件更新影响 0 行时提示已被他人下单（409），不生成订单")
    void createOrderLostRace() {
        when(goodsService.getEntity(10L)).thenReturn(goods);
        when(goodsRepository.compareAndSetStatus(10L, GoodsStatus.ON_SALE, GoodsStatus.RESERVED)).thenReturn(0);

        assertThatThrownBy(() -> orderService.create(buyer, new CreateOrderRequest(10L, null)))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("已被其他同学下单")
                .extracting("status").isEqualTo(HttpStatus.CONFLICT);
        verify(orderRepository, never()).save(any());
    }

    @Test
    @DisplayName("卖家确认订单：待卖家确认 → 待交易")
    void sellerConfirm() {
        TradeOrder order = stubOrder(OrderStatus.PENDING);

        OrderVO vo = orderService.confirm(seller, 100L);

        assertThat(vo.status()).isEqualTo(OrderStatus.CONFIRMED);
        assertThat(order.getConfirmedAt()).isNotNull();
    }

    @Test
    @DisplayName("只有卖家可以确认订单（买家确认返回 403）")
    void onlySellerCanConfirm() {
        stubOrder(OrderStatus.PENDING);

        assertThatThrownBy(() -> orderService.confirm(buyer, 100L))
                .isInstanceOf(BusinessException.class)
                .extracting("status").isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    @DisplayName("已确认的订单不能重复确认")
    void cannotConfirmTwice() {
        stubOrder(OrderStatus.CONFIRMED);

        assertThatThrownBy(() -> orderService.confirm(seller, 100L))
                .isInstanceOf(BusinessException.class)
                .hasMessage("当前订单状态不能确认");
    }

    @Test
    @DisplayName("买家确认收货：订单完成，商品变为已售出")
    void buyerComplete() {
        TradeOrder order = stubOrder(OrderStatus.CONFIRMED);

        OrderVO vo = orderService.complete(buyer, 100L);

        assertThat(vo.status()).isEqualTo(OrderStatus.COMPLETED);
        assertThat(order.getCompletedAt()).isNotNull();
        verify(goodsRepository).compareAndSetStatus(10L, GoodsStatus.RESERVED, GoodsStatus.SOLD);
    }

    @Test
    @DisplayName("只有买家可以确认收货（卖家操作返回 403）")
    void onlyBuyerCanComplete() {
        stubOrder(OrderStatus.CONFIRMED);

        assertThatThrownBy(() -> orderService.complete(seller, 100L))
                .isInstanceOf(BusinessException.class)
                .extracting("status").isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    @DisplayName("卖家确认前买家不能确认收货")
    void completeRequiresConfirmed() {
        stubOrder(OrderStatus.PENDING);

        assertThatThrownBy(() -> orderService.complete(buyer, 100L))
                .isInstanceOf(BusinessException.class)
                .hasMessage("卖家确认订单后才能确认收货");
        verify(goodsRepository, never()).compareAndSetStatus(anyLong(), any(), any());
    }

    @Test
    @DisplayName("买家取消订单：记录原因，商品恢复在售")
    void buyerCancel() {
        TradeOrder order = stubOrder(OrderStatus.PENDING);

        OrderVO vo = orderService.cancel(buyer, 100L, "不需要了");

        assertThat(vo.status()).isEqualTo(OrderStatus.CANCELLED);
        assertThat(order.getCancelReason()).isEqualTo("买家取消：不需要了");
        assertThat(order.getCancelledAt()).isNotNull();
        verify(goodsRepository).compareAndSetStatus(10L, GoodsStatus.RESERVED, GoodsStatus.ON_SALE);
    }

    @Test
    @DisplayName("卖家取消已确认的订单，未填原因时只记录取消方")
    void sellerCancelWithoutReason() {
        TradeOrder order = stubOrder(OrderStatus.CONFIRMED);

        orderService.cancel(seller, 100L, null);

        assertThat(order.getCancelReason()).isEqualTo("卖家取消");
        verify(goodsRepository).compareAndSetStatus(10L, GoodsStatus.RESERVED, GoodsStatus.ON_SALE);
    }

    @Test
    @DisplayName("已完成的订单不能取消")
    void cannotCancelCompleted() {
        stubOrder(OrderStatus.COMPLETED);

        assertThatThrownBy(() -> orderService.cancel(buyer, 100L, "反悔"))
                .isInstanceOf(BusinessException.class)
                .hasMessage("订单已完成或已取消");
        verify(goodsRepository, never()).compareAndSetStatus(anyLong(), any(), any());
    }

    @Test
    @DisplayName("与订单无关的用户不能取消或查看订单（403）")
    void strangerForbidden() {
        stubOrder(OrderStatus.PENDING);

        assertThatThrownBy(() -> orderService.cancel(stranger, 100L, null))
                .isInstanceOf(BusinessException.class)
                .extracting("status").isEqualTo(HttpStatus.FORBIDDEN);
        assertThatThrownBy(() -> orderService.detail(stranger, 100L))
                .isInstanceOf(BusinessException.class)
                .extracting("status").isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    @DisplayName("管理员和交易双方可以查看订单详情")
    void detailVisibleForParticipantsAndAdmin() {
        stubOrder(OrderStatus.PENDING);

        assertThat(orderService.detail(buyer, 100L).buyer().phone()).isEqualTo(buyer.getPhone());
        assertThat(orderService.detail(seller, 100L).id()).isEqualTo(100L);
        assertThat(orderService.detail(TestFixtures.admin(9), 100L).id()).isEqualTo(100L);
    }

    @Test
    @DisplayName("订单不存在返回 404")
    void orderNotFound() {
        when(orderRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> orderService.confirm(seller, 404L))
                .isInstanceOf(BusinessException.class)
                .extracting("status").isEqualTo(HttpStatus.NOT_FOUND);
    }
}

package com.campus.market.service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.ThreadLocalRandom;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.campus.market.common.BusinessException;
import com.campus.market.common.PageResult;
import com.campus.market.dto.CreateOrderRequest;
import com.campus.market.dto.OrderVO;
import com.campus.market.entity.Goods;
import com.campus.market.entity.GoodsStatus;
import com.campus.market.entity.OrderStatus;
import com.campus.market.entity.TradeOrder;
import com.campus.market.entity.User;
import com.campus.market.repository.GoodsRepository;
import com.campus.market.repository.TradeOrderRepository;

/**
 * 订单流程：买家下单 → 卖家确认 → 线下交易 → 买家确认收货；
 * 完成前买卖双方都可以取消，取消后商品自动恢复在售。
 */
@Service
@Transactional
public class OrderService {

    private static final DateTimeFormatter ORDER_NO_TIME = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final TradeOrderRepository orderRepository;
    private final GoodsRepository goodsRepository;
    private final GoodsService goodsService;

    public OrderService(TradeOrderRepository orderRepository, GoodsRepository goodsRepository,
                        GoodsService goodsService) {
        this.orderRepository = orderRepository;
        this.goodsRepository = goodsRepository;
        this.goodsService = goodsService;
    }

    public OrderVO create(User buyer, CreateOrderRequest request) {
        Goods goods = goodsService.getEntity(request.goodsId());
        if (goods.getSeller().getId().equals(buyer.getId())) {
            throw BusinessException.badRequest("不能购买自己发布的商品");
        }
        if (goods.getStatus() != GoodsStatus.ON_SALE) {
            throw BusinessException.conflict("商品当前不可购买");
        }
        // 条件更新保证同一商品只会被一个买家锁定，防止“超卖”
        if (goodsRepository.compareAndSetStatus(goods.getId(), GoodsStatus.ON_SALE, GoodsStatus.RESERVED) == 0) {
            throw BusinessException.conflict("手慢了，商品已被其他同学下单");
        }
        TradeOrder order = new TradeOrder();
        order.setOrderNo(generateOrderNo());
        order.setGoods(goods);
        order.setBuyer(buyer);
        order.setSeller(goods.getSeller());
        order.setGoodsTitle(goods.getTitle());
        order.setGoodsImage(goods.getImages().isEmpty() ? null : goods.getImages().get(0));
        order.setPrice(goods.getPrice());
        order.setStatus(OrderStatus.PENDING);
        order.setBuyerRemark(StringUtils.hasText(request.remark()) ? request.remark().trim() : null);
        return OrderVO.from(orderRepository.save(order));
    }

    /** 卖家确认订单，双方约定线下交易 */
    public OrderVO confirm(User seller, Long orderId) {
        TradeOrder order = getEntity(orderId);
        if (!order.getSeller().getId().equals(seller.getId())) {
            throw BusinessException.forbidden("只有卖家可以确认订单");
        }
        if (order.getStatus() != OrderStatus.PENDING) {
            throw BusinessException.badRequest("当前订单状态不能确认");
        }
        order.setStatus(OrderStatus.CONFIRMED);
        order.setConfirmedAt(LocalDateTime.now());
        return OrderVO.from(order);
    }

    /** 买家确认收货，交易完成，商品变为已售出 */
    public OrderVO complete(User buyer, Long orderId) {
        TradeOrder order = getEntity(orderId);
        if (!order.getBuyer().getId().equals(buyer.getId())) {
            throw BusinessException.forbidden("只有买家可以确认收货");
        }
        if (order.getStatus() != OrderStatus.CONFIRMED) {
            throw BusinessException.badRequest("卖家确认订单后才能确认收货");
        }
        order.setStatus(OrderStatus.COMPLETED);
        order.setCompletedAt(LocalDateTime.now());
        orderRepository.save(order);
        goodsRepository.compareAndSetStatus(order.getGoods().getId(), GoodsStatus.RESERVED, GoodsStatus.SOLD);
        return OrderVO.from(order);
    }

    /** 买家或卖家取消订单，商品恢复在售 */
    public OrderVO cancel(User user, Long orderId, String reason) {
        TradeOrder order = getEntity(orderId);
        boolean isBuyer = order.getBuyer().getId().equals(user.getId());
        boolean isSeller = order.getSeller().getId().equals(user.getId());
        if (!isBuyer && !isSeller) {
            throw BusinessException.forbidden("无权操作该订单");
        }
        if (order.getStatus() != OrderStatus.PENDING && order.getStatus() != OrderStatus.CONFIRMED) {
            throw BusinessException.badRequest("订单已完成或已取消");
        }
        String who = isBuyer ? "买家取消" : "卖家取消";
        order.setStatus(OrderStatus.CANCELLED);
        order.setCancelReason(StringUtils.hasText(reason) ? who + "：" + reason.trim() : who);
        order.setCancelledAt(LocalDateTime.now());
        orderRepository.save(order);
        goodsRepository.compareAndSetStatus(order.getGoods().getId(), GoodsStatus.RESERVED, GoodsStatus.ON_SALE);
        return OrderVO.from(order);
    }

    @Transactional(readOnly = true)
    public OrderVO detail(User user, Long orderId) {
        TradeOrder order = getEntity(orderId);
        boolean related = order.getBuyer().getId().equals(user.getId())
                || order.getSeller().getId().equals(user.getId());
        if (!related && !user.isAdmin()) {
            throw BusinessException.forbidden("无权查看该订单");
        }
        return OrderVO.from(order);
    }

    /** 我买到的 */
    @Transactional(readOnly = true)
    public PageResult<OrderVO> listAsBuyer(User buyer, OrderStatus status, int page, int size) {
        PageRequest pageable = pageable(page, size);
        return PageResult.of(status == null
                ? orderRepository.findByBuyerId(buyer.getId(), pageable)
                : orderRepository.findByBuyerIdAndStatus(buyer.getId(), status, pageable), OrderVO::from);
    }

    /** 我卖出的 */
    @Transactional(readOnly = true)
    public PageResult<OrderVO> listAsSeller(User seller, OrderStatus status, int page, int size) {
        PageRequest pageable = pageable(page, size);
        return PageResult.of(status == null
                ? orderRepository.findBySellerId(seller.getId(), pageable)
                : orderRepository.findBySellerIdAndStatus(seller.getId(), status, pageable), OrderVO::from);
    }

    private TradeOrder getEntity(Long orderId) {
        return orderRepository.findById(orderId)
                .orElseThrow(() -> BusinessException.notFound("订单不存在"));
    }

    private static PageRequest pageable(int page, int size) {
        return PageRequest.of(Math.max(page, 1) - 1, size, Sort.by(Sort.Direction.DESC, "createdAt"));
    }

    private static String generateOrderNo() {
        return LocalDateTime.now().format(ORDER_NO_TIME) + ThreadLocalRandom.current().nextInt(100000, 1000000);
    }
}

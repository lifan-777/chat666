package com.campus.market.service;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.campus.market.common.BusinessException;
import com.campus.market.common.PageResult;
import com.campus.market.dto.AuditRequest;
import com.campus.market.dto.GoodsQuery;
import com.campus.market.dto.GoodsRequest;
import com.campus.market.dto.GoodsVO;
import com.campus.market.entity.Goods;
import com.campus.market.entity.GoodsStatus;
import com.campus.market.entity.User;
import com.campus.market.repository.FavoriteRepository;
import com.campus.market.repository.GoodsRepository;

import jakarta.persistence.criteria.Predicate;

/**
 * 商品发布、编辑、上下架、搜索与审核。
 */
@Service
@Transactional
public class GoodsService {

    /** 所有人可见的商品状态；其余状态只有卖家本人和管理员可见 */
    private static final Set<GoodsStatus> PUBLIC_STATUSES =
            EnumSet.of(GoodsStatus.ON_SALE, GoodsStatus.RESERVED, GoodsStatus.SOLD);
    /** 卖家可以编辑的状态 */
    private static final Set<GoodsStatus> EDITABLE_STATUSES =
            EnumSet.of(GoodsStatus.PENDING, GoodsStatus.ON_SALE, GoodsStatus.REJECTED, GoodsStatus.OFF_SHELF);
    /** 卖家可以主动下架的状态 */
    private static final Set<GoodsStatus> OFF_SHELF_STATUSES =
            EnumSet.of(GoodsStatus.PENDING, GoodsStatus.ON_SALE, GoodsStatus.REJECTED);

    private final GoodsRepository goodsRepository;
    private final FavoriteRepository favoriteRepository;
    private final CategoryService categoryService;

    public GoodsService(GoodsRepository goodsRepository, FavoriteRepository favoriteRepository,
                        CategoryService categoryService) {
        this.goodsRepository = goodsRepository;
        this.favoriteRepository = favoriteRepository;
        this.categoryService = categoryService;
    }

    /** 发布商品，新商品进入“待审核”状态 */
    public GoodsVO publish(User seller, GoodsRequest request) {
        Goods goods = new Goods();
        goods.setSeller(seller);
        apply(goods, request);
        goods.setStatus(GoodsStatus.PENDING);
        return GoodsVO.from(goodsRepository.save(goods));
    }

    /** 编辑商品，编辑后需要重新审核 */
    public GoodsVO update(User user, Long goodsId, GoodsRequest request) {
        Goods goods = getOwnedGoods(user, goodsId);
        if (!EDITABLE_STATUSES.contains(goods.getStatus())) {
            throw BusinessException.badRequest("交易中或已售出的商品不能编辑");
        }
        apply(goods, request);
        goods.setStatus(GoodsStatus.PENDING);
        goods.setRejectReason(null);
        return GoodsVO.from(goods);
    }

    /** 卖家主动下架 */
    public GoodsVO offShelf(User user, Long goodsId) {
        Goods goods = getOwnedGoods(user, goodsId);
        if (!OFF_SHELF_STATUSES.contains(goods.getStatus())) {
            throw BusinessException.badRequest("当前状态的商品不能下架");
        }
        goods.setStatus(GoodsStatus.OFF_SHELF);
        return GoodsVO.from(goods);
    }

    /** 卖家重新上架，需要重新审核 */
    public GoodsVO reShelf(User user, Long goodsId) {
        Goods goods = getOwnedGoods(user, goodsId);
        if (goods.getStatus() != GoodsStatus.OFF_SHELF) {
            throw BusinessException.badRequest("只有已下架的商品可以重新上架");
        }
        goods.setStatus(GoodsStatus.PENDING);
        goods.setRejectReason(null);
        return GoodsVO.from(goods);
    }

    /** 首页搜索：只返回在售商品 */
    @Transactional(readOnly = true)
    public PageResult<GoodsVO> search(GoodsQuery query) {
        Specification<Goods> spec = (root, cq, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("status"), GoodsStatus.ON_SALE));
            if (StringUtils.hasText(query.keyword())) {
                String like = "%" + query.keyword().trim().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("title")), like),
                        cb.like(cb.lower(root.get("description")), like)));
            }
            if (query.categoryId() != null) {
                predicates.add(cb.equal(root.get("category").get("id"), query.categoryId()));
            }
            if (query.minPrice() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("price"), query.minPrice()));
            }
            if (query.maxPrice() != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("price"), query.maxPrice()));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
        PageRequest pageable = PageRequest.of(query.pageOrDefault() - 1, query.sizeOrDefault(), toSort(query.sort()));
        return PageResult.of(goodsRepository.findAll(spec, pageable), GoodsVO::from);
    }

    /**
     * 商品详情。非公开状态（待审核、驳回、下架）的商品只有卖家本人和管理员可以查看；
     * 他人浏览时浏览量 +1。
     */
    public GoodsVO detail(Long goodsId, User viewer) {
        Goods goods = getEntity(goodsId);
        boolean isOwner = viewer != null && goods.getSeller().getId().equals(viewer.getId());
        boolean isAdmin = viewer != null && viewer.isAdmin();
        if (!PUBLIC_STATUSES.contains(goods.getStatus()) && !isOwner && !isAdmin) {
            throw BusinessException.notFound("商品不存在或已下架");
        }
        int viewCount = goods.getViewCount();
        if (!isOwner) {
            goodsRepository.increaseViewCount(goodsId);
            viewCount++;
        }
        boolean favorited = viewer != null && favoriteRepository.existsByUserIdAndGoodsId(viewer.getId(), goodsId);
        return GoodsVO.of(goods, viewCount, favorited, favoriteRepository.countByGoodsId(goodsId));
    }

    /** 我发布的商品 */
    @Transactional(readOnly = true)
    public PageResult<GoodsVO> listBySeller(Long sellerId, GoodsStatus status, int page, int size) {
        PageRequest pageable = PageRequest.of(Math.max(page, 1) - 1, size, Sort.by(Sort.Direction.DESC, "updatedAt"));
        return PageResult.of(status == null
                ? goodsRepository.findBySellerId(sellerId, pageable)
                : goodsRepository.findBySellerIdAndStatus(sellerId, status, pageable), GoodsVO::from);
    }

    /** 管理员查询全部商品，可按状态、关键词筛选 */
    @Transactional(readOnly = true)
    public PageResult<GoodsVO> adminSearch(GoodsStatus status, String keyword, int page, int size) {
        Specification<Goods> spec = (root, cq, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (StringUtils.hasText(keyword)) {
                predicates.add(cb.like(cb.lower(root.get("title")), "%" + keyword.trim().toLowerCase() + "%"));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
        Sort sort = status == GoodsStatus.PENDING
                ? Sort.by(Sort.Direction.ASC, "updatedAt")      // 待审核按提交先后处理
                : Sort.by(Sort.Direction.DESC, "updatedAt");
        PageRequest pageable = PageRequest.of(Math.max(page, 1) - 1, size, sort);
        return PageResult.of(goodsRepository.findAll(spec, pageable), GoodsVO::from);
    }

    /** 管理员审核：通过则上架，驳回必须填写原因 */
    public GoodsVO audit(Long goodsId, AuditRequest request) {
        Goods goods = getEntity(goodsId);
        if (goods.getStatus() != GoodsStatus.PENDING) {
            throw BusinessException.badRequest("该商品不是待审核状态");
        }
        if (Boolean.TRUE.equals(request.approved())) {
            goods.setStatus(GoodsStatus.ON_SALE);
            goods.setRejectReason(null);
        } else {
            if (!StringUtils.hasText(request.reason())) {
                throw BusinessException.badRequest("驳回时必须填写原因");
            }
            goods.setStatus(GoodsStatus.REJECTED);
            goods.setRejectReason(request.reason().trim());
        }
        return GoodsVO.from(goods);
    }

    /** 管理员强制下架违规商品 */
    public GoodsVO forceOffShelf(Long goodsId, String reason) {
        Goods goods = getEntity(goodsId);
        if (goods.getStatus() == GoodsStatus.RESERVED) {
            throw BusinessException.badRequest("商品正在交易中，请等待交易结束后再处理");
        }
        if (goods.getStatus() == GoodsStatus.SOLD || goods.getStatus() == GoodsStatus.OFF_SHELF) {
            throw BusinessException.badRequest("商品已售出或已下架");
        }
        goods.setStatus(GoodsStatus.OFF_SHELF);
        goods.setRejectReason(StringUtils.hasText(reason) ? "管理员下架：" + reason.trim() : "管理员下架");
        return GoodsVO.from(goods);
    }

    @Transactional(readOnly = true)
    public Goods getEntity(Long goodsId) {
        return goodsRepository.findById(goodsId)
                .orElseThrow(() -> BusinessException.notFound("商品不存在"));
    }

    private Goods getOwnedGoods(User user, Long goodsId) {
        Goods goods = getEntity(goodsId);
        if (!goods.getSeller().getId().equals(user.getId())) {
            throw BusinessException.forbidden("只能操作自己发布的商品");
        }
        return goods;
    }

    private void apply(Goods goods, GoodsRequest request) {
        goods.setTitle(request.title().trim());
        goods.setDescription(request.description().trim());
        goods.setPrice(request.price());
        goods.setOriginalPrice(request.originalPrice());
        goods.setCategory(categoryService.getEntity(request.categoryId()));
        goods.setConditionLevel(request.conditionLevel());
        goods.setTradeLocation(request.tradeLocation().trim());
        goods.setImages(new ArrayList<>(request.images()));
    }

    private static Sort toSort(String sort) {
        if (sort == null) {
            return Sort.by(Sort.Direction.DESC, "createdAt", "id");
        }
        return switch (sort) {
            case "price_asc" -> Sort.by(Sort.Direction.ASC, "price");
            case "price_desc" -> Sort.by(Sort.Direction.DESC, "price");
            case "hot" -> Sort.by(Sort.Direction.DESC, "viewCount");
            default -> Sort.by(Sort.Direction.DESC, "createdAt", "id");
        };
    }
}

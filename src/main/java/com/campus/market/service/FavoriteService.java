package com.campus.market.service;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.campus.market.common.BusinessException;
import com.campus.market.common.PageResult;
import com.campus.market.dto.GoodsVO;
import com.campus.market.entity.Favorite;
import com.campus.market.entity.Goods;
import com.campus.market.entity.User;
import com.campus.market.repository.FavoriteRepository;

/**
 * 收藏商品。收藏与取消收藏都是幂等操作。
 */
@Service
@Transactional
public class FavoriteService {

    private final FavoriteRepository favoriteRepository;
    private final GoodsService goodsService;

    public FavoriteService(FavoriteRepository favoriteRepository, GoodsService goodsService) {
        this.favoriteRepository = favoriteRepository;
        this.goodsService = goodsService;
    }

    public void add(User user, Long goodsId) {
        Goods goods = goodsService.getEntity(goodsId);
        if (goods.getSeller().getId().equals(user.getId())) {
            throw BusinessException.badRequest("不能收藏自己发布的商品");
        }
        if (favoriteRepository.existsByUserIdAndGoodsId(user.getId(), goodsId)) {
            return;
        }
        Favorite favorite = new Favorite();
        favorite.setUser(user);
        favorite.setGoods(goods);
        favoriteRepository.save(favorite);
    }

    public void remove(User user, Long goodsId) {
        favoriteRepository.findByUserIdAndGoodsId(user.getId(), goodsId)
                .ifPresent(favoriteRepository::delete);
    }

    @Transactional(readOnly = true)
    public PageResult<GoodsVO> list(User user, int page, int size) {
        PageRequest pageable = PageRequest.of(Math.max(page, 1) - 1, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return PageResult.of(favoriteRepository.findByUserId(user.getId(), pageable), f -> GoodsVO.from(f.getGoods()));
    }
}

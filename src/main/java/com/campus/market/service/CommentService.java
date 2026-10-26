package com.campus.market.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.campus.market.common.BusinessException;
import com.campus.market.dto.CommentRequest;
import com.campus.market.dto.CommentVO;
import com.campus.market.entity.Comment;
import com.campus.market.entity.Goods;
import com.campus.market.entity.User;
import com.campus.market.repository.CommentRepository;

/**
 * 商品留言。买家可以在商品下咨询，卖家可以回复。
 */
@Service
@Transactional
public class CommentService {

    private final CommentRepository commentRepository;
    private final GoodsService goodsService;
    private final UserService userService;

    public CommentService(CommentRepository commentRepository, GoodsService goodsService, UserService userService) {
        this.commentRepository = commentRepository;
        this.goodsService = goodsService;
        this.userService = userService;
    }

    @Transactional(readOnly = true)
    public List<CommentVO> list(Long goodsId) {
        goodsService.getEntity(goodsId);
        return commentRepository.findByGoodsIdOrderByCreatedAtAsc(goodsId).stream().map(CommentVO::from).toList();
    }

    public CommentVO add(User user, Long goodsId, CommentRequest request) {
        Goods goods = goodsService.getEntity(goodsId);
        Comment comment = new Comment();
        comment.setGoods(goods);
        comment.setUser(user);
        comment.setContent(request.content().trim());
        if (request.replyToUserId() != null) {
            comment.setReplyTo(userService.getEntity(request.replyToUserId()));
        }
        return CommentVO.from(commentRepository.save(comment));
    }

    /** 留言作者、商品卖家或管理员可以删除留言 */
    public void delete(User user, Long commentId) {
        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> BusinessException.notFound("留言不存在"));
        boolean allowed = user.isAdmin()
                || comment.getUser().getId().equals(user.getId())
                || comment.getGoods().getSeller().getId().equals(user.getId());
        if (!allowed) {
            throw BusinessException.forbidden("无权删除该留言");
        }
        commentRepository.delete(comment);
    }
}

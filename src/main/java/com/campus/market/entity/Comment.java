package com.campus.market.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * 商品留言，可以回复某位用户。
 */
@Entity
@Table(name = "comment")
public class Comment extends BaseEntity {

    @ManyToOne(optional = false)
    @JoinColumn(name = "goods_id")
    private Goods goods;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(nullable = false, length = 300)
    private String content;

    /** 被回复的用户，为空表示直接留言 */
    @ManyToOne
    @JoinColumn(name = "reply_to_user_id")
    private User replyTo;

    public Goods getGoods() {
        return goods;
    }

    public void setGoods(Goods goods) {
        this.goods = goods;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public User getReplyTo() {
        return replyTo;
    }

    public void setReplyTo(User replyTo) {
        this.replyTo = replyTo;
    }
}

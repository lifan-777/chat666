package com.campus.market.entity;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;

/**
 * 二手商品。
 */
@Entity
@Table(name = "goods")
public class Goods extends BaseEntity {

    @Column(nullable = false, length = 50)
    private String title;

    @Column(nullable = false, length = 2000)
    private String description;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    /** 原价，可为空 */
    @Column(precision = 10, scale = 2)
    private BigDecimal originalPrice;

    @ManyToOne(optional = false)
    @JoinColumn(name = "category_id")
    private Category category;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ConditionLevel conditionLevel;

    /** 交易地点，例如“东区食堂门口” */
    @Column(nullable = false, length = 50)
    private String tradeLocation;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "goods_image", joinColumns = @JoinColumn(name = "goods_id"))
    @OrderColumn(name = "sort_order")
    @Column(name = "url", nullable = false, length = 255)
    private List<String> images = new ArrayList<>();

    @ManyToOne(optional = false)
    @JoinColumn(name = "seller_id")
    private User seller;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private GoodsStatus status = GoodsStatus.PENDING;

    /** 审核驳回或强制下架的原因 */
    @Column(length = 200)
    private String rejectReason;

    /** 浏览量只通过 GoodsRepository#increaseViewCount 原子递增，实体更新时不写入该列 */
    @Column(nullable = false, updatable = false)
    private Integer viewCount = 0;

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public void setPrice(BigDecimal price) {
        this.price = price;
    }

    public BigDecimal getOriginalPrice() {
        return originalPrice;
    }

    public void setOriginalPrice(BigDecimal originalPrice) {
        this.originalPrice = originalPrice;
    }

    public Category getCategory() {
        return category;
    }

    public void setCategory(Category category) {
        this.category = category;
    }

    public ConditionLevel getConditionLevel() {
        return conditionLevel;
    }

    public void setConditionLevel(ConditionLevel conditionLevel) {
        this.conditionLevel = conditionLevel;
    }

    public String getTradeLocation() {
        return tradeLocation;
    }

    public void setTradeLocation(String tradeLocation) {
        this.tradeLocation = tradeLocation;
    }

    public List<String> getImages() {
        return images;
    }

    public void setImages(List<String> images) {
        this.images = images;
    }

    public User getSeller() {
        return seller;
    }

    public void setSeller(User seller) {
        this.seller = seller;
    }

    public GoodsStatus getStatus() {
        return status;
    }

    public void setStatus(GoodsStatus status) {
        this.status = status;
    }

    public String getRejectReason() {
        return rejectReason;
    }

    public void setRejectReason(String rejectReason) {
        this.rejectReason = rejectReason;
    }

    public Integer getViewCount() {
        return viewCount;
    }

    public void setViewCount(Integer viewCount) {
        this.viewCount = viewCount;
    }
}

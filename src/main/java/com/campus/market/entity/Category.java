package com.campus.market.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * 商品分类。
 */
@Entity
@Table(name = "category")
public class Category extends BaseEntity {

    @Column(nullable = false, unique = true, length = 20)
    private String name;

    /** Element Plus 图标名，例如 Iphone、Reading */
    @Column(length = 30)
    private String icon;

    @Column(nullable = false)
    private Integer sortOrder = 0;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getIcon() {
        return icon;
    }

    public void setIcon(String icon) {
        this.icon = icon;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }
}

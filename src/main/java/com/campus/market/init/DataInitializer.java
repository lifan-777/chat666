package com.campus.market.init;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.campus.market.config.AppProperties;
import com.campus.market.entity.Category;
import com.campus.market.entity.Comment;
import com.campus.market.entity.ConditionLevel;
import com.campus.market.entity.Favorite;
import com.campus.market.entity.Goods;
import com.campus.market.entity.GoodsStatus;
import com.campus.market.entity.OrderStatus;
import com.campus.market.entity.Role;
import com.campus.market.entity.TradeOrder;
import com.campus.market.entity.User;
import com.campus.market.entity.UserStatus;
import com.campus.market.repository.CategoryRepository;
import com.campus.market.repository.CommentRepository;
import com.campus.market.repository.FavoriteRepository;
import com.campus.market.repository.GoodsRepository;
import com.campus.market.repository.TradeOrderRepository;
import com.campus.market.repository.UserRepository;

/**
 * 首次启动（用户表为空）时写入演示数据，便于直接体验和答辩演示。
 * 可通过 app.seed-demo-data=false 关闭。
 */
@Component
public class DataInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);
    private static final DateTimeFormatter ORDER_NO_TIME = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final AppProperties properties;
    private final PasswordEncoder passwordEncoder;
    private final UserRepository userRepository;
    private final CategoryRepository categoryRepository;
    private final GoodsRepository goodsRepository;
    private final TradeOrderRepository orderRepository;
    private final CommentRepository commentRepository;
    private final FavoriteRepository favoriteRepository;

    private final Map<String, User> users = new HashMap<>();
    private final Map<String, Category> categories = new HashMap<>();
    private final Map<String, Goods> goodsByKey = new HashMap<>();
    private int orderSeq;

    public DataInitializer(AppProperties properties, PasswordEncoder passwordEncoder,
                           UserRepository userRepository, CategoryRepository categoryRepository,
                           GoodsRepository goodsRepository, TradeOrderRepository orderRepository,
                           CommentRepository commentRepository, FavoriteRepository favoriteRepository) {
        this.properties = properties;
        this.passwordEncoder = passwordEncoder;
        this.userRepository = userRepository;
        this.categoryRepository = categoryRepository;
        this.goodsRepository = goodsRepository;
        this.orderRepository = orderRepository;
        this.commentRepository = commentRepository;
        this.favoriteRepository = favoriteRepository;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!properties.seedDemoData() || userRepository.count() > 0) {
            return;
        }
        createUsers();
        createCategories();
        createGoods();
        createOrders();
        createComments();
        createFavorites();
        log.info("已写入演示数据：管理员 admin/admin123，普通用户 zhangsan、lisi、wangwu、zhaoliu（密码均为 123456）");
    }

    private void createUsers() {
        user("admin", "admin123", "平台管理员", "13800000000", Role.ADMIN, UserStatus.NORMAL);
        user("zhangsan", "123456", "张三", "13800000001", Role.USER, UserStatus.NORMAL);
        user("lisi", "123456", "李四", "13800000002", Role.USER, UserStatus.NORMAL);
        user("wangwu", "123456", "王五", "13800000003", Role.USER, UserStatus.NORMAL);
        user("zhaoliu", "123456", "赵六", "13800000004", Role.USER, UserStatus.NORMAL);
        user("spam2026", "123456", "低价代购", "13800000009", Role.USER, UserStatus.BANNED);
    }

    private void createCategories() {
        category("数码电子", "Iphone", 1);
        category("书籍教材", "Reading", 2);
        category("生活用品", "House", 3);
        category("服饰鞋包", "Handbag", 4);
        category("运动户外", "Basketball", 5);
        category("交通出行", "Bicycle", 6);
        category("其他", "Box", 99);
    }

    private void createGoods() {
        goods("ipad", "zhangsan", "数码电子", "iPad Air 5 64G 星光色 带笔", "2380", "4399", ConditionLevel.LIKE_NEW,
                "东区宿舍楼下", GoodsStatus.ON_SALE, 126, 9,
                "去年开学买的，主要用来记笔记，一直贴膜带壳，无磕碰无划痕。电池效率 96%。送一代 Apple Pencil 和保护壳，可当面验机。");
        goods("mouse", "lisi", "数码电子", "罗技 MX Master 3S 无线鼠标", "420", "699", ConditionLevel.LIGHTLY_USED,
                "图书馆一楼大厅", GoodsStatus.ON_SALE, 58, 8,
                "手感很好的办公鼠标，支持三台设备切换，充一次电用一个多月。滚轮正常，外壳有轻微使用痕迹。");
        goods("headphone", "wangwu", "数码电子", "索尼 WH-1000XM4 降噪耳机", "850", "2299", ConditionLevel.LIGHTLY_USED,
                "西区食堂门口", GoodsStatus.ON_SALE, 203, 7,
                "降噪效果很好，图书馆自习神器。耳罩已换新，配件齐全（收纳盒、充电线、音频线）。");
        goods("monitor", "zhangsan", "数码电子", "小米 27 寸 2K 显示器", "560", "999", ConditionLevel.LIGHTLY_USED,
                "东区宿舍楼下", GoodsStatus.RESERVED, 87, 6,
                "IPS 屏，无坏点无漏光，带原装支架和 DP 线。毕业清仓，宿舍自提。");
        goods("calculator", "zhaoliu", "数码电子", "卡西欧 fx-991CN X 科学计算器", "65", "178", ConditionLevel.LIKE_NEW,
                "教学楼 A 栋", GoodsStatus.ON_SALE, 41, 5,
                "考试专用计算器，功能完好，送保护套。高数、大物、电路考试都能用。");
        goods("earphone", "lisi", "数码电子", "四六级考试 FM 耳机", "30", "88", ConditionLevel.LIKE_NEW,
                "图书馆一楼大厅", GoodsStatus.SOLD, 35, 12,
                "只用过两次考试，带电池，调频清晰。");
        goods("math", "lisi", "书籍教材", "《高等数学》同济第七版 上下册", "25", "79.6", ConditionLevel.LIGHTLY_USED,
                "图书馆一楼大厅", GoodsStatus.ON_SALE, 64, 4,
                "上下两册一起出，有少量铅笔笔记，重点题目都做了标记，适合大一新生。");
        goods("english", "wangwu", "书籍教材", "考研英语一真题黄皮书 2026 版", "30", "89", ConditionLevel.LIKE_NEW,
                "西区食堂门口", GoodsStatus.ON_SALE, 77, 3,
                "已上岸，真题只做了前三年，后面全新。附赠作文模板笔记。");
        goods("algorithm", "zhangsan", "书籍教材", "《算法导论》第三版 中文版", "45", "128", ConditionLevel.LIKE_NEW,
                "东区宿舍楼下", GoodsStatus.SOLD, 92, 14,
                "经典教材，几乎全新，只翻过前几章。");
        goods("lamp", "lisi", "生活用品", "LED 护眼台灯 三档调光", "35", "99", ConditionLevel.LIGHTLY_USED,
                "南区 5 号楼", GoodsStatus.ON_SALE, 29, 2,
                "宿舍必备，USB 充电，亮度三档可调，带笔筒和手机支架。");
        goods("cooker", "wangwu", "生活用品", "小熊电煮锅 1.2L", "40", "129", ConditionLevel.LIKE_NEW,
                "西区食堂门口", GoodsStatus.PENDING, 0, 1,
                "低功率宿舍可用，煮面、火锅都可以，只用过三四次。");
        goods("storage", "zhaoliu", "生活用品", "透明收纳箱 三件套", "20", "45", ConditionLevel.USED,
                "教学楼 A 栋", GoodsStatus.ON_SALE, 18, 2,
                "搬家清理，三个大号收纳箱，带轮子，有使用痕迹但不影响使用。");
        goods("badminton", "zhaoliu", "运动户外", "迪卡侬羽毛球拍 一对 送球", "60", "159", ConditionLevel.LIGHTLY_USED,
                "体育馆门口", GoodsStatus.ON_SALE, 33, 3,
                "体育课用的，拍线完好，送半筒羽毛球和拍套。");
        goods("basketball", "lisi", "运动户外", "斯伯丁 7 号篮球", "55", "149", ConditionLevel.USED,
                "体育馆门口", GoodsStatus.PENDING, 0, 0,
                "室外打了一学期，气密性良好，表皮有磨损。");
        goods("bike", "wangwu", "交通出行", "捷安特 ATX 山地自行车 26 寸", "680", "1698", ConditionLevel.LIGHTLY_USED,
                "南区车棚", GoodsStatus.ON_SALE, 156, 10,
                "21 速变速正常，刹车灵敏，送车锁和车灯。适合身高 165-185。");
        goods("scooter", "zhangsan", "交通出行", "九号电动滑板车 E25", "1200", "2499", ConditionLevel.LIGHTLY_USED,
                "东区宿舍楼下", GoodsStatus.RESERVED, 98, 11,
                "续航 25km 左右，校园代步很方便，电池健康，有原装充电器。");
        goods("jacket", "zhaoliu", "服饰鞋包", "优衣库轻型羽绒服 L 码 黑色", "150", "499", ConditionLevel.LIKE_NEW,
                "教学楼 A 栋", GoodsStatus.ON_SALE, 47, 4,
                "去年冬天买的，穿过几次，已干洗。轻薄保暖，可收纳成小包。");
        goods("shoes", "wangwu", "服饰鞋包", "匡威 1970s 帆布鞋 42 码", "120", "459", ConditionLevel.NEW,
                "西区食堂门口", GoodsStatus.REJECTED, 0, 2,
                "买大了一码，全新未穿。");
        goodsByKey.get("shoes").setRejectReason("图片与描述不符，请上传商品实物照片后重新提交");
    }

    private void createOrders() {
        order("algorithm", "lisi", OrderStatus.COMPLETED, 5, "周五下午图书馆见", null);
        order("earphone", "zhangsan", OrderStatus.COMPLETED, 3, "考试前一天能交易吗？", null);
        order("mouse", "wangwu", OrderStatus.CANCELLED, 2, null, "买家取消：已经买到新的了");
        order("lamp", "zhangsan", OrderStatus.CANCELLED, 6, null, "卖家取消：已被同学线下预定");
        order("scooter", "zhaoliu", OrderStatus.CONFIRMED, 1, "明天中午 12 点宿舍楼下", null);
        order("monitor", "wangwu", OrderStatus.PENDING, 0, "今晚可以看货吗？", null);
    }

    private void createComments() {
        comment("ipad", "lisi", "请问电池健康度多少？有没有维修过？", null);
        comment("ipad", "zhangsan", "电池效率 96%，没有拆修过，可以当面验机。", "lisi");
        comment("ipad", "wangwu", "可以小刀吗？2200 行不行", null);
        comment("ipad", "zhangsan", "最低 2300，诚心要的话再送一个支架。", "wangwu");
        comment("bike", "zhangsan", "车架多大的？我 175 能骑吗？", null);
        comment("bike", "wangwu", "26 寸车架，175 正合适。", "zhangsan");
        comment("headphone", "zhaoliu", "降噪还正常吗？", null);
    }

    private void createFavorites() {
        favorite("lisi", "ipad");
        favorite("wangwu", "ipad");
        favorite("zhaoliu", "ipad");
        favorite("zhangsan", "bike");
        favorite("zhangsan", "headphone");
        favorite("lisi", "jacket");
    }

    private void user(String username, String password, String nickname, String phone, Role role, UserStatus status) {
        User u = new User();
        u.setUsername(username);
        u.setPassword(passwordEncoder.encode(password));
        u.setNickname(nickname);
        u.setPhone(phone);
        u.setRole(role);
        u.setStatus(status);
        u.setCreatedAt(LocalDateTime.now().minusDays(30));
        users.put(username, userRepository.save(u));
    }

    private void category(String name, String icon, int sortOrder) {
        Category c = new Category();
        c.setName(name);
        c.setIcon(icon);
        c.setSortOrder(sortOrder);
        categories.put(name, categoryRepository.save(c));
    }

    private void goods(String key, String seller, String category, String title, String price, String originalPrice,
                       ConditionLevel condition, String location, GoodsStatus status, int views, int daysAgo,
                       String description) {
        Goods g = new Goods();
        g.setTitle(title);
        g.setDescription(description);
        g.setPrice(new BigDecimal(price));
        g.setOriginalPrice(new BigDecimal(originalPrice));
        g.setCategory(categories.get(category));
        g.setConditionLevel(condition);
        g.setTradeLocation(location);
        g.setImages(new ArrayList<>(List.of("/demo-images/" + key + ".jpg")));
        g.setSeller(users.get(seller));
        g.setStatus(status);
        g.setViewCount(views);
        g.setCreatedAt(LocalDateTime.now().minusDays(daysAgo).minusHours(key.length()));
        goodsByKey.put(key, goodsRepository.save(g));
    }

    private void order(String goodsKey, String buyer, OrderStatus status, int daysAgo, String remark,
                       String cancelReason) {
        Goods g = goodsByKey.get(goodsKey);
        LocalDateTime createdAt = LocalDateTime.now().minusDays(daysAgo).minusHours(1);
        TradeOrder o = new TradeOrder();
        o.setOrderNo(createdAt.format(ORDER_NO_TIME) + String.format("%06d", ++orderSeq));
        o.setGoods(g);
        o.setBuyer(users.get(buyer));
        o.setSeller(g.getSeller());
        o.setGoodsTitle(g.getTitle());
        o.setGoodsImage(g.getImages().get(0));
        o.setPrice(g.getPrice());
        o.setStatus(status);
        o.setBuyerRemark(remark);
        o.setCancelReason(cancelReason);
        o.setCreatedAt(createdAt);
        if (status == OrderStatus.CONFIRMED || status == OrderStatus.COMPLETED) {
            o.setConfirmedAt(createdAt.plusHours(2));
        }
        if (status == OrderStatus.COMPLETED) {
            o.setCompletedAt(createdAt.plusDays(1));
        }
        if (status == OrderStatus.CANCELLED) {
            o.setCancelledAt(createdAt.plusHours(5));
        }
        orderRepository.save(o);
    }

    private void comment(String goodsKey, String username, String content, String replyTo) {
        Comment c = new Comment();
        c.setGoods(goodsByKey.get(goodsKey));
        c.setUser(users.get(username));
        c.setContent(content);
        c.setReplyTo(replyTo == null ? null : users.get(replyTo));
        commentRepository.save(c);
    }

    private void favorite(String username, String goodsKey) {
        Favorite f = new Favorite();
        f.setUser(users.get(username));
        f.setGoods(goodsByKey.get(goodsKey));
        favoriteRepository.save(f);
    }
}

"""生成演示数据用的商品图片（扁平风格插画），输出到 src/main/resources/static/demo-images。

用法：python3 tools/gen_demo_images.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src/main/resources/static/demo-images"
FONT = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"
SIZE = 800

# 分类 -> (渐变起始色, 渐变结束色)
PALETTE = {
    "digital": ((96, 165, 250), (37, 99, 235)),
    "book": ((251, 191, 36), (217, 119, 6)),
    "life": ((52, 211, 153), (5, 150, 105)),
    "cloth": ((244, 114, 182), (219, 39, 119)),
    "sport": ((251, 146, 60), (234, 88, 12)),
    "travel": ((167, 139, 250), (109, 40, 217)),
}

# 文件名, 分类, 主标题, 副标题
ITEMS = [
    ("ipad", "digital", "iPad Air 5", "64G · 星光色"),
    ("mouse", "digital", "MX Master 3S", "无线鼠标"),
    ("headphone", "digital", "降噪耳机", "WH-1000XM4"),
    ("monitor", "digital", "27 寸 2K 显示器", "IPS 屏"),
    ("calculator", "digital", "fx-991CN", "科学计算器"),
    ("earphone", "digital", "四六级耳机", "FM 调频"),
    ("math", "book", "高等数学", "同济第七版"),
    ("english", "book", "考研英语真题", "2026 版"),
    ("algorithm", "book", "算法导论", "第三版"),
    ("lamp", "life", "护眼台灯", "LED 三档调光"),
    ("cooker", "life", "电煮锅", "1.2L 宿舍可用"),
    ("storage", "life", "收纳箱", "三件套"),
    ("badminton", "sport", "羽毛球拍", "一对 · 送球"),
    ("basketball", "sport", "篮球", "7 号标准球"),
    ("bike", "travel", "山地自行车", "26 寸 21 速"),
    ("scooter", "travel", "电动滑板车", "续航 25km"),
    ("jacket", "cloth", "羽绒服", "L 码 · 黑色"),
    ("shoes", "cloth", "帆布鞋", "42 码"),
]


def gradient(c1, c2):
    img = Image.new("RGB", (SIZE, SIZE), c1)
    draw = ImageDraw.Draw(img)
    for y in range(SIZE):
        t = y / SIZE
        color = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))
        draw.line([(0, y), (SIZE, y)], fill=color)
    return img


def draw_icon(draw, kind, cx, cy):
    """在 (cx, cy) 附近画一个简单的白色图标。"""
    w = (255, 255, 255)
    soft = (255, 255, 255, 120)
    if kind == "digital":
        draw.rounded_rectangle([cx - 150, cy - 105, cx + 150, cy + 95], 22, outline=w, width=14)
        draw.rounded_rectangle([cx - 115, cy - 72, cx + 115, cy + 62], 8, fill=soft)
        draw.rectangle([cx - 20, cy + 95, cx + 20, cy + 135], fill=w)
        draw.rounded_rectangle([cx - 90, cy + 130, cx + 90, cy + 148], 9, fill=w)
    elif kind == "book":
        draw.rounded_rectangle([cx - 130, cy - 120, cx + 120, cy + 130], 14, outline=w, width=14)
        draw.rectangle([cx - 130, cy - 120, cx - 85, cy + 130], fill=w)
        for i, dy in enumerate((-60, -20, 20)):
            draw.rounded_rectangle([cx - 55, cy + dy, cx + 85 - i * 30, cy + dy + 14], 7, fill=w)
    elif kind == "life":
        draw.polygon([(cx - 160, cy - 10), (cx, cy - 150), (cx + 160, cy - 10)], fill=w)
        draw.rectangle([cx - 115, cy - 15, cx + 115, cy + 140], outline=w, width=14)
        draw.rounded_rectangle([cx - 35, cy + 45, cx + 35, cy + 140], 10, fill=w)
    elif kind == "cloth":
        draw.polygon([(cx - 70, cy - 140), (cx - 175, cy - 80), (cx - 130, cy - 5), (cx - 95, cy - 25),
                      (cx - 95, cy + 140), (cx + 95, cy + 140), (cx + 95, cy - 25), (cx + 130, cy - 5),
                      (cx + 175, cy - 80), (cx + 70, cy - 140), (cx + 35, cy - 105), (cx - 35, cy - 105)], fill=w)
    elif kind == "sport":
        r = 140
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=w, width=14)
        draw.line([(cx - r, cy), (cx + r, cy)], fill=w, width=12)
        draw.line([(cx, cy - r), (cx, cy + r)], fill=w, width=12)
        draw.arc([cx - r - 90, cy - r, cx + r - 190, cy + r], -60, 60, fill=w, width=12)
        draw.arc([cx - r + 190, cy - r, cx + r + 90, cy + r], 120, 240, fill=w, width=12)
    elif kind == "travel":
        for dx in (-105, 105):
            draw.ellipse([cx + dx - 75, cy - 5, cx + dx + 75, cy + 145], outline=w, width=14)
        pts = [(cx - 105, cy + 70), (cx - 30, cy - 50), (cx + 60, cy - 50), (cx + 105, cy + 70)]
        draw.line(pts, fill=w, width=14, joint="curve")
        draw.line([(cx - 30, cy - 50), (cx + 5, cy + 70), (cx + 60, cy - 50)], fill=w, width=12)
        draw.line([(cx - 45, cy - 85), (cx - 5, cy - 85)], fill=w, width=14)
        draw.line([(cx + 60, cy - 50), (cx + 70, cy - 95), (cx + 105, cy - 95)], fill=w, width=12)


def make(name, kind, title, subtitle):
    c1, c2 = PALETTE[kind]
    img = gradient(c1, c2).convert("RGBA")
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    # 背景装饰圆
    draw.ellipse([520, -120, 920, 280], fill=(255, 255, 255, 30))
    draw.ellipse([-160, 560, 240, 960], fill=(255, 255, 255, 25))
    draw_icon(draw, kind, SIZE // 2, 300)
    img = Image.alpha_composite(img, overlay)

    draw = ImageDraw.Draw(img)
    title_font = ImageFont.truetype(FONT, 64)
    sub_font = ImageFont.truetype(FONT, 36)
    tw = draw.textlength(title, font=title_font)
    draw.text(((SIZE - tw) / 2, 530), title, font=title_font, fill="white")
    sw = draw.textlength(subtitle, font=sub_font)
    draw.text(((SIZE - sw) / 2, 620), subtitle, font=sub_font, fill=(255, 255, 255, 220))
    img.convert("RGB").save(OUT / f"{name}.jpg", quality=85)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for item in ITEMS:
        make(*item)
    print(f"generated {len(ITEMS)} images -> {OUT}")


if __name__ == "__main__":
    main()

"""棚・収納・展示用の家具。正面 +Z。"""
import palette as P
from lib import Model, asset


def open_shelf(m, W, H, D, levels, mat, t=0.018, kick=0.05, cols=1, back=True):
    """側板・天板・底板・背板と、levels 段の空間を作る。"""
    for sx in (-1, 1):
        m.box((t, H, D), (sx * (W / 2 - t / 2), H / 2, 0), mat, bevel=0.003, name="side")
    iw = W - 2 * t
    m.box((iw + 0.001, t, D), (0, H - t / 2, 0), mat, bevel=0.002, name="top")
    m.box((iw + 0.001, t, D), (0, kick + t / 2, 0), mat, bevel=0.002, name="bottom")
    if kick > 0:
        m.box((iw, kick, t), (0, kick / 2, D / 2 - 0.025), mat, bevel=0.0, name="kick")
    if back:
        m.box((iw, H - kick - t, 0.006), (0, (H + kick) / 2 - t / 2, -D / 2 + 0.003), mat, bevel=0.0, name="back")
    lo, hi = kick + t, H - t
    step = (hi - lo - (levels - 1) * t) / levels
    for i in range(1, levels):
        y = lo + i * step + (i - 0.5) * t
        m.box((iw, t, D - 0.008), (0, y, 0.004), mat, bevel=0.002, name="shelf")
    for c in range(1, cols):
        x = -iw / 2 + iw * c / cols
        m.box((t, hi - lo, D - 0.008), (x, (lo + hi) / 2, 0.004), mat, bevel=0.002, name="divider")


@asset("bookshelf.glb", (0.80, 1.80, 0.30), variants={
    "w060": {"size": (0.60, 1.80, 0.30)}, "w100": {"size": (1.00, 1.80, 0.30)}})
def bookshelf(tint=None, size=(0.80, 1.80, 0.30)):
    m = Model("bookshelf")
    wood = m.mat("wood", tint or P.WOOD_BROWN, rough=0.6)
    open_shelf(m, *size, 5, wood, t=0.028, kick=0.06)
    return m


@asset("shelf_low.glb", (0.90, 0.90, 0.30))
def shelf_low(tint=None):
    m = Model("shelf_low")
    wood = m.mat("wood", tint or P.WOOD_LIGHT, rough=0.55)
    open_shelf(m, 0.90, 0.90, 0.30, 3, wood, t=0.026, kick=0.04)
    return m


@asset("shelf_cube.glb", (0.80, 0.80, 0.35))
def shelf_cube(tint=None):
    m = Model("shelf_cube")
    body = m.mat("tint", tint or "#c6bcb0", rough=0.6)
    open_shelf(m, 0.80, 0.80, 0.35, 2, body, t=0.03, kick=0.0, cols=2)
    return m


@asset("wardrobe.glb", (0.80, 1.80, 0.55))
def wardrobe(tint=None):
    m = Model("wardrobe")
    body = m.mat("tint", tint or "#b8afa5", rough=0.6)  # 暖かい灰色
    metal = m.mat("metal", P.METAL_LIGHT, rough=0.3, metal=0.8)
    wood = m.mat("wood", P.WOOD_MED, rough=0.55)
    W, H, D = 0.80, 1.80, 0.55
    leg = 0.07
    m.box((W, H - leg - 0.02, D - 0.022), (0, leg + (H - leg - 0.02) / 2, -0.011), body, bevel=0.006, name="carcass")
    m.box((W + 0.01, 0.02, D - 0.012), (0, H - 0.01, -0.006), body, bevel=0.005, name="cap")
    dh = H - leg - 0.05
    for sx in (-1, 1):
        m.box((W / 2 - 0.006, dh, 0.02), (sx * W / 4, leg + 0.012 + dh / 2, D / 2 - 0.012), body, bevel=0.004,
              name="door")
        m.box((0.012, 0.22, 0.012), (sx * 0.035, leg + 0.95, D / 2 + 0.004 - 0.006), metal, bevel=0.004, name="handle")
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.cyl(0.016, leg, (sx * (W / 2 - 0.05), leg / 2, sz * (D / 2 - 0.06)), wood, seg=12, r2=0.021, name="leg")
    return m


@asset("chest_drawers.glb", (0.80, 0.85, 0.40))
def chest_drawers(tint=None):
    m = Model("chest_drawers")
    wood = m.mat("wood", tint or P.WOOD_LIGHT, rough=0.55)
    knob = m.mat("knob", P.WOOD_MED, rough=0.5)
    W, H, D = 0.80, 0.85, 0.40
    leg = 0.09
    bh = H - leg
    m.box((W, bh, D - 0.018), (0, leg + bh / 2, -0.009), wood, bevel=0.006, name="carcass")
    gap, n = 0.006, 4
    dh = (bh - 0.04 - gap * (n + 1)) / n
    for i in range(n):
        y = leg + 0.02 + gap + i * (dh + gap) + dh / 2
        m.box((W - 0.05, dh, 0.02), (0, y, D / 2 - 0.012), wood, bevel=0.004, name="drawer")
        for sx in (-1, 1):
            m.cyl(0.012, 0.025, (sx * 0.17, y, D / 2 + 0.003), knob, seg=14, axis="z", r2=0.016, bevel=0.004,
                  name="knob")
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.cyl(0.014, leg, (sx * (W / 2 - 0.05), leg / 2, sz * (D / 2 - 0.05)), knob, seg=12, r2=0.02, name="leg")
    return m


@asset("tv_stand.glb", (1.20, 0.40, 0.35))
def tv_stand(tint=None):
    m = Model("tv_stand")
    wood = m.mat("wood", tint or P.WOOD_LIGHT, rough=0.55)
    dark = m.mat("wood_dark", P.WOOD_MED, rough=0.55)
    W, H, D = 1.20, 0.40, 0.35
    leg = 0.08
    bh = H - leg
    t = 0.02
    m.box((W, t, D), (0, H - t / 2, 0), wood, bevel=0.005, name="top")
    m.box((W - 0.01, t, D - 0.01), (0, leg + t / 2, 0), wood, bevel=0.004, name="bottom")
    for sx in (-1, 1):
        m.box((t, bh - 2 * t, D - 0.01), (sx * (W / 2 - t / 2 - 0.005), leg + bh / 2, 0), wood, bevel=0.003,
              name="side")
    m.box((W - 0.03, bh - 2 * t, 0.008), (0, leg + bh / 2, -D / 2 + 0.01), wood, bevel=0.0, name="back")
    cw = 0.36  # 中央の開放棚
    for sx in (-1, 1):
        m.box((t, bh - 2 * t, D - 0.03), (sx * cw / 2, leg + bh / 2, 0), wood, bevel=0.002, name="partition")
        dw = W / 2 - cw / 2 - 0.02
        m.box((dw, bh - 2 * t - 0.006, 0.018), (sx * (cw / 2 + dw / 2 + 0.006), leg + bh / 2, D / 2 - 0.009), wood,
              bevel=0.003, name="door")
        m.box((0.08, 0.012, 0.012), (sx * (cw / 2 + 0.06), leg + bh - 0.06, D / 2 + 0.004), dark, bevel=0.004,
              name="handle")
    m.box((cw - t, t * 0.8, D - 0.04), (0, leg + bh / 2, 0), wood, bevel=0.002, name="center_shelf")
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.cyl(0.014, leg, (sx * (W / 2 - 0.06), leg / 2, sz * (D / 2 - 0.05)), dark, seg=12, r2=0.02, name="leg")
    return m


@asset("wall_shelf.glb", (0.60, 0.50, 0.12))
def wall_shelf(tint=None):
    m = Model("wall_shelf")
    white = m.mat("tint", tint or "#f7f7f5", rough=0.5)
    W, H, D, t = 0.60, 0.50, 0.12, 0.026
    for sx in (-1, 1):
        m.box((0.03, H, 0.015), (sx * 0.2, H / 2, -D / 2 + 0.0075), white, bevel=0.003, name="rail")
    for y in (0.03, 0.245, 0.46):
        m.box((W, t, D - 0.015), (0, y + t / 2, 0.0075), white, bevel=0.004, name="board")
        for sx in (-1, 1):
            m.box((0.012, 0.03, 0.06), (sx * 0.2, y - 0.015, -D / 2 + 0.045), white, bevel=0.002, name="bracket")
    return m


@asset("display_case.glb", (0.40, 1.20, 0.30))
def display_case(tint=None):
    m = Model("display_case")
    frame = m.mat("tint", tint or "#d9ccf0", rough=0.5)
    glass = m.mat("glass", P.GLASS, rough=0.05, alpha=0.22)
    metal = m.mat("metal", P.METAL_LIGHT, rough=0.3, metal=0.8)
    W, H, D = 0.40, 1.20, 0.30
    p = 0.024
    m.box((W, 0.05, D), (0, 0.025, 0), frame, bevel=0.004, name="base")
    m.box((W, 0.025, D), (0, H - 0.0125, 0), frame, bevel=0.004, name="cap")
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box((p, H - 0.075, p), (sx * (W / 2 - p / 2), 0.05 + (H - 0.075) / 2, sz * (D / 2 - p / 2)), frame,
                  bevel=0.002, name="post")
    gh = H - 0.075
    gy = 0.05 + gh / 2
    m.box((W - 2 * p, gh, 0.004), (0, gy, D / 2 - 0.006), glass, bevel=0.0, name="front_glass")
    for sx in (-1, 1):
        m.box((0.004, gh, D - 2 * p), (sx * (W / 2 - 0.006), gy, 0), glass, bevel=0.0, name="side_glass")
    m.box((W - 2 * p, gh, 0.006), (0, gy, -D / 2 + 0.005), frame, bevel=0.0, name="back")
    for y in (0.33, 0.61, 0.89):
        m.box((W - 2 * p, 0.006, D - 2 * p), (0, y, 0), glass, bevel=0.0, name="shelf")
    m.box((0.008, 0.06, 0.008), (W / 2 - 0.035, 0.62, D / 2 - 0.0), metal, bevel=0.002, name="knob")
    return m


def stair_outline(depth_steps, heights):
    """側面図 (z, y) の階段輪郭。z は正面 +Z、最前段が低い。"""
    n = len(heights)
    total = sum(depth_steps)
    z = total / 2
    pts = [(z, 0.0)]
    for d, h in zip(depth_steps, heights):
        pts.append((z, h))
        z -= d
        pts.append((z, h))
    pts.append((-total / 2, 0.0))
    return pts


@asset("acrylic_stand_case.glb", (0.30, 0.15, 0.15))
def acrylic_stand_case(tint=None):
    m = Model("acrylic_stand_case")
    acr = m.mat("tint", tint or "#e8e0f5", rough=0.08, alpha=0.5)
    W, D, t = 0.30, 0.15, 0.004
    steps = [0.05, 0.10, 0.15]
    sd = D / 3
    for i, h in enumerate(steps):
        zf = D / 2 - i * sd
        m.box((W - 2 * t, t, sd), (0, h - t / 2, zf - sd / 2), acr, bevel=0.001, name="tread")
        m.box((W - 2 * t, h, t), (0, h / 2, zf - t / 2), acr, bevel=0.001, name="riser")
    m.box((W - 2 * t, steps[-1], t), (0, steps[-1] / 2, -D / 2 + t / 2), acr, bevel=0.001, name="back")
    for sx in (-1, 1):
        m.prism(stair_outline([sd] * 3, steps), t, acr, plane="zy", offset=sx * (W / 2) - (t if sx > 0 else 0),
                bevel=0.001, name="side")
    return m


@asset("display_rack_open.glb", (0.35, 0.90, 0.25))
def display_rack_open(tint=None):
    m = Model("display_rack_open")
    acr = m.mat("tint", tint or "#e6def5", rough=0.08, alpha=0.5)
    W, H, D, t = 0.35, 0.90, 0.25, 0.006
    for y in (0.0, 0.3, 0.6, H - t):
        m.box((W, t, D), (0, y + t / 2, 0), acr, bevel=0.0015, name="shelf")
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.cyl(0.008, H, (sx * (W / 2 - 0.015), H / 2, sz * (D / 2 - 0.015)), acr, seg=12, name="post")
    m.box((W - 0.03, 0.03, 0.004), (0, 0.6 + t + 0.015, -D / 2 + 0.01), acr, bevel=0.001, name="lip")
    m.box((W - 0.03, 0.03, 0.004), (0, 0.3 + t + 0.015, -D / 2 + 0.01), acr, bevel=0.001, name="lip")
    m.box((W - 0.03, 0.03, 0.004), (0, t + 0.015, -D / 2 + 0.01), acr, bevel=0.001, name="lip")
    return m


@asset("display_stand_floor.glb", (0.65, 1.00, 0.60))
def display_stand_floor(tint=None):
    m = Model("display_stand_floor")
    white = m.mat("tint", tint or "#c3b9ae", rough=0.55)
    W, D, t = 0.65, 0.60, 0.022
    heights = [0.36, 0.68, 1.00]
    sd = D / 3
    for sx in (-1, 1):
        m.prism(stair_outline([sd] * 3, heights), t, white, plane="zy",
                offset=sx * (W / 2) - (t if sx > 0 else 0), bevel=0.004, name="side")
    iw = W - 2 * t
    for i, h in enumerate(heights):
        zf = D / 2 - i * sd
        m.box((iw + 0.004, t, sd + 0.004), (0, h - t / 2, zf - sd / 2), white, bevel=0.004, name="step")
        lo = heights[i - 1] if i else 0.0
        m.box((iw, h - t - lo, 0.015), (0, lo + (h - t - lo) / 2, zf - 0.01), white, bevel=0.0, name="riser")
    m.box((iw, heights[-1], 0.015), (0, heights[-1] / 2, -D / 2 + 0.0075), white, bevel=0.0, name="back")
    return m

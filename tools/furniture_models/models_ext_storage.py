"""追加の棚・収納家具。正面 +Z、背面 -Z が壁側。"""
import math

import palette as P
from lib import Model, asset
from models_storage import open_shelf
from models_tables import tapered_legs


def drawer_stack(m, W, y0, y1, z_front, n, mat, knob, gap=0.006, inset=0.025, knobs=1, heights=None):
    """y0〜y1 に n 段の引き出し前板とつまみを並べる。heights は各段の比率 (下から)。"""
    ratios = heights or [1] * n
    total = y1 - y0 - gap * (n + 1)
    y = y0 + gap
    for r in ratios:
        dh = total * r / sum(ratios)
        cy = y + dh / 2
        m.box((W - 2 * inset, dh, 0.02), (0, cy, z_front - 0.01), mat, bevel=0.004, name="drawer")
        xs = [0.0] if knobs == 1 else [-W * 0.22, W * 0.22]
        for x in xs:
            m.cyl(0.011, 0.022, (x, cy, z_front + 0.011), knob, seg=14, axis="z", r2=0.015, bevel=0.004,
                  name="knob")
        y += dh + gap


def glass_door(m, w, h, center, frame, glass, stile=0.04, t=0.02):
    """木枠のガラス扉。center は扉の中心 (前面寄り)。"""
    x, y, z = center
    for sx in (-1, 1):
        m.box((stile, h, t), (x + sx * (w / 2 - stile / 2), y, z), frame, bevel=0.003, name="stile")
    for sy in (-1, 1):
        m.box((w - 2 * stile, stile, t), (x, y + sy * (h / 2 - stile / 2), z), frame, bevel=0.003, name="rail")
    m.box((w - 2 * stile + 0.004, h - 2 * stile + 0.004, 0.004), (x, y, z - 0.002), glass, bevel=0.0, name="glass")


# ---------- 棚 ----------
@asset("shelf_metal.glb", (0.90, 1.80, 0.45))
def shelf_metal(tint=None):
    m = Model("shelf_metal")
    steel = m.mat("tint", tint or "#a9a4bb", rough=0.6)
    foot = m.mat("foot", P.METAL_DARK, rough=0.7)
    W, H, D = 0.90, 1.80, 0.45
    pr = 0.016
    px, pz = W / 2 - pr, D / 2 - pr
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.cyl(pr, H - 0.025, (sx * px, 0.025 + (H - 0.025) / 2, sz * pz), steel, seg=12, name="pole")
            m.cyl(0.02, 0.025, (sx * px, 0.0125, sz * pz), foot, seg=12, name="foot")
    for y in (0.12, 0.52, 0.92, 1.32, 1.76):
        rh, rt = 0.026, 0.012
        for sz in (-1, 1):
            m.box((W - 2 * pr, rh, rt), (0, y, sz * (D / 2 - rt / 2 - 0.004)), steel, bevel=0.002, name="rim")
        for sx in (-1, 1):
            m.box((rt, rh, D - 2 * pr), (sx * (W / 2 - rt / 2 - 0.004), y, 0), steel, bevel=0.002, name="rim")
        # 前後方向のワイヤー
        n = 22
        for i in range(n):
            x = -W / 2 + 0.035 + i * (W - 0.07) / (n - 1)
            m.box((0.008, 0.007, D - 0.03), (x, y + rh / 2 - 0.004, 0), steel, bevel=0.0, name="wire")
        for z in (-0.1, 0.1):
            m.box((W - 0.04, 0.008, 0.008), (0, y - 0.004, z), steel, bevel=0.0, name="support")
    return m


@asset("shelf_cube_4x4.glb", (1.47, 1.47, 0.39))
def shelf_cube_4x4(tint=None):
    m = Model("shelf_cube_4x4")
    body = m.mat("tint", tint or "#c6bcb0", rough=0.6)
    open_shelf(m, 1.47, 1.47, 0.39, 4, body, t=0.032, kick=0.0, cols=4)
    return m


@asset("shelf_cube_boxes.glb", (0.80, 0.80, 0.35))
def shelf_cube_boxes(tint=None):
    m = Model("shelf_cube_boxes")
    body = m.mat("tint", tint or "#e0d4c2", rough=0.6)
    fabric = m.mat("box", "#b9c4d6", rough=0.95)
    strap = m.mat("strap", "#8a8099", rough=0.9)
    W, H, D, t = 0.80, 0.80, 0.35, 0.03
    open_shelf(m, W, H, D, 2, body, t=t, kick=0.0, cols=2)
    cw = (W - 3 * t) / 2  # 区画の内寸
    ch = (H - 3 * t) / 2
    for sx in (-1, 1):
        cx = sx * (cw / 2 + t / 2)
        bw, bh, bd = cw - 0.016, ch - 0.02, D - 0.05
        cy = t + 0.002 + bh / 2
        cz = D / 2 - 0.012 - bd / 2
        m.box((bw, bh, bd), (cx, cy, cz), fabric, bevel=0.012, seg=2, name="fabric_box")
        # 前面の取っ手ループ
        fz = cz + bd / 2
        m.box((0.05, 0.022, 0.006), (cx, cy + bh * 0.22, fz + 0.002), strap, bevel=0.002, name="tab")
        m.rod((cx - 0.035, cy + bh * 0.22, fz + 0.004), (cx - 0.03, cy + bh * 0.22 - 0.03, fz + 0.02), 0.005,
              strap, seg=8, name="loop")
        m.rod((cx + 0.035, cy + bh * 0.22, fz + 0.004), (cx + 0.03, cy + bh * 0.22 - 0.03, fz + 0.02), 0.005,
              strap, seg=8, name="loop")
        m.rod((cx - 0.03, cy + bh * 0.22 - 0.03, fz + 0.02), (cx + 0.03, cy + bh * 0.22 - 0.03, fz + 0.02), 0.005,
              strap, seg=8, name="loop")
    return m


# ---------- チェスト・衣装ケース ----------
@asset("chest_tall.glb", (0.50, 1.20, 0.40))
def chest_tall(tint=None):
    m = Model("chest_tall")
    body = m.mat("tint", tint or P.WOOD_LIGHT, rough=0.55)
    knob = m.mat("knob", P.WOOD_MED, rough=0.5)
    W, H, D = 0.50, 1.20, 0.40
    kick, top = 0.06, 0.025
    m.box((W - 0.04, kick, D - 0.06), (0, kick / 2, -0.02), knob, bevel=0.004, name="plinth")
    bh = H - kick - top
    m.box((W - 0.01, bh, D - 0.02), (0, kick + bh / 2, -0.01), body, bevel=0.005, name="carcass")
    m.box((W, top, D), (0, H - top / 2, 0), body, bevel=0.006, name="top")
    drawer_stack(m, W, kick + 0.01, H - top, D / 2, 6, body, knob, inset=0.02)
    return m


@asset("oshiire_case.glb", (0.45, 0.70, 0.55))
def oshiire_case(tint=None):
    """半透明の引き出し式衣装ケースを3段積み。"""
    m = Model("oshiire_case")
    frame = m.mat("tint", tint or "#ece7df", rough=0.6)
    body = m.mat("body", "#e3e0ee", rough=0.2, alpha=0.6)
    W, H, D = 0.45, 0.70, 0.55
    n = 3
    ch = H / n
    for i in range(n):
        y0 = i * ch
        # 外枠: 天板・底板・背面は不透明、側面は半透明
        m.box((W, 0.016, D), (0, y0 + ch - 0.008, 0), frame, bevel=0.005, name="case_top")
        m.box((W - 0.01, 0.012, D - 0.01), (0, y0 + 0.006, 0), frame, bevel=0.003, name="case_bottom")
        for sx in (-1, 1):
            m.box((0.008, ch - 0.028, D - 0.03), (sx * (W / 2 - 0.006), y0 + ch / 2, -0.01), body, bevel=0.0,
                  name="case_side")
            for sz in (-1, 1):
                m.box((0.016, ch - 0.028, 0.016), (sx * (W / 2 - 0.008), y0 + ch / 2, sz * (D / 2 - 0.02) - 0.006),
                      frame, bevel=0.003, name="corner")
        m.box((W - 0.02, ch - 0.028, 0.008), (0, y0 + ch / 2, -D / 2 + 0.006), body, bevel=0.0, name="case_back")
        # 引き出し前面 (半透明板 + 縁)
        fy = y0 + ch / 2
        fh = ch - 0.03
        m.box((W - 0.03, fh, 0.01), (0, fy, D / 2 - 0.012), body, bevel=0.0, name="drawer_front")
        for sy in (-1, 1):
            m.box((W - 0.03, 0.014, 0.016), (0, fy + sy * (fh / 2 - 0.007), D / 2 - 0.01), frame, bevel=0.003,
                  name="drawer_rim")
        for sx in (-1, 1):
            m.box((0.014, fh - 0.028, 0.016), (sx * (W / 2 - 0.022), fy, D / 2 - 0.01), frame, bevel=0.003,
                  name="drawer_rim")
        m.box((0.16, 0.03, 0.022), (0, fy + fh / 2 - 0.03, D / 2 - 0.003), frame, bevel=0.006, name="handle")
    return m


# ---------- キャビネット ----------
@asset("sideboard.glb", (1.60, 0.70, 0.45))
def sideboard(tint=None):
    m = Model("sideboard")
    body = m.mat("tint", tint or "#cdd8c8", rough=0.6)
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    W, H, D = 1.60, 0.70, 0.45
    leg, top = 0.18, 0.028
    bh = H - leg - top
    m.box((W - 0.02, bh, D - 0.03), (0, leg + bh / 2, -0.015), body, bevel=0.005, name="carcass")
    m.box((W, top, D), (0, H - top / 2, 0), wood, bevel=0.007, name="top")
    sw = (W - 0.02) / 3
    zf = D / 2
    y0, y1 = leg + 0.006, H - top - 0.006
    for sx in (-1, 1):
        cx = sx * sw
        m.box((sw - 0.012, y1 - y0, 0.02), (cx, (y0 + y1) / 2, zf - 0.01), body, bevel=0.004, name="door")
        hx = cx - sx * (sw / 2 - 0.05)
        m.box((0.016, 0.16, 0.016), (hx, (y0 + y1) / 2 + 0.04, zf + 0.008), wood, bevel=0.004, name="handle")
    # 中央は引き出し3段
    gap = 0.006
    dh = (y1 - y0 - 2 * gap) / 3
    for i in range(3):
        cy = y0 + i * (dh + gap) + dh / 2
        m.box((sw - 0.012, dh, 0.02), (0, cy, zf - 0.01), body, bevel=0.004, name="drawer")
        m.box((0.12, 0.014, 0.016), (0, cy + dh * 0.18, zf + 0.008), wood, bevel=0.004, name="pull")
    e = 0.07
    tapered_legs(m, [(sx * (W / 2 - e), sz * (D / 2 - e)) for sx in (-1, 1) for sz in (-1, 1)], leg + 0.002, wood,
                 top=0.05, bottom=0.032)
    return m


@asset("cabinet_glass.glb", (0.80, 1.20, 0.40))
def cabinet_glass(tint=None):
    m = Model("cabinet_glass")
    wood = m.mat("tint", tint or P.WOOD_LIGHT, rough=0.55)
    glass = m.mat("glass", P.GLASS, rough=0.05, alpha=0.25)
    knob = m.mat("knob", P.WOOD_MED, rough=0.5)
    W, H, D = 0.80, 1.20, 0.40
    t, kick = 0.028, 0.07
    zf = D / 2 - 0.02
    for sx in (-1, 1):
        m.box((t, H - 0.03, D - 0.02), (sx * (W / 2 - t / 2 - 0.005), (H - 0.03) / 2, -0.01), wood, bevel=0.004,
              name="side")
    m.box((W, 0.03, D), (0, H - 0.015, 0), wood, bevel=0.006, name="top")
    iw = W - 2 * t - 0.01
    m.box((iw, t, D - 0.04), (0, kick + t / 2, -0.01), wood, bevel=0.002, name="bottom")
    m.box((iw, kick, 0.02), (0, kick / 2, zf - 0.03), knob, bevel=0.003, name="kick")
    m.box((iw, H - 0.03, 0.008), (0, (H - 0.03) / 2, -D / 2 + 0.004), wood, bevel=0.0, name="back")
    for y in (0.43, 0.78):
        m.box((iw, 0.02, D - 0.07), (0, y, -0.025), wood, bevel=0.002, name="shelf")
    dy0, dy1 = kick + 0.004, H - 0.034
    dw = (W - 0.016) / 2
    for sx in (-1, 1):
        glass_door(m, dw - 0.004, dy1 - dy0, (sx * dw / 2, (dy0 + dy1) / 2, zf + 0.01), wood, glass, stile=0.045)
        m.cyl(0.011, 0.022, (sx * 0.04, 0.62, zf + 0.031), knob, seg=14, axis="z", r2=0.015, bevel=0.004,
              name="knob")
    return m


@asset("cupboard.glb", (0.80, 1.80, 0.45))
def cupboard(tint=None):
    """食器棚。上段ガラス扉、中段オープンカウンター、下段引き出しと扉。"""
    m = Model("cupboard")
    body = m.mat("tint", tint or "#ece3d4", rough=0.6)
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    glass = m.mat("glass", P.GLASS, rough=0.05, alpha=0.25)
    W, H, D = 0.80, 1.80, 0.45
    kick, ctop = 0.06, 0.85
    zf = D / 2
    # 下段
    m.box((W - 0.04, kick, D - 0.06), (0, kick / 2, -0.02), wood, bevel=0.003, name="plinth")
    lh = ctop - 0.03 - kick
    m.box((W - 0.01, lh, D - 0.03), (0, kick + lh / 2, -0.015), body, bevel=0.005, name="lower_carcass")
    m.box((W, 0.03, D), (0, ctop - 0.015, 0), wood, bevel=0.006, name="counter")
    y0, y1 = kick + 0.006, ctop - 0.036
    dr_h = 0.15
    for sx in (-1, 1):
        cx = sx * (W / 4 - 0.002)
        m.box((W / 2 - 0.016, dr_h, 0.02), (cx, y1 - dr_h / 2, zf - 0.04), body, bevel=0.004, name="drawer")
        m.box((0.1, 0.014, 0.016), (cx, y1 - dr_h / 2, zf - 0.022), wood, bevel=0.004, name="pull")
        door_h = y1 - dr_h - 0.006 - y0
        m.box((W / 2 - 0.016, door_h, 0.02), (cx, y0 + door_h / 2, zf - 0.04), body, bevel=0.004, name="door")
        m.box((0.016, 0.12, 0.016), (sx * 0.04, y0 + door_h - 0.09, zf - 0.022), wood, bevel=0.004, name="handle")
    # 中段のオープンスペースと上段 (奥行き浅め、背面揃え)
    ud = 0.34
    uz = -D / 2 + ud / 2
    t = 0.025
    for sx in (-1, 1):
        m.box((t, H - ctop, ud), (sx * (W / 2 - t / 2 - 0.005), ctop + (H - ctop) / 2, uz), body, bevel=0.004,
              name="upper_side")
    iw = W - 2 * t - 0.01
    m.box((iw, H - ctop, 0.008), (0, ctop + (H - ctop) / 2, -D / 2 + 0.004), body, bevel=0.0, name="back")
    m.box((W, 0.03, ud + 0.01), (0, H - 0.015, uz + 0.005), body, bevel=0.006, name="top")
    ub = 1.18
    m.box((iw, t, ud - 0.01), (0, ub + t / 2, uz), body, bevel=0.002, name="upper_bottom")
    m.box((iw, 0.018, ud - 0.05), (0, 1.48, uz - 0.015), body, bevel=0.002, name="upper_shelf")
    uzf = uz + ud / 2
    dy0, dy1 = ub + 0.003, H - 0.033
    dw = (W - 0.016) / 2
    for sx in (-1, 1):
        glass_door(m, dw - 0.004, dy1 - dy0, (sx * dw / 2, (dy0 + dy1) / 2, uzf + 0.01), body, glass, stile=0.04)
        m.cyl(0.01, 0.02, (sx * 0.04, ub + 0.12, uzf + 0.03), wood, seg=14, axis="z", r2=0.014, bevel=0.004,
              name="knob")
    return m


@asset("tv_stand_wide.glb", (1.80, 0.35, 0.40))
def tv_stand_wide(tint=None):
    m = Model("tv_stand_wide")
    body = m.mat("tint", tint or "#d8cbbb", rough=0.6)
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    W, H, D = 1.80, 0.35, 0.40
    base, top = 0.05, 0.03
    m.box((W - 0.1, base, D - 0.08), (0, base / 2, -0.02), wood, bevel=0.004, name="plinth")
    bh = H - base - top
    m.box((W, top, D), (0, H - top / 2, 0), wood, bevel=0.007, name="top")
    zf = D / 2
    cw = 0.60  # 中央の開口
    y0, y1 = base + 0.006, H - top - 0.006
    bw = (W - 0.01 - cw) / 2
    cd = D - 0.025
    for sx in (-1, 1):
        m.box((bw, bh, cd), (sx * (cw / 2 + bw / 2), base + bh / 2, -0.0125), body, bevel=0.005, name="carcass")
    m.box((cw + 0.01, 0.02, cd), (0, base + 0.01, -0.0125), body, bevel=0.002, name="niche_bottom")
    m.box((cw + 0.01, bh, 0.01), (0, base + bh / 2, -D / 2 + 0.005), body, bevel=0.0, name="niche_back")
    m.box((cw + 0.01, 0.018, cd - 0.03), (0, base + bh / 2 + 0.01, -0.0275), body, bevel=0.002,
          name="center_shelf")
    sw = bw
    for sx in (-1, 1):
        cx = sx * (cw / 2 + sw / 2)
        m.box((sw - 0.01, y1 - y0, 0.02), (cx, (y0 + y1) / 2, zf - 0.01), body, bevel=0.004, name="flap")
        m.box((0.14, 0.014, 0.016), (cx, y1 - 0.035, zf + 0.008), wood, bevel=0.004, name="pull")
    return m


# ---------- 靴・ワゴン ----------
@asset("shoe_rack.glb", (0.80, 0.50, 0.30))
def shoe_rack(tint=None):
    """前下がりの3段オープン靴ラック。"""
    m = Model("shoe_rack")
    frame = m.mat("tint", tint or P.METAL_DARK, rough=0.6)
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    W, H, D = 0.80, 0.50, 0.30
    p = 0.022
    zb, zfr = -D / 2 + p / 2, D / 2 - p / 2
    for sx in (-1, 1):
        x = sx * (W / 2 - p / 2)
        m.box((p, H, p), (x, H / 2, zb), frame, bevel=0.003, name="post")
        m.box((p, H - 0.025, p), (x, (H - 0.025) / 2, zfr), frame, bevel=0.003, name="post")
    slope = math.radians(12)
    run = zfr - zb
    for yb in (0.13, 0.31, 0.49):
        yf = yb - run * math.tan(slope)
        for sx in (-1, 1):
            x = sx * (W / 2 - p / 2)
            m.rod((x, yb - 0.01, zb), (x, yf - 0.01, zfr), 0.009, frame, seg=8, name="side_rail")
        # 板状のスラット (前下がり)
        for k in range(4):
            u = (k + 0.5) / 4
            z = zb + run * u
            y = yb - (yb - yf) * u
            m.box((W - 2 * p, 0.014, 0.05), (0, y, z), wood, bevel=0.003, rot=(math.degrees(slope), 0, 0),
                  name="slat")
        m.cyl(0.008, W - 2 * p, (0, yf + 0.025, zfr), frame, seg=8, axis="x", name="stopper")
    return m


@asset("shoe_cabinet.glb", (0.80, 1.00, 0.35))
def shoe_cabinet(tint=None):
    m = Model("shoe_cabinet")
    body = m.mat("tint", tint or "#e6dccd", rough=0.6)
    wood = m.mat("wood", P.WOOD_MED, rough=0.55)
    W, H, D = 0.80, 1.00, 0.35
    kick, top = 0.06, 0.03
    m.box((W - 0.04, kick, D - 0.05), (0, kick / 2, -0.015), wood, bevel=0.003, name="plinth")
    bh = H - kick - top
    m.box((W - 0.01, bh, D - 0.025), (0, kick + bh / 2, -0.0125), body, bevel=0.005, name="carcass")
    m.box((W, top, D), (0, H - top / 2, 0), wood, bevel=0.007, name="top")
    y0, y1 = kick + 0.006, H - top - 0.006
    dw = (W - 0.016) / 2
    for sx in (-1, 1):
        m.box((dw - 0.006, y1 - y0, 0.02), (sx * dw / 2, (y0 + y1) / 2, D / 2 - 0.01), body, bevel=0.004,
              name="door")
        m.box((0.016, 0.16, 0.016), (sx * 0.04, y1 - 0.16, D / 2 + 0.008), wood, bevel=0.004, name="handle")
    # 足元の通気スリット
    for sx in (-1, 1):
        for i in range(3):
            m.box((0.12, 0.008, 0.004), (sx * dw / 2, y0 + 0.05 + i * 0.022, D / 2 + 0.001), wood, bevel=0.0,
                  name="vent")
    return m


@asset("file_wagon.glb", (0.40, 0.60, 0.50))
def file_wagon(tint=None):
    m = Model("file_wagon")
    body = m.mat("tint", tint or "#d6d2de", rough=0.6)
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    wheel = m.mat("wheel", "#5b566b", rough=0.8)
    W, H, D = 0.40, 0.60, 0.50
    cast, top = 0.06, 0.025
    bh = H - cast - top
    m.box((W - 0.006, bh, D - 0.02), (0, cast + bh / 2, -0.01), body, bevel=0.005, name="carcass")
    m.box((W, top, D), (0, H - top / 2, 0), wood, bevel=0.006, name="top")
    y0, y1 = cast + 0.006, H - top - 0.006
    gap = 0.006
    ratios = [2.2, 1.2, 0.8]  # 下からファイル段・中段・浅い段
    total = y1 - y0 - gap * 2
    y = y0
    for r in ratios:
        dh = total * r / sum(ratios)
        cy = y + dh / 2
        m.box((W - 0.03, dh, 0.02), (0, cy, D / 2 - 0.01), body, bevel=0.004, name="drawer")
        m.box((0.12, 0.014, 0.016), (0, y + dh - 0.03, D / 2 + 0.008), wood, bevel=0.004, name="pull")
        y += dh + gap
    for sx in (-1, 1):
        for sz in (-1, 1):
            x, z = sx * (W / 2 - 0.05), sz * (D / 2 - 0.06)
            m.box((0.034, 0.012, 0.034), (x, cast - 0.006, z), wheel, bevel=0.003, name="caster_mount")
            m.cyl(0.024, 0.02, (x, 0.024, z), wheel, seg=14, axis="x", name="caster")
    return m


# ---------- 小物収納 ----------
@asset("wall_hooks.glb", (0.60, 0.15, 0.08))
def wall_hooks(tint=None):
    """壁付けのフックボード。背面 -Z が壁。"""
    m = Model("wall_hooks")
    board = m.mat("tint", tint or P.WOOD_LIGHT, rough=0.55)
    knob = m.mat("wood", P.WOOD_MED, rough=0.5)
    W, H, D = 0.60, 0.15, 0.08
    bt = 0.022
    zb = -D / 2 + bt / 2
    m.box((W, H, bt), (0, H / 2, zb), board, bevel=0.006, name="board")
    for i in range(5):
        x = -W / 2 + 0.08 + i * (W - 0.16) / 4
        m.cyl(0.009, D - bt - 0.012, (x, H / 2 - 0.01, -D / 2 + bt + (D - bt - 0.012) / 2), knob, seg=12,
              axis="z", r2=0.008, name="peg")
        m.sphere(0.016, (x, H / 2 - 0.01, D / 2 - 0.016), knob, seg=14, rings=8, name="knob")
    return m


@asset("storage_box_fabric.glb", (0.33, 0.33, 0.33))
def storage_box_fabric(tint=None):
    """布製の収納ボックス。前面に持ち手の切り欠き。"""
    m = Model("storage_box_fabric")
    fab = m.mat("tint", tint or "#c9b8a2", rough=0.95)
    trim = m.mat("trim", "#8f7a66", rough=0.9)
    S, t = 0.33, 0.012
    m.box((S - 0.01, 0.012, S - 0.01), (0, 0.006, 0), fab, bevel=0.004, name="bottom")
    for sx in (-1, 1):
        m.box((t, S - 0.012, S - 0.008), (sx * (S / 2 - t / 2), (S - 0.012) / 2, 0), fab, bevel=0.004, name="wall")
    m.box((S - 2 * t, S - 0.012, t), (0, (S - 0.012) / 2, -S / 2 + t / 2), fab, bevel=0.003, name="wall")
    # 前面: 切り欠き (幅hw, 高さhh) を囲むように分割
    hw, hh, hy = 0.11, 0.032, 0.255
    fw = S - 2 * t
    zf = S / 2 - t / 2
    m.box((fw, hy - hh / 2, t), (0, (hy - hh / 2) / 2, zf), fab, bevel=0.003, name="front")
    top_h = (S - 0.012) - (hy + hh / 2)
    m.box((fw, top_h, t), (0, hy + hh / 2 + top_h / 2, zf), fab, bevel=0.003, name="front")
    sw = (fw - hw) / 2
    for sx in (-1, 1):
        m.box((sw, hh, t), (sx * (hw / 2 + sw / 2), hy, zf), fab, bevel=0.0, name="front")
    # 切り欠きの縁取り
    for sy in (-1, 1):
        m.box((hw + 0.012, 0.006, t + 0.004), (0, hy + sy * (hh / 2 + 0.003), zf), trim, bevel=0.002,
              name="cutout_trim")
    for sx in (-1, 1):
        m.box((0.006, hh, t + 0.004), (sx * (hw / 2 + 0.003), hy, zf), trim, bevel=0.002, name="cutout_trim")
    # 上縁のパイピング
    for sz in (-1, 1):
        m.box((S, 0.012, 0.016), (0, S - 0.006, sz * (S / 2 - 0.008)), trim, bevel=0.004, name="rim")
    for sx in (-1, 1):
        m.box((0.016, 0.012, S - 0.032), (sx * (S / 2 - 0.008), S - 0.006, 0), trim, bevel=0.004, name="rim")
    return m

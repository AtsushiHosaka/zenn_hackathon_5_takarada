"""テーブル・デスク。"""
import math

import palette as P
from lib import Model, asset, circle, rrect


def tapered_legs(m, pts, h, mat, top=0.045, bottom=0.032):
    """角材の先細り脚。"""
    for x, z in pts:
        m.cyl(bottom * 0.75, h, (x, h / 2, z), mat, seg=4, r2=top * 0.75, rot=(0, 45, 0), name="leg")


def round_legs(m, pts, h, mat, r=0.026):
    for x, z in pts:
        m.cyl(r * 0.75, h, (x, h / 2, z), mat, seg=14, r2=r, name="leg")


def top_rect(m, W, D, y, t, mat, r=0.03):
    """角丸天板。y は天板上面。"""
    return m.prism(rrect(W, D, r), t, mat, plane="xz", offset=y - t, bevel=0.006, seg=2, name="top")


def apron(m, W, D, y_top, h, inset, mat):
    t = 0.02
    for sx in (-1, 1):
        m.box((t, h, D - 2 * inset), (sx * (W / 2 - inset), y_top - h / 2, 0), mat, bevel=0.003, name="apron")
    for sz in (-1, 1):
        m.box((W - 2 * inset, h, t), (0, y_top - h / 2, sz * (D / 2 - inset)), mat, bevel=0.003, name="apron")


@asset("table_low_rect.glb", (0.90, 0.38, 0.50), variants={
    "w075": {"size": (0.75, 0.38, 0.50)}, "w110": {"size": (1.10, 0.38, 0.50)}})
def table_low_rect(tint=None, size=(0.90, 0.38, 0.50)):
    m = Model("table_low_rect")
    wood = m.mat("wood", tint or P.WOOD_LIGHT, rough=0.55)
    (W, H, D), t = size, 0.035
    top_rect(m, W, D, H, t, wood, r=0.04)
    e = 0.06
    round_legs(m, [(sx * (W / 2 - e), sz * (D / 2 - e)) for sx in (-1, 1) for sz in (-1, 1)], H - t, wood, r=0.026)
    apron(m, W, D, H - t, 0.05, e, wood)
    return m


@asset("table_low_round.glb", (0.70, 0.38, 0.70))
def table_low_round(tint=None):
    m = Model("table_low_round")
    top = m.mat("tint", tint or P.IVORY, rough=0.7)
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    R, H, t = 0.35, 0.38, 0.032
    m.cyl(R, t, (0, H - t / 2, 0), top, seg=48, bevel=0.008, name="top")
    m.cyl(0.16, 0.02, (0, H - t - 0.01, 0), wood, seg=24, name="under_ring")
    for k in range(3):
        a = math.radians(90 + 120 * k)
        m.rod((0.13 * math.cos(a), H - t - 0.01, 0.13 * math.sin(a)), (0.25 * math.cos(a), 0, 0.25 * math.sin(a)),
              0.026, wood, seg=12, r2=0.019, name="leg")
    return m


@asset("table_dining_rect.glb", (1.20, 0.72, 0.75))
def table_dining_rect(tint=None):
    m = Model("table_dining_rect")
    wood = m.mat("wood", tint or P.WOOD_LIGHT, rough=0.55)
    W, D, H, t = 1.20, 0.75, 0.72, 0.04
    top_rect(m, W, D, H, t, wood, r=0.02)
    e = 0.07
    tapered_legs(m, [(sx * (W / 2 - e), sz * (D / 2 - e)) for sx in (-1, 1) for sz in (-1, 1)], H - t, wood,
                 top=0.055, bottom=0.04)
    apron(m, W, D, H - t, 0.08, e, wood)
    return m


@asset("table_dining_round.glb", (0.90, 0.72, 0.90))
def table_dining_round(tint=None):
    m = Model("table_dining_round")
    wood = m.mat("wood", tint or P.WOOD_LIGHT, rough=0.55)
    H, t = 0.72, 0.04
    m.cyl(0.45, t, (0, H - t / 2, 0), wood, seg=56, bevel=0.008, name="top")
    m.cyl(0.2, 0.03, (0, H - t - 0.015, 0), wood, seg=32, name="top_support")
    m.lathe([(0.27, 0.0), (0.27, 0.025), (0.2, 0.05), (0.07, 0.09), (0.055, 0.2), (0.05, H - t - 0.08),
             (0.07, H - t - 0.03), (0.07, H - t)], (0, 0, 0), wood, seg=40, name="pedestal")
    return m


@asset("desk_wood.glb", (1.00, 0.72, 0.50), variants={
    "w080": {"size": (0.80, 0.72, 0.50)}, "w120": {"size": (1.20, 0.72, 0.50)}})
def desk_wood(tint=None, size=(1.00, 0.72, 0.50)):
    m = Model("desk_wood")
    wood = m.mat("wood", tint or P.WOOD_LIGHT, rough=0.55)
    (W, H, D), t = size, 0.035
    top_rect(m, W, D, H, t, wood, r=0.015)
    e = 0.04
    tapered_legs(m, [(sx * (W / 2 - e), sz * (D / 2 - e)) for sx in (-1, 1) for sz in (-1, 1)], H - t, wood,
                 top=0.055, bottom=0.042)
    # 正面は椅子用に開け、左右と背面だけ幕板を付ける
    for sx in (-1, 1):
        m.box((0.02, 0.07, D - 2 * e), (sx * (W / 2 - e), H - t - 0.035, 0), wood, bevel=0.003, name="apron")
    m.box((W - 2 * e, 0.07, 0.02), (0, H - t - 0.035, -(D / 2 - e)), wood, bevel=0.003, name="apron")
    return m


def frame_leg(m, x, D, H, mat, t=0.038):
    """金属の口の字脚 (側面)。"""
    m.box((t, H, t), (x, H / 2, -(D / 2 - 0.04)), mat, bevel=0.003, name="frame_post")
    m.box((t, H, t), (x, H / 2, D / 2 - 0.04), mat, bevel=0.003, name="frame_post")
    m.box((t * 1.6, t, D - 0.02), (x, t / 2, 0), mat, bevel=0.004, name="frame_foot")
    m.box((t, t, D - 0.08), (x, H - t / 2, 0), mat, bevel=0.003, name="frame_top")


@asset("desk_wide.glb", (1.40, 0.72, 0.60))
def desk_wide(tint=None):
    m = Model("desk_wide")
    wood = m.mat("wood", tint or P.WOOD_LIGHT, rough=0.55)
    metal = m.mat("metal", P.METAL_DARK, rough=0.45, metal=0.5)
    W, D, H, t = 1.40, 0.60, 0.72, 0.035
    top_rect(m, W, D, H, t, wood, r=0.01)
    for sx in (-1, 1):
        frame_leg(m, sx * (W / 2 - 0.08), D, H - t, metal)
    m.box((W - 0.16, 0.03, 0.02), (0, H - t - 0.12, -(D / 2 - 0.04)), metal, bevel=0.003, name="cross_bar")
    return m


@asset("desk_l_left.glb", (1.40, 0.72, 1.20))
def desk_l_left(tint=None):
    m = Model("desk_l_left")
    wood = m.mat("wood", tint or P.WOOD_LIGHT, rough=0.55)
    metal = m.mat("metal", P.METAL_DARK, rough=0.45, metal=0.5)
    W, H, t = 1.40, 0.72, 0.035
    z0, zm, z1 = -0.60, -0.60 + 0.55, 0.60  # 背面, 主天板の手前, L字の手前
    xr = -W / 2 + 0.50  # L字(左)の内側
    outline = [(-W / 2, z0), (W / 2, z0), (W / 2, zm), (xr, zm), (xr, z1), (-W / 2, z1)]
    m.prism(outline, t, wood, plane="xz", offset=H - t, bevel=0.006, name="top")
    e = 0.03
    for x, z in [(-W / 2 + e, z0 + e), (W / 2 - e, z0 + e), (W / 2 - e, zm - e), (-W / 2 + e, z1 - e), (xr - e, z1 - e)]:
        m.box((0.042, H - t, 0.042), (x, (H - t) / 2, z), metal, bevel=0.004, name="leg")
    m.box((W - 2 * e, 0.03, 0.02), (0, H - t - 0.1, z0 + e), metal, bevel=0.003, name="rail")
    m.box((0.02, 0.03, z1 - z0 - 2 * e), (-W / 2 + e, H - t - 0.1, (z0 + z1) / 2), metal, bevel=0.003, name="rail")
    return m


@asset("desk_fold.glb", (0.80, 0.70, 0.45))
def desk_fold(tint=None):
    m = Model("desk_fold")
    wood = m.mat("wood", tint or P.WOOD_LIGHT, rough=0.55)
    metal = m.mat("metal", P.METAL_WHITE, rough=0.4, metal=0.3)
    W, D, H, t = 0.80, 0.45, 0.70, 0.03
    top_rect(m, W, D, H, t, wood, r=0.01)
    y_top = H - t
    for sx in (-1, 1):
        x = sx * (W / 2 - 0.06)
        m.rod((x, 0.012, -D / 2 + 0.03), (x, y_top - 0.012, D / 2 - 0.05), 0.012, metal, seg=10, name="x_leg")
        m.rod((x + sx * 0.026, 0.012, D / 2 - 0.03), (x + sx * 0.026, y_top - 0.012, -D / 2 + 0.05), 0.012, metal,
              seg=10, name="x_leg")
        m.box((0.03, 0.024, D - 0.02), (x + sx * 0.013, 0.012, 0), metal, bevel=0.005, name="foot")
        m.box((0.03, 0.02, D - 0.06), (x + sx * 0.013, y_top - 0.01, 0), metal, bevel=0.004, name="top_rail")
        m.cyl(0.016, 0.06, (x + sx * 0.013, y_top / 2, 0), metal, seg=12, axis="x", name="pivot")
    m.cyl(0.011, W - 0.12, (0, 0.03, -D / 2 + 0.03), metal, seg=10, axis="x", name="cross_bar")
    return m


@asset("side_table.glb", (0.40, 0.50, 0.40))
def side_table(tint=None):
    m = Model("side_table")
    body = m.mat("tint", tint or "#eee6d6", rough=0.7)
    H = 0.50
    m.cyl(0.2, 0.03, (0, H - 0.015, 0), body, seg=48, bevel=0.012, bseg=3, name="top")
    m.lathe([(0.0, 0.0), (0.15, 0.0), (0.155, 0.01), (0.15, 0.022), (0.07, 0.05), (0.055, 0.1), (0.055, H - 0.06),
             (0.08, H - 0.03)], (0, 0, 0), body, seg=40, cap_bottom=False, name="pedestal")
    return m

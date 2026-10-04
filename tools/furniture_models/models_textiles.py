"""布もの (ベッドカバー・カーテン・ラグ・クッション・タペストリー)。"""
import math

import palette as P
from lib import Model, asset, circle, rrect


@asset("bed_cover.glb", (1.00, 0.04, 2.00), variants={
    "101": {"tint": "#b9a3e3"}, "201": {"tint": "#9cae8c"}, "301": {"tint": "#efe6d8"}})
def bed_cover(tint=None, size=(1.00, 0.04, 2.00)):
    W, H, D = size
    m = Model("bed_cover")
    fab = m.mat("tint", tint or "#b9a3e3", rough=0.95)
    ob = m.cushion((W, H, D), (0, H / 2, 0), fab, puff=0.5, round_=0.45, cuts=10, name="cover")

    def wrinkle(co):
        u, v = co.x / (W / 2), co.z / (D / 2)
        if co.y > 0:
            co.y += H * 0.12 * math.sin(7 * u + 3 * v) * math.sin(5 * v) * (0.3 + 0.7 * max(abs(u), abs(v)))
        return co

    m.deform(ob, wrinkle)
    return m


def curtain_panels(m, W, H, D, mat, gap=0.04, pleats=7, thickness=0.006):
    pw = (W - gap) / 2
    amp = (D - thickness) / 2 * 0.95
    for sx in (-1, 1):
        x_in, x_out = sx * gap / 2, sx * W / 2

        def fn(u, v, x_in=x_in, x_out=x_out):
            x = x_in + (x_out - x_in) * u
            fullness = 0.75 + 0.25 * (1 - v)
            z = amp * fullness * math.sin(TWO_PI * pleats * u + 0.4)
            return (x, v * H, z)

        m.surface(pleats * 8 + 1, 14, fn, mat, thickness=thickness, name="panel")
        m.box((pw, 0.05, thickness * 2.2), ((x_in + x_out) / 2, H - 0.025, 0), mat, bevel=0.002, name="header")


TWO_PI = math.tau


@asset("curtain_pair.glb", (1.60, 2.00, 0.04), variants={"102": {"tint": "#8e6cc8"}, "202": {"tint": "#c8d6b4"}})
def curtain_pair(tint=None, size=(1.60, 2.00, 0.04)):
    m = Model("curtain_pair")
    fab = m.mat("tint", tint or "#8e6cc8", rough=0.95)
    curtain_panels(m, *size, fab)
    return m


@asset("curtain_sheer.glb", (1.60, 2.00, 0.04), variants={
    "115": {"tint": "#d9cdf0", "size": (1.00, 2.00, 0.04)},
    "302": {"tint": "#e6d9c4"},
    "901": {"tint": "#f5f3ee", "size": (1.00, 2.00, 0.03)}})
def curtain_sheer(tint=None, size=(1.60, 2.00, 0.04)):
    m = Model("curtain_sheer")
    fab = m.mat("tint", tint or "#f5f3ee", rough=0.9, alpha=0.55)
    W = size[0]
    curtain_panels(m, *size, fab, gap=0.03, pleats=max(4, round(9 * W / 1.6)), thickness=0.003)
    return m


def flat_rug(m, outline_outer, outline_inner, H, pile, trim):
    """縁取り(下地)と毛足(上)の2層。"""
    m.prism(outline_outer, H * 0.82, trim, plane="xz", offset=0.0, bevel=H * 0.3, name="trim")
    m.prism(outline_inner, H * 0.6, pile, plane="xz", offset=H * 0.4, bevel=H * 0.25, name="pile")


@asset("rug_rect.glb", (1.40, 0.03, 2.00), variants={
    "103": {"tint": "#c9b6e4"}, "203": {"tint": "#cdb58a", "size": (1.30, 0.02, 1.90)}})
def rug_rect(tint=None, size=(1.40, 0.03, 2.00)):
    W, H, D = size
    m = Model("rug_rect")
    color = tint or "#c9b6e4"
    pile = m.mat("tint", color, rough=1.0)
    trim = m.mat("trim", _shade(color, 0.86), rough=0.9)
    flat_rug(m, rrect(W, D, 0.05, 4), rrect(W - 0.07, D - 0.07, 0.03, 4), H, pile, trim)
    return m


@asset("rug_round.glb", (1.00, 0.02, 1.00), variants={
    "111": {"tint": "#cbb8ea"}, "211": {"tint": "#9fb48d", "size": (1.20, 0.02, 1.20)},
    "311": {"tint": "#f2ece2", "size": (1.00, 0.03, 1.00)}})
def rug_round(tint=None, size=(1.00, 0.02, 1.00)):
    W, H, D = size
    m = Model("rug_round")
    color = tint or "#cbb8ea"
    pile = m.mat("tint", color, rough=1.0)
    trim = m.mat("trim", _shade(color, 0.86), rough=0.9)
    flat_rug(m, circle(W / 2, 64), circle(W / 2 - 0.035, 64), H, pile, trim)
    return m


@asset("rug_wave.glb", (1.30, 0.02, 1.85))
def rug_wave(tint=None, size=(1.30, 0.02, 1.85)):
    W, H, D = size
    m = Model("rug_wave")
    pile = m.mat("tint", tint or "#d8c3a5", rough=1.0)
    pts = []
    n = 240
    for i in range(n):
        t = math.tau * i / n
        c, s_ = math.cos(t), math.sin(t)
        # 角の丸い長方形 (超楕円) に、外周に沿った柔らかな波を足す
        k = 5.0
        r = (abs(c) ** k + abs(s_) ** k) ** (-1 / k)
        wave = 1 + 0.035 * math.sin(14 * t)
        pts.append((c * r * wave * W / 2, s_ * r * wave * D / 2))
    m.prism(pts, H, pile, plane="xz", bevel=H * 0.35, fan=True, name="rug")
    return m


def _shade(hex_color, k):
    h = hex_color.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return "#%02x%02x%02x" % tuple(max(0, min(255, int(c * k))) for c in (r, g, b))


@asset("cushion.glb", (0.45, 0.15, 0.45), variants={
    "107": {"tint": "#7b4fc4"}, "207": {"tint": "#7c9a6a"}, "307": {"tint": "#f1ebe1"}})
def cushion(tint=None):
    m = Model("cushion")
    fab = m.mat("tint", tint or "#7b4fc4", rough=0.95)
    m.cushion((0.45, 0.15, 0.45), (0, 0.075, 0), fab, puff=0.7, round_=0.5, cuts=6, pinch=0.05, name="cushion")
    return m


@asset("tapestry.glb", (0.60, 0.90, 0.01))
def tapestry(tint=None):
    m = Model("tapestry")
    fab = m.mat("tint", tint or "#c3aee8", rough=0.95)
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    W, H = 0.60, 0.90

    def fn(u, v):
        x = (u - 0.5) * W
        sag = 0.008 * math.sin(math.pi * u) * (1 - v) ** 3
        z = 0.0015 * math.sin(u * math.pi * 5) * (1 - v * 0.7)
        return (x, sag + v * (H - 0.012 - 0.008) + 0.008 - 0.008 * (1 - v), z)

    m.surface(31, 12, fn, fab, thickness=0.0025, name="cloth")
    m.cyl(0.005, W + 0.02, (0, H - 0.006, 0.0), wood, seg=10, axis="x", name="dowel")
    return m

"""壁掛け・小物・機器。背面 -Z は平ら。"""
import math

import palette as P
from lib import Model, asset


def wave_outline(w, h, n=96, inset=0.0):
    """ゆるい波状で左右非対称の輪郭 (x, y)。"""
    pts = []
    for i in range(n):
        t = math.tau * i / n
        c, s = math.cos(t), math.sin(t)
        k = 3.2
        r = (abs(c) ** k + abs(s) ** k) ** (-1 / k)
        wave = 1 + 0.045 * math.sin(5 * t + 0.6) + 0.025 * math.sin(3 * t + 1.7)
        pts.append((c * (r * wave * w / 2 - inset), s * (r * wave * h / 2 - inset)))
    return pts


@asset("wall_mirror.glb", (0.40, 0.60, 0.03))
def wall_mirror(tint=None):
    m = Model("wall_mirror")
    frame = m.mat("tint", tint or "#e9e4dc", rough=0.6)
    mirror = m.mat("mirror", "#dfe8f2", rough=0.3)
    W, H = 0.40, 0.60
    m.prism(wave_outline(W, H), 0.024, frame, plane="xy", offset=-0.015, bevel=0.006, fan=True, name="frame")
    m.prism(wave_outline(W, H, inset=0.022), 0.006, mirror, plane="xy", offset=0.009, bevel=0.0015, fan=True,
            name="mirror")
    return m


@asset("wall_art.glb", (0.50, 0.40, 0.02))
def wall_art(tint=None):
    m = Model("wall_art")
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    paper = m.mat("tint", tint or "#e8eadc", rough=0.9)
    green = m.mat("print", "#7d9c6a", rough=0.9)
    W, H, D, f = 0.50, 0.40, 0.02, 0.022
    for sx in (-1, 1):
        m.box((f, H, D), (sx * (W / 2 - f / 2), H / 2, 0), wood, bevel=0.003, name="frame")
    for sy in (0, 1):
        m.box((W - 2 * f + 0.002, f, D), (0, f / 2 + sy * (H - f), 0), wood, bevel=0.003, name="frame")
    m.box((W - 2 * f, H - 2 * f, 0.004), (0, H / 2, -0.002), paper, bevel=0.0, name="paper")
    # 枝と葉のシンプルなイラスト (紙面から0.5mmだけ浮かせた平面)
    z = 0.0005
    stem = [(0.0, 0.085), (0.01, 0.16), (0.025, 0.24), (0.045, 0.31)]
    for (x0, y0), (x1, y1) in zip(stem, stem[1:]):
        dx, dy = x1 - x0, y1 - y0
        ln = math.hypot(dx, dy)
        nx, ny = -dy / ln * 0.002, dx / ln * 0.002
        m.prism([(x0 - nx, y0 - ny), (x1 - nx, y1 - ny), (x1 + nx, y1 + ny), (x0 + nx, y0 + ny)], 0.001, green,
                plane="xy", offset=z, name="stem_print")
    for k, (x, y) in enumerate([(0.004, 0.12), (0.014, 0.17), (0.022, 0.22), (0.034, 0.27), (0.045, 0.31)]):
        side = 1 if k % 2 else -1
        ang = math.radians(35 * side + 90)
        L, Wd = 0.06, 0.022
        pts = []
        for i in range(16):
            t = math.tau * i / 16
            lx, ly = L / 2 * (1 + math.cos(t)), Wd / 2 * math.sin(t) * (1 - 0.3 * math.cos(t))
            if k == 4:
                ang = math.radians(80)
            pts.append((x + lx * math.cos(ang) * -side * (-1 if k == 4 else 1) - ly * math.sin(ang),
                        y + lx * math.sin(ang) + ly * math.cos(ang)))
        m.prism(pts, 0.001, green, plane="xy", offset=z, fan=True, name="leaf_print")
    return m


@asset("monitor.glb", (0.55, 0.40, 0.18))
def monitor(tint=None):
    m = Model("monitor")
    body = m.mat("tint", tint or "#26272a", rough=0.5)
    screen = m.mat("screen", "#121418", rough=0.25)
    W = 0.55
    sh = 0.32
    y0 = 0.40 - sh
    m.box((W, sh, 0.018), (0, y0 + sh / 2, 0.02), body, bevel=0.004, name="panel")
    m.box((W - 0.016, sh - 0.03, 0.002), (0, y0 + sh / 2 + 0.006, 0.0295), screen, bevel=0.0, name="screen")
    m.box((0.2, 0.12, 0.02), (0, y0 + 0.13, 0.002), body, bevel=0.008, name="back_housing")
    m.box((0.05, 0.16, 0.02), (0, 0.09, -0.02), body, bevel=0.006, rot=(-8, 0, 0), name="neck")
    m.box((0.22, 0.012, 0.18), (0, 0.006, 0.0), body, bevel=0.005, name="foot")
    return m

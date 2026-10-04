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


# ---------- 追加モデル (2026-10-04) ----------

@asset("wall_clock.glb", (0.30, 0.30, 0.04))
def wall_clock(tint=None):
    m = Model("wall_clock")
    frame = m.mat("tint", tint or P.WOOD_LIGHT, rough=0.55)
    face = m.mat("face", "#efe6d8", rough=0.7)
    ink = m.mat("ink", "#4a4562", rough=0.7)
    R = 0.15
    m.cyl(R, 0.035, (0, R, -0.0025), frame, seg=48, axis="z", bevel=0.008, name="frame")
    m.cyl(R - 0.018, 0.004, (0, R, 0.016), face, seg=48, axis="z", name="face")
    for k in range(12):
        a = math.tau * k / 12
        size = (0.008, 0.022, 0.002) if k % 3 == 0 else (0.005, 0.012, 0.002)
        r = R - 0.035
        m.box(size, (r * math.sin(a), R + r * math.cos(a), 0.0185), ink, bevel=0.0, rot=(0, 0, -math.degrees(a)),
              name="tick")
    m.box((0.008, 0.06, 0.002), (0.02 * 0.7, R + 0.02, 0.0195), ink, bevel=0.0, rot=(0, 0, -40), name="hour_hand")
    m.box((0.005, 0.09, 0.002), (-0.03, R - 0.03, 0.0205), ink, bevel=0.0, rot=(0, 0, -135), name="minute_hand")
    m.cyl(0.008, 0.004, (0, R, 0.0215), ink, seg=12, axis="z", name="hub")
    return m


@asset("photo_frame.glb", (0.15, 0.20, 0.08))
def photo_frame(tint=None):
    """卓上に立てるフォトフレーム。背面の脚で支える。"""
    m = Model("photo_frame")
    frame = m.mat("tint", tint or P.WOOD_LIGHT, rough=0.55)
    photo = m.mat("print", "#c9b6e4", rough=0.8)
    W, H, f, d = 0.15, 0.195, 0.015, 0.014
    tilt = 12
    parts = []
    for sx in (-1, 1):
        parts.append(m.box((f, H, d), (sx * (W / 2 - f / 2), H / 2, 0), frame, bevel=0.002, name="frame"))
    for y in (f / 2, H - f / 2):
        parts.append(m.box((W - 2 * f, f, d), (0, y, 0), frame, bevel=0.002, name="frame"))
    parts.append(m.box((W - 2 * f, H - 2 * f, 0.003), (0, H / 2, 0.0), photo, bevel=0.0, name="photo"))
    parts.append(m.box((W - 0.01, H - 0.01, 0.003), (0, H / 2, -d / 2 + 0.0015), frame, bevel=0.0, name="back"))
    from lib import rot_matrix
    for ob in parts:
        m.apply(ob)
        ob.data.transform(rot_matrix((-tilt, 0, 0)))
    m.rod((0, 0.0, -0.065), (0, 0.12, -0.03), 0.004, frame, seg=6, name="easel")
    return m


@asset("plush_bear.glb", (0.30, 0.35, 0.25))
def plush_bear(tint=None):
    """座ったくまのぬいぐるみ。正面 +Z。"""
    m = Model("plush_bear")
    m.tol = 0.2  # 丸い形は目安寸法に合わせて少し伸縮する
    fur = m.mat("tint", tint or "#c99f7a", rough=0.95)
    light = m.mat("muzzle", "#ecd9c2", rough=0.95)
    ink = m.mat("eye", "#3a3242", rough=0.6)
    m.sphere(1, (0, 0.115, 0.0), fur, seg=24, rings=12, scale=(0.1, 0.115, 0.085), name="body")
    m.sphere(1, (0, 0.11, 0.06), light, seg=20, rings=10, scale=(0.065, 0.075, 0.035), name="belly")
    m.sphere(0.082, (0, 0.265, 0.01), fur, seg=24, rings=12, name="head")
    for sx in (-1, 1):
        m.sphere(0.032, (sx * 0.06, 0.335, 0.0), fur, seg=16, rings=8, name="ear")
        m.sphere(0.018, (sx * 0.06, 0.337, 0.018), light, seg=12, rings=6, name="ear_inner")
        m.sphere(1, (sx * 0.1, 0.14, 0.03), fur, seg=16, rings=8, scale=(0.032, 0.06, 0.035), name="arm")
        m.sphere(1, (sx * 0.06, 0.04, 0.07), fur, seg=16, rings=8, scale=(0.042, 0.04, 0.065), name="leg")
        m.sphere(1, (sx * 0.06, 0.04, 0.128), light, seg=12, rings=6, scale=(0.028, 0.028, 0.01), name="paw")
        m.sphere(0.009, (sx * 0.03, 0.285, 0.083), ink, seg=10, rings=6, name="eye")
    m.sphere(1, (0, 0.245, 0.075), light, seg=16, rings=8, scale=(0.035, 0.026, 0.022), name="muzzle")
    m.sphere(1, (0, 0.255, 0.096), ink, seg=10, rings=6, scale=(0.011, 0.008, 0.006), name="nose")
    return m


@asset("blanket_folded.glb", (0.50, 0.08, 0.35))
def blanket_folded(tint=None):
    m = Model("blanket_folded")
    fab = m.mat("tint", tint or "#d8b9a0", rough=0.95)
    for i in range(3):
        m.cushion((0.5 - 0.004 * i, 0.028, 0.35 - 0.006 * i), (0.003 * (i % 2), 0.014 + 0.026 * i, 0.002 * i), fab,
                  puff=0.3, round_=0.45, cuts=4, name="layer")
    return m


@asset("room_divider.glb", (1.20, 1.60, 0.25))
def room_divider(tint=None):
    """3枚を交互に折った衝立。"""
    m = Model("room_divider")
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    panel = m.mat("tint", tint or "#e6d8c6", rough=0.9)
    pw, H, f = 0.45, 1.60, 0.03
    ang = math.degrees(math.acos(1.17 / (3 * pw)))
    x, z = -1.17 / 2, 0.0
    from lib import rot_matrix
    from mathutils import Matrix
    for i in range(3):
        a = ang if i % 2 == 0 else -ang
        dx = pw * math.cos(math.radians(a))
        dz = pw * math.sin(math.radians(a))
        parts = []
        for sx in (-1, 1):
            parts.append(m.box((f, H, 0.025), (sx * (pw / 2 - f / 2), H / 2, 0), wood, bevel=0.004, name="stile"))
        for y in (0.06, H - f / 2):
            parts.append(m.box((pw - 2 * f, f, 0.025), (0, y, 0), wood, bevel=0.004, name="rail"))
        parts.append(m.box((pw - 2 * f, H - 0.06 - f - 0.015, 0.008), (0, (0.06 + H - f) / 2, 0), panel, bevel=0.0,
                           name="panel"))
        center = (x + dx / 2, 0, z + dz / 2)
        for ob in parts:
            m.apply(ob)
            ob.data.transform(Matrix.Translation(center) @ rot_matrix((0, -a, 0)))
        x += dx
        z += dz
    return m


@asset("trash_bin.glb", (0.25, 0.35, 0.25))
def trash_bin(tint=None):
    m = Model("trash_bin")
    body = m.mat("tint", tint or "#c6bcb0", rough=0.6)
    outer = [(0.0, 0.0), (0.108, 0.0), (0.112, 0.006), (0.125, 0.335), (0.125, 0.35)]
    inner = [(0.117, 0.35), (0.117, 0.336), (0.105, 0.012), (0.0, 0.012)]
    m.lathe(outer + inner, (0, 0, 0), body, seg=40, closed=False, cap_bottom=False, cap_top=False, name="bin")
    return m

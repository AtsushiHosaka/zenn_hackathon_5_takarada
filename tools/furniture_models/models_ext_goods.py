"""追加の植物・小物・壁掛け・ペット・屋外用品。壁掛けは背面 -Z が平ら。"""
import math
import random

import palette as P
from lib import Model, asset, rot_matrix, rrect
from mathutils import Matrix, Vector
from models_plants import leaf_mesh, pot


def xf(m, parts, mat):
    """部品のモディファイアを適用してから、メッシュへ変換行列を掛ける。"""
    for ob in parts:
        m.apply(ob)
        ob.data.transform(mat)


def flat(m, pts, mat, z, name="print"):
    """紙面へ貼る平らな図形 (x, y)。z は紙面からの位置。"""
    return m.prism(pts, 0.001, mat, plane="xy", offset=z, fan=True, name=name)


def ellipse(cx, cy, rx, ry, seg=28, rot=0.0):
    a0 = math.radians(rot)
    out = []
    for i in range(seg):
        t = math.tau * i / seg
        x, y = rx * math.cos(t), ry * math.sin(t)
        out.append((cx + x * math.cos(a0) - y * math.sin(a0), cy + x * math.sin(a0) + y * math.cos(a0)))
    return out


def arch(cx, y0, w, h, seg=12):
    """下が平らで上が半円のアーチ (x, y)。"""
    r = w / 2
    pts = [(cx - r, y0), (cx + r, y0)]
    for i in range(seg + 1):
        a = math.pi * i / seg
        pts.append((cx + r * math.cos(a), y0 + h - r + r * math.sin(a)))
    return pts


def frame(m, w, h, f, d, center, mat):
    """額縁の4辺。center は額の中心 (x, y)。奥行きは z=-d/2..d/2。"""
    cx, cy = center
    for sx in (-1, 1):
        m.box((f, h, d), (cx + sx * (w / 2 - f / 2), cy, 0), mat, bevel=0.002, name="frame")
    for sy in (-1, 1):
        m.box((w - 2 * f + 0.002, f, d), (cx, cy + sy * (h / 2 - f / 2), 0), mat, bevel=0.002, name="frame")


def heart_outline(L, W, n=8):
    """ポトスのハート形の葉 (x=幅, z=葉先方向)。"""
    right = []
    for i in range(n + 1):
        a = math.pi * i / n
        right.append((W / 2 * math.sin(a) ** 0.8, L * (0.55 + 0.5 * math.cos(a)) - 0.12 * L * math.sin(a) ** 6))
    left = [(-x, z) for x, z in reversed(right[1:-1])]
    return (right + [(0.0, 0.1 * L)] + left)[::-1]


def blade_outline(L, W, n=9):
    """サンセベリアの剣状の葉。根元はやや細く、先は尖る。"""
    right = []
    for i in range(n + 1):
        t = i / n
        right.append((W / 2 * min(1.0, 0.7 + 1.2 * t) * (1 - t) ** 0.55, L * t))
    left = [(-x, z) for x, z in reversed(right[:-1])]
    return right + left


# ---------- 植物 ----------

@asset("plant_snake.glb", (0.35, 0.70, 0.35))
def plant_snake(tint=None):
    m = Model("plant_snake")
    m.tol = 0.3  # 葉の広がりは目安寸法に合わせて伸縮する
    leaf = m.mat("leaf", tint or "#5f8f5a", rough=0.6)
    edge = m.mat("leaf_edge", "#d8d58a", rough=0.6)
    potm = m.mat("pot", "#d9c9b6", rough=0.7)
    soil = m.mat("soil", P.SOIL, rough=1.0)
    pot(m, 0.12, 0.095, 0.24, potm, soil)
    rnd = random.Random(31)
    for k in range(12):
        yaw = 137.5 * k + rnd.uniform(-15, 15)
        L = rnd.uniform(0.38, 0.52) if k < 8 else rnd.uniform(0.24, 0.32)
        W = rnd.uniform(0.06, 0.08)
        a = math.radians(yaw)
        r0 = rnd.uniform(0.02, 0.05)
        reach = rnd.uniform(0.11, 0.145)  # 葉先の外への張り出し
        pitch = math.degrees(math.acos(min(1.0, reach / L)))
        base = Vector((r0 * math.sin(a), 0.205, r0 * math.cos(a)))
        # 葉の向きは外向きに少しねじる
        face = yaw + rnd.uniform(-10, 10)
        leaf_mesh(m, blade_outline(L, W), edge, 0.004, base, face, pitch, curl=4.0, length=L, name="leaf_edge")
        leaf_mesh(m, blade_outline(L * 0.97, W * 0.7), leaf, 0.0065, base, face, pitch, curl=4.0, length=L,
                  name="leaf")
    return m


@asset("plant_cactus.glb", (0.15, 0.30, 0.15))
def plant_cactus(tint=None):
    m = Model("plant_cactus")
    m.tol = 0.3
    body = m.mat("leaf", tint or "#78a86a", rough=0.7)
    potm = m.mat("pot", "#e3b9a4", rough=0.7)
    soil = m.mat("soil", P.SOIL, rough=1.0)
    flower = m.mat("flower", "#f0a8bf", rough=0.7)
    pot(m, 0.06, 0.047, 0.09, potm, soil, rim=0.006)
    # 縦の稜はlatheの1つおきの頂点を縮めて作る
    prof = [(0.0, 0.06), (0.026, 0.06), (0.032, 0.08), (0.034, 0.12), (0.033, 0.2), (0.031, 0.245),
            (0.025, 0.268), (0.014, 0.28), (0.0, 0.283)]
    m.lathe(prof, (0, 0, 0), body, seg=20, pleat=0.14, name="cactus")
    for sx, y, top, ang in ((1, 0.15, 0.075, 0), (-1, 0.12, 0.055, -30)):
        a = math.radians(ang)
        dx, dz = sx * math.cos(a), math.sin(a)
        reach = 0.058
        c = Vector((dx * reach, y, dz * reach))
        m.rod(Vector((dx * 0.02, y - 0.004, dz * 0.02)), c, 0.0135, body, seg=12, name="arm")
        m.sphere(0.015, c, body, seg=12, rings=8, name="elbow")
        arm_prof = [(0.0, 0.0), (0.015, 0.0), (0.0155, top * 0.6), (0.012, top * 0.88), (0.006, top), (0.0, top + 0.002)]
        m.lathe(arm_prof, (c.x, c.y, c.z), body, seg=14, pleat=0.14, name="arm_up")
    for k in range(5):
        a = math.tau * k / 5
        m.sphere(1, (0.007 * math.cos(a), 0.287, 0.007 * math.sin(a)), flower, seg=8, rings=5,
                 scale=(0.007, 0.004, 0.007), name="petal")
    m.sphere(0.004, (0, 0.29, 0), potm, seg=8, rings=4, name="flower_center")
    return m


@asset("plant_pothos_hanging.glb", (0.40, 0.70, 0.40))
def plant_pothos_hanging(tint=None):
    m = Model("plant_pothos_hanging")
    m.tol = 0.3  # つるの広がりは目安寸法に合わせて伸縮する
    leaf = m.mat("leaf", tint or "#6aa45a", rough=0.6)
    potm = m.mat("pot", "#e8d2bc", rough=0.7)
    soil = m.mat("soil", P.SOIL, rough=1.0)
    cord = m.mat("cord", "#e9dcc4", rough=0.95)
    n0 = len(m.parts)
    pot(m, 0.11, 0.08, 0.15, potm, soil)
    py = 0.36  # 鉢の底の高さ
    xf(m, m.parts[n0:], Matrix.Translation((0, py, 0)))
    rim = py + 0.15
    # 上の輪 (縦向き) と3本のひも、鉢の下で結ぶマクラメ
    ring = [(0.022 + 0.005 * math.cos(math.tau * i / 8), 0.005 * math.sin(math.tau * i / 8)) for i in range(8)]
    ob = m.lathe(ring, (0, 0, 0), cord, seg=20, closed=True, cap_bottom=False, cap_top=False, name="ring")
    ob.data.transform(Matrix.Translation((0, 0.673, 0)) @ rot_matrix((90, 0, 0)))
    knot = Vector((0, 0.635, 0))
    m.sphere(0.012, knot, cord, seg=12, rings=6, name="knot")
    m.rod((0, 0.652, 0), knot, 0.005, cord, seg=6, name="cord")
    bottom = Vector((0, py - 0.035, 0))
    for k in range(3):
        a = math.tau * k / 3 + 0.4
        c, s = math.cos(a), math.sin(a)
        top = Vector((0.118 * c, rim + 0.005, 0.118 * s))
        mid = Vector((0.106 * c, py + 0.03, 0.106 * s))
        m.rod(knot, top, 0.0045, cord, seg=6, name="cord")
        m.rod(top, mid, 0.0045, cord, seg=6, name="cord")
        m.rod(mid, bottom, 0.0045, cord, seg=6, name="cord")
        m.sphere(0.008, mid, cord, seg=8, rings=4, name="knot")
    m.sphere(0.014, bottom, cord, seg=12, rings=6, name="knot")
    for k in range(5):
        a = math.tau * k / 5
        m.rod(bottom, bottom + Vector((0.012 * math.cos(a), -0.07, 0.012 * math.sin(a))), 0.003, cord, seg=5,
              name="tassel")
    # 鉢の縁から垂れるつると、ハート形の葉
    rnd = random.Random(17)
    heart = heart_outline(0.055, 0.05)
    small = heart_outline(0.04, 0.036)
    drops = [0.5, 0.42, 0.33, 0.26, 0.2, 0.36, 0.14, 0.28]
    for v, drop in enumerate(drops):
        a = math.tau * v / len(drops) + rnd.uniform(-0.2, 0.2)
        out_r = rnd.uniform(0.15, 0.18)
        pts = []
        for k in range(9):
            t = k / 8
            r = 0.09 + (out_r - 0.09) * math.sin(min(1.0, t * 2.5) * math.pi / 2)
            y = rim + 0.025 * math.sin(math.pi * min(1.0, t * 3)) - drop * max(0.0, t - 0.12) / 0.88
            aa = a + 0.25 * t * (1 if v % 2 else -1)
            pts.append(Vector((r * math.cos(aa), y, r * math.sin(aa))))
        for p0, p1 in zip(pts, pts[1:]):
            m.rod(p0, p1, 0.0028, leaf, seg=5, name="vine")
        nleaf = 4 + int(drop * 16)
        for k in range(nleaf):
            t = 0.15 + 0.85 * k / (nleaf - 1)
            i = min(7, int(t * 8))
            p = pts[i].lerp(pts[i + 1], t * 8 - i)
            outward = math.degrees(math.atan2(p.x, p.z)) + rnd.uniform(-50, 50) + (25 if k % 2 else -25)
            shape = heart if rnd.random() < 0.6 else small
            pitch = rnd.uniform(-35, 5) if t < 0.3 else rnd.uniform(-75, -45)
            leaf_mesh(m, shape, leaf, 0.003, p, outward, pitch, curl=3.0, length=0.055)
    return m


# ---------- 小物 ----------

@asset("watering_can.glb", (0.30, 0.22, 0.12))
def watering_can(tint=None):
    m = Model("watering_can")
    body = m.mat("tint", tint or "#a9c9bf", rough=0.6)
    accent = m.mat("accent", "#e9dcc8", rough=0.6)
    cx = -0.055
    m.lathe([(0.0, 0.0), (0.054, 0.0), (0.059, 0.008), (0.06, 0.12), (0.054, 0.142), (0.04, 0.152),
             (0.0, 0.153)], (cx, 0, 0), body, seg=36, name="body")
    m.cyl(0.024, 0.012, (cx - 0.015, 0.155, 0), accent, seg=20, bevel=0.003, name="opening")
    # 注ぎ口 (+X) と先端のはす口
    a, b = Vector((cx + 0.045, 0.03, 0)), Vector((0.152, 0.162, 0))
    m.rod(a, b, 0.013, body, seg=12, r2=0.008, name="spout")
    d = (b - a).normalized()
    m.rod(b - d * 0.005, b + d * 0.028, 0.01, accent, seg=16, r2=0.021, name="rose")
    m.rod(b + d * 0.028, b + d * 0.032, 0.021, accent, seg=16, name="rose_face")
    # 上の持ち手 (前後方向のアーチ)
    pts = []
    for i in range(9):
        t = math.pi * i / 8
        pts.append(Vector((cx - 0.05 * math.cos(t) * 1.0 + 0.0, 0.135 + 0.072 * math.sin(t), 0)))
    for p0, p1 in zip(pts, pts[1:]):
        m.rod(p0, p1, 0.009, body, seg=10, name="handle")
    for p in (pts[0], pts[-1]):
        m.sphere(0.0092, p, body, seg=10, rings=5, name="handle_joint")
    return m


@asset("figurine.glb", (0.12, 0.25, 0.12))
def figurine(tint=None):
    """丸い石を積んだオブジェ。"""
    m = Model("figurine")
    m.tol = 0.15
    tintm = m.mat("tint", tint or "#cdb8e0", rough=0.85)
    stone = m.mat("stone", "#e6d3bd", rough=0.9)
    sage = m.mat("stone2", "#a9c2a6", rough=0.9)
    stones = [(0.058, 0.034, 0.032, 0.0, 0.0, 0, stone), (0.046, 0.03, 0.09, 0.006, -0.004, 7, tintm),
              (0.037, 0.028, 0.143, -0.006, 0.004, -9, sage), (0.029, 0.026, 0.19, 0.004, -0.002, 6, stone),
              (0.019, 0.022, 0.232, -0.002, 0.002, -4, tintm)]
    for i, (r, hh, y, dx, dz, tilt, mat) in enumerate(stones):
        ob = m.sphere(1, (0, 0, 0), mat, seg=28, rings=14, scale=(r, hh, r), name="stone")
        if i == 0:  # 置いたときに安定する平らな底
            m.deform(ob, lambda co: Vector((co.x, max(co.y, -hh * 0.82), co.z)))
        ob.data.transform(Matrix.Translation((dx, y, dz)) @ rot_matrix((0, 30 * i, tilt)))
    return m


@asset("reed_diffuser.glb", (0.08, 0.25, 0.08))
def reed_diffuser(tint=None):
    m = Model("reed_diffuser")
    m.tol = 0.15
    glass = m.mat("tint", tint or "#e6b8a8", rough=0.4)
    cap = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    reed = m.mat("reed", "#b89a76", rough=0.9)
    m.lathe([(0.0, 0.0), (0.034, 0.0), (0.038, 0.006), (0.039, 0.06), (0.033, 0.078), (0.014, 0.088),
             (0.012, 0.095), (0.0, 0.095)], (0, 0, 0), glass, seg=32, name="bottle")
    m.cyl(0.014, 0.018, (0, 0.102, 0), cap, seg=20, bevel=0.003, name="collar")
    rnd = random.Random(9)
    for k in range(8):
        a = math.tau * k / 8 + rnd.uniform(-0.2, 0.2)
        lean = rnd.uniform(0.026, 0.04)
        top = rnd.uniform(0.235, 0.25)
        m.rod((0.003 * math.cos(a), 0.09, 0.003 * math.sin(a)), (lean * math.cos(a), top, lean * math.sin(a)), 0.0022,
              reed, seg=5, name="reed")
    return m


# ---------- 壁掛け ----------

@asset("poster.glb", (0.50, 0.70, 0.02))
def poster(tint=None):
    m = Model("poster")
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    paper = m.mat("tint", tint or "#f1e8dc", rough=0.9)
    pink = m.mat("print", "#e6a99a", rough=0.9)
    sage = m.mat("print2", "#9dbb9a", rough=0.9)
    W, H, f, D = 0.50, 0.70, 0.016, 0.02
    frame(m, W, H, f, D, (0, H / 2), wood)
    m.box((W - 2 * f, H - 2 * f, 0.004), (0, H / 2, -0.002), paper, bevel=0.0, name="paper")
    z = 0.0005
    flat(m, arch(-0.03, 0.14, 0.24, 0.36), sage, z)
    flat(m, ellipse(0.085, 0.47, 0.075, 0.075, seg=32), pink, z + 0.0012)
    flat(m, [(x, y) for x, y in ellipse(-0.12, 0.14, 0.07, 0.07, seg=32) if y >= 0.14] + [(-0.19, 0.14)], pink,
         z + 0.0012)
    # 下部の細い帯 (タイトル行の代わり)
    flat(m, [(-0.16, 0.085), (0.16, 0.085), (0.16, 0.093), (-0.16, 0.093)], sage, z)
    flat(m, [(-0.08, 0.065), (0.08, 0.065), (0.08, 0.07), (-0.08, 0.07)], pink, z)
    return m


@asset("photo_wall.glb", (0.90, 0.35, 0.02))
def photo_wall(tint=None):
    """大きさの違う3枚の額を横に並べ、背面の細い桟でつなぐ。"""
    m = Model("photo_wall")
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    paper = m.mat("paper", "#f3ece2", rough=0.9)
    pink = m.mat("tint", tint or "#e8b4b0", rough=0.9)
    sage = m.mat("print", "#9fbf9a", rough=0.9)
    f, D, cy = 0.016, 0.02, 0.175
    frames = [(0.24, 0.29, -0.33), (0.28, 0.35, -0.0), (0.22, 0.25, 0.34)]
    m.box((0.84, 0.03, 0.004), (0, cy, -0.008), wood, bevel=0.001, name="back_rail")
    z = 0.0005
    for i, (w, h, cx) in enumerate(frames):
        frame(m, w, h, f, D, (cx, cy), wood)
        m.box((w - 2 * f, h - 2 * f, 0.004), (cx, cy, -0.002), paper, bevel=0.0, name="mat")
        iw, ih = w - 2 * f - 0.05, h - 2 * f - 0.05
        y0 = cy - ih / 2
        if i == 0:  # 円とアーチ
            flat(m, [(cx - iw / 2, y0), (cx + iw / 2, y0), (cx + iw / 2, y0 + ih), (cx - iw / 2, y0 + ih)], pink, z)
            flat(m, arch(cx - 0.02, y0, 0.09, 0.13), sage, z + 0.0012)
            flat(m, ellipse(cx + 0.045, y0 + ih - 0.05, 0.03, 0.03), paper, z + 0.0012)
        elif i == 1:  # 山と太陽
            flat(m, [(cx - iw / 2, y0), (cx + iw / 2, y0), (cx + iw / 2, y0 + ih), (cx - iw / 2, y0 + ih)], sage, z)
            flat(m, [(cx - iw / 2, y0), (cx + 0.03, y0), (cx - 0.04, y0 + 0.12)], paper, z + 0.0012)
            flat(m, [(cx - 0.03, y0), (cx + iw / 2, y0), (cx + iw / 2, y0 + 0.06), (cx + 0.05, y0 + 0.15)], pink,
                 z + 0.0014)
            flat(m, ellipse(cx + 0.04, y0 + ih - 0.06, 0.035, 0.035), pink, z + 0.0012)
        else:  # 葉の形
            flat(m, [(cx - iw / 2, y0), (cx + iw / 2, y0), (cx + iw / 2, y0 + ih), (cx - iw / 2, y0 + ih)], paper, z)
            flat(m, ellipse(cx, cy, 0.035, 0.075, rot=20), sage, z + 0.0012)
            flat(m, ellipse(cx + 0.035, cy - 0.045, 0.022, 0.022), pink, z + 0.0014)
    return m


@asset("memo_board.glb", (0.60, 0.45, 0.02))
def memo_board(tint=None):
    m = Model("memo_board")
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    cork = m.mat("tint", tint or "#d6b48a", rough=0.95)
    paper = m.mat("paper", "#f3e4a8", rough=0.9)
    pin = m.mat("pin", "#e59a9a", rough=0.6)
    W, H, f, D = 0.60, 0.45, 0.026, 0.02
    frame(m, W, H, f, D, (0, H / 2), wood)
    m.box((W - 2 * f, H - 2 * f, 0.008), (0, H / 2, -0.006), cork, bevel=0.0, name="cork")
    zc = -0.002  # コルク面
    notes = [(-0.16, 0.29, 0.11, 0.11, -6), (-0.02, 0.27, 0.12, 0.09, 4), (0.15, 0.30, 0.09, 0.12, 8),
             (-0.10, 0.13, 0.14, 0.09, 3), (0.11, 0.13, 0.10, 0.10, -7)]
    for x, y, w, h, ang in notes:
        m.box((w, h, 0.001), (x, y, zc + 0.0005), paper, bevel=0.0, rot=(0, 0, ang), name="note")
        a = math.radians(ang)
        px, py = x - 0.0 * math.cos(a) - (h / 2 - 0.015) * math.sin(a), y + (h / 2 - 0.015) * math.cos(a)
        m.cyl(0.0015, 0.006, (px, py, zc + 0.003), pin, seg=6, axis="z", name="pin")
        m.sphere(1, (px, py, zc + 0.0075), pin, seg=12, rings=6, scale=(0.0075, 0.0075, 0.004), name="pin_head")
    return m


# ---------- 本 ----------

def book(m, L, t, D, cover, pages, mat):
    """横に寝かせた本。L=左右, t=厚み(上下), D=奥行き。背は +Z。作った部品を返す。"""
    b = 0.003
    parts = [m.box((L, b, D), (0, -t / 2 + b / 2, 0), cover, bevel=0.0012, name="cover"),
             m.box((L, b, D), (0, t / 2 - b / 2, 0), cover, bevel=0.0012, name="cover"),
             m.box((L, t, 0.004), (0, 0, D / 2 - 0.002), cover, bevel=0.0015, name="spine"),
             m.box((L - 0.008, t - 2 * b + 0.001, D - 0.008), (0, 0, -0.002), pages, bevel=0.0, name="pages")]
    xf(m, parts, mat)
    return parts


@asset("books_row.glb", (0.40, 0.25, 0.20))
def books_row(tint=None):
    m = Model("books_row")
    covers = [m.mat("tint", tint or "#e3a9a6", rough=0.85), m.mat("book2", "#9fbfae", rough=0.85),
              m.mat("book3", "#bfb0dc", rough=0.85)]
    pages = m.mat("paper", "#f2ebdd", rough=0.9)
    rnd = random.Random(12)
    thick = [rnd.uniform(0.02, 0.031) for _ in range(12)]
    inner = 0.40 - 2 * 0.012
    k = inner / sum(thick)
    thick = [t * k for t in thick]
    x = -inner / 2
    order = [0, 1, 2, 1, 0, 2, 2, 0, 1, 0, 2, 1]
    foot = 0.07  # ブックエンドの足 (本の下へ差し込む板)
    for i, t in enumerate(thick):
        h = rnd.uniform(0.18, 0.25) if i != 6 else 0.25
        d = rnd.uniform(0.15, 0.19)
        cx = x + t / 2
        y0 = 0.004 if (cx - t / 2 < -inner / 2 + foot or cx + t / 2 > inner / 2 - foot) else 0.0
        mat = Matrix.Translation((cx, y0 + h / 2, 0.1 - d / 2 - 0.004)) @ rot_matrix((0, 0, 90))
        book(m, h, t, d, covers[order[i]], pages, mat)
        x += t
    for sx in (-1, 1):
        prof = [(-0.07, 0.0), (0.07, 0.0), (0.07, 0.13), (0.05, 0.155), (0.0, 0.165), (-0.05, 0.155), (-0.07, 0.13)]
        m.prism(prof, 0.008, pages, plane="zy", offset=sx * (inner / 2 + 0.004) - 0.004, bevel=0.002,
                center=(0, 0, 0.0), name="bookend")
        m.box((foot + 0.008, 0.004, 0.14), (sx * (inner / 2 - foot / 2 + 0.004), 0.002, 0.0), pages, bevel=0.001,
              name="bookend_foot")
    return m


@asset("books_stack.glb", (0.25, 0.15, 0.18))
def books_stack(tint=None):
    m = Model("books_stack")
    covers = [m.mat("tint", tint or "#e3a9a6", rough=0.85), m.mat("book2", "#9fbfae", rough=0.85),
              m.mat("book3", "#bfb0dc", rough=0.85)]
    pages = m.mat("paper", "#f2ebdd", rough=0.9)
    y = 0.0
    for i, (L, D, t, yaw, dx) in enumerate([(0.24, 0.17, 0.034, 3, 0.0), (0.21, 0.155, 0.028, -6, 0.008),
                                             (0.22, 0.15, 0.032, 4, -0.006), (0.18, 0.13, 0.026, -8, 0.006),
                                             (0.16, 0.12, 0.03, 9, -0.004)]):
        book(m, L, t, D, covers[i % 3], pages,
             Matrix.Translation((dx, y + t / 2, 0)) @ rot_matrix((0, yaw, 0)))
        y += t
    return m


# ---------- 食器 ----------

def mug(m, x, z, y0, handle_yaw, body, coffee):
    m.lathe([(0.0, 0.0), (0.033, 0.0), (0.036, 0.005), (0.037, 0.088), (0.0325, 0.088), (0.031, 0.012),
             (0.0, 0.012)], (x, y0, z), body, seg=32, cap_bottom=False, cap_top=False, name="mug")
    m.cyl(0.031, 0.002, (x, y0 + 0.068, z), coffee, seg=28, name="coffee")
    a = math.radians(handle_yaw)
    dvec = Vector((math.cos(a), 0, -math.sin(a)))
    pts = [Vector((x, y0, z)) + dvec * (0.034 + 0.022 * math.sin(math.pi * i / 6))
           + Vector((0, 0.046 + 0.024 * math.cos(math.pi * i / 6), 0)) for i in range(7)]
    for p0, p1 in zip(pts, pts[1:]):
        m.rod(p0, p1, 0.0055, body, seg=8, name="handle")


@asset("tableware_set.glb", (0.35, 0.10, 0.25))
def tableware_set(tint=None):
    m = Model("tableware_set")
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    body = m.mat("tint", tint or "#a9c4dc", rough=0.6)
    plate = m.mat("plate", "#efe5d6", rough=0.6)
    coffee = m.mat("coffee", "#9a6f52", rough=0.8)
    W, D = 0.35, 0.25
    m.prism(rrect(W, D, 0.02), 0.01, wood, plane="xz", offset=0.0, bevel=0.003, name="tray")
    for sz in (-1, 1):
        m.box((W, 0.03, 0.012), (0, 0.015, sz * (D / 2 - 0.006)), wood, bevel=0.004, name="tray_wall")
    for sx in (-1, 1):
        m.box((0.012, 0.03, D - 0.02), (sx * (W / 2 - 0.006), 0.015, 0), wood, bevel=0.004, name="tray_wall")
    y0 = 0.01
    mug(m, -0.11, -0.035, y0, 20, body, coffee)
    mug(m, -0.015, 0.05, y0, -90, body, coffee)
    m.lathe([(0.0, 0.0), (0.042, 0.0), (0.048, 0.004), (0.064, 0.012), (0.062, 0.015), (0.046, 0.008),
             (0.0, 0.008)], (0.085, y0, 0.0), plate, seg=36, name="plate")
    for cx, cz in ((0.07, -0.01), (0.1, 0.018)):
        m.cyl(0.019, 0.008, (cx, y0 + 0.012, cz), coffee, seg=18, bevel=0.003, name="cookie")
    return m


# ---------- ランドリー ----------

@asset("laundry_basket.glb", (0.45, 0.55, 0.35))
def laundry_basket(tint=None):
    m = Model("laundry_basket")
    body = m.mat("tint", tint or "#d8bf98", rough=0.9)
    weave = m.mat("weave", "#b89870", rough=0.9)
    sz = 0.35 / 0.45
    H, step = 0.5, 0.0125
    outer = [(0.0, 0.0), (0.185, 0.0), (0.19, 0.008)]
    n = int((H - 0.02) / step)
    for k in range(n + 1):
        y = 0.012 + k * step
        outer.append((0.19 + 0.025 * y / H, y))
    inner = [(0.202, H - 0.004), (0.18, 0.025), (0.0, 0.025)]
    seg = 48
    ob = m.lathe(outer + inner, (0, 0, 0), body, seg=seg, cap_bottom=False, cap_top=False, name="basket")

    def woven(co):
        r = math.hypot(co.x, co.z)
        if r > 0.185 and 0.01 < co.y < H - 0.008 and r > 0.19 + 0.025 * co.y / H - 0.002:
            i = round((math.atan2(co.z, co.x) % math.tau) / (math.tau / seg))
            j = round((co.y - 0.012) / step)
            k = 1 + (0.018 if (i // 2 + j // 2) % 2 else 0.0)
            co.x *= k
            co.z *= k
        co.z *= sz
        return co

    m.deform(ob, woven)
    for y, r, rr in ((H, 0.212, 0.012), (0.12, 0.2045, 0.006), (0.36, 0.212, 0.006), (0.012, 0.192, 0.008)):
        prof = [(r + rr * math.cos(math.tau * i / 8), y + rr * math.sin(math.tau * i / 8)) for i in range(8)]
        ob = m.lathe(prof, (0, 0, 0), weave, seg=seg, closed=True, cap_bottom=False, cap_top=False, name="band")
        ob.data.transform(Matrix.Diagonal((1, 1, sz, 1)))
    for sx in (-1, 1):
        pts = [Vector((sx * 0.205, H - 0.005 + 0.043 * math.sin(math.pi * i / 8), 0.075 * math.cos(math.pi * i / 8)))
               for i in range(9)]
        for p0, p1 in zip(pts, pts[1:]):
            m.rod(p0, p1, 0.0085, weave, seg=8, name="handle")
    return m


@asset("drying_rack.glb", (0.90, 1.10, 0.55))
def drying_rack(tint=None):
    """A字に開いた床置きの物干しラック。"""
    m = Model("drying_rack")
    frame_m = m.mat("tint", tint or "#e3e0e8", rough=0.6)
    rail = m.mat("rail", "#b9c9d6", rough=0.6)
    X, top, foot_z = 0.42, 1.085, 0.25

    def zf(y, s):
        return s * (foot_z - (foot_z - 0.02) * y / top)

    for sx in (-1, 1):
        for s in (-1, 1):
            m.rod((sx * X, 0.0, zf(0.0, s)), (sx * X, top, zf(top, s)), 0.014, frame_m, seg=10, name="leg")
            m.box((0.036, 0.016, 0.05), (sx * X, 0.008, zf(0.0, s)), rail, bevel=0.006, name="foot")
        # 前後の脚をつなぐ開き止め
        m.rod((sx * (X - 0.005), 0.42, zf(0.42, -1)), (sx * (X - 0.005), 0.42, zf(0.42, 1)), 0.006, rail, seg=6,
              name="stay")
    m.rod((-X - 0.012, top, 0), (X + 0.012, top, 0), 0.015, frame_m, seg=12, name="hinge")
    for sx in (-1, 1):
        m.sphere(0.017, (sx * (X + 0.012), top, 0), frame_m, seg=12, rings=6, name="hinge_cap")
    for s in (-1, 1):
        for y in (0.16, 0.62, 0.74, 0.86, 0.98):
            m.rod((-X, y, zf(y, s)), (X, y, zf(y, s)), 0.0065 if y > 0.2 else 0.01, rail if y > 0.2 else frame_m,
                  seg=8, name="rail")
    return m


# ---------- ペット ----------

def sisal_post(m, x, z, y0, y1, r, mat):
    """麻縄を巻いた柱。半径を交互に変えて巻き目を出す。"""
    prof = [(0.0, y0), (r * 0.95, y0)]
    n = int((y1 - y0) / 0.012)
    for k in range(n + 1):
        prof.append((r + (0.003 if k % 2 else 0.0), y0 + (y1 - y0) * k / n))
    prof += [(r * 0.95, y1), (0.0, y1)]
    m.lathe(prof, (x, 0, z), mat, seg=14, name="post")


@asset("cat_tower.glb", (0.55, 1.40, 0.45))
def cat_tower(tint=None):
    m = Model("cat_tower")
    fab = m.mat("tint", tint or "#d9cfe6", rough=0.95)
    sisal = m.mat("sisal", "#d8c09a", rough=0.95)
    soft = m.mat("cushion", "#f1e6dc", rough=0.95)
    m.box((0.55, 0.04, 0.45), (0, 0.02, 0), fab, bevel=0.012, name="base")
    # 箱型のハウス (正面にアーチの出入口)
    hx, hw, hh, hd, t = -0.10, 0.30, 0.28, 0.30, 0.02
    y0 = 0.04
    m.box((hw, hh, t), (hx, y0 + hh / 2, -hd / 2 + t / 2), fab, bevel=0.006, name="house_back")
    for sx in (-1, 1):
        m.box((t, hh, hd), (hx + sx * (hw / 2 - t / 2), y0 + hh / 2, 0), fab, bevel=0.006, name="house_side")
    ow, oh = 0.16, 0.2  # 出入口の幅と高さ
    zf = hd / 2 - t / 2
    for sx in (-1, 1):
        pw = (hw - ow) / 2
        m.box((pw, hh, t), (hx + sx * (ow / 2 + pw / 2), y0 + hh / 2, zf), fab, bevel=0.004, name="house_front")
    r = ow / 2
    n = 10
    for i in range(n):
        a0, a1 = math.pi * i / n, math.pi * (i + 1) / n
        p0 = (hx + r * math.cos(a0), y0 + oh - r + r * math.sin(a0))
        p1 = (hx + r * math.cos(a1), y0 + oh - r + r * math.sin(a1))
        quad = [p0, (p0[0], y0 + hh), (p1[0], y0 + hh), p1]
        m.prism(quad, t, fab, plane="xy", offset=zf - t / 2, name="house_arch")
    m.box((hw - 2 * t, 0.012, hd - 2 * t), (hx, y0 + 0.006, -0.005), soft, bevel=0.004, name="house_mat")
    # 台と柱
    m.box((0.32, 0.03, 0.32), (hx, 0.335, 0), fab, bevel=0.012, name="roof")
    sisal_post(m, 0.17, -0.08, 0.04, 0.70, 0.04, sisal)
    m.box((0.32, 0.03, 0.30), (0.11, 0.715, 0), fab, bevel=0.012, name="platform")
    sisal_post(m, -0.17, -0.06, 0.35, 1.05, 0.04, sisal)
    m.box((0.30, 0.03, 0.30), (-0.12, 1.065, 0), fab, bevel=0.012, name="platform")
    sisal_post(m, 0.15, 0.04, 0.73, 1.30, 0.04, sisal)
    # 一番上の丸いベッド
    m.lathe([(0.0, 0.0), (0.15, 0.0), (0.168, 0.02), (0.17, 0.07), (0.16, 0.098), (0.142, 0.1), (0.132, 0.08),
             (0.128, 0.04), (0.0, 0.04)], (0.1, 1.30, 0), fab, seg=36, name="bed")
    m.lathe([(0.0, 0.0), (0.12, 0.0), (0.13, 0.012), (0.12, 0.025), (0.0, 0.03)], (0.1, 1.335, 0), soft, seg=28,
            name="bed_cushion")
    # ぶら下がるボール
    m.rod((-0.24, 1.05, 0.11), (-0.24, 0.94, 0.11), 0.003, sisal, seg=5, name="toy_string")
    m.sphere(0.022, (-0.24, 0.925, 0.11), soft, seg=14, rings=8, name="toy_ball")
    return m


@asset("pet_bed.glb", (0.60, 0.20, 0.50))
def pet_bed(tint=None):
    """楕円のドーナツ型ベッド。前側の縁を少し低くする。"""
    m = Model("pet_bed")
    fab = m.mat("tint", tint or "#e3c3b6", rough=0.95)
    soft = m.mat("cushion", "#f0e5da", rough=0.95)
    R, rr, cy = 0.21, 0.09, 0.105
    prof = [(R + rr * math.cos(math.tau * i / 16), cy + rr * math.sin(math.tau * i / 16)) for i in range(16)]
    bolster = m.lathe(prof, (0, 0, 0), fab, seg=48, closed=True, cap_bottom=False, cap_top=False, name="bolster")
    base = m.lathe([(0.0, 0.0), (0.2, 0.0), (0.225, 0.015), (0.22, 0.04), (0.0, 0.04)], (0, 0, 0), fab, seg=48,
                   name="base")
    pad = m.lathe([(0.0, 0.035), (0.19, 0.035), (0.205, 0.055), (0.19, 0.078), (0.11, 0.088), (0.0, 0.09)],
                  (0, 0, 0), soft, seg=40, name="pad")

    def shape(co):
        r = math.hypot(co.x, co.z)
        if r > 0.12:  # 前側 (+Z) の縁を低くする
            front = max(0.0, co.z / r) ** 2
            co.y = 0.03 + (co.y - 0.03) * (1 - 0.3 * front) if co.y > 0.03 else co.y
        co.z *= 0.5 / 0.6
        return co

    for ob in (bolster, base, pad):
        m.deform(ob, shape)
    return m


# ---------- 屋外 ----------

def folding_chair(m, mat, frame_m, wood):
    """正面 +Z の折りたたみチェア。部品を作って mat で配置する。"""
    parts = []
    for sx in (-1, 1):
        parts.append(m.rod((sx * 0.17, 0.0, -0.16), (sx * 0.17, 0.8, -0.215), 0.012, frame_m, seg=10, name="back_post"))
        parts.append(m.rod((sx * 0.152, 0.0, 0.19), (sx * 0.152, 0.44, -0.1), 0.011, frame_m, seg=10, name="front_leg"))
        parts.append(m.rod((sx * 0.165, 0.44, -0.19), (sx * 0.165, 0.44, 0.18), 0.01, frame_m, seg=8, name="seat_rail"))
    parts.append(m.rod((-0.152, 0.07, 0.15), (0.152, 0.07, 0.15), 0.008, frame_m, seg=8, name="foot_bar"))
    parts.append(m.rod((-0.17, 0.2, -0.174), (0.17, 0.2, -0.174), 0.008, frame_m, seg=8, name="foot_bar"))
    for k in range(5):
        z = -0.15 + 0.075 * k
        parts.append(m.box((0.37, 0.016, 0.062), (0, 0.458, z), wood, bevel=0.004, name="seat_slat"))
    for y in (0.62, 0.74):
        z = -0.16 - 0.055 * y / 0.8 + 0.014
        parts.append(m.box((0.36, 0.07, 0.014), (0, y, z), wood, bevel=0.004, rot=(-4, 0, 0), name="back_slat"))
    xf(m, parts, mat)


@asset("balcony_set.glb", (1.20, 0.80, 0.60))
def balcony_set(tint=None):
    m = Model("balcony_set")
    frame_m = m.mat("tint", tint or "#9fc2b4", rough=0.6)
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    # 丸い折りたたみテーブル
    m.cyl(0.29, 0.02, (0, 0.71, 0), frame_m, seg=40, bevel=0.006, name="table_top")
    m.cyl(0.22, 0.02, (0, 0.69, 0), frame_m, seg=32, name="apron")
    for xs, s in ((0.12, -1), (0.09, 1)):
        for sx in (-1, 1):
            m.rod((sx * xs, 0.0, s * 0.25), (sx * xs, 0.69, -s * 0.13), 0.012, frame_m, seg=10, name="table_leg")
        m.rod((-xs, 0.06, s * 0.226), (xs, 0.06, s * 0.226), 0.008, frame_m, seg=8, name="table_bar")
    cx = 0.368
    folding_chair(m, Matrix.Translation((cx, 0, 0)) @ rot_matrix((0, -90, 0)), frame_m, wood)
    folding_chair(m, Matrix.Translation((-cx, 0, 0)) @ rot_matrix((0, 90, 0)), frame_m, wood)
    return m

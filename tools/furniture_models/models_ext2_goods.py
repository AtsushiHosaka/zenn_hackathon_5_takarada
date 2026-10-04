"""追加の植物・推し活グッズ・趣味の小物 (第2弾)。壁掛けは背面 -Z が平ら。"""
import math
import random

import bmesh
import palette as P
from lib import Model, asset, rot_matrix, rrect
from mathutils import Matrix, Vector
from models_plants import leaf_mesh, pot


def xf(m, parts, mat):
    """部品のモディファイアを適用してから、メッシュへ変換行列を掛ける。"""
    for ob in parts:
        m.apply(ob)
        ob.data.transform(mat)


def orient(m, ob, p, direction):
    """+Y 向きに作った部品を、点 p から direction の向きへ置き直す。"""
    m.apply(ob)
    q = Vector((0, 1, 0)).rotation_difference(Vector(direction).normalized())
    ob.data.transform(Matrix.Translation(p) @ q.to_matrix().to_4x4())
    return ob


def lance(L, W, n=8, p=0.9):
    """先の尖った楕円形の葉 (x=幅, z=葉先方向)。"""
    right = [(W / 2 * math.sin(math.pi * i / n) ** p, L * i / n) for i in range(n + 1)]
    left = [(-x, z) for x, z in reversed(right[1:-1])]
    return right + left


def spoon(L, W, n=6):
    """多肉植物の肉厚な葉。根元は細く、先は丸みのある三角。"""
    right = []
    for i in range(n + 1):
        t = i / n
        right.append((W / 2 * math.sin(math.pi * t ** 0.75) ** 0.6, L * t))
    left = [(-x, z) for x, z in reversed(right[1:-1])]
    return right + left


def rosette(m, c, R, mat, rnd, rings=((8, 1.0, 14), (7, 0.8, 34), (5, 0.6, 56), (4, 0.4, 76)), W=0.55,
            thick=0.004):
    """エケベリア風のロゼット。外側ほど寝かせ、内側ほど立てる。"""
    c = Vector(c)
    for k, (n, s, pitch) in enumerate(rings):
        L = R * s
        for i in range(n):
            yaw = 360 * i / n + 23 * k + rnd.uniform(-8, 8)
            leaf_mesh(m, spoon(L, L * W), mat, thick, c + Vector((0, 0.002 * k, 0)), yaw,
                      pitch + rnd.uniform(-5, 5), length=L, name="rosette_leaf")
    m.sphere(R * 0.12, c + Vector((0, R * 0.12, 0)), mat, seg=10, rings=6, name="rosette_bud")


def heart(cx, cy, s, n=28):
    """ハート形の輪郭 (x, y)。s はおおよその幅。"""
    pts = []
    for i in range(n):
        t = math.tau * i / n
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((cx + x * s / 32, cy + y * s / 32))
    return pts[::-1]


def star(cx, cy, r, n=5, inner=0.45, rot=90):
    pts = []
    for i in range(2 * n):
        a = math.radians(rot) + math.pi * i / n
        rr = r if i % 2 == 0 else r * inner
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return pts


def flat(m, pts, mat, z, name="print"):
    """正面へ貼る平らな図形 (x, y)。z は貼る面の位置。"""
    return m.prism(pts, 0.001, mat, plane="xy", offset=z, fan=True, name=name)


def ellipse(cx, cy, rx, ry, seg=24):
    return [(cx + rx * math.cos(math.tau * i / seg), cy + ry * math.sin(math.tau * i / seg)) for i in range(seg)]


def blob(m, center, scale, mat, rot=None, seg=20, rings=10, name="blob"):
    """回転付きの楕円体。"""
    ob = m.sphere(1, (0, 0, 0), mat, seg=seg, rings=rings, scale=scale, name=name)
    ob.data.transform(Matrix.Translation(center) @ (rot_matrix(rot) if rot else Matrix.Identity(4)))
    return ob


# ---------- 植物 ----------

@asset("plant_pachira.glb", (0.50, 1.20, 0.50))
def plant_pachira(tint=None):
    """パキラ。3本を編んだ幹の先に、手のひら状の葉 (小葉5〜7枚) を付ける。"""
    m = Model("plant_pachira")
    m.tol = 0.5  # 枝葉の広がりは目安寸法に合わせて伸縮する
    leaf = m.mat("leaf", tint or "#68a85a", rough=0.6)
    stem = m.mat("stem", "#a08a6c", rough=0.8)
    potm = m.mat("pot", "#e3cdb4", rough=0.7)
    soil = m.mat("soil", P.SOIL, rough=1.0)
    pot(m, 0.13, 0.1, 0.28, potm, soil)
    rnd = random.Random(41)
    y0, y1, n = 0.25, 0.82, 18
    tops = []
    for s in range(3):
        pts = []
        for k in range(n + 1):
            t = k / n
            a = math.tau * s / 3 + t * 2.2 * math.tau
            r = 0.017 + 0.012 * max(0.0, t - 0.85) / 0.15  # 先端で少し開く
            pts.append(Vector((r * math.cos(a), y0 + (y1 - y0) * t, r * math.sin(a))))
        for i, (p0, p1) in enumerate(zip(pts, pts[1:])):
            rr = 0.017 - 0.006 * i / n
            m.rod(p0, p1, rr, stem, seg=8, r2=rr - 0.0003, name="trunk")
        tops.append(pts[-1])
    for c in range(12):
        a = math.tau * c / 12 * 2.0 + rnd.uniform(-0.2, 0.2)
        elev = math.radians(rnd.uniform(22, 70))
        L = rnd.uniform(0.12, 0.2)
        start = tops[c % 3]
        d = Vector((math.cos(a) * math.cos(elev), math.sin(elev), math.sin(a) * math.cos(elev)))
        end = start + d * L
        m.rod(start, end, 0.0045, stem, seg=6, r2=0.0035, name="petiole")
        k = rnd.choice((5, 6, 7))
        spread = 150 if k > 5 else 130
        yaw0 = 90 - math.degrees(a)  # 葉柄の外向きの方位
        for j in range(k):
            off = -spread / 2 + spread * j / (k - 1)
            size = 1.0 - 0.35 * abs(off) / (spread / 2)  # 中央の小葉ほど長い
            Lf = rnd.uniform(0.14, 0.165) * size
            leaf_mesh(m, lance(Lf, Lf * 0.34), leaf, 0.003, end, yaw0 + off, rnd.uniform(5, 20), droop=0.25,
                      curl=1.2, length=Lf)
    return m


@asset("plant_dracaena.glb", (0.45, 1.30, 0.45))
def plant_dracaena(tint=None):
    """ドラセナ (幸福の木)。高さ違いの太い幹の先に、細長い葉の房。"""
    m = Model("plant_dracaena")
    m.tol = 0.5  # 枝葉の広がりは目安寸法に合わせて伸縮する
    leaf = m.mat("leaf", tint or "#6aa55c", rough=0.6)
    cane = m.mat("stem", "#a88a6a", rough=0.85)
    potm = m.mat("pot", "#d9cfc6", rough=0.7)
    soil = m.mat("soil", P.SOIL, rough=1.0)
    pot(m, 0.12, 0.095, 0.26, potm, soil)
    rnd = random.Random(52)
    canes = [((0.035, -0.02), 0.96, 0.026), ((-0.04, 0.025), 0.74, 0.024), ((0.0, 0.045), 0.52, 0.022)]
    for (cx, cz), top, r in canes:
        lean = Vector((cx * 0.6, 0, cz * 0.6))
        base = Vector((cx, 0.24, cz))
        tip = Vector((cx, top, cz)) + lean
        m.rod(base, tip, r, cane, seg=10, r2=r * 0.9, name="cane")
        m.cyl(r * 0.9, 0.006, (tip.x, tip.y + 0.003, tip.z), cane, seg=10, bevel=0.002, name="cane_cap")
        steps = int((top - 0.3) / 0.07)
        for k in range(1, steps):
            p = base.lerp(tip, k / steps)
            m.cyl(r * 1.06, 0.006, tuple(p), cane, seg=10, bevel=0.002, name="node")
        # 幹の先から伸びる新芽の上に葉の房
        shoot = tip + Vector((rnd.uniform(-0.02, 0.02), 0.06, rnd.uniform(-0.02, 0.02)))
        m.rod(tip + Vector((0, -0.01, 0)), shoot, r * 0.45, leaf, seg=8, r2=r * 0.35, name="shoot")
        count = 16
        for k in range(count):
            t = k / (count - 1)
            pitch = 80 - 62 * t + rnd.uniform(-6, 6)  # 内側は立ち、外側は垂れる
            L = rnd.uniform(0.2, 0.25) * (0.85 + 0.2 * t)
            yaw = 137.5 * k + rnd.uniform(-10, 10)
            p = shoot + Vector((0, -0.05 * t, 0))
            leaf_mesh(m, lance(L, rnd.uniform(0.032, 0.042), n=10, p=0.6), leaf, 0.003, p, yaw, pitch,
                      droop=0.3 + 0.2 * t, curl=3.0, length=L)
    return m


@asset("plant_succulents.glb", (0.25, 0.12, 0.15))
def plant_succulents(tint=None):
    """浅い角鉢に、色違いのロゼットを寄せ植えにする。"""
    m = Model("plant_succulents")
    m.tol = 0.3
    leaf = m.mat("leaf", tint or "#93b98a", rough=0.6)
    leaf2 = m.mat("leaf2", "#cfa0b4", rough=0.6)
    potm = m.mat("pot", "#ddc4b0", rough=0.7)
    soil = m.mat("soil", P.SOIL, rough=1.0)
    W, D, H, t = 0.25, 0.15, 0.055, 0.012
    m.prism(rrect(W, D, 0.018), 0.01, potm, plane="xz", offset=0.0, bevel=0.003, name="planter_bottom")
    for sz in (-1, 1):
        m.box((W, H, t), (0, H / 2, sz * (D / 2 - t / 2)), potm, bevel=0.004, name="planter_wall")
    for sx in (-1, 1):
        m.box((t, H, D - 0.004), (sx * (W / 2 - t / 2), H / 2, 0), potm, bevel=0.004, name="planter_wall")
    m.box((W - 2 * t + 0.002, 0.008, D - 2 * t + 0.002), (0, H - 0.01, 0), soil, bevel=0.0, name="soil")
    rnd = random.Random(17)
    ys = H - 0.006
    rosette(m, (-0.07, ys, -0.015), 0.045, leaf, rnd)
    rosette(m, (0.04, ys, 0.02), 0.04, leaf2, rnd)
    rosette(m, (0.085, ys, -0.03), 0.028, leaf, rnd, rings=((7, 1.0, 20), (5, 0.7, 45), (4, 0.45, 70)))
    rosette(m, (-0.015, ys, -0.035), 0.026, leaf2, rnd, rings=((7, 1.0, 20), (5, 0.7, 45), (4, 0.45, 70)))
    # ハオルチア風の立った尖り葉
    c = Vector((-0.02, ys, 0.03))
    for k in range(11):
        L = rnd.uniform(0.055, 0.065) * (1.0 if k > 3 else 0.8)
        leaf_mesh(m, spoon(L, 0.013, n=5), leaf, 0.005, c, 137.5 * k, 50 + 3 * k, length=L, name="spike")
    for k in range(5):
        x, z = rnd.uniform(-0.1, 0.1), rnd.uniform(-0.05, 0.05)
        blob(m, (x, ys + 0.002, z), (0.009, 0.005, 0.008), potm, rot=(0, rnd.uniform(0, 180), 0), seg=10, rings=5,
             name="pebble")
    return m


@asset("dried_flowers.glb", (0.20, 0.45, 0.20))
def dried_flowers(tint=None):
    """花瓶に挿したパンパスグラス風の穂と、ドライの小花。"""
    m = Model("dried_flowers")
    m.tol = 0.3  # 穂の広がりは目安寸法に合わせて伸縮する
    vase = m.mat("tint", tint or "#e3bfae", rough=0.6)
    plume = m.mat("plume", "#efe0c6", rough=0.95)
    stem = m.mat("stem", "#b39a76", rough=0.9)
    flower = m.mat("flower", "#d69aa0", rough=0.85)
    m.lathe([(0.0, 0.0), (0.045, 0.0), (0.056, 0.03), (0.062, 0.08), (0.054, 0.125), (0.03, 0.165),
             (0.024, 0.185), (0.03, 0.198), (0.026, 0.2), (0.0, 0.195)], (0, 0, 0), vase, seg=36, name="vase")
    rnd = random.Random(23)
    mouth = Vector((0, 0.19, 0))
    # パンパスの穂
    for k in range(5):
        a = math.tau * k / 5 + rnd.uniform(-0.3, 0.3)
        lean = rnd.uniform(0.03, 0.06)
        top = Vector((lean * math.cos(a), rnd.uniform(0.32, 0.36), lean * math.sin(a)))
        m.rod(mouth + Vector((0.004 * math.cos(a), 0, 0.004 * math.sin(a))), top, 0.0025, stem, seg=6, name="stem")
        Lp = rnd.uniform(0.12, 0.14)
        nr = 14
        prof = [(0.0, 0.0)] + [(0.024 * math.sin(math.pi * (i / nr) ** 0.7) ** 0.7 * (1 - 0.3 * i / nr),
                                Lp * i / nr) for i in range(1, nr)] + [(0.0, Lp)]
        ob = m.lathe(prof, (0, 0, 0), plume, seg=16, pleat=0.12, name="plume")

        def fluff(co):  # 穂の毛羽立ち
            k = 1 + rnd.uniform(-0.06, 0.1)
            co.x *= k
            co.z *= k
            co.x += 0.006 * (co.y / Lp) ** 2  # 穂先を少しなびかせる
            return co

        m.deform(ob, fluff)
        orient(m, ob, top - (top - mouth).normalized() * 0.02, top - mouth)
    # ウサギノオ風の小さな穂
    for k in range(4):
        a = math.tau * (k + 0.5) / 4 + rnd.uniform(-0.3, 0.3)
        lean = rnd.uniform(0.06, 0.08)
        top = Vector((lean * math.cos(a), rnd.uniform(0.27, 0.3), lean * math.sin(a)))
        m.rod(mouth, top, 0.0016, stem, seg=5, name="stem")
        d = (top - mouth).normalized()
        blob(m, top + d * 0.014, (0.009, 0.016, 0.009), plume,
             rot=None, seg=10, rings=6, name="tail")
    # 小花の付いた枝
    for k in range(3):
        a = math.tau * k / 3 + 0.9
        lean = 0.05
        top = Vector((lean * math.cos(a), 0.29 + 0.01 * k, lean * math.sin(a)))
        m.rod(mouth, top, 0.0018, stem, seg=5, name="branch")
        for j in range(5):
            b = a + rnd.uniform(-1.2, 1.2)
            p = mouth.lerp(top, rnd.uniform(0.55, 1.0))
            q = p + Vector((0.02 * math.cos(b), rnd.uniform(0.0, 0.02), 0.02 * math.sin(b)))
            m.rod(p, q, 0.0012, stem, seg=4, name="twig")
            m.sphere(0.0065, q, flower, seg=8, rings=5, name="bud")
    return m


@asset("terrarium.glb", (0.18, 0.22, 0.18))
def terrarium(tint=None):
    """口の開いたガラスの球に、砂・小石・小さな多肉と苔。"""
    m = Model("terrarium")
    glass = m.mat("glass", "#dcebf2", rough=0.1, alpha=0.3)
    sand = m.mat("sand", "#e8d2a6", rough=1.0)
    stone = m.mat("stone", "#b9b2c4", rough=0.9)
    leaf = m.mat("leaf", tint or "#86b27a", rough=0.6)
    Rx, Ry = 0.09, 0.095
    cy = Ry * math.sin(math.radians(60))
    prof = [(0.0, 0.0)]
    for i in range(13):
        ph = math.radians(-60 + 120 * i / 12)
        prof.append((Rx * math.cos(ph), cy + Ry * math.sin(ph)))
    top = prof[-1][1]
    prof += [(0.042, top + 0.006), (0.04, 0.208), (0.045, 0.216), (0.046, 0.22)]
    m.lathe(prof, (0, 0, 0), glass, seg=40, cap_top=False, name="globe")

    def inner_r(y):
        s = max(-1.0, min(1.0, (y - cy) / Ry))
        return Rx * math.cos(math.asin(s)) - 0.003

    sp = [(0.0, 0.002)] + [(inner_r(0.002 + 0.048 * i / 6), 0.002 + 0.048 * i / 6) for i in range(7)]
    sp += [(inner_r(0.05) * 0.6, 0.056), (0.0, 0.058)]
    m.lathe(sp, (0, 0, 0), sand, seg=32, name="sand")
    rnd = random.Random(6)
    for x, z, s in ((0.035, 0.03, 0.013), (0.045, -0.01, 0.009), (-0.04, 0.035, 0.01), (0.015, 0.05, 0.007)):
        blob(m, (x, 0.054, z), (s, s * 0.6, s * 0.85), stone, rot=(0, rnd.uniform(0, 180), 0), seg=12, rings=6,
             name="stone")
    rosette(m, (-0.01, 0.056, -0.005), 0.032, leaf, rnd, rings=((7, 1.0, 22), (5, 0.7, 48), (4, 0.45, 72)))
    for x, z, s in ((-0.045, -0.03, 0.016), (0.03, -0.04, 0.013), (-0.05, 0.01, 0.011)):
        blob(m, (x, 0.052, z), (s, s * 0.55, s), leaf, seg=12, rings=6, name="moss")
    return m


# ---------- 水槽 ----------

@asset("aquarium.glb", (0.45, 0.35, 0.25))
def aquarium(tint=None):
    """フレーム付きのガラス水槽。水 (半透明) の中に砂利・水草・小魚。"""
    m = Model("aquarium")
    frame = m.mat("tint", tint or "#cfd8e6", rough=0.6)
    water = m.mat("water", "#a9d6ec", rough=0.1, alpha=0.35)
    gravel = m.mat("gravel", "#dcc6a2", rough=1.0)
    plant = m.mat("leaf", "#6fae6a", rough=0.6)
    fish = m.mat("fish", "#f2a07b", rough=0.7)
    W, H, D, f = 0.45, 0.35, 0.25, 0.014
    m.box((W, 0.025, D), (0, 0.0125, 0), frame, bevel=0.004, name="base")
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box((f, 0.305, f), (sx * (W / 2 - f / 2), 0.025 + 0.1525, sz * (D / 2 - f / 2)), frame, bevel=0.002,
                  name="corner")
    for sz in (-1, 1):
        m.box((W, 0.016, f), (0, 0.33 - 0.008 + 0.0, sz * (D / 2 - f / 2)), frame, bevel=0.003, name="rim")
    for sx in (-1, 1):
        m.box((f, 0.016, D), (sx * (W / 2 - f / 2), 0.322, 0), frame, bevel=0.003, name="rim")
    m.box((W + 0.004, 0.02, D + 0.004), (0, 0.34, 0), frame, bevel=0.006, name="lid")
    m.box((W - 0.012, 0.29, D - 0.012), (0, 0.025 + 0.145, 0), water, bevel=0.002, name="water")
    m.box((W - 0.02, 0.03, D - 0.02), (0, 0.04, 0), gravel, bevel=0.004, name="gravel")
    rnd = random.Random(14)
    for k in range(18):
        x, z = rnd.uniform(-0.19, 0.19), rnd.uniform(-0.09, 0.09)
        s = rnd.uniform(0.008, 0.014)
        blob(m, (x, 0.055, z), (s, s * 0.6, s), gravel, rot=(0, rnd.uniform(0, 180), 0), seg=8, rings=4,
             name="pebble")
    blob(m, (0.1, 0.065, -0.05), (0.04, 0.03, 0.03), gravel, rot=(0, 20, 8), seg=14, rings=8, name="rock")
    # 水草 (背面寄りに細長い葉)
    for cx, cz, n, hgt in ((-0.15, -0.07, 9, 0.22), (-0.06, -0.08, 7, 0.17), (0.16, -0.06, 8, 0.2),
                           (0.05, -0.085, 6, 0.13)):
        for k in range(n):
            L = hgt * rnd.uniform(0.7, 1.0)
            leaf_mesh(m, lance(L, rnd.uniform(0.011, 0.015), n=8, p=0.5), plant, 0.002,
                      Vector((cx + rnd.uniform(-0.01, 0.01), 0.052, cz)), rnd.uniform(-60, 60) + 180 * (k % 2),
                      rnd.uniform(68, 84), droop=rnd.uniform(-0.15, 0.15), length=L, name="weed")
    for x, z in ((-0.02, 0.05), (0.12, 0.04)):
        for k in range(7):
            a = math.tau * k / 7
            blob(m, (x + 0.014 * math.cos(a), 0.072, z + 0.012 * math.sin(a)), (0.012, 0.018, 0.012), plant,
                 seg=10, rings=6, name="bush")
    # 小魚 (側面を正面へ向ける)
    for x, y, z, d, s in ((-0.08, 0.2, 0.03, 1, 1.0), (0.06, 0.25, -0.01, -1, 0.9), (0.13, 0.15, 0.04, -1, 0.8),
                          (-0.14, 0.27, 0.0, 1, 0.75)):
        blob(m, (x, y, z), (0.016 * s, 0.01 * s, 0.005 * s), fish, seg=14, rings=8, name="fish")
        tx = x - d * 0.016 * s
        tail = [(tx, y), (tx - d * 0.013 * s, y + 0.008 * s), (tx - d * 0.013 * s, y - 0.008 * s)]
        if d < 0:
            tail = tail[::-1]
        m.prism(tail, 0.003 * s, fish, plane="xy", offset=z - 0.0015 * s, name="fish_tail")
        m.sphere(0.0018 * s, (x + d * 0.009 * s, y + 0.002 * s, z + 0.0045 * s), frame, seg=6, rings=4,
                 name="fish_eye")
    return m


# ---------- ぬいぐるみ ----------

@asset("plush_bunny.glb", (0.25, 0.40, 0.20))
def plush_bunny(tint=None):
    """座ったうさぎのぬいぐるみ。長い耳。正面 +Z。"""
    m = Model("plush_bunny")
    m.tol = 0.25  # 丸い形は目安寸法に合わせて少し伸縮する
    fur = m.mat("tint", tint or "#f1d3c6", rough=0.95)
    pink = m.mat("inner", "#f0a9b8", rough=0.95)
    ink = m.mat("eye", "#3a3242", rough=0.6)
    blob(m, (0, 0.1, 0), (0.092, 0.1, 0.075), fur, seg=24, rings=12, name="body")
    blob(m, (0, 0.235, 0.012), (0.074, 0.066, 0.066), fur, seg=24, rings=12, name="head")
    for sx in (-1, 1):
        blob(m, (sx * 0.032, 0.335, -0.005), (0.026, 0.07, 0.016), fur, rot=(-8, 0, -sx * 12), seg=16, rings=10,
             name="ear")
        blob(m, (sx * 0.0335, 0.338, 0.008), (0.015, 0.054, 0.006), pink, rot=(-8, 0, -sx * 12), seg=12, rings=8,
             name="ear_inner")
        blob(m, (sx * 0.085, 0.12, 0.045), (0.028, 0.048, 0.03), fur, rot=(15, 0, sx * 18), seg=14, rings=8,
             name="arm")
        blob(m, (sx * 0.05, 0.028, 0.07), (0.036, 0.028, 0.058), fur, seg=14, rings=8, name="foot")
        blob(m, (sx * 0.05, 0.03, 0.125), (0.022, 0.018, 0.006), pink, seg=12, rings=6, name="foot_pad")
        m.sphere(0.0085, (sx * 0.032, 0.248, 0.07), ink, seg=10, rings=6, name="eye")
        blob(m, (sx * 0.016, 0.215, 0.07), (0.02, 0.016, 0.014), fur, seg=12, rings=6, name="cheek")
        blob(m, (sx * 0.05, 0.222, 0.06), (0.012, 0.008, 0.004), pink, rot=(0, sx * 30, 0), seg=10, rings=5,
             name="blush")
    blob(m, (0, 0.226, 0.082), (0.008, 0.006, 0.005), pink, seg=10, rings=5, name="nose")
    m.sphere(0.03, (0, 0.06, -0.066), fur, seg=14, rings=8, name="tail")
    return m


# ---------- 推し活 ----------

@asset("acrylic_stand.glb", (0.08, 0.15, 0.05))
def acrylic_stand(tint=None):
    """透明な台座に差したアクリル板。抽象的なキャラクター風の絵柄。"""
    m = Model("acrylic_stand")
    acr = m.mat("acrylic", "#e6eef6", rough=0.08, alpha=0.45)
    body = m.mat("tint", tint or "#eeb0c4", rough=0.8)
    accent = m.mat("print", "#f6dcc4", rough=0.8)
    m.prism(rrect(0.08, 0.05, 0.008), 0.006, acr, plane="xz", offset=0.0, bevel=0.0015, name="base")
    # 絵柄の外形に沿って切り抜いた板
    board = []
    for i in range(25):  # 上は丸く
        a = math.pi * i / 24
        board.append((0.033 * math.cos(a), 0.117 + 0.033 * math.sin(a)))
    board += [(-0.034, 0.03), (-0.03, 0.004), (0.03, 0.004), (0.034, 0.03)]
    m.prism(board, 0.003, acr, plane="xy", offset=-0.0015, bevel=0.0008, fan=True, name="board")
    z = 0.0015
    # 胴体 (アーチ形) と頭、耳。抽象的な形にとどめる
    arch = [(-0.025, 0.012), (0.025, 0.012)] + [(0.025 * math.cos(math.pi * i / 12), 0.055 + 0.025 * math.sin(
        math.pi * i / 12)) for i in range(13)]
    flat(m, arch, body, z, name="print_body")
    flat(m, ellipse(0, 0.098, 0.022, 0.021), accent, z, name="print_head")
    for sx in (-1, 1):
        flat(m, ellipse(sx * 0.016, 0.121, 0.008, 0.008, seg=12), body, z, name="print_ear")
    flat(m, heart(0, 0.045, 0.016), accent, z + 0.001, name="print_heart")
    flat(m, star(0.022, 0.135, 0.008), accent, z, name="print_star")
    flat(m, star(-0.025, 0.075, 0.005), body, z, name="print_star")
    return m


@asset("badge_display.glb", (0.40, 0.30, 0.02))
def badge_display(tint=None):
    """布張りのボードに缶バッジを12個並べた壁掛け。"""
    m = Model("badge_display")
    fab = m.mat("tint", tint or "#cdbde0", rough=0.95)
    cols = [m.mat("badge", "#f2b2c2", rough=0.5), m.mat("badge2", "#a9d0e6", rough=0.5),
            m.mat("badge3", "#f4dc9c", rough=0.5)]
    mark = m.mat("print", "#f6efe6", rough=0.7)
    W, H = 0.40, 0.30
    m.cushion((W, 0.012, H), (0, 0, 0), fab, puff=0.15, round_=0.4, cuts=4, rot=(90, 0, 0))
    ob = m.parts[-1]
    ob.data.transform(Matrix.Translation((0, H / 2, -0.004)))
    r = 0.029
    prof = [(0.0, 0.0), (r, 0.0), (r + 0.0005, 0.003), (r * 0.85, 0.0062), (r * 0.5, 0.0075), (0.0, 0.0078)]
    k = 0
    for j in range(3):
        for i in range(4):
            x, y = -0.1275 + 0.085 * i, H / 2 + 0.085 * (1 - j)
            ob = m.lathe(prof, (0, 0, 0), cols[(i + j) % 3], seg=28, name="badge")
            m.apply(ob)
            ob.data.transform(Matrix.Translation((x, y, 0.002)) @ rot_matrix((90, 0, 0)))
            zf = 0.002 + 0.0068
            shape = (heart(x, y - 0.001, 0.026), star(x, y, 0.013), ellipse(x, y, 0.01, 0.01, seg=16))[k % 3]
            flat(m, shape, mark, zf, name="badge_mark")
            k += 1
    return m


@asset("uchiwa_stand.glb", (0.25, 0.38, 0.10))
def uchiwa_stand(tint=None):
    """丸いうちわを小さなスタンドに立てる。ハートの絵柄。"""
    m = Model("uchiwa_stand")
    face = m.mat("tint", tint or "#f4b6c8", rough=0.85)
    frame = m.mat("frame", "#f2eadf", rough=0.7)
    mark = m.mat("print", "#fbe6a2", rough=0.8)
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    R, cy = 0.12, 0.26
    m.cyl(R, 0.003, (0, cy, 0), face, seg=56, axis="z", name="face")
    ring = [(R + 0.0035 * math.cos(math.tau * i / 8), 0.0035 * math.sin(math.tau * i / 8)) for i in range(8)]
    ob = m.lathe(ring, (0, 0, 0), frame, seg=56, closed=True, cap_bottom=False, cap_top=False, name="rim")
    ob.data.transform(Matrix.Translation((0, cy, 0)) @ rot_matrix((90, 0, 0)))
    # 背面の骨
    for k in range(9):
        a = math.radians(-60 + 120 * k / 8) + math.pi / 2
        p0 = Vector((0, cy - R + 0.02, -0.0025))
        p1 = Vector((R * 0.95 * math.cos(a), cy + R * 0.95 * math.sin(a), -0.0025))
        m.rod(p0, p1, 0.0012, frame, seg=4, name="rib")
    m.box((0.022, 0.15, 0.012), (0, 0.018 + 0.075, -0.003), frame, bevel=0.004, name="handle")
    z = 0.0015
    flat(m, heart(0, 0.258, 0.11), mark, z, name="print_heart")
    flat(m, heart(0, 0.26, 0.06), face, z + 0.001, name="print_heart_inner")
    for x, y, s in ((-0.075, 0.33, 0.032), (0.08, 0.2, 0.028), (0.07, 0.335, 0.02), (-0.08, 0.19, 0.022)):
        flat(m, heart(x, y, s), mark, z, name="print_heart_small")
    # スタンド (台座と持ち手を挟む爪)
    m.box((0.12, 0.018, 0.10), (0, 0.009, 0), wood, bevel=0.005, name="stand_base")
    for sx in (-1, 1):
        m.box((0.012, 0.045, 0.03), (sx * 0.0175, 0.018 + 0.0225, -0.003), wood, bevel=0.003, name="stand_clip")
    return m


@asset("photo_garland.glb", (1.00, 0.30, 0.02))
def photo_garland(tint=None):
    """2本のピンの間にたるませた紐へ、小さな写真カードをクリップで留める。"""
    m = Model("photo_garland")
    paper = m.mat("paper", "#f3ece2", rough=0.9)
    photo = m.mat("tint", tint or "#e8b4b0", rough=0.9)
    photo2 = m.mat("print", "#a9c9b8", rough=0.9)
    wood = m.mat("wood", "#d9b98c", rough=0.7)
    wall = -0.01
    xe, ye, sag = 0.485, 0.285, 0.14

    def sy(x):
        return ye - sag * (1 - (x / xe) ** 2)

    pts = [Vector((x, sy(x), wall + 0.004)) for x in (-xe + 2 * xe * i / 24 for i in range(25))]
    for p0, p1 in zip(pts, pts[1:]):
        m.rod(p0, p1, 0.0015, wood, seg=6, name="string")
    for sx in (-1, 1):
        m.cyl(0.0075, 0.008, (sx * xe, ye, wall + 0.016), photo2, seg=16, axis="z", bevel=0.002, name="pin_head")
        m.cyl(0.004, 0.012, (sx * xe, ye, wall + 0.006), photo2, seg=10, axis="z", name="pin_neck")
    cw, ch = 0.1, 0.125
    for i, x in enumerate((-0.4, -0.24, -0.08, 0.08, 0.24, 0.4)):
        y = sy(x)
        ang = 0.4 * math.degrees(math.atan(2 * sag * x / xe ** 2)) + (3 if i % 2 else -3)
        parts = [m.box((cw, ch, 0.002), (0, -0.008 - ch / 2, 0), paper, bevel=0.0, name="card")]
        img = photo if i % 2 == 0 else photo2
        other = photo2 if i % 2 == 0 else photo
        iw, ih = cw - 0.014, ch - 0.034
        iy = -0.008 - 0.007 - ih / 2
        parts.append(m.box((iw, ih, 0.001), (0, iy, 0.0015), img, bevel=0.0, name="photo"))
        if i % 3 == 0:  # 写真の中の簡単な絵 (山と太陽)
            shape = [(-iw / 2, iy - ih / 2), (iw / 2, iy - ih / 2), (iw / 2, iy - ih / 2 + 0.02), (0.01, iy + 0.01),
                     (-0.015, iy - 0.01)]
        elif i % 3 == 1:
            shape = ellipse(0.0, iy, 0.022, 0.022)
        else:
            shape = heart(0.0, iy, 0.04)
        parts.append(m.prism(shape, 0.0008, other, plane="xy", offset=0.002, fan=True, name="photo_print"))
        parts.append(m.box((0.009, 0.026, 0.006), (0, -0.004, 0.0015), wood, bevel=0.0015, name="clip"))
        xf(m, parts, Matrix.Translation((x, y, wall + 0.006)) @ rot_matrix((0, 0, ang)))
    return m


# ---------- 壁の棚 ----------

@asset("wall_shelf_hex.glb", (0.40, 0.35, 0.12))
def wall_shelf_hex(tint=None):
    """六角形の箱形ウォールシェルフ。中央に仕切り板、背板付き。"""
    m = Model("wall_shelf_hex")
    wood = m.mat("wood", tint or P.WOOD_LIGHT, rough=0.55)
    back = m.mat("tint", "#c7d8c0", rough=0.85)
    R, t, D = 0.2, 0.018, 0.12
    cy = R * math.sin(math.radians(60))
    Ri = R - t / math.cos(math.radians(30))
    outer = [(R * math.cos(math.radians(60 * i)), cy + R * math.sin(math.radians(60 * i))) for i in range(6)]
    inner = [(Ri * math.cos(math.radians(60 * i)), cy + Ri * math.sin(math.radians(60 * i))) for i in range(6)]
    for i in range(6):
        j = (i + 1) % 6
        m.prism([outer[i], outer[j], inner[j], inner[i]], D, wood, plane="xy", offset=-D / 2, bevel=0.003,
                name="side")
    m.prism(inner, 0.006, back, plane="xy", offset=-D / 2, name="back")
    st = 0.016
    m.box((2 * Ri - 0.01, st, D - 0.008), (0, cy - st / 2, 0.002), wood, bevel=0.003, name="shelf")
    return m


# ---------- 趣味・家電 ----------

@asset("record_player.glb", (0.42, 0.12, 0.35))
def record_player(tint=None):
    """木の台にターンテーブル、レコード、トーンアーム。ダストカバーなし。"""
    m = Model("record_player")
    body = m.mat("tint", tint or "#d9b48a", rough=0.6)
    rec = m.mat("record", "#4a4562", rough=0.6)
    label = m.mat("label", "#f0a8bf", rough=0.8)
    arm = m.mat("arm", "#dedae6", rough=0.6)
    W, D = 0.42, 0.35
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.cyl(0.018, 0.012, (sx * (W / 2 - 0.04), 0.006, sz * (D / 2 - 0.04)), arm, seg=16, bevel=0.003,
                  name="foot")
    m.box((W, 0.075, D), (0, 0.012 + 0.0375, 0), body, bevel=0.01, name="plinth")
    top = 0.087
    cx = -0.055
    m.cyl(0.146, 0.012, (cx, top + 0.006, 0), arm, seg=56, bevel=0.003, name="platter")
    # レコード (細い段で溝を表す)
    prof = [(0.0, 0.0), (0.15, 0.0), (0.15, 0.003)]
    for k, r in enumerate((0.135, 0.115, 0.095, 0.075, 0.05)):
        prof.append((r + 0.004, 0.003 if k % 2 == 0 else 0.0026))
        prof.append((r, 0.0026 if k % 2 == 0 else 0.003))
    prof.append((0.0, 0.003))
    m.lathe(prof, (cx, top + 0.012, 0), rec, seg=56, name="record")
    m.cyl(0.046, 0.001, (cx, top + 0.0155, 0), label, seg=36, name="label")
    m.cyl(0.0035, 0.014, (cx, top + 0.019, 0), arm, seg=10, name="spindle")
    # トーンアーム
    px, pz = 0.15, -0.1
    m.cyl(0.026, 0.012, (px, top + 0.006, pz), arm, seg=24, bevel=0.003, name="arm_base")
    m.cyl(0.009, 0.016, (px, top + 0.017, pz), arm, seg=12, name="arm_post")
    head = Vector((0.045, top + 0.022, 0.055))
    pivot = Vector((px, top + 0.024, pz))
    m.rod(pivot + (pivot - head).normalized() * 0.04, pivot, 0.0045, arm, seg=10, name="arm_tail")
    m.rod(pivot, head + Vector((0, 0.004, 0)), 0.0035, arm, seg=10, name="arm")
    cw = pivot + (pivot - head).normalized() * 0.045
    m.cyl(0.011, 0.02, (0, 0, 0), rec, seg=16, bevel=0.003, axis="y", name="counterweight")
    orient(m, m.parts[-1], cw, pivot - head)
    hs = m.box((0.016, 0.006, 0.03), (0, 0, 0), rec, bevel=0.0015, name="headshell")
    ang = math.degrees(math.atan2(head.x - pivot.x, head.z - pivot.z))
    xf(m, [hs], Matrix.Translation(head + Vector((0, 0.0015, 0))) @ rot_matrix((0, ang, 0)))
    m.cyl(0.006, 0.02, (px + 0.0, top + 0.01, 0.06), arm, seg=10, name="arm_rest")
    # 操作部
    m.cyl(0.014, 0.01, (0.16, top + 0.005, 0.12), rec, seg=20, bevel=0.003, name="knob")
    m.box((0.03, 0.006, 0.016), (0.11, top + 0.003, 0.13), label, bevel=0.002, name="button")
    return m


def guitar_outline(n=24):
    """アコースティックギターの胴の輪郭 (x, y)。y=0 が胴の底。"""
    c1, r1, c2, r2 = 0.18, 0.18, 0.39, 0.13
    top = c2 + r2

    def half(y):
        a = math.sqrt(max(0.0, r1 * r1 - (y - c1) ** 2))
        b = math.sqrt(max(0.0, r2 * r2 - (y - c2) ** 2))
        return (a ** 6 + b ** 6) ** (1 / 6)  # 2つの円をなめらかにつなぐ

    ys = [top * (1 - math.cos(math.pi * i / n)) / 2 for i in range(n + 1)]
    right = [(half(y), y) for y in ys]
    left = [(-x, y) for x, y in reversed(right[1:-1])]
    return right + left


@asset("guitar.glb", (0.38, 1.00, 0.30))
def guitar(tint=None):
    """アコースティックギターをA字のスタンドに立て掛ける。胴の表は +Z。"""
    m = Model("guitar")
    m.tol = 0.2
    body = m.mat("tint", tint or "#e8c290", rough=0.6)
    wood = m.mat("wood", P.WOOD_BROWN, rough=0.6)
    dark = m.mat("dark", "#5d4a52", rough=0.7)
    stand = m.mat("stand", "#bdb8cc", rough=0.6)
    g = []  # ギター本体 (縦に立てて作り、あとで傾ける)
    g.append(m.prism(guitar_outline(), 0.1, body, plane="xy", offset=-0.05, bevel=0.012, fan=True, name="body"))
    g.append(m.cyl(0.05, 0.002, (0, 0.335, 0.0505), wood, seg=32, axis="z", name="rosette"))
    g.append(m.cyl(0.04, 0.003, (0, 0.335, 0.0515), dark, seg=32, axis="z", name="soundhole"))
    g.append(m.box((0.1, 0.016, 0.006), (0, 0.13, 0.052), dark, bevel=0.002, name="bridge"))
    g.append(m.box((0.05, 0.33, 0.03), (0, 0.5 + 0.165, 0.035), wood, bevel=0.006, name="neck"))
    g.append(m.box((0.052, 0.4, 0.006), (0, 0.44 + 0.2, 0.053), dark, bevel=0.0015, name="fretboard"))
    for k in range(9):
        y = 0.83 - 0.034 * k * (1 - 0.03 * k)
        g.append(m.box((0.052, 0.002, 0.002), (0, y, 0.0565), stand, bevel=0.0, name="fret"))
    g.append(m.box((0.054, 0.006, 0.008), (0, 0.84, 0.054), stand, bevel=0.001, name="nut"))
    g.append(m.box((0.085, 0.15, 0.02), (0, 0.84 + 0.075, 0.035), wood, bevel=0.008, name="headstock"))
    for sx in (-1, 1):
        for k in range(3):
            y = 0.87 + 0.04 * k
            g.append(m.cyl(0.006, 0.022, (sx * 0.052, y, 0.035), stand, seg=8, axis="x", name="peg"))
            g.append(m.box((0.004, 0.016, 0.01), (sx * 0.068, y, 0.035), stand, bevel=0.0015, name="peg_key"))
    for k in range(6):
        u = (k - 2.5) / 2.5
        g.append(m.rod((u * 0.024, 0.13, 0.0555), (u * 0.02, 0.84, 0.059), 0.0007, stand, seg=4, name="string"))
    tilt = 16
    y0, z0 = 0.05, 0.07
    T = Matrix.Translation((0, y0, z0)) @ rot_matrix((-tilt, 0, 0))
    xf(m, g, T)

    def w(x, y, z):
        return T @ Vector((x, y, z))

    # 胴を受ける下の腕と、ネックを受ける上の受け (ギターと同じ傾き)
    for sx in (-1, 1):
        a = w(sx * 0.12, -0.012, -0.07)
        b = w(sx * 0.12, -0.012, 0.07)
        m.rod(a, b, 0.009, stand, seg=10, name="cradle_arm")
        m.rod(b, w(sx * 0.12, 0.04, 0.075), 0.009, stand, seg=10, name="cradle_lip")
        m.sphere(0.011, w(sx * 0.12, 0.04, 0.075), dark, seg=10, rings=6, name="cradle_pad")
    m.rod(w(-0.12, -0.012, -0.07), w(0.12, -0.012, -0.07), 0.009, stand, seg=10, name="cradle_bar")
    yoke = w(0, 0.72, 0.008)
    for sx in (-1, 1):
        m.rod(w(sx * 0.035, 0.72, 0.008), w(sx * 0.035, 0.72, 0.06), 0.006, stand, seg=8, name="yoke_prong")
        m.sphere(0.008, w(sx * 0.035, 0.72, 0.06), dark, seg=10, rings=6, name="yoke_pad")
    m.rod(w(-0.038, 0.72, 0.008), w(0.038, 0.72, 0.008), 0.007, stand, seg=8, name="yoke")
    # 支柱と脚
    joint = w(0, -0.012, -0.07)
    post_foot = Vector((0, 0.0, joint.z - 0.1))
    m.rod(post_foot, yoke, 0.011, stand, seg=10, name="post")
    m.rod(joint, post_foot.lerp(yoke, joint.y / yoke.y), 0.009, stand, seg=10, name="brace")
    for sx in (-1, 1):
        foot = Vector((sx * 0.17, 0.0, joint.z + 0.12))
        m.rod(foot + Vector((0, 0.008, 0)), w(sx * 0.12, -0.012, -0.03), 0.009, stand, seg=10, name="leg")
        m.box((0.03, 0.016, 0.04), (foot.x, 0.008, foot.z), dark, bevel=0.005, name="leg_foot")
    m.box((0.06, 0.016, 0.03), (0, 0.008, post_foot.z), dark, bevel=0.005, name="post_foot")
    return m


@asset("suitcase.glb", (0.40, 0.65, 0.25))
def suitcase(tint=None):
    """リブ付きのハードケース。4輪キャスター、キャリーハンドルは収納状態。"""
    m = Model("suitcase")
    shell = m.mat("tint", tint or "#a9c8de", rough=0.6)
    trim = m.mat("trim", "#6e6882", rough=0.7)
    W, D = 0.40, 0.236
    y0, y1 = 0.055, 0.615
    H = y1 - y0
    m.box((W, H, D), (0, y0 + H / 2, 0), shell, bevel=0.035, seg=4, name="shell")
    m.box((W + 0.004, H + 0.004, 0.012), (0, y0 + H / 2, -0.02), trim, bevel=0.03, seg=3, name="seam")
    for sz in (-1, 1):
        for k in range(4):
            x = -0.105 + 0.07 * k
            m.box((0.03, H - 0.11, 0.012), (x, y0 + H / 2, sz * (D / 2 - 0.002)), shell, bevel=0.005, name="rib")
    # 角の保護パーツ
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box((0.07, 0.05, 0.07), (sx * (W / 2 - 0.03), y0 + 0.022, sz * (D / 2 - 0.03)), trim, bevel=0.018,
                  name="corner_guard")
            m.box((0.046, 0.022, 0.046), (sx * (W / 2 - 0.04), y0 - 0.011, sz * (D / 2 - 0.04)), trim, bevel=0.006,
                  name="caster")
            for dx in (-0.011, 0.011):
                m.cyl(0.022, 0.014, (sx * (W / 2 - 0.04) + dx, 0.022, sz * (D / 2 - 0.04)), trim, seg=16,
                      axis="x", bevel=0.004, name="wheel")
    # 収納したキャリーハンドル (背面上部) と上部の持ち手
    m.box((0.24, 0.012, 0.05), (0, y1 + 0.002, -0.07), trim, bevel=0.004, name="handle_housing")
    for sx in (-1, 1):
        m.box((0.018, 0.024, 0.018), (sx * 0.1, y1 + 0.014, -0.07), trim, bevel=0.004, name="handle_post")
    m.box((0.23, 0.014, 0.03), (0, y1 + 0.028, -0.07), trim, bevel=0.006, name="handle_grip")
    m.box((0.12, 0.012, 0.022), (0, y1 + 0.004, 0.05), trim, bevel=0.005, name="top_handle")
    return m


@asset("yoga_mat.glb", (0.60, 0.12, 0.12))
def yoga_mat(tint=None):
    """丸めたヨガマット (X方向に寝かせる)。断面は渦巻き。2本のバンドと持ち手。"""
    m = Model("yoga_mat")
    mat = m.mat("tint", tint or "#bba8dc", rough=0.9)
    strap = m.mat("strap", "#8a8099", rough=0.85)
    L, thick, pitch, r0, r_out = 0.6, 0.0045, 0.0062, 0.01, 0.058
    turns = (r_out - thick - r0) / pitch
    n = int(turns * 40)
    th_end = turns * math.tau
    phase = math.radians(-105) - th_end  # 巻き終わりを床の手前に置く
    bm = bmesh.new()
    rows = []
    for i in range(n + 1):
        th = th_end * i / n
        r = r0 + pitch * th / math.tau
        a = th + phase
        row = []
        for rr in (r, r + thick):
            for x in (-L / 2, L / 2):
                row.append(bm.verts.new((x, r_out + rr * math.sin(a), rr * math.cos(a))))
        rows.append(row)  # [内左, 内右, 外左, 外右]
    for p, q in zip(rows, rows[1:]):
        bm.faces.new((p[0], q[0], q[2], p[2]))  # 左端面
        bm.faces.new((p[1], p[3], q[3], q[1]))  # 右端面
        bm.faces.new((p[2], q[2], q[3], p[3]))  # 外側
        bm.faces.new((p[0], p[1], q[1], q[0]))  # 内側
    for row in (rows[0], rows[-1]):
        bm.faces.new((row[0], row[2], row[3], row[1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    m._obj(bm, mat, "roll")
    band = [(r_out + 0.0005, -0.014), (r_out + 0.0035, -0.014), (r_out + 0.0035, 0.014), (r_out + 0.0005, 0.014)]
    for sx in (-1, 1):
        ob = m.lathe(band, (0, 0, 0), strap, seg=40, closed=True, cap_bottom=False, cap_top=False, name="band")
        ob.data.transform(Matrix.Translation((sx * 0.17, r_out, 0)) @ rot_matrix((0, 0, 90)))
    m.box((0.34, 0.003, 0.024), (0, 2 * r_out + 0.0035, 0.0), strap, bevel=0.001, name="carry_strap")
    for sx in (-1, 1):
        m.box((0.03, 0.008, 0.032), (sx * 0.17, 2 * r_out + 0.005, 0), strap, bevel=0.002, name="buckle")
    return m

"""植物。葉・茎・鉢・土は別素材。"""
import math
import random

import palette as P
from lib import Model, asset, rot_matrix
from mathutils import Matrix, Vector


def pot(m, r_top, r_bottom, h, mat, soil_mat, rim=0.012):
    m.lathe([(0.0, 0.0), (r_bottom, 0.0), (r_bottom + 0.002, 0.006), (r_top, h - rim), (r_top + 0.006, h - rim),
             (r_top + 0.006, h), (r_top - 0.006, h), (r_top - 0.008, h - 0.02), (0.0, h - 0.02)], (0, 0, 0), mat,
            seg=40, cap_top=False, name="pot")
    m.cyl(r_top - 0.008, 0.01, (0, h - 0.025, 0), soil_mat, seg=32, name="soil")


def leaf_mesh(m, outline, mat, thickness, base, yaw, pitch, droop=0.0, curl=0.0, length=1.0, name="leaf"):
    """outline: 葉の輪郭 (x=幅方向, z=葉先方向)。根元を base に置き、yaw(度)方向へ pitch(度)だけ持ち上げる。"""
    ob = m.prism(outline, thickness, mat, plane="xz", offset=-thickness / 2, fan=True, name=name)

    def bend(co):
        t = max(0.0, co.z / length)
        co.y -= droop * t * t * length + curl * co.x * co.x
        return co

    m.deform(ob, bend)
    ob.data.transform(Matrix.Translation(base) @ rot_matrix((0, yaw, 0)) @ rot_matrix((-pitch, 0, 0)))
    return ob


def monstera_outline(L, W, slits=3):
    """切れ込みのあるハート形。z=0 が葉柄の付け根。"""
    pts = []
    n = 40
    sl = {int(n * (0.2 + 0.6 * (k + 0.5) / slits)) for k in range(slits)}
    for i in range(n + 1):
        t = i / n  # 0: 先端 → 1: 根元 (右側)
        a = math.pi * t
        x = W / 2 * math.sin(a) ** 0.8
        z = L * (0.55 + 0.5 * math.cos(a)) - 0.12 * L * math.sin(a) ** 6
        if i in sl:  # 縁から中央脈へ向かう楔形の切れ込み
            pts.append((x * 0.97, z + 0.035 * L))
            pts.append((x * 0.32, z + 0.005 * L))
            pts.append((x * 0.97, z - 0.03 * L))
            continue
        pts.append((x, z))
    right = pts
    left = [(-x, z) for x, z in reversed(right[1:-1])]
    out = right + [(0.0, 0.12 * L)] + left
    return out[::-1]


@asset("plant_monstera.glb", (0.60, 1.20, 0.60))
def plant_monstera(tint=None):
    m = Model("plant_monstera")
    m.tol = 0.5  # 枝葉の広がりは目安寸法に合わせて伸縮する
    leaf = m.mat("leaf", tint or P.LEAF, rough=0.6)
    stem = m.mat("stem", P.STEM, rough=0.7)
    potm = m.mat("pot", P.POT_BEIGE, rough=0.7)
    soil = m.mat("soil", P.SOIL, rough=1.0)
    pot(m, 0.155, 0.12, 0.32, potm, soil)
    rnd = random.Random(3)
    # (方位, 葉の付け根の高さ, 持ち上げ角, 葉の長さ)
    leaves = [(0, 0.88, 40, 0.34), (65, 0.80, 35, 0.32), (130, 0.74, 30, 0.31), (200, 0.86, 42, 0.33),
              (270, 0.70, 28, 0.30), (320, 0.62, 22, 0.27), (100, 0.58, 20, 0.26), (235, 0.96, 55, 0.30),
              (25, 0.52, 18, 0.24)]
    for yaw, top, pitch, L in leaves:
        a = math.radians(yaw)
        reach = 0.05 + 0.03 * rnd.random()
        tip = Vector((reach * math.sin(a), top, reach * math.cos(a)))
        mid = Vector((tip.x * 0.4, top * 0.6, tip.z * 0.4))
        start = Vector((0.02 * math.sin(a), 0.30, 0.02 * math.cos(a)))
        m.rod(start, mid, 0.008, stem, seg=8, r2=0.007, name="stem")
        m.rod(mid, tip, 0.007, stem, seg=8, r2=0.006, name="stem")
        L *= 0.85
        leaf_mesh(m, monstera_outline(L, L * 0.9), leaf, 0.005, tip, yaw, pitch, droop=0.3, curl=0.5, length=L)
    return m


@asset("plant_eucalyptus.glb", (0.40, 0.90, 0.40))
def plant_eucalyptus(tint=None):
    m = Model("plant_eucalyptus")
    m.tol = 0.5  # 枝葉の広がりは目安寸法に合わせて伸縮する
    leaf = m.mat("leaf", tint or P.LEAF_SAGE, rough=0.7)
    stem = m.mat("stem", "#8a7a63", rough=0.8)
    potm = m.mat("pot", P.POT_BEIGE, rough=0.7)
    soil = m.mat("soil", P.SOIL, rough=1.0)
    pot(m, 0.095, 0.075, 0.20, potm, soil)
    rnd = random.Random(7)
    disc = [(0.022 * math.cos(math.tau * i / 10), 0.022 + 0.022 * math.sin(math.tau * i / 10)) for i in range(10)]
    for b in range(6):
        a = math.tau * b / 6 + rnd.uniform(-0.3, 0.3)
        lean = rnd.uniform(0.12, 0.17)
        h = rnd.uniform(0.78, 0.88)
        pts = [Vector((0.01 * math.cos(a), 0.18, 0.01 * math.sin(a)))]
        for k in range(1, 5):
            t = k / 4
            pts.append(Vector((lean * t ** 1.3 * math.cos(a), 0.18 + (h - 0.18) * t, lean * t ** 1.3 * math.sin(a))))
        for p0, p1 in zip(pts, pts[1:]):
            m.rod(p0, p1, 0.004, stem, seg=6, r2=0.003, name="branch")
        for k in range(12):
            t = 0.25 + 0.75 * k / 11
            seg_i = min(3, int(t * 4))
            local = t * 4 - seg_i
            p = pts[seg_i].lerp(pts[seg_i + 1], local)
            side = 90 if k % 2 else -90
            yaw = math.degrees(a) + side + rnd.uniform(-20, 20)
            leaf_mesh(m, disc, leaf, 0.002, p, yaw, rnd.uniform(-30, 30), length=0.044)
    return m


@asset("small_plant.glb", (0.15, 0.25, 0.15))
def small_plant(tint=None):
    m = Model("small_plant")
    m.tol = 0.5  # 枝葉の広がりは目安寸法に合わせて伸縮する
    leaf = m.mat("leaf", tint or "#4f8a45", rough=0.6)
    stem = m.mat("stem", P.STEM, rough=0.7)
    potm = m.mat("pot", P.WHITE, rough=0.5)
    soil = m.mat("soil", P.SOIL, rough=1.0)
    pot(m, 0.055, 0.045, 0.10, potm, soil, rim=0.006)
    rnd = random.Random(11)
    disc = [(0.028 * math.cos(math.tau * i / 14), 0.028 + 0.028 * math.sin(math.tau * i / 14)) for i in range(14)]
    for k in range(7):
        a = math.tau * k / 7 + rnd.uniform(-0.2, 0.2)
        h = rnd.uniform(0.16, 0.2)
        r = rnd.uniform(0.02, 0.035)
        tip = Vector((r * math.cos(a), h, r * math.sin(a)))
        m.rod((0, 0.09, 0), tip, 0.0025, stem, seg=6, name="stem")
        leaf_mesh(m, disc, leaf, 0.002, tip, 90 - math.degrees(a), rnd.uniform(15, 40), curl=1.5, length=0.056)
    return m


@asset("wall_planter.glb", (0.50, 0.60, 0.15))
def wall_planter(tint=None):
    m = Model("wall_planter")
    m.tol = 0.5  # 枝葉の広がりは目安寸法に合わせて伸縮する
    leaf = m.mat("leaf", tint or "#5f8a4f", rough=0.6)
    stem = m.mat("stem", P.STEM, rough=0.7)
    potm = m.mat("pot", P.POT_BEIGE, rough=0.7)
    soil = m.mat("soil", P.SOIL, rough=1.0)
    back = -0.075
    # 背面が平らな半円の容器
    half = [(0.11 * math.cos(math.pi * i / 16), back + 0.10 * math.sin(math.pi * i / 16)) for i in range(17)]
    m.prism(half, 0.13, potm, plane="xz", offset=0.44, bevel=0.006, name="pot")
    m.prism([(x * 0.92, back + (z - back) * 0.9) for x, z in half], 0.01, soil, plane="xz", offset=0.565, name="soil")
    m.box((0.05, 0.03, 0.01), (0, 0.585, back + 0.005), potm, bevel=0.003, name="hanger")
    rnd = random.Random(5)
    oval = [(0.016 * math.cos(math.tau * i / 10), 0.024 + 0.024 * math.sin(math.tau * i / 10)) for i in range(10)]
    for v in range(9):
        x0 = rnd.uniform(-0.09, 0.09)
        z0 = back + rnd.uniform(0.03, 0.08)
        drop = rnd.uniform(0.22, 0.52)
        sway = rnd.uniform(-0.17, 0.17)
        pts = []
        for k in range(7):
            t = k / 6
            pts.append(Vector((x0 + sway * t * t + (0.06 if x0 > 0 else -0.06) * math.sin(t * 2),
                               0.57 - drop * t, z0 + 0.04 * math.sin(t * 3))))
        for p0, p1 in zip(pts, pts[1:]):
            m.rod(p0, p1, 0.0025, stem, seg=5, name="vine")
        for k in range(1, 13):
            t = k / 12
            i = min(5, int(t * 6))
            p = pts[i].lerp(pts[i + 1], t * 6 - i)
            yaw = rnd.uniform(-70, 70) + (180 if k % 2 else 0)
            leaf_mesh(m, oval, leaf, 0.002, p, yaw, rnd.uniform(-60, -20), length=0.048)
    return m


# ---------- 追加モデル (2026-10-04) ----------

@asset("plant_fiddle.glb", (0.60, 1.40, 0.60))
def plant_fiddle(tint=None):
    """ウンベラータ。大きなハート形の葉。"""
    m = Model("plant_fiddle")
    m.tol = 0.5  # 枝葉の広がりは目安寸法に合わせて伸縮する
    leaf = m.mat("leaf", tint or "#6aa85c", rough=0.6)
    stem = m.mat("stem", "#8a7a63", rough=0.8)
    potm = m.mat("pot", "#cfa98a", rough=0.7)
    soil = m.mat("soil", P.SOIL, rough=1.0)
    pot(m, 0.15, 0.12, 0.30, potm, soil)
    rnd = random.Random(21)
    for b, (lean_a, h) in enumerate([(30, 1.25), (150, 1.05), (270, 1.15)]):
        a = math.radians(lean_a)
        pts = [Vector((0.02 * math.cos(a), 0.28, 0.02 * math.sin(a)))]
        for k in range(1, 5):
            t = k / 4
            pts.append(Vector((0.1 * t ** 1.5 * math.cos(a), 0.28 + (h - 0.28) * t, 0.1 * t ** 1.5 * math.sin(a))))
        for p0, p1 in zip(pts, pts[1:]):
            m.rod(p0, p1, 0.012, stem, seg=8, r2=0.009, name="trunk")
        for k in range(6):
            t = 0.45 + 0.55 * k / 5
            i = min(3, int(t * 4))
            p = pts[i].lerp(pts[i + 1], t * 4 - i)
            yaw = lean_a + rnd.uniform(-70, 70) + 140 * (k % 2)
            L = rnd.uniform(0.17, 0.22) * (1.1 if k > 3 else 1.0)
            leaf_mesh(m, monstera_outline(L, L * 0.95, slits=0), leaf, 0.004, p, 90 - yaw, rnd.uniform(15, 45),
                      droop=0.25, curl=0.8, length=L)
    return m


@asset("plant_olive.glb", (0.50, 1.50, 0.50))
def plant_olive(tint=None):
    m = Model("plant_olive")
    m.tol = 0.5  # 枝葉の広がりは目安寸法に合わせて伸縮する
    leaf = m.mat("leaf", tint or "#8fa58a", rough=0.7)
    stem = m.mat("stem", "#7a6a58", rough=0.8)
    potm = m.mat("pot", "#d8cfc2", rough=0.7)
    soil = m.mat("soil", P.SOIL, rough=1.0)
    pot(m, 0.13, 0.1, 0.28, potm, soil)
    rnd = random.Random(8)
    trunk = [Vector((0, 0.26, 0)), Vector((0.02, 0.5, 0.01)), Vector((-0.01, 0.75, -0.01)), Vector((0.0, 0.9, 0.0))]
    for p0, p1 in zip(trunk, trunk[1:]):
        m.rod(p0, p1, 0.018, stem, seg=8, r2=0.015, name="trunk")
    narrow = [(0.011 * math.sin(math.pi * i / 6), 0.085 * (1 - math.cos(math.pi * i / 6)) / 2) for i in range(7)]
    narrow = narrow + [(-x, z) for x, z in reversed(narrow[1:-1])]
    for c in range(9):
        a = math.tau * c / 9 + rnd.uniform(-0.2, 0.2)
        rr = rnd.uniform(0.1, 0.18)
        cy = rnd.uniform(1.0, 1.36)
        center = Vector((rr * math.cos(a), cy, rr * math.sin(a)))
        m.rod(trunk[-1], center, 0.008, stem, seg=6, r2=0.005, name="branch")
        for k in range(30):
            off = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1)))
            if off.length > 1:
                off.normalize()
            p = center + off * 0.09
            leaf_mesh(m, narrow, leaf, 0.0015, p, rnd.uniform(0, 360), rnd.uniform(-40, 50), length=0.085)
    return m


@asset("plant_stand.glb", (0.40, 0.60, 0.40))
def plant_stand(tint=None):
    m = Model("plant_stand")
    wood = m.mat("wood", tint or P.WOOD_LIGHT, rough=0.55)
    m.cyl(0.2, 0.025, (0, 0.6 - 0.0125, 0), wood, seg=40, bevel=0.006, name="top_tray")
    m.cyl(0.17, 0.022, (0, 0.27, 0), wood, seg=40, bevel=0.006, name="low_tray")
    for k in range(3):
        a = math.radians(90 + 120 * k)
        m.rod((0.19 * math.cos(a), 0.0, 0.19 * math.sin(a)), (0.15 * math.cos(a), 0.58, 0.15 * math.sin(a)), 0.014,
              wood, seg=10, r2=0.016, name="leg")
    return m


@asset("vase_tulip.glb", (0.15, 0.40, 0.15))
def vase_tulip(tint=None):
    m = Model("vase_tulip")
    m.tol = 0.5  # 花の広がりは目安寸法に合わせて伸縮する
    vase = m.mat("vase", "#e9ddd0", rough=0.5)
    flower = m.mat("tint", tint or "#eaa7b8", rough=0.7)
    stem = m.mat("stem", P.STEM, rough=0.7)
    leaf = m.mat("leaf", "#7fae6a", rough=0.6)
    m.lathe([(0.0, 0.0), (0.04, 0.0), (0.058, 0.03), (0.064, 0.07), (0.055, 0.11), (0.032, 0.145), (0.03, 0.16),
             (0.034, 0.168), (0.0, 0.166)], (0, 0, 0), vase, seg=36, name="vase")
    rnd = random.Random(4)
    head = [(0.0, 0.0), (0.011, 0.002), (0.018, 0.012), (0.02, 0.026), (0.018, 0.04), (0.012, 0.046),
            (0.0, 0.042)]
    for k in range(5):
        a = math.tau * k / 5 + rnd.uniform(-0.3, 0.3)
        r = rnd.uniform(0.025, 0.05)
        top = Vector((r * math.cos(a), rnd.uniform(0.31, 0.355), r * math.sin(a)))
        mid = Vector((0.008 * math.cos(a), 0.22, 0.008 * math.sin(a)))
        m.rod((0, 0.15, 0), mid, 0.0028, stem, seg=6, name="stem")
        m.rod(mid, top, 0.0028, stem, seg=6, name="stem")
        m.lathe(head, (top.x, top.y - 0.003, top.z), flower, seg=12, name="tulip")
    blade = [(0.012 * math.sin(math.pi * i / 8), 0.14 * i / 8) for i in range(9)]
    blade = blade + [(-x, z) for x, z in reversed(blade[1:-1])]
    for k in range(3):
        leaf_mesh(m, blade, leaf, 0.002, Vector((0, 0.16, 0)), 120 * k + 20, 62, droop=0.05, length=0.14)
    return m

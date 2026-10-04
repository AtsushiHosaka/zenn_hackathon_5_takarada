"""追加の家電・照明 第2弾 (2026-10-05)。発光部分は独立素材 (light)。"""
import math

from mathutils import Matrix, Vector

import palette as P
from lib import TAU, Model, asset, rot_matrix, rrect


def _ring(m, R, t, mat, center=(0, 0, 0), rot=None, seg=40, tseg=8, name="ring"):
    """トーラス。既定はY軸まわり (XZ平面)。rot=(90, 0, 0) でXY平面 (+Z向き)。"""
    prof = [(R + t * math.cos(TAU * i / tseg), t * math.sin(TAU * i / tseg)) for i in range(tseg)]
    ob = m.lathe(prof, (0, 0, 0), mat, seg=seg, closed=True, name=name)
    mx = Matrix.Translation(Vector(center))
    if rot:
        mx = mx @ rot_matrix(rot)
    ob.data.transform(mx)
    return ob


def _polyline(m, pts, r, mat, seg=8, joints=True, name="wire"):
    for a, b in zip(pts, pts[1:]):
        m.rod(a, b, r, mat, seg=seg, name=name)
    if joints:
        for p in pts[1:-1]:
            m.sphere(r, p, mat, seg=seg, rings=max(4, seg // 2), name=name + "_joint")


def _feet(m, mat, xs, zs, r=0.012, h=0.008, seg=12):
    for x in xs:
        for z in zs:
            m.cyl(r, h, (x, h / 2, z), mat, seg=seg, name="foot")


# ---------- キッチン家電 ----------

@asset("rice_cooker.glb", (0.25, 0.22, 0.33))
def rice_cooker(tint=None):
    """炊飯器。丸みのある本体とふた、後ろへ倒した持ち手、前面に傾いた操作パネル。"""
    m = Model("rice_cooker")
    body = m.mat("tint", tint or P.WHITE, rough=0.6)
    plastic = m.mat("plastic", "#8a86a0", rough=0.6)
    screen = m.mat("screen", "#4d4868", rough=0.5)
    light = m.mat("light", "#bfeac9", rough=0.5, emit="#bfeac9", strength=1.8)
    _feet(m, plastic, (-0.08, 0.08), (-0.1, 0.1), r=0.014, h=0.008)
    m.box((0.25, 0.135, 0.30), (0, 0.008 + 0.0675, -0.015), body, bevel=0.04, seg=3, name="body")
    m.box((0.244, 0.07, 0.294), (0, 0.17, -0.015), body, bevel=0.035, seg=4, name="lid")
    # 蒸気口
    m.cyl(0.022, 0.008, (0, 0.207, -0.05), plastic, seg=20, bevel=0.003, name="vent")
    m.cyl(0.012, 0.006, (0, 0.212, -0.05), screen, seg=14, name="vent_hole")
    # 持ち手: ふた後方の上に渡したアーチ
    for sx in (-1, 1):
        m.box((0.022, 0.016, 0.03), (sx * 0.07, 0.205, -0.125), plastic, bevel=0.006, name="handle_post")
    _polyline(m, [(-0.07, 0.208, -0.125), (-0.055, 0.218, -0.125), (0.055, 0.218, -0.125), (0.07, 0.208, -0.125)],
              0.0075, plastic, seg=10, name="handle")
    # 前面の操作パネル (上を後ろへ傾ける)
    tilt = (-18, 0, 0)
    m.box((0.18, 0.075, 0.03), (0, 0.085, 0.142), body, bevel=0.012, rot=tilt, name="panel_base")
    pm = Matrix.Translation((0, 0.085, 0.142)) @ rot_matrix(tilt)

    def at(x, y, z):
        return tuple(pm @ Vector((x, y, z)))

    m.box((0.15, 0.055, 0.004), at(0, 0, 0.016), screen, bevel=0.002, rot=tilt, name="panel")
    m.box((0.05, 0.018, 0.003), at(-0.03, 0.01, 0.019), light, bevel=0.0, rot=tilt, name="display")
    m.box((0.035, 0.016, 0.006), at(0.045, 0.012, 0.019), body, bevel=0.003, rot=tilt, name="start")
    for x in (-0.045, -0.015, 0.015):
        m.cyl(0.006, 0.005, at(x, -0.015, 0.019), body, seg=10, axis="z", rot=tilt, name="button")
    m.cyl(0.006, 0.005, at(0.045, -0.015, 0.019), light, seg=10, axis="z", rot=tilt, name="lamp")
    # ふたを開けるボタン
    m.box((0.06, 0.014, 0.02), (0, 0.15, 0.128), plastic, bevel=0.005, name="release")
    return m


@asset("kettle.glb", (0.22, 0.22, 0.15))
def kettle(tint=None):
    """電気ケトル。丸い電源台に本体、注ぎ口は+X、取っ手は-X。"""
    m = Model("kettle")
    body = m.mat("tint", tint or "#b9d4c8", rough=0.6)
    plastic = m.mat("plastic", P.WHITE, rough=0.6)
    light = m.mat("light", "#ffd6a6", rough=0.5, emit="#ffd6a6", strength=2.0)
    m.lathe([(0.0, 0.0), (0.072, 0.0), (0.075, 0.005), (0.074, 0.018), (0.068, 0.022), (0.0, 0.022)],
            (0, 0, 0), plastic, seg=40, name="base")
    m.box((0.014, 0.006, 0.004), (0.0, 0.012, 0.074), light, bevel=0.0, name="lamp")
    m.lathe([(0.0, 0.022), (0.06, 0.022), (0.066, 0.03), (0.07, 0.06), (0.068, 0.12), (0.062, 0.17),
             (0.056, 0.192), (0.0, 0.192)], (0, 0, 0), body, seg=40, name="body")
    m.lathe([(0.0, 0.19), (0.057, 0.19), (0.055, 0.2), (0.04, 0.207), (0.0, 0.209)], (0, 0, 0), plastic,
            seg=40, name="lid")
    m.box((0.034, 0.014, 0.022), (-0.005, 0.214, 0), plastic, bevel=0.006, name="knob")
    # 注ぎ口: 本体の肩から+X上方へ
    m.rod((0.045, 0.15, 0), (0.1, 0.188, 0), 0.016, body, seg=14, r2=0.008, name="spout")
    # 取っ手 (-X): 上下で本体につながる輪
    hp = [(-0.055, 0.175, 0), (-0.08, 0.175, 0)]
    hp += [(-0.08 - 0.024 * math.sin(math.pi / 2 * i / 4), 0.151 + 0.024 * math.cos(math.pi / 2 * i / 4), 0)
           for i in range(1, 5)]
    hp += [(-0.104, 0.09, 0)]
    hp += [(-0.08 - 0.024 * math.cos(math.pi / 2 * i / 4), 0.09 - 0.024 * math.sin(math.pi / 2 * i / 4), 0)
           for i in range(1, 5)]
    hp += [(-0.064, 0.066, 0)]
    _polyline(m, hp, 0.011, plastic, seg=10, name="handle")
    m.box((0.012, 0.012, 0.018), (-0.098, 0.162, 0), light, bevel=0.003, rot=(0, 0, -30), name="switch")
    return m


@asset("toaster.glb", (0.35, 0.22, 0.30))
def toaster(tint=None):
    """オーブントースター。左にガラス窓の扉と横長の取っ手、右に操作ダイヤル。"""
    m = Model("toaster")
    body = m.mat("tint", tint or "#f2c6b4", rough=0.6)
    glass = m.mat("glass", "#4d4868", rough=0.4)
    plastic = m.mat("plastic", "#f4efe6", rough=0.6)
    light = m.mat("light", "#ffb07a", rough=0.5, emit="#ffb07a", strength=1.6)
    W, H, D = 0.35, 0.206, 0.285
    y0 = 0.012
    _feet(m, plastic, (-0.14, 0.14), (-0.11, 0.11), r=0.014, h=y0)
    m.box((W, H, D), (0, y0 + H / 2, -0.0075), body, bevel=0.02, seg=3, name="body")
    fz = D / 2 - 0.0075
    # 扉
    dx0, dx1 = -W / 2 + 0.014, 0.075
    dcx = (dx0 + dx1) / 2
    m.box((dx1 - dx0, H - 0.03, 0.008), (dcx, y0 + H / 2, fz + 0.004), plastic, bevel=0.005, name="door")
    m.box((dx1 - dx0 - 0.04, H - 0.085, 0.004), (dcx, y0 + H / 2 - 0.012, fz + 0.009), glass, bevel=0.002,
          name="window")
    # 窓の奥に赤く光るヒーター
    for y in (0.06, 0.15):
        m.box((dx1 - dx0 - 0.06, 0.006, 0.002), (dcx, y0 + y, fz + 0.0115), light, bevel=0.0, name="heater")
    m.box((dx1 - dx0 - 0.06, 0.016, 0.016), (dcx, y0 + H - 0.03, fz + 0.016), plastic, bevel=0.006,
          name="handle")
    for sx in (-1, 1):
        m.box((0.014, 0.014, 0.012), (dcx + sx * 0.09, y0 + H - 0.03, fz + 0.012), plastic, bevel=0.004,
              name="handle_post")
    # 右の操作部: ダイヤル2つ
    px = (dx1 + W / 2) / 2 + 0.003
    m.box((W / 2 - dx1 - 0.024, H - 0.03, 0.004), (px, y0 + H / 2, fz + 0.002), plastic, bevel=0.002,
          name="panel")
    for y in (0.14, 0.065):
        m.cyl(0.024, 0.018, (px, y0 + y, fz + 0.013), body, seg=24, axis="z", bevel=0.005, name="dial")
        m.box((0.005, 0.03, 0.006), (px, y0 + y, fz + 0.024), plastic, bevel=0.002, rot=(0, 0, -35),
              name="dial_mark")
    m.cyl(0.004, 0.004, (px, y0 + 0.19, fz + 0.005), light, seg=10, axis="z", name="lamp")
    return m


@asset("coffee_maker.glb", (0.20, 0.30, 0.25))
def coffee_maker(tint=None):
    """ドリップ式コーヒーメーカー。後ろのタンク塔、張り出したヘッド、台にガラスのサーバー。"""
    m = Model("coffee_maker")
    body = m.mat("tint", tint or "#c9b6e4", rough=0.6)
    plastic = m.mat("plastic", P.METAL_DARK, rough=0.6)
    glass = m.mat("glass", P.GLASS, rough=0.3, alpha=0.45)
    coffee = m.mat("coffee", "#7a5643", rough=0.6)
    # 台と後ろの塔、上のヘッド
    m.box((0.20, 0.03, 0.245), (0, 0.015, 0.0025), body, bevel=0.012, name="base")
    m.box((0.15, 0.003, 0.12), (0, 0.031, 0.055), plastic, bevel=0.0, name="warmer")
    m.box((0.20, 0.30, 0.11), (0, 0.15, -0.07), body, bevel=0.016, seg=3, name="tower")
    m.box((0.20, 0.065, 0.14), (0, 0.2675, 0.05), body, bevel=0.016, seg=3, name="head")
    m.box((0.12, 0.012, 0.1), (0, 0.229, 0.055), plastic, bevel=0.003, name="filter")
    # 塔の正面: 水量窓と電源
    m.box((0.03, 0.12, 0.004), (-0.06, 0.13, -0.014), glass, bevel=0.0, name="gauge")
    m.cyl(0.012, 0.008, (0.065, 0.08, -0.012), plastic, seg=16, axis="z", bevel=0.002, name="switch")
    # ガラスのサーバー
    cz = 0.055
    m.lathe([(0.0, 0.034), (0.058, 0.034), (0.064, 0.05), (0.066, 0.09), (0.06, 0.13), (0.048, 0.155),
             (0.046, 0.16), (0.0, 0.16)], (0, 0, cz), glass, seg=36, name="carafe")
    m.lathe([(0.0, 0.037), (0.055, 0.037), (0.06, 0.05), (0.062, 0.09), (0.0, 0.09)], (0, 0, cz), coffee,
            seg=36, name="coffee")
    m.lathe([(0.0, 0.158), (0.05, 0.158), (0.05, 0.172), (0.03, 0.18), (0.0, 0.18)], (0, 0, cz), plastic,
            seg=32, name="carafe_lid")
    _polyline(m, [(0.055, 0.14, cz), (0.085, 0.135, cz), (0.088, 0.075, cz), (0.06, 0.07, cz)], 0.008,
              plastic, seg=8, name="carafe_handle")
    return m


@asset("washing_machine.glb", (0.60, 1.00, 0.60))
def washing_machine(tint=None):
    """縦型洗濯機。天面手前にふた、奥に一段高い操作パネル。"""
    m = Model("washing_machine")
    body = m.mat("tint", tint or P.WHITE, rough=0.6)
    plastic = m.mat("plastic", "#a9a4b6", rough=0.6)
    lid = m.mat("lid", "#cfe3ef", rough=0.5)
    light = m.mat("light", "#a6e2ff", rough=0.5, emit="#a6e2ff", strength=1.8)
    m.box((0.56, 0.04, 0.56), (0, 0.02, 0), plastic, bevel=0.01, name="plinth")
    m.box((0.60, 0.85, 0.60), (0, 0.035 + 0.425, 0), body, bevel=0.03, seg=3, name="body")
    # 天面: ふた (手前) と取っ手のくぼみ
    top = 0.885
    m.box((0.52, 0.025, 0.40), (0, top + 0.0125, 0.07), lid, bevel=0.012, seg=2, name="lid")
    m.box((0.46, 0.006, 0.34), (0, top + 0.026, 0.07), body, bevel=0.003, name="lid_inset")
    m.box((0.16, 0.014, 0.03), (0, top + 0.02, 0.27), plastic, bevel=0.006, name="lid_handle")
    # 奥の操作パネル (前へ傾ける)
    m.box((0.60, 0.115, 0.14), (0, top + 0.0575, -0.23), body, bevel=0.025, seg=3, name="panel_box")
    tilt = (-25, 0, 0)
    pc = Vector((0, top + 0.07, -0.158))
    pm = Matrix.Translation(pc) @ rot_matrix(tilt)

    def at(x, y, z):
        return tuple(pm @ Vector((x, y, z)))

    m.box((0.5, 0.07, 0.006), tuple(pc), plastic, bevel=0.003, rot=tilt, name="panel")
    m.box((0.1, 0.03, 0.004), at(0.0, 0.008, 0.004), light, bevel=0.0, rot=tilt, name="display")
    for x in (-0.19, -0.14, -0.09, 0.09, 0.14):
        m.cyl(0.012, 0.007, at(x, 0.0, 0.004), body, seg=14, axis="z", rot=tilt, name="button")
    m.cyl(0.02, 0.01, at(0.2, 0.0, 0.005), body, seg=18, axis="z", rot=tilt, name="start")
    # 正面下の点検口
    m.box((0.5, 0.11, 0.006), (0, 0.11, 0.3), body, bevel=0.003, name="kick_panel")
    m.box((0.08, 0.012, 0.006), (0, 0.15, 0.304), plastic, bevel=0.003, name="kick_notch")
    return m


@asset("dish_rack.glb", (0.45, 0.30, 0.30))
def dish_rack(tint=None):
    """水切りラック。トレーの上にワイヤーかご、左に立てた皿、右に箸立てとコップ。"""
    m = Model("dish_rack")
    wire = m.mat("tint", tint or "#d9d3e2", rough=0.6)
    tray = m.mat("plastic", "#b9d4c8", rough=0.6)
    plate = m.mat("plate", P.IVORY, rough=0.7)
    cup = m.mat("cup", "#f2c6b4", rough=0.6)
    W, D = 0.45, 0.30
    # トレー
    m.prism(rrect(W, D, 0.03), 0.008, tray, bevel=0.003, name="tray")
    for sx in (-1, 1):
        m.box((0.012, 0.025, D - 0.03), (sx * (W / 2 - 0.006), 0.02, 0), tray, bevel=0.004, name="tray_wall")
    for sz in (-1, 1):
        m.box((W - 0.03, 0.025, 0.012), (0, 0.02, sz * (D / 2 - 0.006)), tray, bevel=0.004, name="tray_wall")
    m.box((0.06, 0.006, 0.03), (0, 0.012, D / 2 + 0.008), tray, bevel=0.002, name="spout")
    # ワイヤーかご
    w, d = 0.42, 0.27
    r = 0.003
    yb, yt = 0.04, 0.16

    def rect(y):
        return [(-w / 2, y, -d / 2), (w / 2, y, -d / 2), (w / 2, y, d / 2), (-w / 2, y, d / 2), (-w / 2, y, -d / 2)]

    _polyline(m, rect(yb), r, wire, seg=6, name="frame")
    _polyline(m, rect(yt), r, wire, seg=6, name="rim")
    _polyline(m, rect(0.1), r, wire, seg=6, joints=False, name="mid")
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.rod((sx * w / 2, 0.008, sz * d / 2), (sx * w / 2, yt, sz * d / 2), 0.004, wire, seg=6, name="post")
    for i in range(1, 8):
        x = -w / 2 + w * i / 8
        for sz in (-1, 1):
            m.rod((x, yb, sz * d / 2), (x, yt, sz * d / 2), r, wire, seg=6, name="bar")
    for i in range(1, 6):
        z = -d / 2 + d * i / 6
        for sx in (-1, 1):
            m.rod((sx * w / 2, yb, z), (sx * w / 2, yt, z), r, wire, seg=6, name="bar")
    for i in range(1, 6):
        z = -d / 2 + d * i / 6
        m.rod((-w / 2, yb, z), (w / 2, yb, z), r, wire, seg=6, name="floor")
    # 皿を立てるU字の仕切り (Z方向に並べる)
    for i in range(6):
        x = -0.18 + 0.03 * i
        _polyline(m, [(x, yb, -0.09), (x, 0.12, -0.09), (x, 0.12, 0.09), (x, yb, 0.09)], 0.0025, wire, seg=6,
                  joints=False, name="divider")
    # 立てた皿 3枚 (Z方向に並ぶ、仕切りの間)
    for i, (x, rr) in enumerate(((-0.165, 0.115), (-0.135, 0.11), (-0.105, 0.095))):
        m.cyl(rr, 0.008, (x, yb + rr + 0.003, 0.0), plate, seg=36, axis="x", bevel=0.003, rot=(0, 0, -8),
              name="plate")
    # 右手前: 箸立て、右奥: 伏せたコップ
    m.cyl(0.035, 0.11, (0.15, yb + 0.055, 0.07), wire, seg=20, name="utensil_holder")
    m.cyl(0.031, 0.002, (0.15, yb + 0.11, 0.07), tray, seg=20, name="holder_top")
    for dx, dz, h, tilt in ((-0.012, -0.008, 0.28, 4), (0.006, 0.01, 0.298, -5), (0.014, -0.01, 0.27, 7)):
        x, z = 0.15 + dx, 0.07 + dz
        m.rod((x, yb + 0.02, z), (x + math.sin(math.radians(tilt)) * 0.1, h, z), 0.0035, plate, seg=6,
              name="chopstick")
    m.lathe([(0.0, 0.09), (0.03, 0.09), (0.034, 0.04), (0.036, 0.0), (0.0, 0.0)], (0.15, yb + 0.002, -0.07), cup,
            seg=24, name="cup")
    _polyline(m, [(0.185, yb + 0.02, -0.07), (0.205, yb + 0.03, -0.07), (0.205, yb + 0.06, -0.07),
                  (0.182, yb + 0.07, -0.07)], 0.005, cup, seg=6, name="cup_handle")
    return m


# ---------- 暖房・PC・小物家電 ----------

@asset("heater.glb", (0.40, 0.65, 0.25))
def heater(tint=None):
    """オイルヒーター。縦長のフィンを並べ、脚にキャスター、右端に操作ボックス。"""
    m = Model("heater")
    body = m.mat("tint", tint or P.WHITE, rough=0.6)
    plastic = m.mat("plastic", "#8a86a0", rough=0.6)
    light = m.mat("light", "#ffb07a", rough=0.5, emit="#ffb07a", strength=1.8)
    n, pitch, t = 9, 0.036, 0.026
    x0 = -0.2
    y0, h = 0.075, 0.575
    for i in range(n):
        x = x0 + pitch * i
        m.prism(rrect(0.17, h, 0.06), t, body, plane="zy", offset=x, center=(0, y0 + h / 2, 0), bevel=0.008,
                name="fin")
    xe = x0 + pitch * (n - 1) + t
    for y in (y0 + 0.05, y0 + h - 0.05):
        m.rod((x0, y, 0), (xe + 0.01, y, 0), 0.018, body, seg=12, name="header")
    # 操作ボックス
    m.box((0.072, 0.2, 0.13), (xe + 0.036, y0 + h - 0.13, 0), body, bevel=0.016, seg=3, name="control")
    cx = xe + 0.036
    m.cyl(0.022, 0.012, (cx + 0.036, y0 + h - 0.1, 0.02), plastic, seg=20, axis="x", bevel=0.004, name="dial")
    m.box((0.004, 0.014, 0.034), (cx + 0.036 + 0.007, y0 + h - 0.1, 0.02), body, bevel=0.0, name="dial_mark")
    m.box((0.004, 0.024, 0.04), (cx + 0.037, y0 + h - 0.175, 0.02), plastic, bevel=0.002, name="switch")
    m.cyl(0.006, 0.004, (cx + 0.037, y0 + h - 0.06, -0.03), light, seg=10, axis="x", name="lamp")
    # 脚 (Z方向のバー) とキャスター
    for x in (-0.15, 0.08):
        m.box((0.04, 0.025, 0.24), (x, 0.05, 0), body, bevel=0.01, name="foot_bar")
        for sz in (-1, 1):
            m.cyl(0.006, 0.012, (x, 0.032, sz * 0.095), plastic, seg=8, name="caster_stem")
            m.cyl(0.02, 0.016, (x, 0.02, sz * 0.095), plastic, seg=16, axis="x", bevel=0.004, name="caster")
    return m


@asset("desktop_pc.glb", (0.20, 0.45, 0.45))
def desktop_pc(tint=None):
    """タワー型デスクトップPC。左側面 (-X) がガラス窓で、内部に光る帯とファン。"""
    m = Model("desktop_pc")
    body = m.mat("tint", tint or P.WHITE, rough=0.6)
    screen = m.mat("screen", "#3a3650", rough=0.5)
    light = m.mat("light", "#a77bff", rough=0.5, emit="#a77bff", strength=1.6)
    glass = m.mat("glass", P.GLASS, rough=0.3, alpha=0.3)
    W, H, D = 0.2, 0.43, 0.45
    y0 = 0.02
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box((0.03, y0, 0.06), (sx * 0.07, y0 / 2, sz * 0.17), screen, bevel=0.004, name="foot")
    # 枠: 右側面・上下・前後を本体色で、左は開口
    m.box((W - 0.012, H, D), (0.006, y0 + H / 2, 0), body, bevel=0.012, seg=2, name="case")
    # 内部 (左側面にはめた濃色の面)
    ix = -W / 2 + 0.006
    m.box((0.004, H - 0.05, D - 0.06), (ix + 0.002, y0 + H / 2, -0.005), screen, bevel=0.0, name="interior")
    # マザーボード上の部品
    m.box((0.01, 0.05, 0.28), (ix - 0.005, y0 + 0.2, -0.02), body, bevel=0.003, name="gpu")
    m.box((0.01, 0.08, 0.08), (ix - 0.005, y0 + 0.31, -0.06), body, bevel=0.003, name="cooler")
    for y in (0.13, 0.27):
        _ring(m, 0.042, 0.005, light, center=(ix - 0.002, y0 + y + 0.04, -0.19), rot=(0, 0, 90), seg=28, tseg=5,
              name="fan_ring")
        m.cyl(0.012, 0.006, (ix - 0.002, y0 + y + 0.04, -0.19), body, seg=14, axis="x", name="fan_hub")
    # 縦に光る帯 (前寄り)
    m.box((0.004, H - 0.08, 0.01), (ix - 0.003, y0 + H / 2, D / 2 - 0.05), light, bevel=0.0, name="strip")
    m.box((0.004, 0.01, D - 0.12), (ix - 0.003, y0 + 0.035, -0.01), light, bevel=0.0, name="strip_bottom")
    # ガラス板と枠
    m.box((0.004, H - 0.03, D - 0.03), (-W / 2 + 0.002, y0 + H / 2, 0), glass, bevel=0.002, name="glass")
    # 前面: 縦の吸気スリット、電源ボタン
    for i in range(5):
        m.box((0.008, 0.3, 0.004), (-0.04 + 0.02 * i, y0 + 0.17, D / 2 + 0.001), screen, bevel=0.002,
              name="intake")
    m.cyl(0.011, 0.004, (0.0, y0 + H - 0.04, D / 2 + 0.001), screen, seg=16, axis="z", name="power")
    _ring(m, 0.011, 0.0018, light, center=(0.0, y0 + H - 0.04, D / 2 + 0.003), rot=(90, 0, 0), seg=20, tseg=4,
          name="power_ring")
    return m


@asset("keyboard_mouse.glb", (0.45, 0.04, 0.20))
def keyboard_mouse(tint=None):
    """キーボード (キーの格子) と右 (+X) のマウスパッドにマウス。"""
    m = Model("keyboard_mouse")
    body = m.mat("tint", tint or P.WHITE, rough=0.6)
    keys = m.mat("keys", "#ece6f2", rough=0.7)
    pad = m.mat("pad", "#b9b6c6", rough=0.95)
    accent = m.mat("accent", "#c9b6e4", rough=0.7)
    kx, kw, kd = -0.065, 0.32, 0.13
    m.box((kw, 0.018, kd), (kx, 0.009, -0.01), body, bevel=0.007, seg=2, rot=(4, 0, 0), name="keyboard")
    # キー: 5段 × 14列 (下段はスペースキー)
    u = 0.0215
    for row in range(5):
        z = -0.01 + (row - 2) * u
        ys = 0.0185 - (row - 2) * u * math.tan(math.radians(4))
        if row == 4:
            cells = [(-5.5, 1.5), (-3.75, 1.0), (0.0, 6.0), (3.75, 1.0), (5.5, 1.5)]
        else:
            cells = [(c - 6.5, 1.0) for c in range(14)]
        for cx, cw in cells:
            mat = accent if (row == 0 and cx == -6.5) or (row == 2 and cx == 6.5) else keys
            m.box((cw * u - 0.004, 0.006, u - 0.004), (kx + cx * u, ys + 0.002, z), mat, bevel=0.0015, seg=1,
                  rot=(4, 0, 0), name="key")
    # マウスパッドとマウス
    px = 0.225 - 0.0525
    m.box((0.105, 0.003, 0.20), (px, 0.0015, 0.0), pad, bevel=0.0012, name="pad")
    mouse = m.sphere(0.5, (0, 0, 0), body, seg=20, rings=10, name="mouse")
    me = mouse.data
    for v in me.vertices:
        co = v.co
        co.x *= 0.062
        co.z *= 0.11
        co.y = (max(co.y, -0.2) + 0.2) * 0.0514
    me.transform(Matrix.Translation((px, 0.003, 0.0)))
    m.box((0.002, 0.004, 0.035), (px, 0.0375, -0.02), pad, bevel=0.0, name="mouse_split")
    m.cyl(0.004, 0.008, (px, 0.036, -0.022), accent, seg=10, axis="z", name="wheel")
    return m


@asset("projector.glb", (0.25, 0.10, 0.20))
def projector(tint=None):
    """ホームプロジェクター。前面 (+Z) 左寄りにレンズ、天面にピントのつまみ、側面に通気口。"""
    m = Model("projector")
    body = m.mat("tint", tint or P.WHITE, rough=0.6)
    plastic = m.mat("plastic", "#8a86a0", rough=0.6)
    lens = m.mat("glass", "#a9c6e8", rough=0.3)
    light = m.mat("light", "#bfe6ff", rough=0.5, emit="#bfe6ff", strength=1.8)
    y0, H, D = 0.008, 0.088, 0.185
    _feet(m, plastic, (-0.09, 0.09), (-0.06, 0.06), r=0.012, h=y0)
    m.box((0.25, H, D), (0, y0 + H / 2, -0.0075), body, bevel=0.022, seg=3, name="body")
    fz = D / 2 - 0.0075
    lx, ly = -0.055, y0 + H / 2
    m.cyl(0.036, 0.012, (lx, ly, fz + 0.002), plastic, seg=32, axis="z", bevel=0.004, name="lens_ring")
    m.cyl(0.026, 0.01, (lx, ly, fz + 0.008), lens, seg=28, axis="z", bevel=0.003, name="lens")
    m.cyl(0.012, 0.003, (lx, ly, fz + 0.0135), light, seg=16, axis="z", name="lens_glow")
    # 前面右: 通気スリット
    for i in range(5):
        m.box((0.075, 0.005, 0.004), (0.065, y0 + 0.025 + 0.011 * i, fz + 0.001), plastic, bevel=0.001,
              name="vent")
    # 天面: ピントリングとボタン
    m.cyl(0.014, 0.006, (lx, y0 + H + 0.002, -0.02), plastic, seg=16, bevel=0.002, name="focus")
    for i in range(3):
        m.cyl(0.006, 0.004, (0.04 + 0.022 * i, y0 + H + 0.001, -0.04), plastic, seg=10, name="button")
    m.cyl(0.004, 0.004, (0.04, y0 + H + 0.001, -0.06), light, seg=10, name="lamp")
    for sx in (-1, 1):
        for i in range(4):
            m.box((0.004, 0.04, 0.008), (sx * 0.125, y0 + H / 2, -0.05 + 0.02 * i), plastic, bevel=0.001,
                  name="side_vent")
    return m


@asset("radio.glb", (0.25, 0.15, 0.10))
def radio(tint=None):
    """レトロラジオ。左にスピーカーグリル、右に目盛り窓とつまみ2つ、上に持ち手。"""
    m = Model("radio")
    body = m.mat("tint", tint or "#8fc1b5", rough=0.6)
    wood = m.mat("wood", P.WOOD_MED, rough=0.7)
    face = m.mat("face", "#f4ead8", rough=0.7)
    ink = m.mat("ink", "#5c4b44", rough=0.7)
    W, H, D = 0.25, 0.115, 0.09
    m.box((W, H, D), (0, H / 2, -0.005), body, bevel=0.02, seg=3, name="body")
    fz = D / 2 - 0.005
    # 前面の木の化粧板
    m.box((W - 0.03, H - 0.026, 0.004), (0, H / 2, fz + 0.001), wood, bevel=0.002, name="front")
    # スピーカーグリル (左): 円の中に横スリット
    gx, gy = -0.055, H / 2
    m.cyl(0.04, 0.004, (gx, gy, fz + 0.004), face, seg=36, axis="z", name="grille")
    for i in range(-3, 4):
        hw = math.sqrt(max(0.0, 0.034 ** 2 - (i * 0.009) ** 2))
        m.box((2 * hw, 0.0035, 0.003), (gx, gy + i * 0.009, fz + 0.007), ink, bevel=0.0, name="slot")
    # 目盛り窓と針 (右上)
    dx = 0.065
    m.box((0.085, 0.032, 0.004), (dx, H / 2 + 0.018, fz + 0.004), face, bevel=0.002, name="dial_window")
    for i in range(9):
        m.box((0.0015, 0.008 if i % 2 else 0.012, 0.002), (dx - 0.034 + 0.0085 * i, H / 2 + 0.024, fz + 0.007),
              ink, bevel=0.0, name="tick")
    m.box((0.002, 0.026, 0.002), (dx + 0.006, H / 2 + 0.018, fz + 0.008), ink,
          bevel=0.0, name="needle")
    for x in (dx - 0.022, dx + 0.022):
        m.cyl(0.013, 0.012, (x, H / 2 - 0.022, fz + 0.008), face, seg=24, axis="z", bevel=0.003, name="knob")
        m.box((0.003, 0.01, 0.003), (x, H / 2 - 0.017, fz + 0.0145), ink, bevel=0.0, name="knob_mark")
    # 持ち手 (上)
    for sx in (-1, 1):
        m.box((0.016, 0.012, 0.022), (sx * 0.075, H + 0.004, -0.005), wood, bevel=0.004, name="handle_mount")
    arc = [(0.075 * math.cos(math.pi * i / 10), H + 0.006 + 0.026 * math.sin(math.pi * i / 10), -0.005)
           for i in range(11)]
    _polyline(m, arc, 0.004, ink, seg=8, name="handle")
    return m


# ---------- 照明 ----------

@asset("lamp_paper.glb", (0.40, 1.00, 0.40))
def lamp_paper(tint=None):
    """和紙のフロアランプ。細い3本脚の上に、竹ひごの横線が入った丸い提灯形の灯り。"""
    m = Model("lamp_paper")
    frame = m.mat("tint", tint or P.METAL_DARK, rough=0.6)
    paper = m.mat("light", "#fff1d6", rough=0.7, emit="#fff1d6", strength=1.0)
    rib = m.mat("rib", "#e3cfa9", rough=0.8)
    cy, R, Hh = 0.77, 0.196, 0.205  # 提灯の中心・半径・半高さ
    ends = 0.045

    def prof_r(t):  # t: -1..1
        return max(ends, R * math.sqrt(max(0.0, 1 - t * t)))

    prof = [(prof_r(-1 + 2 * i / 24), cy + Hh * (-1 + 2 * i / 24)) for i in range(25)]
    m.lathe(prof, (0, 0, 0), paper, seg=48, cap_bottom=True, cap_top=True, name="paper")
    for k in range(1, 12):
        t = -1 + 2 * k / 12
        _ring(m, prof_r(t) + 0.002, 0.0022, rib, center=(0, cy + Hh * t, 0), seg=48, tseg=4, name="rib")
    for y in (cy - Hh, cy + Hh):
        _ring(m, ends + 0.002, 0.004, rib, center=(0, y, 0), seg=24, tseg=5, name="end_ring")
    m.cyl(0.02, 0.016, (0, cy + Hh + 0.008, 0), frame, seg=16, name="top_cap")
    # 3本脚と下のリング
    top = cy - Hh + 0.01
    for k in range(3):
        a = TAU * k / 3 + TAU / 12
        foot = (0.14 * math.cos(a), 0.0, 0.14 * math.sin(a))
        m.rod(foot, (0.03 * math.cos(a), top, 0.03 * math.sin(a)), 0.006, frame, seg=8, name="leg")
        m.sphere(0.008, (foot[0], 0.008, foot[2]), frame, seg=10, rings=5, name="foot")
    _ring(m, 0.105, 0.004, frame, center=(0, 0.14, 0), seg=40, tseg=5, name="leg_ring")
    m.cyl(0.035, 0.012, (0, top - 0.004, 0), frame, seg=16, name="socket")
    return m


@asset("lamp_wall.glb", (0.20, 0.30, 0.20))
def lamp_wall(tint=None):
    """ブラケットライト。壁に付く丸い台座 (背面 -Z 平ら) から腕が出て、上向きのシェード。"""
    m = Model("lamp_wall")
    shade = m.mat("tint", tint or "#f2dfe0", rough=0.7)
    metal = m.mat("metal", "#cbbfa9", rough=0.5)
    light = m.mat("light", P.WARM_LIGHT, rough=0.5, emit=P.WARM_LIGHT, strength=2.2)
    # 壁の台座: 縦長の角丸板
    m.prism(rrect(0.075, 0.15, 0.035), 0.016, metal, plane="xy", offset=-0.1, center=(0, 0.075, 0), bevel=0.004,
            name="backplate")
    # 腕: 台座から前へ出て上へ
    _polyline(m, [(0, 0.06, -0.084), (0, 0.06, -0.035), (0, 0.085, 0.0), (0, 0.17, 0.0)], 0.007, metal, seg=10,
              name="arm")
    m.cyl(0.014, 0.012, (0, 0.06, -0.08), metal, seg=14, axis="z", bevel=0.003, name="arm_mount")
    m.cyl(0.02, 0.025, (0, 0.18, 0.0), metal, seg=16, bevel=0.004, name="socket")
    # 上へ開くシェード (厚みのある殻)
    y0, y1 = 0.18, 0.30
    outer = [(0.045, y0), (0.06, y0 + 0.03), (0.08, y0 + 0.07), (0.1, y1)]
    inner = [(r - 0.005, y) for r, y in reversed(outer)]
    inner[-1] = (0.04, y0 + 0.005)
    m.lathe(outer + inner, (0, 0, 0), shade, seg=48, closed=True, name="shade")
    m.cyl(0.04, 0.004, (0, y0 + 0.003, 0.0), shade, seg=32, name="shade_floor")
    m.sphere(0.03, (0, 0.225, 0.0), light, seg=16, rings=8, name="bulb")
    return m


@asset("neon_sign.glb", (0.40, 0.35, 0.03))
def neon_sign(tint=None):
    """ハートのネオンサイン。透明アクリル板 (背面 -Z 平ら) に光る管、四隅の留め具。"""
    m = Model("neon_sign")
    glow = tint or "#ff5fa2"
    light = m.mat("light", glow, rough=0.4, emit=glow, strength=1.5)
    acrylic = m.mat("glass", P.GLASS, rough=0.3, alpha=0.35)
    cap = m.mat("plastic", "#dcd8e4", rough=0.6)
    W, H = 0.40, 0.35
    m.prism(rrect(W, H, 0.03), 0.006, acrylic, plane="xy", offset=-0.015, center=(0, H / 2, 0), bevel=0.0015,
            name="plate")
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.cyl(0.011, 0.012, (sx * (W / 2 - 0.025), H / 2 + sy * (H / 2 - 0.025), -0.003), cap, seg=14,
                  axis="z", bevel=0.003, name="standoff")
    # ハート曲線 (管の中心 z=0.006)
    s = 0.0092
    cy = H / 2 + 0.018
    n = 64
    pts = []
    for i in range(n + 1):
        t = TAU * i / n
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((x * s, cy + y * s, 0.006))
    _polyline(m, pts, 0.008, light, seg=8, name="tube")
    m.sphere(0.008, pts[0], light, seg=8, rings=4, name="tube_joint")
    # 管を板に留める小さなクリップ
    for i in (8, 24, 40, 56):
        x, y, _ = pts[i]
        m.box((0.012, 0.012, 0.012), (x, y, -0.004), cap, bevel=0.003, name="clip")
    return m

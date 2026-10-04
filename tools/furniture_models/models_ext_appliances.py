"""追加の照明と家電 (2026-10-04)。発光部分は独立素材 (light)。"""
import math

from mathutils import Matrix, Vector

import palette as P
from lib import TAU, Model, asset, rot_matrix, rrect


def ring(m, R, t, mat, center=(0, 0, 0), rot=None, seg=40, tseg=8, name="ring"):
    """トーラス。既定はY軸まわり (XZ平面)。rot=(90, 0, 0) でXY平面 (+Z向き)。"""
    prof = [(R + t * math.cos(TAU * i / tseg), t * math.sin(TAU * i / tseg)) for i in range(tseg)]
    ob = m.lathe(prof, (0, 0, 0), mat, seg=seg, closed=True, name=name)
    mx = Matrix.Translation(Vector(center))
    if rot:
        mx = mx @ rot_matrix(rot)
    ob.data.transform(mx)
    return ob


def polyline(m, pts, r, mat, seg=8, joints=True, name="wire"):
    for a, b in zip(pts, pts[1:]):
        m.rod(a, b, r, mat, seg=seg, name=name)
    if joints:
        for p in pts[1:-1]:
            m.sphere(r, p, mat, seg=seg, rings=max(4, seg // 2), name=name + "_joint")


def transform_last(m, n, mx):
    for ob in m.parts[-n:]:
        m.apply(ob)
        ob.data.transform(mx)


# ---------- 照明 ----------

@asset("ceiling_light.glb", (0.50, 0.12, 0.50))
def ceiling_light(tint=None):
    """丸型シーリングライト。上 (天井側) に本体とアダプタ、下へ乳白のカバー。"""
    m = Model("ceiling_light")
    body = m.mat("tint", tint or P.WHITE, rough=0.6)
    adapter = m.mat("plastic", "#d9d3e2", rough=0.6)
    light = m.mat("light", "#fff6e6", rough=0.5, emit="#fff6e6", strength=1.6)
    # 乳白カバー: 下へふくらむ浅いドーム
    prof = [(0.0, 0.0)]
    for i in range(1, 11):
        a = math.pi / 2 * i / 10
        prof.append((0.235 * math.sin(a), 0.07 * (1 - math.cos(a))))
    m.lathe(prof, (0, 0, 0), light, seg=56, cap_top=True, name="diffuser")
    # 外周の枠と本体
    m.lathe([(0.226, 0.066), (0.25, 0.07), (0.25, 0.088), (0.24, 0.095), (0.226, 0.095)], (0, 0, 0), body,
            seg=56, closed=True, name="rim")
    m.cyl(0.215, 0.018, (0, 0.104, 0), body, seg=56, bevel=0.006, name="housing")
    m.cyl(0.055, 0.008, (0, 0.116, 0), adapter, seg=28, bevel=0.002, name="adapter")
    return m


@asset("floor_lamp_arc.glb", (1.10, 1.90, 0.35))
def floor_lamp_arc(tint=None):
    """アーチ型。重いベースが-X端、弧を描く支柱の先 (+X端) にドーム型シェード。"""
    m = Model("floor_lamp_arc")
    stone = m.mat("stone", "#e9e4dc", rough=0.7)
    metal = m.mat("metal", "#cbbfa9", rough=0.4)
    shade = m.mat("tint", tint or "#4a4562", rough=0.85)
    light = m.mat("light", P.WARM_LIGHT, rough=0.5, emit=P.WARM_LIGHT, strength=2.0)
    bx, sx = -0.40, 0.375
    # 大理石風の重いベース
    m.cyl(0.15, 0.055, (bx, 0.0275, 0), stone, seg=48, bevel=0.012, bseg=3, name="base")
    m.cyl(0.03, 0.02, (bx, 0.065, 0), metal, seg=20, bevel=0.004, name="collar")
    # 3次ベジエの弧
    P0, P1, P2, P3 = (bx, 0.07), (bx, 1.85), (sx, 2.1), (sx, 1.62)

    def bez(t):
        u = 1 - t
        return tuple(u ** 3 * a + 3 * u * u * t * b + 3 * u * t * t * c + t ** 3 * d
                     for a, b, c, d in zip(P0, P1, P2, P3))

    raw = [bez(i / 36) for i in range(37)]
    ymax = max(p[1] for p in raw)
    k = (1.885 - 0.07) / (ymax - 0.07)
    pts = [(x, 0.07 + (y - 0.07) * k, 0.0) for x, y in raw]
    polyline(m, pts, 0.011, metal, seg=10, joints=False, name="arc")
    tip = pts[-1]
    # ドーム型シェード (下が開く)
    top = tip[1] - 0.02
    outer = [(0.175 * math.sin(math.pi / 2 * i / 10) + 0.012, top - 0.16 * (1 - math.cos(math.pi / 2 * i / 10)))
             for i in range(11)]
    outer[0] = (0.0, top + 0.01)
    inner = [(max(r - 0.006, 0.0), y - 0.006) for r, y in reversed(outer)]
    m.lathe(outer + inner, (sx, 0, 0), shade, seg=48, closed=True, name="shade")
    m.cyl(0.02, 0.03, (sx, top + 0.015, 0), metal, seg=14, name="cap")
    m.sphere(0.05, (sx, top - 0.11, 0), light, seg=16, rings=8, name="bulb")
    return m


@asset("desk_lamp_arm.glb", (0.20, 0.50, 0.40))
def desk_lamp_arm(tint=None):
    """アーム式。後方の重いベース、2本のアームと関節、ヘッドは前下向き (+Z)。"""
    m = Model("desk_lamp_arm")
    body = m.mat("tint", tint or "#b9d4c8", rough=0.6)
    joint = m.mat("joint", P.METAL_DARK, rough=0.6)
    light = m.mat("light", P.WARM_LIGHT, rough=0.5, emit=P.WARM_LIGHT, strength=2.5)
    m.cyl(0.10, 0.03, (0, 0.015, -0.10), body, seg=48, bevel=0.008, name="base")
    m.box((0.05, 0.035, 0.05), (0, 0.045, -0.12), body, bevel=0.01, name="pivot_block")
    pivot = (0, 0.07, -0.12)
    elbow = (0, 0.462, -0.07)
    head_top = (0, 0.42, 0.10)
    m.cyl(0.018, 0.05, pivot, joint, seg=16, axis="x", bevel=0.003, name="pivot")
    m.cyl(0.02, 0.05, elbow, joint, seg=16, axis="x", bevel=0.003, name="elbow")
    for dx in (-0.012, 0.012):
        m.rod((dx, pivot[1], pivot[2]), (dx, elbow[1], elbow[2]), 0.006, body, seg=8, name="lower_arm")
        m.rod((dx, elbow[1], elbow[2]), (dx, head_top[1], head_top[2]), 0.006, body, seg=8, name="upper_arm")
    # ヘッド: 円錐シェード、開口部を前下方へ
    tilt = rot_matrix((-30, 0, 0))
    origin = Vector(head_top) - tilt @ Vector((0, 0.085, 0))
    m.lathe([(0.0, 0.088), (0.016, 0.085), (0.03, 0.072), (0.055, 0.03), (0.062, 0.0), (0.056, 0.0),
             (0.049, 0.028), (0.025, 0.066), (0.0, 0.076)], (0, 0, 0), body, seg=32, closed=True, name="head")
    m.cyl(0.054, 0.003, (0, 0.006, 0), light, seg=32, name="lens")
    m.cyl(0.014, 0.04, (0, 0.09, 0), joint, seg=12, axis="x", name="head_joint")
    transform_last(m, 3, Matrix.Translation(origin) @ tilt)
    return m


@asset("lamp_lantern.glb", (0.18, 0.30, 0.18))
def lamp_lantern(tint=None):
    """ランタン型。台座と屋根の間に光るガラス、縦の枠、上に持ち手。"""
    m = Model("lamp_lantern")
    frame = m.mat("tint", tint or "#8fa98a", rough=0.6)
    light = m.mat("light", P.WARM_LIGHT, rough=0.4, emit=P.WARM_LIGHT, strength=1.8)
    m.lathe([(0.0, 0.0), (0.085, 0.0), (0.09, 0.006), (0.09, 0.022), (0.08, 0.03), (0.0, 0.03)], (0, 0, 0), frame,
            seg=40, name="base")
    m.cyl(0.068, 0.17, (0, 0.115, 0), light, seg=32, name="glass")
    for k in range(4):
        a = TAU * (k + 0.5) / 4
        m.box((0.014, 0.17, 0.014), (0.07 * math.cos(a), 0.115, 0.07 * math.sin(a)), frame, bevel=0.003,
              rot=(0, -math.degrees(a), 0), name="post")
    ring(m, 0.07, 0.005, frame, center=(0, 0.115, 0), seg=32, tseg=6, name="band")
    # 屋根
    m.lathe([(0.0, 0.198), (0.088, 0.198), (0.088, 0.208), (0.03, 0.245), (0.0, 0.248)], (0, 0, 0), frame,
            seg=40, name="roof")
    m.cyl(0.012, 0.012, (0, 0.252, 0), frame, seg=12, name="knob")
    # 持ち手 (正面から見えるよう XY 平面の半円)
    arc = [(0.04 * math.cos(math.pi * i / 10), 0.255 + 0.04 * math.sin(math.pi * i / 10), 0.0) for i in range(11)]
    polyline(m, arc, 0.004, frame, seg=8, name="handle")
    return m


@asset("fairy_lights.glb", (1.50, 0.30, 0.05))
def fairy_lights(tint=None):
    """ガーランドライト。両端を留めた電線がたるみ、丸い電球が15個下がる。"""
    m = Model("fairy_lights")
    cord = m.mat("cord", "#5d6b57", rough=0.7)
    light = m.mat("light", tint or "#ffe9b8", rough=0.4, emit=tint or "#ffe9b8", strength=2.2)
    half, y_end, y_mid = 0.745, 0.292, 0.072
    lo, hi = 0.05, 5.0  # 懸垂線 y = y_mid + a(cosh(x/a) - 1)
    for _ in range(60):
        a = (lo + hi) / 2
        if a * (math.cosh(half / a) - 1) > y_end - y_mid:
            lo = a
        else:
            hi = a

    def wire_y(x):
        return y_mid + a * (math.cosh(x / a) - 1)

    pts = [(x, wire_y(x), 0.0) for x in (half * (2 * i / 30 - 1) for i in range(31))]
    polyline(m, pts, 0.0028, cord, seg=6, joints=False, name="cord")
    for sx in (-1, 1):
        m.box((0.012, 0.03, 0.018), (sx * half, y_end, 0.0), cord, bevel=0.003, name="clip")
    for i in range(15):
        x = -0.70 + 0.1 * i
        y = wire_y(x)
        m.cyl(0.0075, 0.016, (x, y - 0.008, 0), cord, seg=10, name="socket")
        m.sphere(0.025, (x, y - 0.016 - 0.023, 0), light, seg=14, rings=8, scale=(1.0, 1.05, 1.0), name="bulb")
    return m


# ---------- 家電 ----------

@asset("air_purifier.glb", (0.30, 0.55, 0.30))
def air_purifier(tint=None):
    """タワー型空気清浄機。前面にスリット、天面に吹き出し口。"""
    m = Model("air_purifier")
    body = m.mat("tint", tint or P.WHITE, rough=0.6)
    grille = m.mat("grille", "#9c97ab", rough=0.7)
    light = m.mat("light", "#9fd8f0", rough=0.5, emit="#9fd8f0", strength=2.0)
    m.box((0.30, 0.535, 0.29), (0, 0.0075 + 0.2675, -0.005), body, bevel=0.045, seg=3, name="body")
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.cyl(0.015, 0.008, (sx * 0.1, 0.004, sz * 0.1), grille, seg=12, name="foot")
    # 前面: 濃色の吸気面に横スリット
    m.box((0.21, 0.31, 0.006), (0, 0.235, 0.141), grille, bevel=0.003, name="intake")
    for i in range(14):
        m.box((0.214, 0.011, 0.008), (0, 0.09 + 0.0215 * i + 0.005, 0.145), body, bevel=0.003, name="slat")
    # 天面: 吹き出しのルーバー
    m.prism(rrect(0.22, 0.18, 0.03), 0.004, grille, offset=0.539, center=(0, 0, -0.02), name="outlet")
    for i in range(8):
        m.box((0.20, 0.008, 0.008), (0, 0.546, -0.096 + 0.022 * i), body, bevel=0.002, name="louver")
    # 天面手前の操作部
    m.box((0.12, 0.004, 0.035), (0, 0.544, 0.11), grille, bevel=0.0015, name="panel")
    m.cyl(0.006, 0.004, (-0.035, 0.547, 0.11), light, seg=12, name="lamp")
    m.cyl(0.006, 0.004, (0.0, 0.547, 0.11), light, seg=12, name="lamp")
    m.cyl(0.01, 0.004, (0.04, 0.547, 0.11), body, seg=14, name="button")
    return m


@asset("speaker.glb", (0.12, 0.20, 0.12))
def speaker(tint=None):
    """布張りの円筒形スピーカー。天面に操作ボタン。"""
    m = Model("speaker")
    fabric = m.mat("tint", tint or "#b9b6c6", rough=0.95)
    plastic = m.mat("plastic", "#4d4868", rough=0.6)
    light = m.mat("light", "#bfe6ff", rough=0.5, emit="#bfe6ff", strength=2.0)
    m.cyl(0.056, 0.008, (0, 0.004, 0), plastic, seg=40, bevel=0.003, name="foot")
    m.lathe([(0.055, 0.006), (0.06, 0.014), (0.06, 0.182), (0.056, 0.19), (0.05, 0.19), (0.05, 0.006)],
            (0, 0, 0), fabric, seg=64, closed=True, pleat=0.012, name="fabric")
    m.lathe([(0.0, 0.186), (0.054, 0.186), (0.056, 0.192), (0.05, 0.198), (0.0, 0.199)], (0, 0, 0), plastic,
            seg=40, name="top")
    ring(m, 0.038, 0.0018, light, center=(0, 0.199, 0), seg=32, tseg=5, name="led_ring")
    for k in range(4):
        a = TAU * k / 4 + TAU / 8
        m.cyl(0.006, 0.002, (0.02 * math.cos(a), 0.2, 0.02 * math.sin(a)), fabric, seg=10, name="button")
    return m


@asset("fan.glb", (0.35, 0.90, 0.35))
def fan(tint=None):
    """リビング扇風機。丸いベース、支柱、モーター、ガード、5枚羽根。+Z正面。"""
    m = Model("fan")
    body = m.mat("tint", tint or P.WHITE, rough=0.6)
    guard = m.mat("grille", "#d5d0de", rough=0.6)
    blade = m.mat("blade", "#b9d6ea", rough=0.5)
    bz = -0.06
    m.lathe([(0.0, 0.0), (0.155, 0.0), (0.16, 0.008), (0.15, 0.03), (0.12, 0.04), (0.0, 0.042)], (0, 0, bz), body,
            seg=48, name="base")
    for i, x in enumerate((-0.03, 0.0, 0.03)):
        m.cyl(0.009, 0.006, (x, 0.042, bz + 0.09), guard, seg=12, name="button")
    m.cyl(0.02, 0.6, (0, 0.04 + 0.3, bz), body, seg=16, name="pole")
    m.cyl(0.026, 0.03, (0, 0.33, bz), guard, seg=16, bevel=0.004, name="pole_joint")
    # モーターと首
    cy = 0.722
    m.box((0.05, 0.06, 0.05), (0, 0.655, -0.05), body, bevel=0.012, name="neck")
    m.lathe([(0.0, -0.15), (0.045, -0.148), (0.062, -0.12), (0.066, -0.07), (0.06, 0.005), (0.0, 0.005)],
            (0, 0, 0), body, seg=32, name="motor")
    transform_last(m, 1, Matrix.Translation((0, cy, 0.02)) @ rot_matrix((90, 0, 0)))
    # ガード: 外周リング、後ろ・前のドーム状ワイヤー
    R, zr = 0.17, 0.06
    ring(m, R, 0.005, guard, center=(0, cy, zr), rot=(90, 0, 0), seg=48, tseg=6, name="rim")
    n = 24
    for k in range(n):
        a = TAU * k / n
        c, s = math.cos(a), math.sin(a)
        front = [(r * c, cy + r * s, zr + 0.075 * (1 - (r / R) ** 2)) for r in (0.04, 0.08, 0.12, 0.15, R)]
        back = [(r * c, cy + r * s, zr - 0.045 * (1 - (r / R) ** 2)) for r in (0.07, 0.11, 0.145, R)]
        polyline(m, front, 0.0018, guard, seg=5, joints=False, name="wire_f")
        polyline(m, back, 0.0018, guard, seg=5, joints=False, name="wire_b")
    for r in (0.08, 0.125):
        ring(m, r, 0.0022, guard, center=(0, cy, zr + 0.075 * (1 - (r / R) ** 2)), rot=(90, 0, 0), seg=40, tseg=5,
             name="ring_f")
    m.cyl(0.04, 0.012, (0, cy, zr + 0.077), body, seg=28, axis="z", bevel=0.004, name="badge")
    ring(m, 0.07, 0.003, guard, center=(0, cy, zr - 0.031), rot=(90, 0, 0), seg=32, tseg=5, name="ring_b")
    # 羽根
    m.cyl(0.032, 0.04, (0, cy, 0.05), body, seg=24, axis="z", bevel=0.008, name="hub")
    outline = []
    L = 0.125
    side = []
    for i in range(9):
        t = i / 8
        w = 0.012 + 0.055 * math.sin(math.pi * min(1.0, t * 1.15)) ** 0.7
        side.append((w / 2, 0.028 + L * t))
    outline = side + [(-x, y) for x, y in reversed(side)]
    for k in range(5):
        m.prism(outline, 0.004, blade, plane="xy", offset=-0.002, rot=(0, 18, 72 * k), center=(0, cy, 0.05),
                fan=True, name="blade")
    return m


@asset("humidifier.glb", (0.20, 0.30, 0.20))
def humidifier(tint=None):
    """小型の円筒形加湿器。水タンクの帯、上に蒸気の吹き出しノズル。"""
    m = Model("humidifier")
    body = m.mat("tint", tint or "#f2dfe0", rough=0.6)
    tank = m.mat("tank", "#cfe3ef", rough=0.4)
    plastic = m.mat("plastic", "#8a86a0", rough=0.6)
    light = m.mat("light", "#a6e2ff", rough=0.5, emit="#a6e2ff", strength=2.0)
    m.lathe([(0.0, 0.0), (0.094, 0.0), (0.1, 0.008), (0.1, 0.11), (0.0, 0.11)], (0, 0, 0), body, seg=48,
            name="lower")
    m.cyl(0.096, 0.13, (0, 0.11 + 0.065, 0), tank, seg=48, name="tank")
    m.lathe([(0.0, 0.24), (0.1, 0.24), (0.1, 0.262), (0.085, 0.278), (0.04, 0.282), (0.0, 0.282)], (0, 0, 0),
            body, seg=48, name="top")
    m.lathe([(0.032, 0.276), (0.034, 0.3), (0.024, 0.3), (0.022, 0.29), (0.0, 0.29), (0.0, 0.276)],
            (0, 0, 0), plastic, seg=28, name="nozzle")
    # 前面の操作部
    m.box((0.06, 0.03, 0.01), (0, 0.06, 0.097), plastic, bevel=0.004, name="panel")
    m.cyl(0.005, 0.004, (-0.015, 0.06, 0.103), light, seg=10, axis="z", name="lamp")
    m.cyl(0.008, 0.005, (0.014, 0.06, 0.103), body, seg=12, axis="z", name="button")
    return m


@asset("vacuum_stick.glb", (0.25, 1.10, 0.25))
def vacuum_stick(tint=None):
    """スタンドに立てたスティック掃除機。"""
    m = Model("vacuum_stick")
    body = m.mat("tint", tint or "#c9b6e4", rough=0.6)
    pipe = m.mat("metal", "#d8d4de", rough=0.5)
    dark = m.mat("plastic", P.METAL_DARK, rough=0.6)
    stand = m.mat("stand", P.WHITE, rough=0.6)
    # スタンド: 台座と背面の支柱、本体を掛けるフック
    m.prism(rrect(0.25, 0.25, 0.04), 0.018, stand, center=(0, 0, 0), bevel=0.006, name="stand_base")
    m.box((0.045, 0.86, 0.03), (0, 0.018 + 0.43, -0.105), stand, bevel=0.01, name="stand_post")
    m.box((0.05, 0.03, 0.07), (0, 0.80, -0.065), stand, bevel=0.008, name="stand_hook")
    # ヘッド
    m.box((0.23, 0.045, 0.08), (0, 0.018 + 0.0225, 0.04), dark, bevel=0.015, seg=3, name="head")
    m.box((0.21, 0.012, 0.03), (0, 0.065, 0.025), body, bevel=0.005, name="head_top")
    m.cyl(0.022, 0.03, (0, 0.07, 0.02), dark, seg=14, axis="x", bevel=0.004, name="head_joint")
    # パイプ
    a, b = (0, 0.075, 0.015), (0, 0.66, -0.035)
    m.rod(a, b, 0.016, pipe, seg=14, name="pipe")
    # 本体: ダストカップ (前) とモーター (後)、ハンドル
    m.cyl(0.042, 0.17, (0, 0.765, -0.02), body, seg=28, bevel=0.01, name="cup")
    m.cyl(0.036, 0.01, (0, 0.675, -0.02), dark, seg=24, name="cup_bottom")
    m.box((0.07, 0.15, 0.07), (0, 0.80, -0.075), dark, bevel=0.015, name="motor")
    m.box((0.06, 0.07, 0.06), (0, 0.885, -0.06), body, bevel=0.015, name="motor_cap")
    # ハンドル: モーター上から後上方へ伸び、上端で前へ折り返すループ
    grip = [(0, 0.905, -0.075), (0, 1.0, -0.095), (0, 1.07, -0.095)]
    polyline(m, grip, 0.016, body, seg=12, name="grip")
    m.rod((0, 1.07, -0.095), (0, 1.075, -0.03), 0.014, body, seg=12, name="handle_top")
    m.sphere(0.016, (0, 1.07, -0.095), body, seg=12, rings=6, name="handle_corner")
    m.rod((0, 1.075, -0.03), (0, 0.92, -0.025), 0.012, body, seg=12, name="handle_front")
    m.box((0.02, 0.025, 0.012), (0, 0.98, -0.078), dark, bevel=0.004, rot=(12, 0, 0), name="trigger")
    return m


@asset("fridge.glb", (0.48, 1.10, 0.55))
def fridge(tint=None):
    """一人暮らし向け2ドア冷蔵庫。上が冷凍室。"""
    m = Model("fridge")
    body = m.mat("tint", tint or "#e8e4ee", rough=0.6)
    plastic = m.mat("plastic", "#a9a4b6", rough=0.6)
    dark = m.mat("seal", "#5c5770", rough=0.8)
    W, D = 0.48, 0.55
    door_d = 0.035
    bz0, bz1 = -D / 2, D / 2 - door_d - 0.012
    m.box((W, 1.075, bz1 - bz0), (0, 0.022 + 1.075 / 2, (bz0 + bz1) / 2), body, bevel=0.012, name="body")
    # ドア裏の濃い帯 (パッキン) で扉の分かれ目を見せる
    m.box((W - 0.01, 1.07, 0.012), (0, 0.022 + 1.07 / 2, bz1 + 0.006), dark, bevel=0.0, name="gasket")
    split = 0.72
    dz = bz1 + 0.012 + door_d / 2
    m.box((W, 1.098 - split - 0.004, door_d), (0, (split + 0.004 + 1.098) / 2, dz), body, bevel=0.012, seg=3,
          name="freezer_door")
    m.box((W, split - 0.004 - 0.024, door_d), (0, (0.024 + split - 0.004) / 2, dz), body, bevel=0.012, seg=3,
          name="fridge_door")
    # 取っ手: 左端の縦長
    hx = -W / 2 + 0.035
    m.box((0.022, 0.12, 0.012), (hx, split + 0.08, D / 2 - 0.006), plastic, bevel=0.004, name="handle")
    m.box((0.022, 0.18, 0.012), (hx, split - 0.12, D / 2 - 0.006), plastic, bevel=0.004, name="handle")
    # 脚と背面
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.cyl(0.016, 0.024, (sx * 0.19, 0.012, sz * 0.2), plastic, seg=12, name="foot")
    m.box((0.36, 0.7, 0.01), (0, 0.45, bz0 + 0.002), plastic, bevel=0.003, name="back_panel")
    return m


@asset("microwave.glb", (0.45, 0.27, 0.35))
def microwave(tint=None):
    """電子レンジ。左に暗い窓の扉、右に操作パネル。"""
    m = Model("microwave")
    body = m.mat("tint", tint or P.WHITE, rough=0.6)
    window = m.mat("screen", "#2f2d3a", rough=0.4)
    panel = m.mat("plastic", "#8a86a0", rough=0.6)
    light = m.mat("light", "#bfeac9", rough=0.5, emit="#bfeac9", strength=1.8)
    W, H, D = 0.45, 0.26, 0.34
    y0 = 0.01
    m.box((W, H, D), (0, y0 + H / 2, -0.005), body, bevel=0.016, seg=3, name="body")
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.cyl(0.014, 0.012, (sx * 0.18, 0.006, sz * 0.13), panel, seg=12, name="foot")
    fz = D / 2 - 0.005
    # 扉
    dx0, dx1 = -W / 2 + 0.012, 0.085
    m.box((dx1 - dx0, H - 0.024, 0.01), ((dx0 + dx1) / 2, y0 + H / 2, fz + 0.005), body, bevel=0.005, name="door")
    m.box((dx1 - dx0 - 0.07, H - 0.09, 0.004), ((dx0 + dx1) / 2 - 0.01, y0 + H / 2, fz + 0.01), window,
          bevel=0.002, name="window")
    m.box((0.016, H - 0.07, 0.012), (dx1 - 0.022, y0 + H / 2, fz + 0.014), panel, bevel=0.005, name="handle")
    # 操作パネル
    px = (0.095 + W / 2 - 0.012) / 2
    pw = W / 2 - 0.012 - 0.095
    m.box((pw, H - 0.024, 0.006), (px, y0 + H / 2, fz + 0.003), panel, bevel=0.003, name="panel")
    m.box((pw - 0.03, 0.03, 0.003), (px, y0 + H - 0.05, fz + 0.007), light, bevel=0.0, name="display")
    for i in range(3):
        m.box((pw - 0.04, 0.014, 0.004), (px, y0 + H - 0.1 - 0.022 * i, fz + 0.008), body, bevel=0.002,
              name="button")
    m.cyl(0.022, 0.012, (px, y0 + 0.055, fz + 0.012), body, seg=24, axis="z", bevel=0.004, name="dial")
    return m


@asset("range_rack.glb", (0.60, 1.20, 0.40))
def range_rack(tint=None):
    """レンジ台。下段は扉付き収納、炊飯器用のスライド板、レンジ棚、天板。"""
    m = Model("range_rack")
    frame = m.mat("tint", tint or P.WHITE, rough=0.6)
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.6)
    metal = m.mat("metal", "#a9a4b6", rough=0.5)
    W, H, D = 0.60, 1.20, 0.40
    t = 0.018
    # 側板 (全高) と背面のつなぎ
    for sx in (-1, 1):
        m.box((t, H, D), (sx * (W / 2 - t / 2), H / 2, 0), frame, bevel=0.004, name="side")
    iw = W - 2 * t
    m.box((iw, 0.05, t), (0, 0.025, D / 2 - 0.02 - t / 2), frame, bevel=0.003, name="kick")
    m.box((iw, 0.48, 0.008), (0, 0.27, -D / 2 + 0.004), frame, bevel=0.0, name="cab_back")
    for y in (0.6, 1.0):
        m.box((iw, 0.04, 0.012), (0, y, -D / 2 + 0.008), frame, bevel=0.002, name="back_bar")
    # 下段収納: 底板・天板・扉2枚
    m.box((iw, t, D - 0.02), (0, 0.05 + t / 2, -0.01), frame, bevel=0.002, name="cab_floor")
    m.box((W, 0.025, D), (0, 0.5 + 0.0125, 0), wood, bevel=0.004, name="cab_top")
    gap = 0.004
    dw = iw / 2 - gap
    for sx in (-1, 1):
        cx = sx * (dw / 2 + gap / 2)
        m.box((dw, 0.44, 0.018), (cx, 0.052 + 0.22, D / 2 - 0.009), frame, bevel=0.004, name="door")
        m.box((0.012, 0.07, 0.012), (sx * 0.035, 0.40, D / 2 + 0.002), metal, bevel=0.004, name="knob")
    # スライド板 (炊飯器用): 少し手前に出した状態、左右にレール
    sy = 0.535
    m.box((iw - 0.01, 0.018, D - 0.05), (0, sy + 0.009, 0.0), wood, bevel=0.003, name="slide_board")
    m.box((iw - 0.01, 0.03, 0.016), (0, sy + 0.01, D / 2 - 0.033), frame, bevel=0.004, name="slide_front")
    m.box((0.08, 0.008, 0.006), (0, sy + 0.014, D / 2 - 0.023), metal, bevel=0.002, name="slide_pull")
    for sx in (-1, 1):
        m.box((0.008, 0.012, D - 0.06), (sx * (iw / 2 - 0.004), sy - 0.002, 0.0), metal, bevel=0.0, name="rail")
    # レンジ棚・中棚・天板
    m.box((iw, t, D - 0.01), (0, 0.84 + t / 2, -0.005), wood, bevel=0.003, name="shelf_range")
    m.box((W, 0.025, D), (0, H - 0.0125, 0), wood, bevel=0.004, name="top")
    return m

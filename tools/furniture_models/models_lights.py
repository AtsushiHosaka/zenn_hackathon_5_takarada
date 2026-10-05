"""照明。発光部分は独立素材 (light)。"""
import math

import palette as P
from lib import Model, asset


def base_and_pole(m, base_r, pole_top, mat, pole_r=0.013, base_h=0.028):
    m.cyl(base_r, base_h, (0, base_h / 2, 0), mat, seg=40, bevel=0.007, bseg=2, name="base")
    m.cyl(pole_r, pole_top - base_h, (0, base_h + (pole_top - base_h) / 2, 0), mat, seg=12, name="pole")


def shade_shell(m, r_bottom, r_top, y0, h, mat, t=0.004, seg=40, pleat=0.0):
    """上下が開いた布シェード (厚みあり)。"""
    return m.lathe([(r_bottom, y0), (r_top, y0 + h), (r_top - t, y0 + h), (r_bottom - t, y0)], (0, 0, 0), mat,
                   seg=seg, closed=True, pleat=pleat, name="shade")


@asset("floor_lamp.glb", (0.25, 1.40, 0.25))
def floor_lamp(tint=None):
    m = Model("floor_lamp")
    dark = m.mat("metal", P.METAL_DARK, rough=0.45, metal=0.5)
    shade = m.mat("tint", tint or "#c7b3ea", rough=0.9)
    light = m.mat("light", P.WARM_LIGHT, rough=0.5, emit=P.WARM_LIGHT, strength=2.0)
    base_and_pole(m, 0.11, 1.22, dark)
    shade_shell(m, 0.125, 0.085, 1.16, 0.24, shade)
    m.sphere(0.04, (0, 1.24, 0), light, seg=16, rings=8, name="bulb")
    m.cyl(0.018, 0.04, (0, 1.20, 0), dark, seg=12, name="socket")
    return m


@asset("floor_lamp_slim.glb", (0.20, 1.20, 0.20))
def floor_lamp_slim(tint=None):
    m = Model("floor_lamp_slim")
    dark = m.mat("metal", P.METAL_DARK, rough=0.45, metal=0.5)
    light = m.mat("light", tint or "#b89be6", rough=0.4, emit=tint or "#b89be6", strength=2.5)
    m.cyl(0.1, 0.02, (0, 0.01, 0), dark, seg=40, bevel=0.006, name="base")
    m.box((0.034, 1.17, 0.024), (0, 0.02 + 1.17 / 2, -0.004), dark, bevel=0.008, name="spine")
    m.box((0.026, 1.12, 0.012), (0, 0.04 + 1.12 / 2, 0.009), light, bevel=0.005, name="light_bar")
    return m


@asset("floor_lamp_rattan.glb", (0.35, 1.30, 0.35))
def floor_lamp_rattan(tint=None):
    m = Model("floor_lamp_rattan")
    wood = m.mat("wood", P.WOOD_MED, rough=0.55)
    rattan = m.mat("tint", tint or "#c49a5e", rough=0.9)
    light = m.mat("light", P.WARM_LIGHT, rough=0.5, emit=P.WARM_LIGHT, strength=2.0)
    base_and_pole(m, 0.12, 0.98, wood, pole_r=0.012)
    # 横方向の編み目を、半径の細かな起伏で表す
    prof_out, prof_in = [], []
    n = 22
    for i in range(n + 1):
        t = i / n
        y = 0.94 + t * 0.36
        r = 0.175 * math.sin(math.pi * (0.18 + 0.72 * t)) ** 0.7
        bump = 0.006 * (i % 2)
        prof_out.append((r + bump, y))
        prof_in.append((max(r - 0.006, 0.01), y))
    m.lathe(prof_out + list(reversed(prof_in)), (0, 0, 0), rattan, seg=36, closed=True, name="shade")
    m.sphere(0.045, (0, 1.10, 0), light, seg=16, rings=8, name="bulb")
    return m


@asset("floor_lamp_tripod.glb", (0.45, 1.40, 0.45))
def floor_lamp_tripod(tint=None):
    m = Model("floor_lamp_tripod")
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    shade = m.mat("tint", tint or P.IVORY, rough=0.9)
    light = m.mat("light", P.WARM_LIGHT, rough=0.5, emit=P.WARM_LIGHT, strength=2.0)
    dark = m.mat("metal", P.METAL_DARK, rough=0.45, metal=0.5)
    apex = 1.06
    for k in range(3):
        a = math.radians(90 + 120 * k)
        m.rod((0.2 * math.cos(a), 0.0, 0.2 * math.sin(a)), (0.02 * math.cos(a), apex, 0.02 * math.sin(a)), 0.013,
              wood, seg=10, r2=0.016, name="leg")
    m.cyl(0.03, 0.05, (0, apex, 0), dark, seg=16, bevel=0.006, name="joint")
    m.cyl(0.01, 0.12, (0, apex + 0.08, 0), dark, seg=10, name="stem")
    shade_shell(m, 0.215, 0.15, 1.10, 0.30, shade, t=0.005)
    m.sphere(0.045, (0, 1.20, 0), light, seg=16, rings=8, name="bulb")
    return m


@asset("floor_lamp_ball.glb", (0.30, 1.30, 0.30))
def floor_lamp_ball(tint=None):
    m = Model("floor_lamp_ball")
    metal = m.mat("metal", "#d8d3c8", rough=0.35, metal=0.6)
    glass = m.mat("tint", tint or "#f6efe3", rough=0.3, emit="#fff4e2", strength=0.8)
    base_and_pole(m, 0.11, 1.02, metal, pole_r=0.012)
    m.cyl(0.035, 0.03, (0, 1.015, 0), metal, seg=20, bevel=0.006, name="cap")
    m.sphere(0.15, (0, 1.15, 0), glass, seg=40, rings=20, name="globe")
    return m


@asset("floor_lamp_pleated.glb", (0.30, 1.40, 0.30))
def floor_lamp_pleated(tint=None):
    m = Model("floor_lamp_pleated")
    metal = m.mat("metal", "#cbbfa9", rough=0.35, metal=0.6)
    shade = m.mat("tint", tint or "#efe3cf", rough=0.9)
    light = m.mat("light", P.WARM_LIGHT, rough=0.5, emit=P.WARM_LIGHT, strength=2.0)
    base_and_pole(m, 0.12, 1.20, metal, pole_r=0.012)
    shade_shell(m, 0.15, 0.10, 1.14, 0.26, shade, t=0.004, seg=48, pleat=0.07)
    m.sphere(0.04, (0, 1.24, 0), light, seg=16, rings=8, name="bulb")
    return m


@asset("desk_lamp_clip.glb", (0.15, 0.35, 0.15))
def desk_lamp_clip(tint=None):
    m = Model("desk_lamp_clip")
    white = m.mat("tint", tint or "#f0f0f0", rough=0.45)
    joint = m.mat("joint", "#b9bbbe", rough=0.4, metal=0.3)
    light = m.mat("light", P.WARM_LIGHT, rough=0.5, emit=P.WARM_LIGHT, strength=2.5)
    # クリップ: 机の天板を挟むコの字 (背面寄り)
    zc = -0.025
    m.box((0.05, 0.012, 0.06), (0, 0.006, zc), white, bevel=0.004, name="jaw_low")
    m.box((0.05, 0.012, 0.06), (0, 0.058, zc), white, bevel=0.004, name="jaw_high")
    m.box((0.05, 0.064, 0.014), (0, 0.032, zc - 0.03), white, bevel=0.004, name="jaw_back")
    m.cyl(0.012, 0.03, (0, 0.035, zc + 0.02), joint, seg=12, name="screw")
    # 首: 縦の支柱から前方へ曲がるアーム
    pts = [(0, 0.064, zc - 0.015), (0, 0.17, zc - 0.02), (0, 0.24, zc - 0.005), (0, 0.27, 0.0)]
    for a, b in zip(pts, pts[1:]):
        m.rod(a, b, 0.006, joint, seg=8, name="neck")
        m.sphere(0.007, b, joint, seg=10, rings=6, name="neck_joint")
    head = (0, 0.29, 0.025)
    k = 1.42
    m.lathe([(k * r, k * y) for r, y in [(0.0, -0.035), (0.022, -0.033), (0.045, -0.01), (0.05, 0.012), (0.046, 0.012),
                                         (0.04, -0.006), (0.02, -0.027), (0.0, -0.029)]],
            (0, 0, 0), white, seg=28, closed=True, name="head")
    m.cyl(0.04 * k, 0.003, (0, 0.009 * k, 0), light, seg=28, name="lens")
    ob_head, ob_lens = m.parts[-2], m.parts[-1]
    from lib import rot_matrix
    from mathutils import Matrix
    for ob in (ob_head, ob_lens):
        m.apply(ob)
        # 開口部を下前方 (+Z) へ向ける
        ob.data.transform(Matrix.Translation(head) @ rot_matrix((145, 0, 0)))
    return m


@asset("led_strip_segment.glb", (1.00, 0.01, 0.01))
def led_strip_segment(tint=None):
    m = Model("led_strip_segment")
    base = m.mat("base", P.WHITE, rough=0.6)
    light = m.mat("light", tint or "#cdb8f0", rough=0.4, emit=tint or "#cdb8f0", strength=3.0)
    m.box((1.0, 0.004, 0.01), (0, 0.002, 0), base, bevel=0.001, name="tape")
    m.box((0.998, 0.006, 0.007), (0, 0.007, 0), light, bevel=0.0025, seg=2, name="diffuser")
    return m


@asset("candle.glb", (0.10, 0.12, 0.10))
def candle(tint=None):
    m = Model("candle")
    wax = m.mat("tint", tint or "#f3e7d3", rough=0.7)
    wick = m.mat("wick", "#3a332c", rough=0.9)
    m.lathe([(0.0, 0.0), (0.047, 0.0), (0.05, 0.004), (0.05, 0.104), (0.047, 0.11), (0.04, 0.111),
             (0.02, 0.106), (0.0, 0.105)], (0, 0, 0), wax, seg=40, name="wax")
    m.cyl(0.0025, 0.016, (0, 0.112, 0), wick, seg=8, name="wick")
    return m


# ---------- 追加モデル (2026-10-04) ----------

@asset("table_lamp.glb", (0.25, 0.30, 0.25))
def table_lamp(tint=None):
    """韓国風インテリアで定番のマッシュルーム型。"""
    m = Model("table_lamp")
    body = m.mat("tint", tint or "#efe3cf", rough=0.5)
    light = m.mat("light", P.WARM_LIGHT, rough=0.5, emit=P.WARM_LIGHT, strength=2.0)
    m.lathe([(0.0, 0.0), (0.075, 0.0), (0.08, 0.008), (0.075, 0.018), (0.03, 0.03), (0.022, 0.06), (0.022, 0.17)],
            (0, 0, 0), body, seg=40, cap_top=False, name="base")
    # 厚みのあるドーム型シェード (下が開いている)
    outer = [(0.125 * math.cos(a), 0.165 + 0.135 * math.sin(a)) for a in [math.pi / 2 * i / 10 for i in range(11)]]
    inner = [(max(r - 0.008, 0.0), y - 0.008) for r, y in reversed(outer)]
    m.lathe(outer + inner, (0, 0, 0), body, seg=40, closed=True, name="shade")
    m.cyl(0.08, 0.004, (0, 0.17, 0), light, seg=32, name="glow")
    return m


@asset("pendant_light.glb", (0.40, 0.60, 0.40))
def pendant_light(tint=None):
    """天井から吊るす照明。コード上端が天井側、最下端 Y=0。"""
    m = Model("pendant_light")
    shade = m.mat("tint", tint or "#c49a5e", rough=0.9)
    cord = m.mat("cord", "#4a4562", rough=0.7)
    light = m.mat("light", P.WARM_LIGHT, rough=0.5, emit=P.WARM_LIGHT, strength=2.0)
    m.cyl(0.05, 0.015, (0, 0.5925, 0), cord, seg=24, bevel=0.004, name="canopy")
    m.cyl(0.004, 0.33, (0, 0.42, 0), cord, seg=8, name="cord")
    m.cyl(0.02, 0.04, (0, 0.25, 0), cord, seg=14, name="socket")
    # 編み目風の段がある、浅いドーム形シェード
    prof_out, prof_in = [], []
    n = 14
    for i in range(n + 1):
        t = i / n
        a = math.pi / 2 * t
        r = 0.2 * math.cos(a) + 0.008 * (i % 2)
        y = 0.02 + 0.24 * math.sin(a)
        prof_out.append((max(r, 0.02), y))
        prof_in.append((max(r - 0.007, 0.015), y - 0.006))
    m.lathe(prof_out + list(reversed(prof_in)), (0, 0, 0), shade, seg=40, closed=True, name="shade")
    m.sphere(0.04, (0, 0.17, 0), light, seg=16, rings=8, name="bulb")
    return m


@asset("tv.glb", (0.97, 0.62, 0.20))
def tv(tint=None):
    m = Model("tv")
    body = m.mat("tint", tint or "#2f2d38", rough=0.5)
    screen = m.mat("screen", "#16151c", rough=0.25)
    W, sh = 0.97, 0.565
    y0 = 0.62 - sh
    m.box((W, sh, 0.03), (0, y0 + sh / 2, 0.0), body, bevel=0.004, name="panel")
    m.box((W - 0.02, sh - 0.02, 0.002), (0, y0 + sh / 2, 0.0155), screen, bevel=0.0, name="screen")
    m.box((0.5, 0.3, 0.04), (0, y0 + 0.2, -0.03), body, bevel=0.01, name="back_housing")
    for sx in (-1, 1):
        m.box((0.04, y0 + 0.02, 0.03), (sx * 0.38, (y0 + 0.02) / 2, 0.0), body, bevel=0.005, name="foot_post")
        m.box((0.05, 0.015, 0.2), (sx * 0.38, 0.0075, 0.0), body, bevel=0.005, name="foot")
    return m

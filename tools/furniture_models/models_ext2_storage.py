"""追加の棚・収納家具 (第2弾)。正面 +Z、背面 -Z が壁側。"""
import math

from mathutils import Vector

import palette as P
from lib import Model, asset, rot_matrix
from models_ext_storage import drawer_stack
from models_tables import tapered_legs


def xf(local, origin, rot):
    """回転 rot (度) を掛けた局所座標を origin へ移す。傾いた部品の配置用。"""
    return tuple(rot_matrix(rot) @ Vector(local) + Vector(origin))


def casters(m, pts, mat, r=0.022, h=0.05):
    """キャスター (車輪と台座)。全高 h。"""
    for x, z in pts:
        m.cyl(r, 0.016, (x, r, z), mat, seg=14, axis="x", name="caster")
        m.box((0.03, h - 2 * r + 0.004, 0.03), (x, (2 * r + h) / 2 - 0.002, z), mat, bevel=0.003,
              name="caster_mount")


# ---------- 棚 ----------
@asset("shelf_corner.glb", (0.40, 1.20, 0.40))
def shelf_corner(tint=None):
    """部屋の角に置く扇形の棚。壁側の角が -X/-Z。"""
    m = Model("shelf_corner")
    board = m.mat("tint", tint or P.WOOD_LIGHT, rough=0.55)
    panel = m.mat("panel", "#ece3d4", rough=0.6)
    S, H = 0.40, 1.20
    c = -S / 2  # 角の座標 (x, z 共通)
    pt = 0.014  # 壁側パネルの厚み
    # 壁に沿う2枚のパネル (L字)
    m.box((S, H, pt), (0, H / 2, c + pt / 2), panel, bevel=0.003, name="back_panel")
    m.box((pt, H, S - pt), (c + pt / 2, H / 2, pt / 2), panel, bevel=0.003, name="side_panel")
    r = S - pt - 0.002
    seg = 16
    arc = [(c + pt + r * math.cos(math.pi / 2 * i / seg), c + pt + r * math.sin(math.pi / 2 * i / seg))
           for i in range(seg + 1)]
    outline = [(c + pt, c + pt)] + arc
    t = 0.024
    for y in (0.0, 0.29, 0.58, 0.87, H - t):
        m.prism(outline, t, board, plane="xz", offset=y, bevel=0.005, name="shelf")
    # 前側の丸い脚 (扇の先端寄り) で棚を支えている見た目に
    a = math.pi / 4
    lx = c + pt + (r - 0.03) * math.cos(a)
    m.cyl(0.014, H - t, (lx, (H - t) / 2, lx), board, seg=12, name="front_post")
    return m


@asset("shelf_gap.glb", (0.20, 1.40, 0.40))
def shelf_gap(tint=None):
    """すき間に差し込むキャスター付きの細いワゴン。物は左右 (±X) から出し入れする。"""
    m = Model("shelf_gap")
    body = m.mat("tint", tint or "#eee8df", rough=0.6)
    rail = m.mat("rail", "#b9c4d6", rough=0.6)
    wheel = m.mat("wheel", "#5b566b", rough=0.8)
    W, H = 0.20, 1.40
    D = 0.40 - 0.033  # 取っ手の出っ張りを奥行きに含める
    cast = 0.05
    pt = 0.016
    ph = H - cast
    for sz in (-1, 1):
        m.box((W, ph, pt), (0, cast + ph / 2, sz * (D / 2 - pt / 2)), body, bevel=0.004, name="end_panel")
    inner = D - 2 * pt
    t = 0.016
    levels = (cast, 0.36, 0.68, 1.0, H - t)
    for y in levels:
        m.box((W - 0.006, t, inner + 0.002), (0, y + t / 2, 0), body, bevel=0.002, name="shelf")
    # 左右の落下防止バー
    for y in levels[:-1]:
        for sx in (-1, 1):
            m.cyl(0.006, inner, (sx * (W / 2 - 0.012), y + t + 0.055, 0), rail, seg=8, axis="z", name="side_bar")
    # 正面の取っ手
    zf = D / 2
    for sx in (-1, 1):
        m.box((0.014, 0.03, 0.022), (sx * 0.05, H - 0.1, zf + 0.011), rail, bevel=0.004, name="handle_post")
    m.cyl(0.011, 0.12, (0, H - 0.1, zf + 0.022), rail, seg=10, axis="x", name="handle")
    casters(m, [(sx * (W / 2 - 0.035), sz * (D / 2 - 0.05)) for sx in (-1, 1) for sz in (-1, 1)], wheel, h=cast)
    return m


@asset("desk_shelf.glb", (0.80, 0.35, 0.25))
def desk_shelf(tint=None):
    """机の上に置くモニター台兼ラック。右側に小さな仕切り棚。"""
    m = Model("desk_shelf")
    body = m.mat("tint", tint or "#e6ddd0", rough=0.6)
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    W, H, D, t = 0.80, 0.35, 0.25, 0.02
    m.box((W, t, D), (0, H - t / 2, 0), wood, bevel=0.005, name="top")
    for sx in (-1, 1):
        m.box((t, H - t, D - 0.01), (sx * (W / 2 - t / 2 - 0.004), (H - t) / 2, -0.005), body, bevel=0.003,
              name="side")
    xd = 0.17
    m.box((t, H - t, D - 0.01), (xd, (H - t) / 2, -0.005), body, bevel=0.003, name="divider")
    x0, x1 = xd + t / 2, W / 2 - t - 0.004
    m.box((x1 - x0 + 0.002, t * 0.8, D - 0.02), ((x0 + x1) / 2, 0.16, -0.01), body, bevel=0.002, name="small_shelf")
    m.box((x1 - x0 + 0.002, H - t, 0.006), ((x0 + x1) / 2, (H - t) / 2, -D / 2 + 0.003), body, bevel=0.0,
          name="back")
    # 左側の背面の補強
    m.box((W / 2 + xd - t - 0.004, 0.04, 0.012), ((-W / 2 + t + xd) / 2, H - t - 0.02, -D / 2 + 0.008), body,
          bevel=0.002, name="back_rail")
    return m


@asset("shelf_floating.glb", (0.80, 0.05, 0.20))
def shelf_floating(tint=None):
    """金具が見えない壁付けの棚板1枚。背面 -Z が壁。"""
    m = Model("shelf_floating")
    board = m.mat("tint", tint or P.WOOD_LIGHT, rough=0.55)
    edge = m.mat("wood", P.WOOD_MED, rough=0.55)
    W, H, D = 0.80, 0.05, 0.20
    m.box((W, H, D - 0.004), (0, H / 2, -0.002), board, bevel=0.006, name="board")
    m.box((W - 0.004, H - 0.004, 0.005), (0, H / 2, D / 2 - 0.0025), edge, bevel=0.002, name="edge_band")
    return m


# ---------- 衣類・収納 ----------
@asset("wardrobe_open.glb", (1.20, 1.80, 0.50))
def wardrobe_open(tint=None):
    """扉のないクローゼット。左にハンガーパイプと引き出し、右に棚の塔。"""
    m = Model("wardrobe_open")
    body = m.mat("tint", tint or "#e7ded2", rough=0.6)
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    metal = m.mat("metal", P.METAL_LIGHT, rough=0.5)
    W, H, D = 1.20, 1.80, 0.50
    t, kick = 0.025, 0.06
    for sx in (-1, 1):
        m.box((t, H, D), (sx * (W / 2 - t / 2), H / 2, 0), body, bevel=0.004, name="side")
    iw = W - 2 * t
    m.box((iw + 0.002, t, D), (0, H - t / 2, 0), body, bevel=0.003, name="top")
    m.box((iw + 0.002, t, D - 0.01), (0, kick + t / 2, -0.005), body, bevel=0.002, name="bottom")
    m.box((iw, kick, 0.02), (0, kick / 2, D / 2 - 0.04), wood, bevel=0.003, name="kick")
    m.box((iw, H - kick - 2 * t, 0.008), (0, (H + kick) / 2, -D / 2 + 0.004), body, bevel=0.0, name="back")
    # 右の棚の塔
    tw = 0.40
    xp = W / 2 - t - tw - t / 2
    lo, hi = kick + t, H - t
    m.box((t, hi - lo, D - 0.01), (xp, (lo + hi) / 2, -0.005), body, bevel=0.003, name="partition")
    tx0, tx1 = xp + t / 2, W / 2 - t
    n = 5
    step = (hi - lo) / n
    for i in range(1, n):
        m.box((tx1 - tx0 + 0.002, 0.02, D - 0.03), ((tx0 + tx1) / 2, lo + i * step, -0.01), wood, bevel=0.003,
              name="tower_shelf")
    # 左の吊り下げ部: 上の棚板、パイプ、下の引き出し
    hx0, hx1 = -W / 2 + t, xp - t / 2
    hw = hx1 - hx0
    hc = (hx0 + hx1) / 2
    m.box((hw + 0.002, 0.02, D - 0.03), (hc, 1.56, -0.01), wood, bevel=0.003, name="top_shelf")
    m.cyl(0.014, hw, (hc, 1.47, 0.0), metal, seg=12, axis="x", name="rod")
    for sx in (-1, 1):
        m.cyl(0.024, 0.008, (hc + sx * (hw / 2 - 0.004), 1.47, 0.0), metal, seg=12, axis="x", name="rod_socket")
    dtop = 0.46
    m.box((hw + 0.002, t, D - 0.01), (hc, dtop - t / 2, -0.005), body, bevel=0.003, name="drawer_top")
    y0, y1 = lo + 0.004, dtop - t - 0.004
    gap = 0.006
    dh = (y1 - y0 - gap) / 2
    for i in range(2):
        cy = y0 + i * (dh + gap) + dh / 2
        m.box((hw - 0.008, dh, 0.02), (hc, cy, D / 2 - 0.024), body, bevel=0.004, name="drawer")
        m.box((0.16, 0.016, 0.016), (hc, cy + dh * 0.22, D / 2 - 0.008), wood, bevel=0.004, name="pull")
    return m


@asset("chest_low.glb", (1.00, 0.60, 0.45))
def chest_low(tint=None):
    """幅広の引き出し2段のローチェスト。"""
    m = Model("chest_low")
    body = m.mat("tint", tint or "#d9e2d3", rough=0.6)
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    W, H, D = 1.00, 0.60, 0.45
    leg, top = 0.10, 0.026
    zf = D / 2 - 0.022  # つまみの出っ張りを奥行きに含める
    bh = H - leg - top
    cd = zf - 0.02 + D / 2
    m.box((W - 0.01, bh, cd), (0, leg + bh / 2, -D / 2 + cd / 2), body, bevel=0.005, name="carcass")
    m.box((W, top, zf + D / 2 + 0.004), (0, H - top / 2, (zf - D / 2 + 0.004) / 2), wood, bevel=0.006,
          name="top")
    drawer_stack(m, W, leg + 0.004, H - top, zf, 2, body, wood, knobs=2, inset=0.02)
    e = 0.06
    tapered_legs(m, [(sx * (W / 2 - e), sz * (D / 2 - e - 0.011)) for sx in (-1, 1) for sz in (-1, 1)], leg + 0.002,
                 wood, top=0.05, bottom=0.034)
    return m


@asset("magazine_rack.glb", (0.40, 0.45, 0.30))
def magazine_rack(tint=None):
    """台形の側板と中央の持ち手付き仕切りで、前後2列に雑誌を立てる。"""
    m = Model("magazine_rack")
    wood = m.mat("tint", tint or P.WOOD_LIGHT, rough=0.55)
    slat = m.mat("wood", P.WOOD_MED, rough=0.55)
    W, H, D = 0.40, 0.45, 0.30
    et = 0.018
    eh, bot, topz = 0.32, D / 2, 0.105
    outline = [(-bot, 0.0), (bot, 0.0), (topz, eh), (-topz, eh)]
    for sx in (-1, 1):
        off = W / 2 - et if sx > 0 else -W / 2
        m.prism(outline, et, wood, plane="zy", offset=off, bevel=0.005, name="end")
    iw = W - 2 * et
    m.box((iw + 0.002, 0.02, D - 0.05), (0, 0.03, 0), slat, bevel=0.003, name="base")
    # 側板の傾きに沿ったスラット
    ang = math.degrees(math.atan2(bot - topz, eh))
    for sz in (-1, 1):
        for yc in (0.07, 0.2):
            ez = bot - (bot - topz) * yc / eh
            m.box((iw + 0.002, 0.055, 0.012), (0, yc, sz * (ez - 0.012)), slat, bevel=0.003,
                  rot=(-sz * ang, 0, 0), name="slat")
    # 中央の仕切りと持ち手
    dt = 0.014
    m.box((iw + 0.002, 0.34 - 0.04, dt), (0, 0.04 + 0.15, 0), wood, bevel=0.003, name="divider")
    for sx in (-1, 1):
        m.box((0.035, 0.08, dt), (sx * 0.075, 0.37, 0), wood, bevel=0.003, name="handle_post")
    m.box((0.185, 0.035, dt + 0.006), (0, H - 0.0175, 0), wood, bevel=0.008, name="handle")
    return m


@asset("coat_stand.glb", (0.45, 1.75, 0.45))
def coat_stand(tint=None):
    """木製のポールハンガー。4本脚と2段のフック。"""
    m = Model("coat_stand")
    wood = m.mat("tint", tint or P.WOOD_LIGHT, rough=0.55)
    knob = m.mat("wood", P.WOOD_MED, rough=0.55)
    m.cyl(0.021, 1.62, (0, 0.08 + 0.81, 0), wood, seg=16, name="pole")
    m.cyl(0.034, 0.12, (0, 0.30, 0), wood, seg=16, r2=0.026, bevel=0.006, name="hub")
    for k in range(4):
        a = math.pi / 2 * k
        d = (math.cos(a), math.sin(a))
        fx, fz = 0.20 * d[0], 0.20 * d[1]
        m.rod((0.02 * d[0], 0.33, 0.02 * d[1]), (fx, 0.03, fz), 0.016, wood, seg=10, r2=0.013, name="leg")
        m.cyl(0.022, 0.03, (fx, 0.015, fz), knob, seg=14, bevel=0.006, name="foot")
    for y, a0, reach in ((1.40, math.pi / 4, 0.14), (1.56, 0.0, 0.15)):
        for k in range(4):
            a = a0 + math.pi / 2 * k
            d = (math.cos(a), 0, math.sin(a))
            tip = (reach * d[0], y + 0.085, reach * d[2])
            m.rod((0.01 * d[0], y, 0.01 * d[2]), tip, 0.009, wood, seg=8, name="hook")
            m.sphere(0.018, tip, knob, seg=12, rings=8, name="hook_ball")
    m.cyl(0.03, 0.02, (0, 1.70, 0), knob, seg=16, bevel=0.005, name="cap_ring")
    m.sphere(0.035, (0, 1.715, 0), knob, seg=16, rings=10, scale=(1, 1, 1), name="finial")
    return m


@asset("umbrella_stand.glb", (0.25, 0.50, 0.25))
def umbrella_stand(tint=None):
    """円筒の傘立て。上部に十字の仕切り、下に受け皿。"""
    m = Model("umbrella_stand")
    body = m.mat("tint", tint or "#b7cdbf", rough=0.6)
    tray = m.mat("tray", "#7f8a99", rough=0.7)
    prof = [(0.0, 0.02), (0.116, 0.02), (0.121, 0.48), (0.12, 0.495), (0.111, 0.495), (0.109, 0.04), (0.0, 0.04)]
    m.lathe(prof, (0, 0, 0), body, seg=32, closed=True, name="tube")
    m.cyl(0.125, 0.03, (0, 0.015, 0), tray, seg=32, bevel=0.006, name="tray")
    m.lathe([(0.108, 0.478), (0.124, 0.478), (0.124, 0.5), (0.108, 0.5)], (0, 0, 0), tray, seg=32, closed=True,
            name="rim")
    m.lathe([(0.1225, 0.11), (0.1225, 0.13)], (0, 0, 0), tray, seg=32, cap_bottom=False, cap_top=False,
            name="band")
    # 上部の十字仕切り
    for rot in ((0, 0, 0), (0, 90, 0)):
        m.box((0.226, 0.018, 0.012), (0, 0.488, 0), tray, bevel=0.003, rot=rot, name="grid")
    return m


@asset("storage_bench.glb", (0.90, 0.45, 0.40))
def storage_bench(tint=None):
    """クッション座面と、下に3つのかご収納があるベンチ。"""
    m = Model("storage_bench")
    body = m.mat("tint", tint or "#efe7da", rough=0.6)
    fabric = m.mat("fabric", "#c9b6e4", rough=0.95)
    basket = m.mat("basket", "#d2ae7c", rough=0.9)
    weave = m.mat("weave", "#a9824f", rough=0.9)
    W, H, D = 0.90, 0.45, 0.40
    t, kick = 0.022, 0.035
    seat = 0.39
    for sx in (-1, 1):
        m.box((t, seat, D), (sx * (W / 2 - t / 2), seat / 2, 0), body, bevel=0.004, name="side")
    iw = W - 2 * t
    m.box((W, 0.022, D), (0, seat - 0.011, 0), body, bevel=0.005, name="seat_board")
    m.box((iw + 0.002, t, D - 0.01), (0, kick + t / 2, -0.005), body, bevel=0.002, name="bottom")
    m.box((iw, kick, 0.016), (0, kick / 2, D / 2 - 0.03), body, bevel=0.0, name="kick")
    m.box((iw, seat - kick - t, 0.006), (0, (seat + kick + t) / 2 - 0.011, -D / 2 + 0.003), body, bevel=0.0,
          name="back")
    lo, hi = kick + t, seat - 0.022
    cw = (iw - 2 * t) / 3
    for sx in (-1, 1):
        m.box((t, hi - lo, D - 0.01), (sx * (cw / 2 + t / 2), (lo + hi) / 2, -0.005), body, bevel=0.002,
              name="divider")
    m.cushion((W - 0.02, 0.06, D - 0.02), (0, seat + 0.03, 0), fabric, puff=0.3, round_=0.35, name="cushion")
    # かご
    bw, bh, bd = cw - 0.024, 0.22, D - 0.07
    for i in (-1, 0, 1):
        cx = i * (cw + t)
        cz = D / 2 - 0.012 - bd / 2
        m.box((bw, bh, bd), (cx, lo + bh / 2 + 0.002, cz), basket, bevel=0.012, name="basket")
        fz = cz + bd / 2
        for k in range(4):
            m.box((bw + 0.004, 0.008, bd + 0.004), (cx, lo + 0.035 + k * 0.045, cz), weave, bevel=0.002,
                  name="weave")
        m.box((bw + 0.006, 0.014, bd + 0.006), (cx, lo + bh - 0.005, cz), weave, bevel=0.004, name="basket_rim")
        m.box((0.07, 0.02, 0.006), (cx, lo + bh - 0.04, fz + 0.002), weave, bevel=0.003, name="handle_slot")
    return m


@asset("toy_storage.glb", (0.80, 0.60, 0.35))
def toy_storage(tint=None):
    """前下がりのカラフルなかごを3段に並べたおもちゃ収納。"""
    m = Model("toy_storage")
    frame = m.mat("tint", tint or P.WOOD_LIGHT, rough=0.55)
    bins = [m.mat("bin_pink", "#f2b8c6", rough=0.7), m.mat("bin_mint", "#a9dcc8", rough=0.7),
            m.mat("bin_yellow", "#f6dc8c", rough=0.7)]
    W, H, D = 0.80, 0.60, 0.35
    t = 0.022
    for sx in (-1, 1):
        m.box((t, H - 0.02, D), (sx * (W / 2 - t / 2), (H - 0.02) / 2, 0), frame, bevel=0.006, name="side")
    iw = W - 2 * t
    m.box((W, 0.022, D - 0.02), (0, H - 0.011, -0.01), frame, bevel=0.006, name="top")
    tilt = 10
    rows = ((0.07, 2, 0.15), (0.26, 3, 0.13), (0.44, 3, 0.11))  # (高さ, 個数, かごの高さ)
    k = 0
    for yc, n, bh in rows:
        org = (0, yc, 0)
        m.box((iw + 0.002, 0.012, D - 0.03), xf((0, -0.006, 0), org, (tilt, 0, 0)), frame, bevel=0.002,
              rot=(tilt, 0, 0), name="row_board")
        # 背面の転落防止バー
        m.box((iw + 0.002, 0.03, 0.014), xf((0, 0.02, -(D - 0.03) / 2 + 0.007), org, (tilt, 0, 0)), frame,
              bevel=0.003, rot=(tilt, 0, 0), name="back_rail")
        gap = 0.012
        bw = (iw - gap * (n + 1)) / n
        bd = 0.26
        bz = 0.015
        wt = 0.008
        for j in range(n):
            mat = bins[k % 3]
            k += 1
            bx = -iw / 2 + gap + bw / 2 + j * (bw + gap)

            def part(size, local):
                m.box(size, xf((bx + local[0], local[1], bz + local[2]), org, (tilt, 0, 0)), mat, bevel=0.003,
                      rot=(tilt, 0, 0), name="bin")

            part((bw, wt, bd), (0, wt / 2, 0))
            for sx in (-1, 1):
                part((wt, bh, bd), (sx * (bw / 2 - wt / 2), bh / 2, 0))
            part((bw - 2 * wt, bh, wt), (0, bh / 2, -bd / 2 + wt / 2))
            fh = bh * 0.62  # 前面は低く、手を入れやすく
            part((bw - 2 * wt, fh, wt), (0, fh / 2, bd / 2 - wt / 2))
    return m


@asset("kitchen_counter.glb", (1.20, 0.90, 0.40))
def kitchen_counter(tint=None):
    """厚い天板のカウンター収納。左は見せる棚、右は扉2枚。間仕切りにも使える。"""
    m = Model("kitchen_counter")
    body = m.mat("tint", tint or "#e9e1d4", rough=0.6)
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    W, H, D = 1.20, 0.90, 0.40
    kick, top, t = 0.07, 0.04, 0.022
    bw, bd = W - 0.02, D - 0.02
    zf = bd / 2 - 0.01
    m.box((W, top, D), (0, H - top / 2, 0), wood, bevel=0.008, name="top")
    m.box((bw - 0.06, kick, bd - 0.06), (0, kick / 2, -0.01), wood, bevel=0.003, name="plinth")
    bh = H - top - kick
    yb = kick + bh / 2
    # 右: 扉付きの箱
    xs = -0.18
    cw = bw / 2 - xs
    cx = xs + cw / 2
    m.box((cw, bh, bd - 0.02), (cx, yb, -0.02), body, bevel=0.005, name="carcass")
    dw = (cw - 0.012) / 2
    for i, sx in enumerate((-1, 1)):
        dx = cx + sx * (dw / 2 + 0.003)
        m.box((dw - 0.004, bh - 0.012, 0.02), (dx, yb, zf), body, bevel=0.004, name="door")
        m.box((0.016, 0.14, 0.016), (cx + sx * 0.035, H - top - 0.12, zf + 0.012), wood, bevel=0.004,
              name="handle")
    # 左: 見せる棚
    x0, x1 = -bw / 2, xs
    m.box((t, bh, bd), (x0 + t / 2, yb, -0.01 + 0.0), body, bevel=0.004, name="side")
    m.box((x1 - x0 - t + 0.002, t, bd), ((x0 + t + x1) / 2, kick + t / 2, -0.01), body, bevel=0.002,
          name="bottom")
    m.box((x1 - x0 - t + 0.002, bh, 0.008), ((x0 + t + x1) / 2, yb, -D / 2 + 0.004), body, bevel=0.0,
          name="back")
    for y in (kick + t + (bh - t) / 3, kick + t + 2 * (bh - t) / 3):
        m.box((x1 - x0 - t + 0.002, 0.02, bd - 0.03), ((x0 + t + x1) / 2, y, -0.02), wood, bevel=0.003,
              name="shelf")
    return m


@asset("mirror_cabinet.glb", (0.40, 1.50, 0.30))
def mirror_cabinet(tint=None):
    """扉の前面が全身鏡になった細長い収納。"""
    m = Model("mirror_cabinet")
    body = m.mat("tint", tint or "#ece5da", rough=0.6)
    mirror = m.mat("mirror", "#dfe8f2", rough=0.3)
    wood = m.mat("wood", P.WOOD_MED, rough=0.55)
    W, H, D = 0.40, 1.50, 0.30
    kick, cap = 0.05, 0.025
    m.box((W - 0.04, kick, D - 0.05), (0, kick / 2, -0.02), wood, bevel=0.003, name="plinth")
    bh = H - kick - cap
    m.box((W - 0.006, bh, D - 0.026), (0, kick + bh / 2, -0.013), body, bevel=0.005, name="carcass")
    m.box((W, cap, D), (0, H - cap / 2, 0), body, bevel=0.006, name="cap")
    dh = bh - 0.012
    zd = D / 2 - 0.013
    m.box((W - 0.012, dh, 0.02), (0, kick + bh / 2, zd - 0.002), body, bevel=0.004, name="door")
    m.box((W - 0.07, dh - 0.07, 0.004), (-0.008, kick + bh / 2, zd + 0.009), mirror, bevel=0.0, name="mirror")
    m.box((0.012, 0.22, 0.014), (W / 2 - 0.022, kick + bh / 2 + 0.05, zd + 0.008), wood, bevel=0.004,
          name="pull")
    return m


@asset("shoji_screen.glb", (0.90, 1.70, 0.25))
def shoji_screen(tint=None):
    """2枚折りの障子風ついたて。木の格子に和紙。中央の蝶番側が奥。"""
    m = Model("shoji_screen")
    wood = m.mat("tint", tint or "#d9b98c", rough=0.6)
    paper = m.mat("paper", "#f8eed8", rough=0.9, alpha=0.88)
    base = m.mat("wood", P.WOOD_MED, rough=0.55)
    H = 1.70
    pw, ft = 0.49, 0.026  # パネル幅、枠の厚み
    ang = 26
    hz = -0.11  # 蝶番の奥行き位置
    s = 0.035  # 框の見付け
    for side in (-1, 1):
        rot = (0, side * -ang, 0) if side > 0 else (0, ang, 0)
        org = (side * 0.006, 0, hz)

        def part(size, local, mat, bevel=0.003):
            lx = side * local[0]
            m.box(size, xf((lx, local[1], local[2]), org, rot), mat, bevel=bevel, rot=rot, name="panel_part")

        for x in (s / 2, pw - s / 2):
            part((s, H, ft), (x, H / 2, 0), wood)
        part((pw - 2 * s, s, ft), (pw / 2, H - s / 2, 0), wood)
        part((pw - 2 * s, s, ft), (pw / 2, 0.03 + s / 2, 0), wood)
        # 腰板
        kh = 0.24
        part((pw - 2 * s, s * 0.8, ft), (pw / 2, kh + s * 0.4, 0), wood)
        part((pw - 2 * s + 0.004, kh - 0.03 - s, 0.014), (pw / 2, 0.03 + s + (kh - 0.03 - s) / 2, 0), base, 0.002)
        # 障子紙と組子
        py0, py1 = kh + s * 0.8, H - s
        part((pw - 2 * s + 0.004, py1 - py0 + 0.004, 0.003), (pw / 2, (py0 + py1) / 2, 0), paper, 0.0)
        bar = 0.012
        for i in (1, 2):
            x = s + (pw - 2 * s) * i / 3
            part((bar, py1 - py0, ft * 0.7), (x, (py0 + py1) / 2, 0), wood, 0.002)
        nrow = 6
        for i in range(1, nrow):
            y = py0 + (py1 - py0) * i / nrow
            part((pw - 2 * s, bar, ft * 0.7), (pw / 2, y, 0), wood, 0.002)
        # 足元の小さな台
        part((0.05, 0.03, 0.09), (pw * 0.55, 0.015, 0), base, 0.004)
    return m

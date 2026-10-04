"""家具GLB生成用の共通ヘルパー。Blender内のPythonで実行する。

モデルはアプリ座標 (単位m, +Y上, +Z正面) でそのまま組み立て、書き出し直前に
Blender座標 (+Z上, -Y正面) へ回転する。glTFの+Y上変換で元のアプリ座標に戻る。
"""
import math

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

TAU = math.tau


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rgba(hex_color, alpha=1.0):
    h = hex_color.lstrip("#")
    return tuple(srgb_to_linear(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4)) + (alpha,)


WARM_GRAY = (0xb8, 0xa9, 0x96)


def soften(hex_color):
    """白に近い色を暖かい灰色へ寄せる。明るさ0.75を超えた分だけ最大60%混ぜる (低彩度の色だけ)。"""
    h = hex_color.lstrip("#")
    rgb = [int(h[i:i + 2], 16) for i in (0, 2, 4)]
    light = max(rgb) / 255
    sat = (max(rgb) - min(rgb)) / max(max(rgb), 1)
    # 彩度の高い色 (ラベンダー・木色など) は変えない
    k = 0.6 * min(1.0, max(0.0, (light - 0.75) / 0.25)) * max(0.0, 1 - sat / 0.15)
    return "#%02x%02x%02x" % tuple(round(c + (w - c) * k) for c, w in zip(rgb, WARM_GRAY))


def reset_scene():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.curves, bpy.data.cameras, bpy.data.lights, bpy.data.images):
        for block in list(coll):
            coll.remove(block)


def rot_matrix(rot):
    """rot: 度数の (x, y, z) オイラー角。アプリ座標系。"""
    return Euler(tuple(math.radians(a) for a in rot), "XYZ").to_matrix().to_4x4()


class Model:
    def __init__(self, name):
        reset_scene()
        self.name = name
        self.parts = []
        self.mats = {}
        self.tol = None  # 植物など、寸法合わせの許容差を個別に広げる場合に設定

    # ---------- 素材 ----------
    def mat(self, name, color, rough=0.8, metal=0.0, alpha=1.0, emit=None, strength=1.5):
        if name in self.mats:
            return self.mats[name]
        # イラスト調: 金属感・つやを抑えたマットな質感に統一する
        # (アプリは環境マップを使わないため、金属素材は黒く沈む)
        metal = 0.0
        rough = max(rough, 0.85) if alpha >= 1.0 else rough
        if not emit:  # 白っぽい色は暖色寄りの灰色へ (発光部はそのまま)
            color = soften(color)
        m = bpy.data.materials.new(name)
        try:
            m.use_nodes = True
        except Exception:
            pass
        bsdf = m.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = rgba(color)
        bsdf.inputs["Roughness"].default_value = rough
        bsdf.inputs["Metallic"].default_value = metal
        m.diffuse_color = rgba(color, alpha)
        m.roughness = rough
        m.metallic = metal
        if alpha < 1.0:
            bsdf.inputs["Alpha"].default_value = alpha
            for attr, value in (("surface_render_method", "BLENDED"), ("blend_method", "BLEND")):
                try:
                    setattr(m, attr, value)
                except Exception:
                    pass
        if emit:
            bsdf.inputs["Emission Color"].default_value = rgba(emit)
            bsdf.inputs["Emission Strength"].default_value = strength
        self.mats[name] = m
        return m

    # ---------- 基本処理 ----------
    def _obj(self, bm, m, name):
        me = bpy.data.meshes.new(name)
        bm.normal_update()
        bm.to_mesh(me)
        bm.free()
        # 陰影は部品ごとに決める。結合後に変えるとカスタム法線が崩れる
        me.shade_smooth()
        me.set_sharp_from_angle(angle=math.radians(25))  # 面をはっきり見せる
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        me.materials.append(m)
        self.parts.append(ob)
        return ob

    @staticmethod
    def bevel(ob, width, seg=2, angle=50, harden=True):
        if width <= 0:
            return ob
        mod = ob.modifiers.new("bevel", "BEVEL")
        mod.harden_normals = harden  # 平らな面の陰影を崩さない
        mod.width = width
        mod.segments = seg
        mod.limit_method = "ANGLE"
        mod.angle_limit = math.radians(angle)
        mod.use_clamp_overlap = True
        return ob

    @staticmethod
    def subsurf(ob, level=1):
        mod = ob.modifiers.new("subsurf", "SUBSURF")
        mod.levels = level
        mod.render_levels = level
        return ob

    @staticmethod
    def apply(ob):
        if not ob.modifiers:
            return ob
        dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
        old = ob.data
        ob.modifiers.clear()
        ob.data = me
        bpy.data.meshes.remove(old)
        return ob

    def deform(self, ob, fn):
        """モディファイア適用後の各頂点へ fn(Vector)->Vector を適用する。"""
        self.apply(ob)
        for v in ob.data.vertices:
            v.co = Vector(fn(v.co.copy()))
        ob.data.update()
        return ob

    @staticmethod
    def _place(bm, center=(0, 0, 0), rot=None, scale=None):
        if scale:
            bmesh.ops.scale(bm, vec=scale, verts=bm.verts)
        if rot:
            bmesh.ops.transform(bm, matrix=rot_matrix(rot), verts=bm.verts)
        bmesh.ops.translate(bm, vec=Vector(center), verts=bm.verts)

    # ---------- 形状 ----------
    def box(self, size, center, m, bevel=0.008, seg=2, rot=None, cuts=0, harden=True, name="box"):
        """size=(幅, 高さ, 奥行き) の箱。center は中心座標。"""
        w, h, d = size
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        if cuts:
            bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts, use_grid_fill=True)
        self._place(bm, center, rot, (w, h, d))
        ob = self._obj(bm, m, name)
        return self.bevel(ob, min(bevel, 0.45 * min(w, h, d)), seg, harden=harden)

    def box_at(self, size, bottom, m, **kw):
        """底面中心を指定する箱。"""
        w, h, d = size
        return self.box(size, (bottom[0], bottom[1] + h / 2, bottom[2]), m, **kw)

    def cyl(self, r, h, center, m, seg=24, r2=None, bevel=0.0, bseg=2, axis="y", rot=None, name="cyl"):
        """円柱/円錐台。axis 方向に長さ h、r は -axis 側、r2 は +axis 側の半径。"""
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg,
                              radius1=r, radius2=r if r2 is None else r2, depth=h)
        if axis == "y":
            bmesh.ops.transform(bm, matrix=Matrix.Rotation(-math.pi / 2, 4, "X"), verts=bm.verts)
        elif axis == "x":
            bmesh.ops.transform(bm, matrix=Matrix.Rotation(math.pi / 2, 4, "Y"), verts=bm.verts)
        self._place(bm, center, rot)
        ob = self._obj(bm, m, name)
        return self.bevel(ob, min(bevel, 0.45 * h, 0.45 * r), bseg)

    def rod(self, a, b, r, m, seg=10, r2=None, name="rod"):
        """点aから点bへの円柱。"""
        a, b = Vector(a), Vector(b)
        bm = bmesh.new()
        length = (b - a).length
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg,
                              radius1=r, radius2=r if r2 is None else r2, depth=length)
        q = Vector((0, 0, 1)).rotation_difference((b - a).normalized())
        bmesh.ops.transform(bm, matrix=q.to_matrix().to_4x4(), verts=bm.verts)
        bmesh.ops.translate(bm, vec=(a + b) / 2, verts=bm.verts)
        return self._obj(bm, m, name)

    def sphere(self, r, center, m, seg=24, rings=12, scale=None, name="sphere"):
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
        self._place(bm, center, None, scale)
        return self._obj(bm, m, name)

    def lathe(self, profile, center, m, seg=32, cap_bottom=True, cap_top=True, closed=False, pleat=0.0, name="lathe"):
        """profile: 下から上への (半径, 高さ) 列。closed=True で始点と終点をつなぐ(厚みのある殻)。
        pleat: 1つおきの頂点の半径を縮める割合 (プリーツ表現)。"""
        bm = bmesh.new()
        rings = []
        for r, y in profile:
            if r <= 1e-6:
                rings.append([bm.verts.new((0, y, 0))])
            else:
                rings.append([bm.verts.new((r * (1 - pleat * (i % 2)) * math.cos(TAU * i / seg), y,
                                            r * (1 - pleat * (i % 2)) * math.sin(TAU * i / seg)))
                              for i in range(seg)])
        pairs = list(zip(rings, rings[1:]))
        if closed:
            pairs.append((rings[-1], rings[0]))
        for lo, hi in pairs:
            if len(lo) == 1 and len(hi) == 1:
                continue
            for i in range(seg):
                j = (i + 1) % seg
                if len(lo) == 1:
                    bm.faces.new((lo[0], hi[j], hi[i]))
                elif len(hi) == 1:
                    bm.faces.new((lo[i], lo[j], hi[0]))
                else:
                    bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
        if not closed:
            if cap_bottom and len(rings[0]) > 1:
                bm.faces.new(list(reversed(rings[0])))
            if cap_top and len(rings[-1]) > 1:
                bm.faces.new(rings[-1])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        self._place(bm, center)
        return self._obj(bm, m, name)

    def prism(self, pts, thickness, m, plane="xz", offset=0.0, bevel=0.0, seg=2, rot=None, center=(0, 0, 0),
              fan=False, name="prism"):
        """2D輪郭を押し出す。
        plane="xz": 上面図 (x, z) の輪郭を y=offset から上へ。
        plane="xy": 正面図 (x, y) の輪郭を z=offset から +Z へ。
        plane="zy": 側面図 (z, y) の輪郭を x=offset から +X へ。
        """
        def to3(p, t):
            if plane == "xz":
                return (p[0], offset + t, p[1])
            if plane == "xy":
                return (p[0], p[1], offset + t)
            return (offset + t, p[1], p[0])

        bm = bmesh.new()
        bottom = [bm.verts.new(to3(p, 0)) for p in pts]
        top = [bm.verts.new(to3(p, thickness)) for p in pts]
        n = len(pts)
        caps = [bm.faces.new(bottom), bm.faces.new(list(reversed(top)))]
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((bottom[i], bottom[j], top[j], top[i]))
        if fan:  # 凹みのある輪郭を中心からの扇で三角形化する
            bmesh.ops.poke(bm, faces=caps)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        self._place(bm, center, rot)
        ob = self._obj(bm, m, name)
        return self.bevel(ob, min(bevel, 0.45 * thickness), seg, angle=40)

    def cushion(self, size, center, m, puff=0.25, round_=0.35, cuts=4, pinch=0.0, rot=None, name="cushion"):
        """布張りクッション。上下面を中央へ膨らませ、角を丸める。
        puff: 外周で厚みを何割減らすか。pinch: 四隅を縮める量(比率)。
        """
        w, h, d = size
        ob = self.box(size, (0, 0, 0), m, bevel=round_ * min(w, h, d), seg=3, cuts=cuts, harden=False, name=name)
        hw, hh, hd = w / 2, h / 2, d / 2

        def fn(co):
            u = min(1.0, abs(co.x) / hw)
            v = min(1.0, abs(co.z) / hd)
            edge = max(u, v) ** 3
            co.y *= 1.0 - puff * edge
            if pinch:
                k = 1.0 - pinch * (u * v) ** 2
                co.x *= k
                co.z *= k
            return co

        self.deform(ob, fn)
        me = ob.data
        me.set_sharp_from_angle(angle=math.pi)  # 布は全面なめらかにする
        if rot:
            me.transform(rot_matrix(rot))
        me.transform(Matrix.Translation(Vector(center)))
        return ob

    def surface(self, nu, nv, fn, m, thickness=0.004, name="surface"):
        """fn(u, v)->(x, y, z) の格子面に厚みを付ける (布など)。"""
        bm = bmesh.new()
        grid = [[bm.verts.new(fn(i / (nu - 1), j / (nv - 1))) for i in range(nu)] for j in range(nv)]
        for j in range(nv - 1):
            for i in range(nu - 1):
                bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
        ob = self._obj(bm, m, name)
        mod = ob.modifiers.new("solidify", "SOLIDIFY")
        mod.thickness = thickness
        mod.offset = 0.0
        return ob

    @staticmethod
    def box_uv(me):
        """面の向きごとに投影するUV (1UV = 1m)。フロントで繰り返しテクスチャを同じ密度で張れる。
        Blender座標 (Z上・-Y正面) で呼ぶ。縦の面はテクスチャの上が+Z(上)になる。"""
        uv = me.uv_layers.new(name="UVMap").data
        for poly in me.polygons:
            n = poly.normal
            ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
            for li in poly.loop_indices:
                co = me.vertices[me.loops[li].vertex_index].co
                if az >= ax and az >= ay:
                    uv[li].uv = (co.x, -co.y if n.z >= 0 else co.y)
                elif ax >= ay:
                    uv[li].uv = (-co.y if n.x >= 0 else co.y, co.z)
                else:
                    uv[li].uv = (co.x if n.y < 0 else -co.x, co.z)

    # ---------- 書き出し ----------
    def finish(self, target, out_path, tol=0.08):
        """結合・座標変換・寸法合わせ・GLB書き出し。target=(幅, 高さ, 奥行き)。"""
        for ob in self.parts:
            self.apply(ob)
            for v in ob.data.vertices:
                v.co = ob.matrix_world @ v.co
            ob.matrix_world = Matrix.Identity(4)
        root = self.parts[0]
        with bpy.context.temp_override(active_object=root, object=root,
                                       selected_objects=self.parts, selected_editable_objects=self.parts):
            bpy.ops.object.join()
        ob = root
        ob.name = self.name
        me = ob.data
        me.name = self.name
        me.transform(Matrix.Rotation(math.pi / 2, 4, "X"))  # アプリ(Y上) → Blender(Z上)
        xs = [v.co.x for v in me.vertices]
        ys = [v.co.y for v in me.vertices]
        zs = [v.co.z for v in me.vertices]
        actual = (max(xs) - min(xs), max(zs) - min(zs), max(ys) - min(ys))  # 幅, 高さ, 奥行き
        me.transform(Matrix.Translation((-(max(xs) + min(xs)) / 2, -(max(ys) + min(ys)) / 2, -min(zs))))
        # 薄い布・ラグは相対誤差が大きく出るため、6mmまでの差は許容して合わせる
        tol = self.tol or tol
        if any(abs(a - t) > max(tol * t, 0.006) for a, t in zip(actual, target)):
            raise RuntimeError(f"{self.name}: 寸法ずれ actual={actual} target={target}")
        sx, sy, sz = (target[0] / actual[0], target[2] / actual[2], target[1] / actual[1])
        me.transform(Matrix.Diagonal((sx, sy, sz, 1.0)))

        self.box_uv(me)
        me.update()
        tris = sum(len(p.vertices) - 2 for p in me.polygons)

        bpy.ops.export_scene.gltf(filepath=out_path, export_format="GLB", export_yup=True,
                                  export_apply=True, use_selection=False)
        return {"name": self.name, "tris": tris, "actual": actual, "materials": [m.name for m in me.materials]}


# ---------- 登録 ----------
ASSETS = {}


def asset(file, size, variants=None):
    """file: 出力名, size: (幅, 高さ, 奥行き)。
    variants: {接尾辞: {"tint": 色, "size": 寸法}} で商品別の色・寸法違いも書き出す。"""
    def deco(fn):
        ASSETS[file] = (fn, size, variants or {})
        return fn
    return deco


def rrect(w, d, r, seg=6):
    """角丸長方形の輪郭 (x, z)。反時計回り。"""
    r = min(r, w / 2, d / 2)
    pts = []
    for cx, cz, a0 in ((w / 2 - r, d / 2 - r, 0), (-w / 2 + r, d / 2 - r, 90),
                       (-w / 2 + r, -d / 2 + r, 180), (w / 2 - r, -d / 2 + r, 270)):
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    return pts


def circle(r, seg=32, cx=0.0, cz=0.0):
    return [(cx + r * math.cos(TAU * i / seg), cz + r * math.sin(TAU * i / seg)) for i in range(seg)]

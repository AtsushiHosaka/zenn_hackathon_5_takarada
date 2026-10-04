"""GLBを1枚ずつ描画してタイル状のPNGにまとめる。
使い方: Blender -b --python preview.py -- <GLBディレクトリ> <出力PNG> [view=front|back|top] [ファイル名...]
"""
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
src, out = argv[0], argv[1]
view = "front"
rest = argv[2:]
if rest and rest[0].startswith("view="):
    view = rest[0][5:]
    rest = rest[1:]
engine = "workbench"
if rest and rest[0].startswith("engine="):
    engine = rest[0][7:]
    rest = rest[1:]
checker = bool(rest) and rest[0] == "checker"  # tint/wood にチェッカーを張ってUVを確認する
if checker:
    rest = rest[1:]
files = rest or sorted(f for f in os.listdir(src) if f.endswith(".glb"))
TILE = 360
scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
scene.render.resolution_x = scene.render.resolution_y = TILE
scene.display.shading.light = "STUDIO"
scene.display.shading.color_type = "TEXTURE" if checker else "MATERIAL"
scene.display.shading.show_cavity = True
scene.display.shading.show_shadows = False
scene.display.shading.show_object_outline = False
scene.render.film_transparent = False
if scene.world is None:
    scene.world = bpy.data.worlds.new("w")
scene.world.color = (0.82, 0.83, 0.85)
scene.view_settings.view_transform = "Standard"

if engine == "eevee":  # アプリ (半球光 + 太陽光) に近い見え方
    scene.render.engine = "BLENDER_EEVEE"
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.93, 0.91, 0.97, 1)
    bg.inputs["Strength"].default_value = 0.6
    scene.view_settings.view_transform = "Standard"
    sun_data = bpy.data.lights.new("sun", "SUN")
    sun_data.energy = 3.0
    sun_data.color = (1.0, 0.95, 0.86)
    sun_data.angle = 0.2
    SUN = sun_data

dirs = {"front": Vector((1.0, -1.7, 0.9)), "back": Vector((-1.0, 1.7, 0.9)), "top": Vector((0.25, -0.5, 2.5)),
        "side": Vector((1.8, -0.4, 0.5))}
tiles = []
tmp = os.path.join(os.path.dirname(out), "_tile.png")
for f in files:
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(src, f))
    if engine == "eevee":
        sun = bpy.data.objects.new("sun", SUN)
        scene.collection.objects.link(sun)
        sun.rotation_euler = (math.radians(50), 0, math.radians(30))
    if checker:
        grid = bpy.data.images.get("checker") or bpy.data.images.new("checker", 256, 256)
        grid.generated_type = "COLOR_GRID"
        for mat in bpy.data.materials:
            if mat.name.split(".")[0] in ("tint", "wood") and mat.node_tree:
                nt = mat.node_tree
                tex = nt.nodes.new("ShaderNodeTexImage")
                tex.image = grid
                nt.nodes.active = tex
                mp = nt.nodes.new("ShaderNodeMapping")
                mp.inputs["Scale"].default_value = (4, 4, 1)  # 0.25m 角
                coord = nt.nodes.new("ShaderNodeTexCoord")
                nt.links.new(coord.outputs["UV"], mp.inputs["Vector"])
                nt.links.new(mp.outputs["Vector"], tex.inputs["Vector"])
                nt.links.new(tex.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Base Color"])
    meshes = [o for o in scene.objects if o.type == "MESH"]
    pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    center, size = (lo + hi) / 2, (hi - lo)
    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = max(size.length * 1.05, 0.05)
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    d = dirs[view].normalized()
    cam.location = center + d * (size.length * 3 + 1)
    cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    cam_data.clip_end = size.length * 10 + 10
    scene.camera = cam
    txt_data = bpy.data.curves.new("label", "FONT")
    txt_data.body = f"{f[:-4]}  {size.x:.2f}x{size.z:.2f}x{size.y:.2f}"
    txt_data.size = cam_data.ortho_scale * 0.055
    txt = bpy.data.objects.new("label", txt_data)
    scene.collection.objects.link(txt)
    txt.parent = cam
    txt.location = (-cam_data.ortho_scale * 0.47, -cam_data.ortho_scale * 0.47, -1)
    mat = bpy.data.materials.new("label")
    mat.diffuse_color = (0.05, 0.05, 0.08, 1)
    txt_data.materials.append(mat)
    scene.render.filepath = tmp
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(tmp)
    arr = np.array(img.pixels[:], dtype=np.float32).reshape(TILE, TILE, 4)
    bpy.data.images.remove(img)
    tiles.append(arr)

cols = min(5, len(tiles))
rows = math.ceil(len(tiles) / cols)
sheet = np.ones((rows * TILE, cols * TILE, 4), dtype=np.float32)
for i, t in enumerate(tiles):
    r, c = divmod(i, cols)
    y0 = (rows - 1 - r) * TILE  # Blenderの画素は下から
    sheet[y0:y0 + TILE, c * TILE:(c + 1) * TILE] = t
    sheet[y0:y0 + TILE, c * TILE:c * TILE + 1] = (0.4, 0.4, 0.4, 1)
    sheet[y0:y0 + 1, c * TILE:(c + 1) * TILE] = (0.4, 0.4, 0.4, 1)
img = bpy.data.images.new("sheet", cols * TILE, rows * TILE, alpha=True)
img.pixels = sheet.ravel()
img.filepath_raw = out
img.file_format = "PNG"
img.save()
os.remove(tmp)
print("SHEET", out, len(tiles))

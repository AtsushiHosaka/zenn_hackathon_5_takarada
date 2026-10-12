"""GLB 1 つを確認用の画像にする (Cycles の CPU 描画。GPU は使わない)。別プロセスで動かす。

使い方: python render.py <glb> <png> <front|side>
"""
import math
import sys

import bpy
from mathutils import Vector

VIEWS = {"front": (0.8, -1.5, 0.75), "side": (-1.6, -0.5, 0.6)}  # Blender 座標 (-Y が家具の正面)

glb, png, view = sys.argv[1:4]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 32
scene.cycles.use_denoising = False
scene.render.resolution_x = scene.render.resolution_y = 480
scene.view_settings.view_transform = "Standard"
world = bpy.data.worlds.new("world")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.82, 0.83, 0.85, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.9
scene.world = world

meshes = [ob for ob in scene.objects if ob.type == "MESH"]
points = [ob.matrix_world @ Vector(corner) for ob in meshes for corner in ob.bound_box]
low = Vector(tuple(min(point[i] for point in points) for i in range(3)))
high = Vector(tuple(max(point[i] for point in points) for i in range(3)))
center = (low + high) / 2
camera = bpy.data.objects.new("camera", bpy.data.cameras.new("camera"))
scene.collection.objects.link(camera)
scene.camera = camera
camera.location = center + Vector(VIEWS[view]).normalized() * (high - low).length / 2 * 3.2
camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
sun.data.energy = 2.5
sun.rotation_euler = (math.radians(50), 0, math.radians(30))
scene.collection.objects.link(sun)
scene.render.filepath = png
bpy.ops.render.render(write_still=True)

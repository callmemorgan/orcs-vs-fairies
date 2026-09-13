"""Editable Blender order icons for the RTS command console."""
import sys, math
from pathlib import Path
import bpy
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
import common as C
ROOT=Path(__file__).resolve().parents[2]
for name in ('halt','hold'):
    C.reset_scene()
    gold=C.material('aged brass','cbb47a',metallic=.55)
    dark=C.material('forged iron','394940',metallic=.5)
    wood=C.material('leather','805b38')
    if name=='halt':
        C.box('stop plaque',(0,0,0),(1.7,.22,1.7),gold,.12)
        C.box('dark square',(0,-.14,0),(1.25,.08,1.25),dark,.04)
        for x in (-.69,.69):
            for z in (-.69,.69):C.uv('rivet',(x,-.14,z),(.065,.055,.065),gold)
    else:
        verts=[(-.85,0,.9),(.85,0,.9),(.8,0,-.1),(0,0,-1),(-.8,0,-.1)]
        C.mesh('shield brass rim',verts,[(0,1,2,3,4)],gold)
        C.mesh('shield face',[(x*.82,-.09,z*.82) for x,y,z in verts],[(0,1,2,3,4)],dark)
        C.box('shield vertical boss',(0,-.17,.03),(.16,.16,1.45),gold)
        C.box('shield crossbar',(0,-.18,.24),(1.18,.17,.15),gold)
        C.uv('central boss',(0,-.25,.24),(.20,.13,.20),gold)
    scene=C.setup_render(128,128,(64,64),24)
    cam=scene.camera;cam.location=(2,-9,2);cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=2.7
    C.save(str(ROOT/'art/models'/f'ui-{name}.blend'))
    C.render(str(ROOT/'public/assets'/f'ui-{name}.png'))

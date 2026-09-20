"""Inspect and render larger portraits from all saved scenery scenes."""
import json,sys
from pathlib import Path
import bpy
BASE=Path(__file__).resolve().parent
sys.path.insert(0,str(BASE))
import common as C
ROOT=BASE.parents[1]
out=ROOT/'work/scenery/portraits';out.mkdir(parents=True,exist_ok=True)
manifest=json.loads((BASE/'raw/environment/manifest.json').read_text())
rows=[]
for item in manifest['assets']:
    aid=item['id'];path=BASE/'scenes'/f'environment-{aid}.blend'
    bpy.ops.wm.open_mainfile(filepath=str(path));scene=bpy.context.scene
    assert scene.camera and scene.get('projection_calibration'),aid
    assert (scene.render.resolution_x,scene.render.resolution_y)==(item['width'],item['height']),aid
    meshes=[o for o in scene.objects if o.type=='MESH'];curves=[o for o in scene.objects if o.type=='CURVE']
    assert meshes,aid
    rows.append({'id':aid,'meshes':len(meshes),'curves':len(curves),'vertices':sum(len(o.data.vertices) for o in meshes),'cameraCalibrated':True})
    scene.render.resolution_x*=3;scene.render.resolution_y*=3;scene.cycles.samples=48
    C.render(out/f'{aid}.png')
(out/'inventory.json').write_text(json.dumps({'status':'pass','models':len(rows),'assets':rows},indent=2)+'\n')
print('PASS:',len(rows),'saved environment models')

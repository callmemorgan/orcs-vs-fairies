"""Faction stone walls and openable gate houses, using the calibrated building export."""
import bpy, sys, json, argparse
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import common as C
from progression import COLORS
BASE=Path(__file__).resolve().parent

def export(asset):
 faction,role=asset.split('-');w=256;anchor=[128,288];out=BASE/'raw/buildings'/asset;out.mkdir(parents=True,exist_ok=True)
 for state,frame in [('idle',0),('construction',0),('construction',1),('construction',2),('death',0)]+([('open',0)] if role=='gate' else []):
  C.reset_scene();stone=C.material('weathered stone','78828a');dark=C.material('mortar','414d55');wood=C.material('oak gate','644732');flag=C.material('faction banner',COLORS[faction][1]);iron=C.material('iron straps','39434a',metallic=.5)
  if state=='death':
   for i in range(8):C.box('fallen masonry',((i%3-.9)*.43,(i//3-.8)*.36,.16),(.4,.36,.3),stone)
  elif role=='wall':
   for layer in range(4):
    for row in range(2):C.box('cut stone block',((row-.5)*.48,0,.2+layer*.34),(.47,.96,.32),stone)
   for x in (-.34,.34):C.box('crenellation',(x,0,1.6),(.30,.94,.42),stone)
   C.box('banner',(0,-.49,.9),(.30,.04,.58),flag)
  else:
   for x in (-.78,.78):
    C.box('gate pier',(x,0,.9),(.42,1.9,1.8),stone)
    for y in (-.65,0,.65):C.box('battlement',(x,y,2.02),(.46,.32,.36),stone)
   C.box('arch lintel',(0,0,1.68),(1.18,1.9,.36),stone)
   for x in (-.43,-.21,0,.21,.43):C.box('portcullis', (x,-.85,1.65 if state=='open' else .75),(.12,.16,1.5),wood)
   for z in (.4,1.15):C.box('iron cross strap',(0,-.95,z+(.9 if state=='open' else 0)),(1.14,.06,.09),iron)
   for x in (-.78,.78):C.box('banner',(x,-.97,1.04),(.28,.03,.58),flag)
  if state=='construction':
   from mathutils import Vector
   bpy.context.view_layer.update();limit=.45+frame*.6
   for o in bpy.context.scene.objects:
    if o.type=='MESH' and min((o.matrix_world@Vector(c)).z for c in o.bound_box)>limit:o.hide_render=True
   for x in (-.6,.6):C.beam('scaffold',(x,-.8,0),(x,-.8,limit+.3),.04,wood)
  scene=C.setup_render(w,384,anchor,samples=24);scene['asset_id']=asset;scene['generator']='fortifications.py'
  if state=='idle':C.save(BASE/'scenes'/f'building-{asset}.blend')
  C.render(out/f'{state}-0-{frame:02}.png')
 (out/'meta.json').write_text(json.dumps({'id':asset,'kind':'building','width':w,'height':384,'anchor':anchor,'animations':{**({'open':{'frames':1,'fps':1,'loop':True}} if role=='gate' else {}),'idle':{'frames':1,'fps':1,'loop':True},'construction':{'frames':3,'fps':1,'loop':False},'death':{'frames':1,'fps':1,'loop':False}}},indent=2))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--asset',choices=[f'{f}-{r}' for f in COLORS for r in ('wall','gate')]);p.add_argument('--all',action='store_true');a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
 for asset in ([a.asset] if a.asset else [f'{f}-{r}' for f in COLORS for r in ('wall','gate')]):export(asset)

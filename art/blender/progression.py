"""Three-age pikes, mounted raiders and torsion siege; editable calibrated models.
Run --sample to inspect representatives, --all to export all eight directions.
"""
import bpy, math, sys, json, argparse
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import common as C
from units import ANIMS
BASE=Path(__file__).resolve().parent
COLORS={'orc':('6b792c','85351f'),'fairy':('cfb592','246750'),'dwarf':('dbb38a','ba6a37'),'undead':('d3ccaa','665184'),'tideborn':('57a7a3','e2b897'),'automata':('d8cbb0','b69ae9')}
IDS=[f'{f}-{r}' for f in COLORS for r in ('spear','cavalry','siege')]

from progression_models import model

def pose(rig,role,state,f,count,d=0,key=False):
    for o in rig.values():
        o.location=o['rest_location'];o.rotation_euler=o['rest_rotation'];o.scale=o['rest_scale']
    t=f/max(1,count-1);phase=f/count*math.pi*2;root=rig['root'];root.rotation_euler.z=-d*math.pi/4
    if state=='idle':rig['body'].location.z+=.01*math.sin(phase)
    if state=='walk':
        for name,o in rig.items():
            if name.startswith('leg'):o.rotation_euler.y+=(.30 if name=='leg1' else -.30)*math.sin(phase)
            elif name.startswith('hoof'):o.rotation_euler.y+=.28*math.sin(phase+(int(name[4:])//2+int(name[4:])%2)*math.pi)
            # Advance one spoke per loop, not per frame (which aliases to a frozen wheel).
            elif name.startswith('wheel'):o.rotation_euler.y+=phase/8
        rig['body'].location.z+=.02*abs(math.sin(phase))
    if state=='attack':
        if role=='siege':
            if root['faction']=='automata':rig['weapon'].location.x-=.23*math.sin(t*math.pi)
            else:rig['weapon'].rotation_euler.y+=.8*math.sin(t*math.pi)
        else:
            if 'arm-1' in rig:rig['arm-1'].location.x+=.23*math.sin(t*math.pi)
            else:rig['weapon'].location.x+=.28*math.sin(t*math.pi)
    for side in (-1,1):
        if f'wing{side}' in rig:rig[f'wing{side}'].rotation_euler.z+=side*.14*math.sin(phase)
    if state=='death':
        if role=='siege':
            # Low carriages collapse in place instead of standing on their tail.
            root.rotation_euler.x=.55*t;root.rotation_euler.y=-.22*t
            rig['body'].location.z-=.20*t
            rig['weapon'].rotation_euler.y+=.85*t
            for name,o in rig.items():
                if name.startswith('wheel'):o.rotation_euler.x+=(.5 if int(name[5:])%2 else -.5)*t
                elif name.startswith('hoof'):o.rotation_euler.y+=.5*t
        else:root.rotation_euler.y=-1.4*t
        bpy.context.view_layer.update()
        from mathutils import Vector
        bounds=[o.matrix_world@Vector(c) for o in bpy.context.scene.objects if o.type in ('MESH','CURVE') for c in o.bound_box]
        # Rest the fallen model on the ground around its original footprint.
        # Rotating a tall rider about the feet alone throws the corpse off canvas.
        root.location.x-=(min(v.x for v in bounds)+max(v.x for v in bounds))*.5*t
        root.location.y-=(min(v.y for v in bounds)+max(v.y for v in bounds))*.5*t
        root.location.z-=min(0,min(v.z for v in bounds))
    if key:
        for o in rig.values():
            for prop in ('location','rotation_euler','scale'):o.keyframe_insert(data_path=prop,frame=f+1,group=state)
    bpy.context.view_layer.update()

def export(asset,sample=False,resume=False,states=None,models_only=False):
    C.reset_scene()
    # Each saved scene owns only its actions, even in an all-faction batch.
    for action in list(bpy.data.actions):bpy.data.actions.remove(action)
    rig=model(asset);role=asset.split('-')[1];w=224;h=224;anchor=[112,176]
    scene=C.setup_render(w,h,anchor,samples=24);scene.render.use_persistent_data=True;scene['asset_id']=asset;scene['generator']='progression.py'
    for state,cfg in ANIMS.items():
        for o in rig.values():
            o.animation_data_clear();o.animation_data_create();o.animation_data.action=bpy.data.actions.new(asset+' / '+state+' / '+o.name);o.animation_data.action.use_fake_user=True
        for f in range(cfg['frames']):pose(rig,role,state,f,cfg['frames'],key=True)
    for o in rig.values():o.animation_data_clear()
    pose(rig,role,'idle',0,4);C.save(BASE/'scenes'/f'unit-{asset}.blend')
    out=BASE/'raw/units'/asset;out.mkdir(parents=True,exist_ok=True)
    (out/'meta.json').write_text(json.dumps({'id':asset,'kind':'unit','width':w,'height':h,'anchor':anchor,'animations':ANIMS},indent=2))
    if models_only:
        print('MODEL COMPLETE',asset,flush=True);return
    jobs=([('idle',0,0),('attack',1,2)]+[('death',d,5) for d in range(8)]) if sample else [(st,d,f) for st,cfg in ANIMS.items() for d in range(8) for f in range(cfg['frames'])]
    for st,d,f in jobs:
        if states and st not in states:continue
        target=out/f'{st}-{d}-{f:02}.png'
        if resume and not sample and target.exists():continue
        pose(rig,role,st,f,ANIMS[st]['frames'],d);C.render(target)
    print('UNIT COMPLETE',asset,flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--sample',action='store_true');p.add_argument('--all',action='store_true');p.add_argument('--resume',action='store_true');p.add_argument('--asset',choices=IDS);p.add_argument('--states',nargs='+',choices=list(ANIMS));p.add_argument('--models-only',action='store_true');a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if not(a.sample or a.all or a.asset):p.error('choose --sample, --all or --asset')
    for asset in ([a.asset] if a.asset else IDS):export(asset,a.sample,a.resume,a.states,a.models_only)

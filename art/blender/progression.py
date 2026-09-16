"""Three-age pikes, mounted raiders and torsion siege; editable calibrated models.
Run --sample to inspect representatives, --all to export all eight directions.
"""
import bpy, math, sys, json, argparse
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import common as C
from units import group, pivot, ANIMS
BASE=Path(__file__).resolve().parent
COLORS={'orc':('6b792c','85351f'),'fairy':('cfb592','246750'),'dwarf':('dbb38a','ba6a37'),'undead':('d3ccaa','665184'),'tideborn':('57a7a3','e2b897'),'automata':('d8cbb0','b69ae9')}
IDS=[f'{f}-{r}' for f in COLORS for r in ('spear','cavalry','siege')]

def model(asset):
    faction,role=asset.split('-');skin,cloth=COLORS[faction]
    m={n:C.material(n,c,metallic=.45 if n in ('steel','trim') else 0) for n,c in {'skin':skin,'cloth':cloth,'steel':'52636d','trim':'d7ac56','wood':'644732','dark':'222b35','mount':'796550','bone':'d3ccaa'}.items()}
    root=pivot('POSE root',(0,0,0));rig={'root':root}
    if role=='siege':
        def carriage():
            C.box('heavy oak chassis',(0,0,.43),(1.65,1.05,.23),m['wood'])
            for x in (-.62,.62):
                C.beam('axle',(x,-.78,.38),(x,.78,.38),.09,m['steel'])
                for y in (-.7,.7):
                    wheel=C.cone('iron wheel',(x,y,.38),.36,.36,.14,m['steel'],16);wheel.rotation_euler.x=math.pi/2
                    for a in range(8):C.beam('wheel spoke',(x,y*1.12,.38),(x+math.cos(a*math.pi/4)*.29,y*1.12,.38+math.sin(a*math.pi/4)*.29),.026,m['trim'])
            for y in (-.4,.4):C.beam('A frame',(-.6,y,.53),(.15,y,1.28),.10,m['wood']);C.beam('A brace',(.64,y,.53),(.15,y,1.28),.10,m['wood'])
            C.box('faction armor',(0,-.54,.65),(.9,.07,.28),m['cloth'])
        rig['body']=group('POSE carriage',(0,0,0),root,carriage)
        def weapon():
            C.beam('throwing arm',(-.88,0,.75),(.95,0,1.38),.095,m['wood'])
            C.uv('loaded stone',(.9,0,1.4),(.22,.22,.22),m['steel'])
            for y in (-.4,.4):C.beam('torsion cord',(.15,y,1.17),(.15,0,1.17),.07,m['bone'])
            C.box('counterweight',(-.8,0,.78),(.38,.4,.32),m['steel'])
        rig['weapon']=group('POSE throwing arm',(.15,0,1.17),root,weapon)
    else:
        mounted=role=='cavalry';z=.98 if mounted else 0
        if mounted:
            def mount():
                C.uv('mount body',(-.08,0,.77),(.69,.32,.34),m['mount'])
                C.uv('mount neck',(.47,0,1.08),(.24,.26,.44),m['mount'])
                C.uv('mount head',(.66,0,1.38),(.34,.23,.24),m['mount'])
                for sign in (-1,1):
                    C.cone('mount ear',(.52,sign*.15,1.68),.075,0,.28,m['mount'])
                    C.uv('mount eye',(.76,sign*.21,1.47),(.035,.023,.035),m['dark'])
                    if faction=='orc':C.beam('boar tusk',(.91,sign*.16,1.28),(1.04,sign*.25,1.5),.055,m['bone'])
                    if faction in ('fairy','dwarf'):C.beam('antler',(.45,sign*.2,1.62),(.2,sign*.45,1.98),.04,m['bone'])
                C.box('saddle cloth',(-.18,0,1.02),(.65,.71,.12),m['cloth'])
                if faction=='tideborn':C.uv('armored shell',(-.3,0,.98),(.50,.38,.22),m['skin'])
                if faction=='automata':
                    for x in (-.5,-.2,.1):C.box('segmented ceramic armor',(x,0,.88),(.25,.69,.4),m['skin'])
                if faction=='undead':
                    for x in (-.45,-.2,.05):
                        for sign in (-1,1):C.beam('exposed bone ribs',(x,0,1.05),(x,sign*.3,.65),.035,m['bone'])
            rig['mount']=group('POSE mount',(0,0,0),root,mount)
            for i,(x,y) in enumerate([(-.5,-.23),(-.5,.23),(.43,-.23),(.43,.23)]):
                rig[f'hoof{i}']=group(f'POSE hoof{i}',(x,y,.76),root,lambda x=x,y=y:C.beam('mount leg',(x,y,.76),(x-.06,y,.14),.075,m['mount']))
        def body():
            C.uv('armored torso',(-.13,0,z+.86),(.23,.28,.34),m['cloth'])
            C.box('breastplate',(.045,0,z+.91),(.13,.46,.38),m['steel'])
            C.uv('head',(-.11,0,z+1.36),(.21,.2,.23),m['skin'])
            C.uv('helmet',(-.13,0,z+1.48),(.23,.22,.14),m['steel'])
            C.cone('helmet crest',(-.15,0,z+1.69),.075,0,.27,m['cloth'])
            for y in (-.19,.19):C.uv('eye',(.069,y,z+1.38),(.025,.025,.025),m['dark'])
            C.box('belt',(-.13,0,z+.61),(.40,.49,.1),m['trim'])
        rig['body']=group('POSE torso',(0,0,z+.7),root,body)
        for i,y in enumerate((-.2,.2)):
            rig[f'leg{i}']=group(f'POSE leg{i}',(-.1,y,z+.6),root,lambda y=y:C.beam('booted leg',(-.1,y,z+.6),(-.1,y*(1.7 if mounted else 1),z+.13),.09,m['dark']))
        def weapon():
            C.beam('pike shaft',(-.6,-.34,z+.55),(1.05,-.34,z+1.65),.034,m['wood'])
            C.beam('steel pike tip',(1.05,-.34,z+1.65),(1.4,-.34,z+1.88),.067,m['steel'])
            C.uv('gripping hand',(.04,-.34,z+.98),(.075,.075,.075),m['skin'])
        rig['weapon']=group('POSE pike',(0,-.3,z+.9),root,weapon)
        shield=C.cone('round shield',(-.05,.34,z+.88),.29,.29,.08,m['cloth'],12);shield.rotation_euler.x=math.pi/2
        from units import parent_keep
        parent_keep(shield,rig['body'])
    for obj in rig.values():obj['rest_location']=list(obj.location);obj['rest_rotation']=list(obj.rotation_euler)
    return rig

def pose(rig,role,state,f,count,d=0,key=False):
    for o in rig.values():o.location=o['rest_location'];o.rotation_euler=o['rest_rotation']
    t=f/max(1,count-1);phase=f/count*math.pi*2;root=rig['root'];root.rotation_euler.z=-d*math.pi/4
    if state=='idle':rig['body'].location.z+=.01*math.sin(phase)
    if state=='walk':
        for name,o in rig.items():
            if name.startswith(('leg','hoof')):o.rotation_euler.y+=.35*math.sin(phase+(int(name[-1])%2)*math.pi)
        rig['body'].location.z+=.02*abs(math.sin(phase))
    if state=='attack':
        if role=='siege':rig['weapon'].rotation_euler.y+=.8*math.sin(t*math.pi)
        else:rig['weapon'].location.x+=.35*math.sin(t*math.pi)
    if state=='death':
        root.rotation_euler.y=-1.4*t
        bpy.context.view_layer.update()
        from mathutils import Vector
        bounds=[o.matrix_world@Vector(c) for o in bpy.context.scene.objects if o.type=='MESH' for c in o.bound_box]
        # Rest the fallen model on the ground around its original footprint.
        # Rotating a tall rider about the feet alone throws the corpse off canvas.
        root.location.x-=(min(v.x for v in bounds)+max(v.x for v in bounds))*.5*t
        root.location.y-=(min(v.y for v in bounds)+max(v.y for v in bounds))*.5*t
        root.location.z-=min(0,min(v.z for v in bounds))
    if key:
        for o in rig.values():
            for prop in ('location','rotation_euler'):o.keyframe_insert(data_path=prop,frame=f+1,group=state)
    bpy.context.view_layer.update()

def export(asset,sample=False,resume=False):
    C.reset_scene();rig=model(asset);role=asset.split('-')[1];w=224;h=224;anchor=[112,176]
    scene=C.setup_render(w,h,anchor,samples=24);scene['asset_id']=asset;scene['generator']='progression.py'
    for state,cfg in ANIMS.items():
        for o in rig.values():
            o.animation_data_clear();o.animation_data_create();o.animation_data.action=bpy.data.actions.new(asset+' / '+state+' / '+o.name);o.animation_data.action.use_fake_user=True
        for f in range(cfg['frames']):pose(rig,role,state,f,cfg['frames'],key=True)
    for o in rig.values():o.animation_data_clear()
    pose(rig,role,'idle',0,4);C.save(BASE/'scenes'/f'unit-{asset}.blend')
    out=BASE/'raw/units'/asset;out.mkdir(parents=True,exist_ok=True)
    (out/'meta.json').write_text(json.dumps({'id':asset,'kind':'unit','width':w,'height':h,'anchor':anchor,'animations':ANIMS},indent=2))
    jobs=([('idle',0,0),('attack',1,2)]+[('death',d,5) for d in range(8)]) if sample else [(st,d,f) for st,cfg in ANIMS.items() for d in range(8) for f in range(cfg['frames'])]
    for st,d,f in jobs:
        target=out/f'{st}-{d}-{f:02}.png'
        if resume and not sample and target.exists():continue
        pose(rig,role,st,f,ANIMS[st]['frames'],d);C.render(target)
    print('UNIT COMPLETE',asset,flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--sample',action='store_true');p.add_argument('--all',action='store_true');p.add_argument('--resume',action='store_true');p.add_argument('--asset',choices=IDS);a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if not(a.sample or a.all or a.asset):p.error('choose --sample, --all or --asset')
    for asset in ([a.asset] if a.asset else IDS):export(asset,a.sample,a.resume)

"""Faction-built walls and gates with staged construction and moving gatework."""
import bpy, math, sys, json, argparse
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
import common as C
from progression import COLORS
BASE=Path(__file__).resolve().parent


def palette(faction):
    stone,trim,flag={
        'orc':('655a49','43494a','963d31'),
        'fairy':('51675b','b6a16c','397e69'),
        'dwarf':('697d87','c5a05b','52636d'),
        'undead':('484557','bfb99d','665184'),
        'tideborn':('b0a184','d98564','3d7462'),
        'automata':('d4cbb4','967744','9473e6'),
    }[faction]
    return {k:C.material(k,v,metallic=.5 if k=='trim' and faction in ('orc','dwarf','automata') else 0,
                         emission=.8 if k=='light' else 0)
            for k,v in {'stone':stone,'trim':trim,'flag':flag,'wood':'624632','dark':'283336',
                        'leaf':'4e9170','light':'98d7c3','ivory':'d9c99e'}.items()}


def masonry(name,center,size,m,rows=5):
    x,y,z=center;w,d,h=size
    C.box(name+' mortar core',(x,y,z),(w-.035,d-.035,h-.035),m['dark'],.018)
    for layer in range(rows):
        n=2 if w<.7 else 4
        # Stagger joints with half blocks at alternating ends.
        cuts=[-w/2]+[(-w/2+(i+(.5 if layer%2 else 1))*w/n) for i in range(n)]+[w/2]
        cuts=sorted(set(c for c in cuts if -w/2<=c<=w/2))
        for a,b in zip(cuts,cuts[1:]):
            if b-a<.02:continue
            C.box(name+' dressed stone',(x+(a+b)/2,y,z-h/2+(layer+.5)*h/rows),
                  (b-a-.014,d,h/rows-.018),m['stone'],.018)
    C.box(name+' coping',(x,y,z+h/2+.025),(w+.07,d+.07,.10),m['trim'],.025)


def emblem(faction,x,y,z,m,scale=1):
    """Raised faction marks on the front face, large enough to survive reduction."""
    def line(name,pts,r=.025):
        return C.curve(name,[(x+a*scale,y-.035,z+b*scale) for a,b in pts],r*scale,m['trim'])
    if faction=='orc':
        for sign in (-1,1):line('iron tusk crest',[(sign*.19,.19),(sign*.12,-.18),(sign*.02,-.06)],.034)
    elif faction=='fairy':
        for sign in (-1,1):line('leaf gate crest',[(0,-.22),(sign*.21,.03),(0,.24),(0,-.22)],.018)
    elif faction=='dwarf':
        C.box('hammer crest head',(x,y-.05,z+.09),(.33*scale,.055,.13*scale),m['trim'],.015)
        C.box('hammer crest haft',(x,y-.05,z-.10),(.055*scale,.055,.30*scale),m['trim'],.01)
    elif faction=='undead':
        C.uv('gate death mask',(x,y-.06,z+.03),(.16*scale,.065,.19*scale),m['ivory'])
        for sign in (-1,1):C.uv('mask eye hollow',(x+sign*.062*scale,y-.12,z+.065*scale),(.043*scale,.015,.050*scale),m['dark'])
        for j in (-1,0,1):C.box('mask tooth',(x+j*.055*scale,y-.07,z-.15*scale),(.034*scale,.07,.09*scale),m['ivory'],.006)
    elif faction=='tideborn':
        for j in range(5):
            a=(j-2)*.40;line('scallop gate crest',[(0,-.20),(math.sin(a)*.18,0),(math.sin(a)*.28,.19)],.02)
    else:
        line('geometric core sigil',[(0,.24),(.18,0),(0,-.24),(-.18,0),(0,.24)],.022)
        C.uv('sigil inset crystal',(x,y-.06,z),(.06*scale,.035,.10*scale),m['light'])


def crown(faction,x,y,z,m):
    if faction=='orc':
        C.box('iron cap',(x,y,z),(.34,.40,.15),m['trim'])
        C.cone('palisade iron tooth',(x,y,z+.21),.13,0,.40,m['trim'],8)
    elif faction=='fairy':
        C.curve('living crown branch',[(x,y,z-.22),(x+.08,y,z+.12),(x,y,z+.40)],.045,m['wood'])
        for s in (-1,1):
            C.mesh('crown pointed leaf',[(x,y,z+.04),(x+s*.24,y,z+.26),(x+s*.14,y-.08,z+.06)],[(0,1,2)],m['leaf'])
    elif faction=='dwarf':
        C.box('crenel brass socket',(x,y,z),(.34,.38,.12),m['trim'])
        C.box('chamfered battlement',(x,y,z+.18),(.29,.32,.31),m['stone'],.065)
    elif faction=='undead':
        C.cone('gothic crown socket',(x,y,z),.17,.11,.16,m['trim'],6)
        C.cone('bone spire',(x,y,z+.28),.10,0,.50,m['ivory'],6)
    elif faction=='tideborn':
        C.curve('coral crenellation',[(x,y,z-.10),(x-.04,y,z+.20),(x+.025,y,z+.32)],.065,m['trim'])
        C.curve('forked coral tip',[(x-.02,y,z+.10),(x+.16,y,z+.18),(x+.17,y,z+.30)],.037,m['trim'])
    else:
        C.box('bronze crown socket',(x,y,z),(.31,.36,.12),m['trim'])
        C.cone('prismatic battlement',(x,y,z+.19),.18,.10,.30,m['stone'],4).rotation_euler.z=math.pi/4


def build(faction,role,state,frame,m):
    gate=role=='gate'
    if state=='death':
        for i in range(13):
            a=i*2.399;r=.22+(i%4)*.22
            o=C.box('broken faction masonry',(math.cos(a)*r,math.sin(a)*r,.10+(i%3)*.04),(.34,.29,.20),m['stone']);o.rotation_euler=(.1*(i%3),.1*(i%2),a)
        for i in (-1,1):C.beam('fallen gate brace',(i*.65,-.55,.09),(-i*.30,.48,.17),.07,m['trim'])
        emblem(faction,.25,-.30,.18,m,.5)
        return
    width=1.0 if not gate else 2.02
    C.box('stepped foundation',(0,0,.08),(width+.12,1.08 if not gate else 1.9,.16),m['stone'])
    if gate:
        for x in (-.79,.79):
            if faction=='fairy':
                for y in (-.58,.58):
                    C.curve('living gate trunk',[(x*1.12,y,.08),(x,y,1.04),(x*.82,y,1.72),(x*.28,y,2.04)],.15,m['wood'])
                    C.curve('trunk gold seam',[(x*1.12,y-.14,.12),(x,y-.14,1.04),(x*.82,y-.14,1.72)],.017,m['trim'])
            else:masonry('gate pier',(x,0,.91),(.48,1.65,1.65),m)
            for y in (-.58,0,.58):crown(faction,x,y,1.85,m)
            emblem(faction,x,-.845,1.10,m,.75)
        if faction=='fairy':
            # Curved root bridge and overlapping leaves replace a stone slab.
            C.curve('woven root arch',[(-.80,-.6,1.70),(0,-.6,2.08),(.80,-.6,1.70)],.11,m['wood'])
            for i in range(9):
                x=(i-4)*.19
                C.mesh('arched canopy leaf',[(x-.23,-.82,1.93),(x+.23,-.82,1.93),(x+.18,.20,2.16),(x,.88,2.0),(x-.18,.20,2.16)],[(0,1,2,3,4)],m['leaf'])
                C.curve('canopy leaf midrib',[(x,-.82,1.94),(x,.20,2.18),(x,.88,2.01)],.012,m['trim'])
        else:
            masonry('gate parapet',(0,0,1.79),(1.15,1.65,.37),m,2)
            if faction=='tideborn':
                for j in range(7):
                    a=(j-3)*.21
                    C.curve('shell fan parapet',[(0,-.25,1.98),(math.sin(a)*.67,.08,2.16),(math.sin(a)*.94,.45,2.22)],.065,m['ivory'])
            elif faction=='automata':
                C.box('gate induction pedestal',(0,.1,2.02),(.58,.62,.13),m['trim'])
                C.cone('gate power prism',(0,.1,2.22),.18,0,.34,m['flag'],6)
            elif faction=='undead':
                C.curve('pointed bone gate crest',[(-.5,-.82,1.95),(0,-.82,2.39),(.5,-.82,1.95)],.055,m['ivory'])
        # Actual voussoirs frame a clear pointed opening beneath the lintel.
        for side in (-1,1):
            C.curve('arch rolled molding',[(side*.55,-.87,.16),(side*.55,-.87,1.18),(side*.34,-.87,1.52),(0,-.87,1.64)],.048,m['trim'])
        C.box('arch keystone',(0,-.88,1.61),(.18,.13,.23),m['trim'],.04)
        gate_root=bpy.data.objects.new('POSE raised gatework',None);bpy.context.collection.objects.link(gate_root)
        before=set(bpy.context.scene.objects)
        for i in range(7):
            x=(i-3)*.155
            C.box('carved gate stave',(x,-.72,.76),(.094,.13,1.36),m['wood' if faction in ('orc','fairy','tideborn') else 'trim'],.018)
            C.cone('gate stave point',(x,-.72,.09),.060,0,.16,m['trim'],8).rotation_euler.x=math.pi
        for z in (.34,.98,1.33):
            C.box('gate cross rail',(0,-.81,z),(1.09,.09,.065),m['trim'],.012)
            for x in (-.43,0,.43):C.uv('gate rail rivet',(x,-.868,z),(.026,.019,.026),m['ivory'])
        for obj in set(bpy.context.scene.objects)-before:obj.parent=gate_root
        gate_root.location.z=.96 if state=='open' else 0
        # The raised lattice stays within the tower's height and preserves the
        # existing separate open frame used by the simulation.
        if state=='open':gate_root.scale.z=.68
    else:
        masonry('wall',(0,0,.75),(.96,.96,1.34),m)
        for x in (-.30,.30):crown(faction,x,0,1.51,m)
        C.box('recessed crest plaque',(0,-.50,.83),(.49,.07,.57),m['flag'],.035)
        emblem(faction,0,-.55,.84,m,.8)
    if faction=='orc':
        for x in ((-.98,.98) if gate else (-.42,.42)):
            C.beam('palisade timber brace',(x,-.58,.12),(x,-.52,1.47),.075,m['wood'])
            for z in (.35,1.16):C.box('iron timber binding',(x,-.52,z),(.19,.20,.09),m['trim'],.012)
    elif faction=='fairy':
        for side in (-1,1):
            x=side*(.91 if gate else .42)
            C.curve('root buttress',[(x+side*.14,-.64,.02),(x,-.55,.38),(x,-.52,1.32),(x-side*.16,-.45,1.74)],.065,m['wood'])
            for j in range(3):
                z=.50+j*.31
                C.mesh('ivy broad leaf',[(x,-.60,z),(x+side*.20,-.61,z+.20),(x+side*.24,-.64,z+.02),(x+side*.08,-.64,z-.07)],[(0,1,2,3)],m['leaf'])
    elif faction=='dwarf':
        for x in ((-.98,.98) if gate else (-.38,.38)):
            C.box('buttress iron shoe',(x,-.66,.32),(.22,.35,.5),m['trim'],.04)
    elif faction=='undead':
        for side in (-1,1):
            x=side*(.98 if gate else .44)
            C.curve('skeletal flying buttress',[(x+side*.13,-.65,.1),(x,-.6,.65),(x-side*.10,-.58,1.4)],.055,m['ivory'])
    elif faction=='tideborn':
        for side in (-1,1):
            x=side*(.91 if gate else .40)
            for j in range(3):
                C.uv('barnacle shell',(x,-.58,.25+j*.16),(.074,.045,.067),m['ivory'])
    else:
        for x in ((-.79,.79) if gate else (-.31,.31)):
            C.box('recessed conduit',(x,-.84 if gate else -.50,.56),(.045,.045,.50),m['dark'],.008)
            C.box('conduit light',(x,-.87 if gate else -.53,.56),(.017,.012,.37),m['light'],.004)
    if state=='construction':
        bpy.context.view_layer.update();limit=.48+frame*.60
        for obj in list(bpy.context.scene.objects):
            if obj.type in ('MESH','CURVE') and min((obj.matrix_world@Vector(c)).z for c in obj.bound_box)>limit:obj.hide_render=True
        for x in (-width*.40,width*.40):
            C.beam('scaffold upright',(x,-.94,.05),(x,-.94,limit+.22),.038,m['wood'])
        C.beam('scaffold cross tie',(-width*.40,-.94,limit),(width*.40,-.94,limit),.04,m['wood'])
        C.beam('scaffold diagonal',(-width*.4,-.94,.10),(width*.4,-.94,limit),.026,m['wood'])


def export(asset):
    faction,role=asset.split('-');w=256;anchor=[128,288];out=BASE/'raw/buildings'/asset;out.mkdir(parents=True,exist_ok=True)
    jobs=[('idle',0),('construction',0),('construction',1),('construction',2),('death',0)]+([('open',0)] if role=='gate' else [])
    for state,frame in jobs:
        C.reset_scene();build(faction,role,state,frame,palette(faction))
        scene=C.setup_render(w,384,anchor,samples=32);scene['asset_id']=asset;scene['generator']='fortifications.py'
        if state=='idle':C.save(BASE/'scenes'/f'building-{asset}.blend')
        C.render(out/f'{state}-0-{frame:02}.png')
    animations={'idle':{'frames':1,'fps':1,'loop':True},'construction':{'frames':3,'fps':1,'loop':False},'death':{'frames':1,'fps':1,'loop':False}}
    if role=='gate':animations['open']={'frames':1,'fps':1,'loop':True}
    (out/'meta.json').write_text(json.dumps({'id':asset,'kind':'building','width':w,'height':384,'anchor':anchor,'animations':animations},indent=2))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--asset',choices=[f'{f}-{r}' for f in COLORS for r in ('wall','gate')]);p.add_argument('--all',action='store_true');a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    for asset in ([a.asset] if a.asset else [f'{f}-{r}' for f in COLORS for r in ('wall','gate')]):export(asset)

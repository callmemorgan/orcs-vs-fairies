"""Procedural painted fantasy architecture. Blender --background --python buildings.py -- --sample.
Each building remains an editable assembly of named meshes; deterministic seed 912.
"""
import sys, math, random, json, argparse
from pathlib import Path
import bpy
from mathutils import Vector
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT))
from common import reset_scene, material, mesh, uv, box, cone, beam, curve, setup_render, render, save
R=random.Random(912)
M={}
def palette():
    global M
    colors={'wood':'#553326','woodlight':'#926345','bark':'#354940','leaf':'#2f756a','leaflight':'#65a58b','iron':'#3c4244','ironlight':'#777267','red':'#963d31','redlight':'#c26240','stone':'#77776b','dark':'#242a29','gold':'#cda55d','ivory':'#e4d5ab','purple':'#8566bc','pink':'#b88bc9','water':'#568e8d','amber':'#efb452'}
    M={k:material(k,v,roughness=.85,metallic=.35 if k.startswith('iron') else 0,emission=.3 if k=='amber' else 0) for k,v in colors.items()}
def b(n,p,s,m='wood',bevel=.035):return box(n,p,s,M[m],bevel)
def rod(n,a,z,r=.045,m='woodlight'):return beam(n,a,z,r,M[m])
def orb(n,p,s,m):return uv(n,p,s,M[m],segments=12,rings=8)
def path(n,pts,r=.06,m='bark'):return curve(n,pts,r,M[m])
def tip(n,p,r=.1,h=.4,m='ivory'):return cone(n,p,r,0,h,M[m])
def leaf(n,start,end,width=.2,m='leaf'):
    a=Vector(start);d=Vector(end)-a;side=d.cross(Vector((0,0,1))).normalized()*width
    if side.length<.01:side=Vector((width,0,0))
    v=[a,a+d*.33+side,a+d*.70+side*.7,a+d,a+d*.70-side*.7,a+d*.33-side,a+d*.46+Vector((0,0,width*.35))]
    ob=mesh(n,[tuple(x) for x in v],[(0,1,6),(1,2,6),(2,3,6),(3,4,6),(4,5,6),(5,0,6)],M[m]);sol=ob.modifiers.new('Petal thickness','SOLIDIFY');sol.thickness=.028
    path(n+' vein',[tuple(a),tuple(a+d*.5+Vector((0,0,width*.37))),tuple(a+d)],.013,'gold' if m in ('purple','pink','ivory') else 'leaflight')
    return ob

def petal(n,start,end,width,m):
    a=Vector(start);d=Vector(end)-a;side=d.cross(Vector((0,0,1))).normalized();verts=[]
    for j in range(9):
        t=j/8;w=width*math.sin(math.pi*t)**.65
        for k in (-1,0,1):
            v=a+d*t+side*(w*k)+Vector((0,0,math.sin(math.pi*t)*width*(.42-.27*abs(k))))
            verts.append(tuple(v))
    faces=[]
    for j in range(8):
        for k in range(2):faces.append((j*3+k,j*3+k+1,(j+1)*3+k+1,(j+1)*3+k))
    ob=mesh(n,verts,faces,M[m]);mod=ob.modifiers.new('Rounded petal contours','SUBSURF');mod.levels=1;mod.render_levels=1
    mod=ob.modifiers.new('Living petal thickness','SOLIDIFY');mod.thickness=.025
    path(n+' fine gold vein',[tuple(a),tuple(a+d*.5+Vector((0,0,width*.42))),tuple(a+d)],.009,'pink' if m=='purple' else 'ivory')
    return ob

def base(size,fairy=False):
    for i in range(24):
        a=i*math.tau/24;r=size*.51+R.uniform(-.07,.07)
        orb('Foundation fieldstone', (math.cos(a)*r,math.sin(a)*r,.08),(.12+R.random()*.06,.09,.085),'stone')
        if fairy:
            leaf('Ground fern',(math.cos(a)*r,math.sin(a)*r,.04),(math.cos(a)*(r+.23),math.sin(a)*(r+.23),.28),.11)
    if not fairy:
        for x in (-size*.36,size*.36):
            for y in (-size*.36,size*.36):b('Stone footing',(x,y,.12),(.45,.45,.24),'stone')

def roof(cx,cy,z,w,d,h):
    # Overlapping individually warped shingles. Ridge runs along Y.
    for side in (-1,1):
        for row in range(5):
            t=row/5;u=(row+1.18)/5
            for col in range(9):
                ya=cy-d/2+col*d/9;yb=ya+d/9*.98
                xa=cx+side*w*.5*t;xb=cx+side*w*.5*u
                za=z+h*(1-t);zb=z+h*(1-u)+.05*(u**3)
                ob=mesh('Overlapping red roof shingle',[(xa,ya,za+.018),(xa,yb,za+.018),(xb,yb+.018,zb),(xb,ya-.018,zb)],[(0,1,2,3)],M['redlight' if R.random()<.22 else 'red']);mod=ob.modifiers.new('Tile edge thickness','SOLIDIFY');mod.thickness=.048
        for yy in (cy-d/2-.02,cy+d/2+.02):
            rod('Iron gable trim',(cx,yy,z+h+.045),(cx+side*w*.61,yy,z-.12),.07,'iron')
            for t in (.25,.55,.9):orb('Gable rivet',(cx+side*w*.5*t,yy-.045,z+h*(1-t)),(.035,.035,.035),'gold')
    rod('Iron ridge cap',(cx,cy-d*.56,z+h+.07),(cx,cy+d*.56,z+h+.07),.075,'iron')
    for yy in (cy-d*.51,cy+d*.51):
        path('Curved ivory roof horn',[(cx,yy,z+h),(cx,yy*1.03,z+h+.17),(cx+.08,yy*1.04,z+h+.37)],.06,'ivory');tip('Horn tip',(cx+.08,yy*1.04,z+h+.39),.04,.15)

def door(x,y,z,w=.6,h=.95):
    b('Door shadow',(x,y,z+h/2),(w+.16,.08,h+.15),'dark')
    for i in range(5):b('Door oak plank',(x-w/2+w*(i+.5)/5,y-.045,z+h/2),(w/5*.92,.07,h),'woodlight')
    for zz in (z+.18,z+h-.18):b('Door iron strap',(x,y-.095,zz),(w,.045,.07),'iron')
    orb('Door ring',(x+w*.22,y-.13,z+h*.48),(.045,.027,.06),'gold')
    for xx in (x-w*.62,x+w*.62):b('Door timber jamb',(xx,y-.04,z+h*.53),(.12,.14,h*1.15))
    b('Door timber lintel',(x,y-.04,z+h+.08),(w*1.4,.16,.13))

def window(x,y,z):
    b('Amber window',(x,y,z),(.3,.07,.4),'amber');b('Window crossbar',(x,y-.045,z),(.34,.05,.045));b('Window mullion',(x,y-.045,z),(.035,.05,.44))

def banner(x,y,z):
    rod('Banner pole',(x,y,z-.8),(x,y,z+.22),.035,'iron');tip('Banner finial',(x,y,z+.3),.06,.23,'ironlight')
    ob=mesh('Crimson hanging banner',[(x-.19,y,z),(x+.19,y,z-.02),(x+.16,y-.035,z-.57),(x,y-.06,z-.49),(x-.18,y-.02,z-.65)],[(0,1,2,3,4)],M['red'])
    leaf('Banner sigil',(x,y-.05,z-.14),(x,y-.065,z-.4),.085,'ivory')

def hall(foundry=False):
    base(3)
    b('Hall timber shell',(0,.05,.9),(2.18,2.14,1.55))
    for yy in [-.96+i*.3 for i in range(8)]:
        for xx in (-1.11,1.11):b('Wall plank',(xx,yy,.88),(.075,.27,1.42),'woodlight')
    for xx in (-1.11,0,1.11):
        for yy in (-1.05,1.12):b('Massive upright',(xx,yy,.95),(.19,.19,1.9));b('Iron post sleeve',(xx,yy,.34),(.23,.23,.38),'iron')
    for xx in (-1.13,1.13):
        rod('Diagonal timber brace',(xx,-1.04,.38),(xx,1.05,1.65),.08)
        b('Side girdle',(xx,0,1.26),(.14,2.3,.12),'iron')
    roof(0,.15,1.66,2.63,2.75,1.05)
    if not foundry:roof(0,.28,2.28,1.65,1.95,.78)
    for i in range(3):b('Front stone step',(0,-1.36-i*.15,.10+i*.045),(.98+i*.2,.3,.16),'stone')
    door(0,-1.07,.24,.67,1.02)
    for xx in (-.76,.76):window(xx,-1.085,1.02);banner(xx*1.6,-1.12,1.7)
    roof(0,-1.15,1.37,1.34,.95,.52)
    for xx in (-.58,.58):rod('Porch pillar',(xx,-1.55,.1),(xx,-1.55,1.4),.065)
    b('Tall masonry chimney',(.82,.65,2.55),(.35,.42,1.54),'stone');b('Chimney cap',(.82,.65,3.33),(.48,.54,.14),'iron')
    for zz in (2.0,2.4,2.8,3.15):b('Chimney band',(.82,.65,zz),(.38,.45,.07),'iron')
    if foundry:
        b('Furnace wing',(1.1,.2,.62),(.9,1.4,1.15),'iron');window(1.11,-.53,.64)
        cone('Massive foundry exhaust',(1.23,.3,2.0),.31,.25,2.55,M['iron'],vertices=8)
        cone('Foundry exhaust rim',(1.23,.3,3.28),.34,.34,.15,M['ironlight'],vertices=8)
        for zz in (1.1,1.8,2.5):cone('Exhaust iron hoop',(1.23,.3,zz),.32,.32,.09,M['ironlight'],vertices=8)
        orb('Skull crest',(0,-1.1,2.06),(.35,.14,.36),'ivory')
        for xx in (-.13,.13):orb('Skull socket',(xx,-1.235,2.1),(.085,.04,.1),'dark')
        for xx in (-.35,.35):path('Skull sweeping horn',[(xx*.6,-1.08,2.2),(xx*1.45,-1.09,2.4),(xx*1.3,-1.07,2.65)],.075,'ivory')
        for xx in (-1.32,-1.1,-.88):rod('Weapon haft',(xx,-1.35,.15),(xx,-1.35,1.17),.025);tip('Rack spearhead',(xx,-1.35,1.27),.075,.22,'ironlight')

def lantern(p):
    x,y,z=p
    path('Nectar suspension',[(x,y,z+.58),(x+.04,y,z+.4),(x,y,z+.23)],.025,'gold')
    orb('Glowing nectar vessel',(x,y,z),(.2,.2,.27),'amber')
    for a in range(6):
        t=a*math.tau/6
        path('Lantern gold rib',[(x,y,z+.28),(x+.205*math.cos(t),y+.205*math.sin(t),z),(x,y,z-.28)],.015,'gold')
    tip('Nectar vessel finial',(x,y,z-.32),.055,.13,'gold')

def flower(x,y,z,s=1):
    for layer in range(2):
        for i in range(7):
            t=math.tau*(i+.5*layer)/7; r=s*(.66 if layer==0 else .48)
            petal('Layered blossom petal',(x,y,z),(x+math.cos(t)*r,y+math.sin(t)*r,z+s*(.2 if layer==0 else .4)),s*.23,'purple' if layer==0 else 'pink')
    orb('Golden flower heart',(x,y,z+.11*s),(.14*s,.14*s,.08*s),'gold')
    for i in range(7):
        t=i*math.tau/7;rod('Flower stamen',(x,y,z+.1*s),(x+.1*s*math.cos(t),y+.1*s*math.sin(t),z+.24*s),.014,'ivory')

def moonwell():
    base(2,True)
    orb('Shallow healing water',(0,0,.12),(.67,.63,.085),'water')
    for i in range(9):
        t=i*math.tau/9
        path('Basin woven root',[(math.cos(t)*.83,math.sin(t)*.83,.08),(math.cos(t+.2)*.64,math.sin(t+.2)*.64,.26),(math.cos(t+.5)*.45,math.sin(t+.5)*.45,.12)],.105)
    stems=[(-.28,.28,2.46,1.05),(.61,.02,1.6,.67),(-.61,-.22,1.23,.57)]
    for x,y,z,s in stems:
        path('Sculpted flowering stem',[(x*.3,y*.3,.2),(x-.2,y+.15,z*.4),(x+.11,y,z*.72),(x,y,z)],.11*s)
        for k in range(5):
            a=k*2.3;h=.4+k*.26
            leaf('Stem leaf',(x*.7,y*.7,h),(x+math.cos(a)*.6*s,y+math.sin(a)*.6*s,h+.35),.22*s)
        flower(x,y,z,s)
    for x,y,z in [(-.73,-.2,.92),(.72,-.26,1.0)]:
        path('Nectar branch',[(0,.2,.5),(x*.6,y,z+.65),(x,y,z+.58)],.065);lantern((x,y,z))
    for i in range(7):
        t=i*math.tau/7;flower(math.cos(t)*.72,math.sin(t)*.72,.18,.22)

def depot():
    base(2)
    for x in (-.65,.65):
        for y in (-.5,.6):rod('Shed post',(x,y,.1),(x,y,1.45),.085)
    roof(-.15,.15,1.45,1.8,1.8,.65)
    for row in range(3):
        for j in range(4-row):
            x=-.5+j*.24+row*.12;z=.22+row*.23
            rod('Cut stacked log',(x,-.92,z),(x,.37,z),.13,'wood');ob=cone('Light cut log end',(x,-.94,z),.105,.105,.028,M['woodlight']);ob.rotation_euler[0]=math.pi/2
    rod('Crane upright',(.78,.48,.1),(.78,.48,2.7),.095)
    rod('Crane cantilever',(.78,.48,2.65),(1.0,-.95,2.3),.09)
    rod('Crane brace',(.78,.48,1.8),(1,-.65,2.37),.06)
    path('Pulley rope',[(.78,.48,2.7),(1,-.95,2.36),(1,-.95,.75)],.018,'ivory');orb('Pulley',(1,-.95,2.32),(.1,.07,.1),'iron')
    rod('Suspended log',(.76,-.95,.7),(1.16,-.95,.7),.17)

def tower():
    base(2)
    for x in (-.57,.57):
        for y in (-.57,.57):rod('Tall tower leg',(x*1.2,y*1.2,.1),(x,y,2.8),.13)
    for z in (.7,1.6,2.45):
        for y in (-.6,.6):rod('Tower side crossbeam',(-.62,y,z),(.62,y,z),.085)
        rod('Tower diagonal',(-.63,-.61,z-.5),(.63,-.61,z+.45),.065)
    b('Raised firing deck',(0,0,2.65),(1.65,1.65,.18))
    for x in (-.75,.75):
        for y in (-.75,.75):rod('Platform canopy post',(x,y,2.5),(x,y,3.55),.075)
    for y in (-.76,.76):b('Platform parapet',(0,y,2.92),(1.65,.09,.32),'woodlight')
    roof(0,0,3.5,1.85,1.85,.7)
    for x in (-.25,.25):rod('Ladder rail',(x,-1.03,.08),(x,-.75,2.68),.035)
    for i in range(11):rod('Ladder rung',(-.27,-1.03+i*.027,.2+i*.23),(.27,-1.03+i*.027,.2+i*.23),.025)
    banner(.77,-.72,2.7)

def elderheart():
    base(3,True)
    for i in range(8):
        a=i*math.tau/8
        path('Ancient spreading root',[(math.cos(a)*1.35,math.sin(a)*1.35,.03),(math.cos(a)*.73,math.sin(a)*.73,.23),(.12*math.cos(a),.12*math.sin(a),1.2)],.17)
    for i in range(7):
        a=i*math.tau/7
        path('Twisting trunk',[(math.cos(a)*.48,math.sin(a)*.48,.15),(math.cos(a+.35)*.35,math.sin(a+.35)*.35,1.1),(math.cos(a+.7)*.39,math.sin(a+.7)*.39,2.15),(math.cos(a+1)*.8,math.sin(a+1)*.8,2.8)],.22)
    door(0,-.52,.16,.5,1.05)
    for x,y,z in [(-.58,-.2,1.75),(.5,-.3,2.08)]:orb('Tree amber hollow',(x,y,z),(.16,.1,.23),'amber')
    for i in range(9):
        a=i*2.4;r=.6+(i%3)*.24;z=2.45+(i%3)*.28;x=math.cos(a)*r;y=math.sin(a)*r
        path('Canopy branch',[(0,0,1.4),(x*.55,y*.55,z-.3),(x,y,z)],.12)
        for j in range(13):
            t=j*2.4;rr=.44*math.sqrt(j/13)
            leaf('Sculpted teal canopy leaf',(x+rr*math.cos(t),y+rr*math.sin(t),z),(x+rr*math.cos(t)+.28*math.cos(t+.8),y+rr*math.sin(t)+.28*math.sin(t+.8),z+.2),.22,'leaflight' if j%3==0 else 'leaf')
    for x in (-1.0,1.):lantern((x,-.24,1.05))
    for i in range(4):b('Root doorstep',(0,-.74-i*.14,.09+i*.025),(.66+i*.14,.24,.12),'stone')

def pavilion():
    base(3,True)
    for i in range(8):
        a=i*math.tau/8;x=math.cos(a)*1.03;y=math.sin(a)*1.03
        path('Pavilion gold arch',[(x,y,.12),(x*1.05,y*1.05,1.4),(x*.7,y*.7,2.0),(0,0,2.45)],.065,'gold')
        petal('Ivory canopy petal',(x*1.13,y*1.13,1.74),(0,0,2.5),.57,'ivory')
        leaf('Eave leaf',(x,y,1.6),(x*1.4,y*1.4,2.02),.2)
        if i%2==0:lantern((x*.92,y*.92,1.2))
    tip('Pavilion spire',(0,0,2.93),.11,.95,'gold');orb('Spire gem',(0,0,2.75),(.14,.14,.17),'purple')
    for i in range(4):b('Pavilion entry step',(0,-1.0-i*.14,.08+i*.022),(1.0+i*.1,.22,.12),'stone')

def thornwatch():
    base(2,True)
    for i in range(6):
        a=i*math.tau/6
        pts=[(math.cos(a+k*.5)*(.67-.1*k),math.sin(a+k*.5)*(.67-.1*k),.1+k*.57) for k in range(5)]
        path('Intertwined thorn tower',pts,.13)
        for k in range(1,4):
            p=pts[k];e=(p[0]+math.cos(a+k*.5)*.38,p[1]+math.sin(a+k*.5)*.38,p[2]+.32)
            ob=rod('Large sculpted thorn',p,e,.07,'bark');tip('Thorn point',e,.06,.21,'gold')
        leaf('Tower curling leaf',pts[1],(math.cos(a)*.95,math.sin(a)*.95,1.35),.22)
    for i in range(5):
        a=i*2.4;r=0 if i==0 else .28;x=math.cos(a)*r;y=math.sin(a)*r;h=1.4 if i==0 else .8
        cone('Violet crystal shard',(x,y,2.45+h*.22),.19,.13,h*.6,M['purple'],vertices=5);cone('Crystal pointed crown',(x,y,2.45+h*.7),.13,0,h*.4,M['pink'],vertices=5)

BUILDERS={'orc-hq':hall,'orc-barracks':lambda:hall(True),'orc-depot':depot,'orc-tower':tower,'fairy-hq':elderheart,'fairy-depot':moonwell,'fairy-barracks':pavilion,'fairy-tower':thornwatch}
def state_geometry(asset,state,frame):
    if state=='death':
        reset_scene();palette();fairy=asset.startswith('fairy');size=3 if asset.endswith(('hq','barracks')) else 2;base(size,fairy)
        for i in range(24):
            x=R.uniform(-size*.4,size*.4);y=R.uniform(-size*.4,size*.4)
            ob=b('Broken timber debris',(x,y,R.uniform(.05,.2)),(R.uniform(.25,.7),.12,.12),'bark' if fairy else 'woodlight');ob.rotation_euler[2]=R.random()*math.tau
            if i%3==0:orb('Rubble',(x,y,.13),(.18,.15,.14),'stone')
            if fairy and i%2==0:leaf('Fallen leaf',(x,y,.08),(x+.35,y+.1,.12),.17,'purple')
        return
    if state=='construction':
        height=max((o.matrix_world @ Vector(c)).z for o in bpy.context.scene.objects if o.type=='MESH' for c in o.bound_box)
        cutoff=height*(.22+frame*.27)
        for o in bpy.context.scene.objects:
            if o.type in ('MESH','CURVE') and o.location.z>cutoff:o.hide_render=True
            elif o.type in ('MESH','CURVE'):
                coords=[(o.matrix_world @ Vector(c)).z for c in o.bound_box]
                if coords and min(coords)>cutoff:o.hide_render=True
                elif coords and o.type=='CURVE' and max(coords)>cutoff and min(coords)<.35:o.scale.z*=cutoff/max(coords)
        s=1.35 if asset.endswith(('hq','barracks')) else .9
        for x in (-s,s):
            for y in (-s,s):rod('Construction scaffold upright',(x,y,.1),(x,y,cutoff+.25),.045,'woodlight')
        for z in [.35+j*.45 for j in range(max(1,int(cutoff/.45)))]:
            for y in (-s,s):rod('Scaffold horizontal',(-s,y,z),(s,y,z),.035,'woodlight')
        for i in range(5):b('Construction planks',(-s+.1+i*.16,s,.18),(.13,.85,.08),'woodlight')

def export(asset,sample=False,only_state=None):
    R.seed(912+list(BUILDERS).index(asset));reset_scene();palette();BUILDERS[asset]()
    wide=asset.endswith(('hq','barracks'));w=384 if wide else 256;anchor=[w//2,288]
    setup_render(w,384,anchor,samples=32)
    save(ROOT/'scenes'/f'building-{asset}.blend')
    out=ROOT/'raw'/'buildings'/asset;out.mkdir(parents=True,exist_ok=True)
    states=[('idle',0)] if sample else [('idle',0),('construction',0),('construction',1),('construction',2),('death',0)]
    for state,frame in states:
        if only_state and state!=only_state:continue
        if state!='idle':
            R.seed(912+list(BUILDERS).index(asset));reset_scene();palette();BUILDERS[asset]();state_geometry(asset,state,frame);setup_render(w,384,anchor,samples=32)
        render(out/f'{state}-0-{frame:02}.png')
    (out/'meta.json').write_text(json.dumps({'id':asset,'kind':'building','width':w,'height':384,'anchor':anchor,'animations':{'idle':{'frames':1,'fps':1,'loop':True},'construction':{'frames':3,'fps':1,'loop':False},'death':{'frames':1,'fps':1,'loop':False}}},indent=2))
if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--sample',action='store_true');ap.add_argument('--all',action='store_true');ap.add_argument('--asset',choices=list(BUILDERS));ap.add_argument('--state',choices=['idle','construction','death']);args=ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    ids=[args.asset] if args.asset else ['orc-hq','fairy-depot'] if args.sample else list(BUILDERS)
    for asset in ids:export(asset,args.sample,args.state)

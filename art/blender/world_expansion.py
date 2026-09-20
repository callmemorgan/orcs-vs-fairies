"""Tideborn, Automata and seeded-map terrain, modeled from the saved ImageGen sheet.
Every delivered image is rendered from these editable Blender objects and actions.
"""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
import common as C
from units import group, pivot, loft, ANIMS
BASE=Path(__file__).resolve().parent
UNITS=[f'{f}-{r}' for f in ('tideborn','automata') for r in ('worker','melee','ranged','special')]
BUILDINGS=[f'{f}-{r}' for f in ('tideborn','automata') for r in ('hq','depot','barracks','tower')]
ENV={'crystal':(128,144,[64,112]),'reeds':(128,128,[64,100]),**{f'tile-{t}':(64,64,[32,44]) for t in ('water','shallows','mud','rock','bridge')}}

def palette():
    colors={'sea':'529e94','seaDark':'275e61','coral':'d98564','shell':'dfd6b2','shellShade':'aa9c7b','sand':'a29979','kelp':'3d7462','bronze':'816540','ceramic':'d4cbb4','dark':'2c353c','crystal':'9473e6','glow':'bc9aff','wood':'755a3a','water':'387986','shallow':'5b9b98','mud':'74634d','rock':'697980','reed':'849859'}
    return {k:C.material(k,v,metallic=.55 if k=='bronze' else 0,emission=1.1 if k in ('crystal','glow') else 0) for k,v in colors.items()}

def ring(name,pos,r,thick,mat):
    bpy.ops.mesh.primitive_torus_add(major_radius=r,minor_radius=thick,major_segments=24,minor_segments=6,location=pos)
    o=bpy.context.object;o.name=name;o.data.materials.append(mat);return o

def crystal(name,pos,r,h,m):
    x,y,z=pos
    C.cone(name+' hexagonal body',(x,y,z+h*.32),r,r,h*.64,m['crystal'],6)
    C.cone(name+' pointed crown',(x,y,z+h*.82),r,0,h*.36,m['glow'],6)

def shell(name,pos,scale,m):
    x,y,z=pos
    C.uv(name+' ivory volume',(x,y,z),(.40*scale,.44*scale,.43*scale),m['shell'],16,12)
    points=[]
    for i in range(49):
        t=i/48;a=t*math.pi*4;r=(.40-.34*t)*scale
        points.append((x+(.15+.30*t)*scale,y+math.cos(a)*r,z+math.sin(a)*r))
    C.curve(name+' spiral ridge',points,.027*scale,m['shellShade'])
    for i in range(11):
        a=i*math.tau/11
        C.curve(name+' radial growth ridge',[(x-.13*scale,y+math.cos(a)*.30*scale,z+math.sin(a)*.30*scale),(x+.04*scale,y+math.cos(a)*.42*scale,z+math.sin(a)*.42*scale),(x+.19*scale,y+math.cos(a)*.34*scale,z+math.sin(a)*.34*scale)],.008*scale,m['shellShade'])

def coral(name,pos,h,m):
    x,y,z=pos
    C.curve(name+' main',[(x,y,z),(x-.05,y,z+h*.5),(x+.03,y,z+h)],.045,m['coral'])
    for sign in (-1,1):C.curve(name+' branch',[(x,y,z+h*.35),(x+sign*h*.22,y,z+h*.58),(x+sign*h*.22,y,z+h*.86)],.034,m['coral'])

def unit(asset,m):
    tide=asset.startswith('tideborn');role=asset.split('-')[1];root=pivot('POSE root',(0,0,0));rig={'root':root}
    if not tide and role=='special':
        def body():
            C.cone('ward engine chassis',(0,0,.61),.52,.48,.23,m['bronze'],10)
            C.cone('ceramic platform',(0,0,.77),.43,.40,.15,m['ceramic'],10)
            for x in (-.31,.31):
                for y in (-.31,.31):C.uv('hip bearing',(x,y,.57),(.16,.16,.16),m['dark'])
        rig['body']=group('POSE body',(0,0,.6),root,body)
        for front in (-1,1):
            for side in (-1,1):
                def leg(front=front,side=side):
                    C.beam('bronze leg',(front*.28,side*.28,.61),(front*.60,side*.55,.40),.09,m['bronze'])
                    plate=C.box('ceramic leg plate',(front*.54,side*.51,.42),(.40,.22,.18),m['ceramic']);plate.rotation_euler.y=front*.5
                    C.beam('lower strut',(front*.60,side*.55,.40),(front*.76,side*.69,.10),.07,m['dark'])
                    C.box('wide foot',(front*.78,side*.69,.07),(.26,.23,.13),m['bronze'])
                rig[f'leg{front},{side}']=group(f'POSE leg {front} {side}',(front*.3,side*.3,.6),root,leg)
        def focus():
            crystal('ward focus',(0,0,.84),.16,.78,m)
            ring('lower ward ring',(0,0,1.00),.54,.035,m['bronze']);ring('upper ward ring',(0,0,1.28),.57,.035,m['bronze'])
            for i in range(4):
                a=i*math.pi/2;C.beam('ring support',(math.cos(a)*.52,math.sin(a)*.52,.8),(math.cos(a)*.57,math.sin(a)*.57,1.30),.025,m['bronze'])
        rig['weapon']=group('POSE focus',(0,0,.84),rig['body'],focus)
    else:
        height=1.0 if role=='worker' and not tide else 1.2
        width=.36 if role=='melee' and not tide else .29 if role=='melee' else .22
        def body():
            if tide:
                loft('amphibian torso',[(.46,0,0,.18,.21),(.85,0,0,width,width*1.25),(1.18,0,0,.19,.24)],m['sea'])
                C.uv('pale belly',(.17,0,.85),(.10,.20,.31),m['shell'])
                C.cone('woven waist belt',(0,0,.53),.25,.25,.10,m['wood'],12)
                if role=='special':
                    for side in (-1,1):
                        for j in range(3):C.curve('kelp mantle',[(-.08,side*.19,1.24),(-.19,side*(.29+j*.08),.91),(-.37,side*(.31+j*.09),.32)],.08,m['kelp'])
                if role=='worker':
                    C.cone('gathering basket',(-.28,0,.86),.23,.30,.48,m['wood'],12)
                    ring('basket rim',(-.28,0,1.11),.30,.035,m['shellShade'])
                    for i in range(8):
                        a=i*math.pi/4;C.beam('basket wicker',(-.28+math.cos(a)*.24,math.sin(a)*.24,.62),(-.28+math.cos(a)*.30,math.sin(a)*.30,1.1),.018,m['shellShade'])
            else:
                C.uv('bronze core',(0,0,.78),(.27,.26,.28),m['bronze'])
                C.uv('ceramic chest',(.04,0,.90),(width+.07,width+.07,.27),m['ceramic'])
                C.uv('violet heart',(.29,0,.88),(.04,.09,.09),m['crystal'])
                C.cone('waist bearing',(0,0,.55),.16,.16,.15,m['dark'])
                for side in (-1,1):
                    C.uv('shoulder joint',(0,side*(width+.08),1.0),(.11,.11,.11),m['bronze'])
                    if role=='melee':
                        C.box('sentinel shoulder armor',(0,side*.39,1.11),(.38,.31,.28),m['ceramic'],.06)
                        C.box('shoulder bronze trim',(.19,side*.39,1.11),(.025,.29,.22),m['bronze'])
        rig['body']=group('POSE body',(0,0,.55),root,body)
        def head():
            if tide:
                C.uv('fin-crested head',(.05,0,1.39),(.24,.25,.22),m['sea'])
                C.uv('broad amphibian muzzle',(.25,0,1.32),(.13,.23,.10),m['seaDark'])
                for side in (-1,1):
                    C.uv('ivory eye',(.22,side*.16,1.46),(.047,.052,.046),m['shell'])
                    C.uv('black pupil',(.26,side*.17,1.465),(.023,.025,.024),m['dark'])
                    fin=C.mesh('cheek fin',[(-.06,side*.19,1.43),(-.25,side*.37,1.53),(-.19,side*.32,1.25)],[(0,1,2)],m['coral'])
                    for j in range(3):
                        C.beam('cheek fin ray',(-.05,side*.20,1.40),(-.23,side*.35,1.28+j*.11),.009,m['shellShade'])
                    for j in range(3):
                        C.curve('neck gill fold',[(-.12,side*.21,1.28-j*.045),(-.02,side*.245,1.27-j*.045),(.06,side*.21,1.26-j*.045)],.012,m['seaDark'])
                if role=='special':
                    for side in (-1,1):coral('coral antler',(-.07,side*.16,1.54),.53,m)
                elif role=='ranged':C.mesh('tall dorsal crest',[(-.13,-.02,1.48),(-.28,-.02,1.93),(.08,-.02,1.59),(-.13,.02,1.48),(-.28,.02,1.93),(.08,.02,1.59)],[(0,1,2),(3,5,4),(0,3,4,1)],m['coral'])
                elif role=='melee':C.uv('shell helmet',(-.04,0,1.57),(.26,.27,.15),m['shell'])
            else:
                C.uv('round ceramic head',(.03,0,1.28),(.22,.23,.21),m['ceramic'])
                eye=C.cone('bronze lens rim',(.23,0,1.29),.125,.125,.06,m['bronze'],16);eye.rotation_euler.y=math.pi/2
                C.uv('single violet lens',(.27,0,1.29),(.025,.087,.087),m['glow'])
                for a in range(6):
                    t=a*math.tau/6
                    C.uv('lens bezel screw',(.269,math.cos(t)*.107,1.29+math.sin(t)*.107),(.012,.012,.012),m['ceramic'])
                for side in (-1,1):
                    C.curve('ceramic head panel seam',[(-.08,side*.17,1.42),(.015,side*.226,1.29),(-.08,side*.17,1.13)],.010,m['bronze'])
                if role=='ranged':crystal('prism crest',(-.05,0,1.46),.085,.32,m)
        rig['head']=group('POSE head',(0,0,1.16),rig['body'],head)
        for side in (-1,1):
            def leg(side=side):
                if tide:
                    C.beam('thigh',(0,side*.15,.55),(-.09,side*.19,.29),.09,m['sea'])
                    C.beam('shin',(-.09,side*.19,.29),(.05,side*.23,.08),.06,m['seaDark'])
                    for j in range(3):C.beam('webbed toe',(.05,side*.23,.07),(.30,side*.23+(j-1)*.085,.025),.025,m['sea'])
                    C.mesh('foot web',[(.02,side*.23,.04),(.30,side*.23-.085,.025),(.30,side*.23+.085,.025)],[(0,1,2)],m['sea'])
                else:
                    C.beam('upper piston',(0,side*.16,.53),(-.08,side*.24,.29),.065,m['bronze'])
                    C.uv('knee bearing',(-.08,side*.24,.29),(.085,.085,.085),m['dark'])
                    C.beam('lower piston',(-.08,side*.24,.29),(.04,side*.27,.10),.065,m['bronze'])
                    C.box('ceramic greave',(-.015,side*.255,.22),(.17,.16,.24),m['ceramic'])
                    C.box('metal foot',(.09,side*.27,.055),(.32,.25,.11),m['dark'])
            rig[f'leg{side}']=group(f'POSE leg {side}',(0,side*.17,.52),root,leg)
            def arm(side=side):
                C.beam('upper arm',(0,side*.26,1.09),(.02,side*.40,.86),.07 if tide else .075,m['sea' if tide else 'bronze'])
                C.uv('elbow',(.02,side*.40,.86),(.075,.075,.075),m['seaDark' if tide else 'dark'])
                C.beam('forearm',(.02,side*.40,.86),(.32,side*.36,.86),.065,m['sea' if tide else 'bronze'])
                C.uv('hand',(.32,side*.36,.86),(.065,.065,.065),m['sea' if tide else 'dark'])
                if not tide and role=='melee':
                    C.box('arm shield',(.20,side*.48,.90),(.20,.34,.78),m['ceramic'],.06)
                    C.box('shield bronze border',(.295,side*.48,.90),(.025,.30,.69),m['bronze'])
            rig[f'arm{side}']=group(f'POSE arm {side}',(0,side*.26,1.08),rig['body'],arm)
        def weapon():
            y=-.38
            if role=='worker':
                if tide:
                    C.beam('spade haft',(.33,y,.30),(.33,y,1.13),.035,m['wood']);C.box('shell spade blade',(.33,y,.23),(.27,.055,.30),m['shell'])
                else:
                    C.box('tool grip',(.34,y,.75),(.09,.09,.32),m['bronze']);C.box('tool head',(.35,y,.96),(.34,.15,.15),m['dark'])
                    C.box('resource crate',(.18,.45,.70),(.35,.32,.37),m['wood'])
                    crystal('stored shard',(.18,.45,.91),.075,.25,m)
            elif role=='melee' and tide:
                C.beam('trident haft',(.34,y,.15),(.34,y,1.55),.035,m['wood'])
                for j in (-1,0,1):
                    C.beam('coral tine',(.34,y,1.39),(.34+j*.14,y,1.56),.034,m['coral']);C.cone('trident point',(.34+j*.14,y,1.69),.04,0,.26,m['coral'],6)
                shield=C.uv('broad shell shield',(.13,.48,.87),(.14,.36,.51),m['shell'],16,10)
                for j in (-1,0,1):C.curve('shell shield ribs',[(.27,.48+j*.22,.52),(.30,.48+j*.27,.86),(.27,.48+j*.18,1.23)],.023,m['coral'])
            elif role=='ranged':
                C.box('launcher stock',(.26,y,.88),(.48,.16,.14),m['wood' if tide else 'bronze'])
                C.beam('launcher barrel',(.40,y,.95),(1.13,y,.95),.085,m['bronze'])
                for x in (.48,.84):
                    o=C.cone('barrel ring',(x,y,.95),.115,.115,.08,m['shell' if tide else 'ceramic']);o.rotation_euler.y=math.pi/2
                if tide:
                    C.beam('harpoon shaft',(.50,y,.95),(1.29,y,.95),.025,m['shell'])
                    tip=C.cone('harpoon point',(1.36,y,.95),.07,0,.22,m['shell'],6);tip.rotation_euler.y=math.pi/2
                    C.curve('harpoon rope',[(.25,y,.84),(.52,y-.08,.65),(.94,y-.07,.80)],.014,m['wood'])
                else:
                    focus=C.cone('beam prism',(1.16,y,.95),.13,0,.36,m['crystal'],6);focus.rotation_euler.y=math.pi/2
            elif tide:
                C.beam('tide staff',(.34,y,.07),(.34,y,1.79),.035,m['wood']);shell('staff conch',(.34,y,1.93),.50,m)
                for j in (-1,1):C.curve('staff kelp',[(.34,y+j*.08,1.81),(.26,y+j*.1,1.60),(.34,y+j*.15,1.45)],.025,m['kelp'])
        rig['weapon']=group('POSE equipment',(.31,-.36,.86),rig['arm-1'],weapon)
    for o in rig.values():o['rest_location']=list(o.location);o['rest_rotation']=list(o.rotation_euler)
    return rig

def pose(rig,asset,state,frame,count,direction=0,key=False):
    for o in rig.values():o.location=o['rest_location'];o.rotation_euler=o['rest_rotation'];o.scale=(1,1,1)
    t=frame/max(1,count-1);phase=frame/count*math.tau;root=rig['root'];root.rotation_euler.z=-direction*math.pi/4
    if state=='idle':rig['body'].location.z+=.01*math.sin(phase)
    if state=='walk':
        for name,o in rig.items():
            if name.startswith('leg'):o.rotation_euler.y=(1 if name.endswith('1') and not name.endswith('-1') else -1)*.28*math.sin(phase)
            elif name.startswith('arm'):o.rotation_euler.y=(1 if name.endswith('-1') else -1)*.14*math.sin(phase)
        rig['body'].location.z+=.025*abs(math.sin(phase))
    if state=='attack':
        if asset.endswith(('worker','melee')) and 'arm-1' in rig:rig['arm-1'].rotation_euler.y=[.35,.75,-.65,-.30,-.08,0][frame]
        elif asset=='tideborn-special':
            for sign in (-1,1):rig[f'arm{sign}'].rotation_euler.x=sign*.55*math.sin(math.pi*t)
        elif asset=='automata-special':rig['weapon'].scale=(1+.12*math.sin(math.pi*t),)*3
        else:rig['weapon'].location.x-=[0,.01,.14,.08,.02,0][frame]
    if state=='death':root.rotation_euler.y=-1.47*t;root.location.z=.10*t;root.location.x=.35*t*math.cos(-direction*math.pi/4);root.location.y=.35*t*math.sin(-direction*math.pi/4)
    if state=='death' and asset=='automata-special':
        # A broad four-legged chassis tips beyond the infantry canvas when it
        # rotates about its feet. Keep its collapsing footprint at the anchor.
        bpy.context.view_layer.update()
        bounds=[o.matrix_world@Vector(c) for o in bpy.context.scene.objects if o.type in ('MESH','CURVE') for c in o.bound_box]
        root.location.x-=(min(v.x for v in bounds)+max(v.x for v in bounds))*.5*t
        root.location.y-=(min(v.y for v in bounds)+max(v.y for v in bounds))*.5*t
        root.location.z-=min(0,min(v.z for v in bounds))
    if key:
        for o in rig.values():
            for prop in ('location','rotation_euler','scale'):o.keyframe_insert(data_path=prop,frame=frame+1,group=state)
    bpy.context.view_layer.update()

def door(x,y,h,w,m,tide):
    C.box('dark arched doorway',(x,y,h*.43),(w,.06,h*.8),m['dark'])
    C.curve('door arch',[(x-w*.62,y-.05,.18),(x-w*.62,y-.05,h*.75),(x,y-.05,h),(x+w*.62,y-.05,h*.75),(x+w*.62,y-.05,.18)],.085,m['coral' if tide else 'bronze'])

def building(asset,m,state='idle',frame=0):
    tide=asset.startswith('tideborn');role=asset.split('-')[1];wide=role in ('hq','barracks');r=1.27 if wide else .82
    C.box('foundation',(0,0,.09),(2*r+.2,2*r+.2,.18),m['sand' if tide else 'dark'])
    if state=='death':
        for i in range(15):
            a=i*2.399;C.box('fallen rubble',(math.cos(a)*r*.75,math.sin(a)*r*.75,.15+(i%3)*.08),(.37,.32,.22),m['sand' if tide else 'ceramic'])
        if not tide:crystal('broken core',(.2,.1,.12),.13,.30,m)
        return
    if tide:
        if role=='depot':
            C.cone('basin water',(0,0,.33),.74,.74,.07,m['water'],24)
            for i in range(16):
                a=i*math.tau/16;o=C.box('basin stone',(math.cos(a)*.78,math.sin(a)*.78,.35),(.31,.23,.36),m['sand']);o.rotation_euler.z=a
            for x in (-.55,.55):C.box('shell supply crate',(x,-.78,.32),(.35,.3,.35),m['wood'])
            coral('basin coral',(-.5,.53,.35),.6,m)
        elif role=='tower':
            C.cone('conch tower base',(0,0,.88),.65,.47,1.55,m['sand'],8)
            for z in (.30,.70,1.10,1.50):ring('tower sandstone courses',(0,0,z),.65-(z-.1)*.116,.023,m['shellShade'])
            for x in (-.43,.43):C.beam('coral buttress',(x,0,.15),(x*.8,0,1.95),.09,m['coral'])
            shell('tower conch',(0,0,2.05),1.25,m)
            mouth=C.cone('shell cannon mouth',(.49,0,2.05),.25,.25,.20,m['shellShade'],16);mouth.rotation_euler.y=math.pi/2
            C.uv('tidal aperture',(.60,0,2.05),(.015,.19,.19),m['water'])
            coral('spire coral',(-.35,.1,1.3),.7,m)
        else:
            for y in (-r+.12,r-.12):
                for z in (.35,.65,.95):
                    for j in range(6):C.box('sandstone course',(-r+(j+.5)*2*r/6,y,z),(2*r/6-.025,.25,.28),m['sand'])
            for x in (-r+.12,r-.12):
                for z in (.35,.65,.95):
                    for j in range(6):C.box('side sandstone course',(x,-r+(j+.5)*2*r/6,z),(.25,2*r/6-.025,.28),m['sand'])
                C.box('coral wall coping',(x,0,1.14),(.29,2*r,.12),m['coral'])
            for x in (-r+.05,r-.05):
                for y in (-r+.05,r-.05):C.curve('coral arch rib',[(x,y,.1),(x*.91,y*.91,1.4),(x*.6,y*.6,1.8)],.12,m['coral'])
            door(0,-r-.05,1.12,.65,m,True)
            if role=='hq':
                C.cone('shell dome support',(0,.15,1.21),.95,.83,.18,m['shellShade'],16);shell('headquarters shell',(0,.15,1.88),1.85,m)
                for x in (-.86,.86):coral('hold coral',(x,.1,.92),.8,m)
            else:
                C.mesh('sail canopy',[(-r,-r,1.30),(r,-r,1.30),(r,r,1.30),(-r,r,1.30),(0,0,2.24)],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],m['shell'])
                for x in (-r,r):
                    for y in (-r,r):C.beam('sail support',(x,y,.18),(x,y,1.76),.04,m['wood']);C.curve('sail rope',[(x,y,1.75),(x*.4,y*.4,1.76),(0,0,2.25)],.018,m['wood'])
                for x in (-.62,.62):door(x,-r-.09,.9,.43,m,True)
    else:
        height=1.25 if wide else .62 if role=='depot' else 1.8
        if role=='tower':
            C.cone('prism pedestal',(0,0,.95),.48,.30,1.72,m['ceramic'],8)
            for z in (.25,.67,1.12,1.63):ring('pedestal bronze collar',(0,0,z),.49-(z-.2)*.105,.04,m['bronze'])
            for i in range(8):
                a=i*math.pi/4;C.beam('bronze pedestal rib',(math.cos(a)*.48,math.sin(a)*.48,.2),(math.cos(a)*.31,math.sin(a)*.31,1.75),.027,m['bronze'])
            for i in range(3):
                a=i*math.tau/3;x,y=math.cos(a)*.42,math.sin(a)*.42;C.beam('prism fork',(0,0,1.50),(x,y,1.90),.09,m['bronze']);crystal('defensive prism',(x,y,1.93),.12,.58,m)
        else:
            for y in (-r+.14,r-.14):
                for j in range(5):C.box('ceramic wall panel',(-r+(j+.5)*2*r/5,y,height/2+.2),(2*r/5-.04,.28,height),m['ceramic'])
            for x in (-r+.14,r-.14):
                for j in range(5):
                    C.box('side armor panel',(x,-r+(j+.5)*2*r/5,height/2+.2),(.28,2*r/5-.035,height),m['ceramic'])
                    C.box('panel fastening',(x+(.15 if x>0 else -.15),-r+(j+.5)*2*r/5,height*.65),(.035,.09,.10),m['bronze'])
                C.box('lower bronze course',(x,0,.30),(.31,2*r,.09),m['bronze'])
            C.box('bronze roof rim',(0,0,height+.22),(2*r+.1,2*r+.1,.15),m['bronze'])
            door(0,-r-.03,min(height,1.1),.65,m,False)
            if role=='hq':
                C.cone('core turbine',(0,0,1.50),.78,.66,.42,m['bronze'],12);crystal('foundry core',(0,0,1.63),.35,1.0,m)
                for sign in (-1,1):C.curve('ceramic core arch',[(sign*.93,.1,.18),(sign*.87,.1,1.9),(sign*.35,.1,2.61)],.16,m['ceramic'])
                for x in (-.85,.85):C.cone('short chimney',(x,.77,1.75),.14,.14,.9,m['bronze'])
            elif role=='depot':
                roof=C.box('sloped depot roof',(0,0,1.0),(1.7,1.6,.16),m['dark']);roof.rotation_euler.x=.18
                for x in (-.53,.53):C.cone('storage silo',(x,.69,1.09),.22,.22,1.36,m['bronze'],12);ring('silo rim',(x,.69,1.78),.21,.026,m['ceramic'])
                for x in (-.42,0,.42):crystal('stored crystal',(x,-.80,.20),.10,.40,m)
            else:
                C.box('assembly roof',(0,0,1.50),(2.45,2.45,.18),m['ceramic'])
                for x in (-.7,.7):
                    C.cone('exhaust pipe',(x,.77,1.98),.15,.15,1.0,m['bronze']);ring('exhaust collar',(x,.77,2.42),.15,.03,m['ceramic'])
                    door(x,-r-.08,1.12,.5,m,False)
                for x in (-.55,0,.55):C.box('roof vent',(x,-.1,1.64),(.31,.9,.08),m['dark'])
    if state=='construction':
        bpy.context.view_layer.update();limit=(.8,1.5,2.3)[frame]
        for o in bpy.context.scene.objects:
            if o.type=='MESH' and min((o.matrix_world@Vector(c)).z for c in o.bound_box)>limit:o.hide_render=True
        for x in (-r,r):
            for y in (-r,r):C.beam('construction upright',(x,y,.1),(x,y,limit+.15),.04,m['wood'])
        for y in (-r,r):C.beam('scaffold rail',(-r,y,limit),(r,y,limit),.04,m['wood'])

def environment(asset,m):
    # Environment-only materials and forms keep the faction models unchanged.
    import random
    import environment as E
    from scenery_forms import branch, blade, fissure
    rng=random.Random(901+sum(map(ord,asset)));E.R.seed(901+sum(map(ord,asset)))
    if asset=='crystal':
        violet=C.material('mineral amethyst','9675cc',roughness=.28)
        light=C.material('amethyst pale growth face','c3a4ef',roughness=.3)
        dark=C.material('amethyst shaded face','684c99',roughness=.35)
        for i in range(9):
            a=i*2.399;r=.11+(i%3)*.20;x,y=math.cos(a)*r,math.sin(a)*r
            E.rock('crystal host matrix',(x,y,0),(.24,.20,.22),m['rock'])
            if i>6:continue
            radius=.10+(i%2)*.045;h=.48+(i%3)*.22;verts=[]
            for z,rr,offset in ((0,.84,0),(h*.68,1,.025),(h*.89,.56,.04),(h,0,.06)):
                for k in range(6):
                    angle=k*math.tau/6
                    verts.append((math.cos(angle)*radius*rr+offset,math.sin(angle)*radius*rr,z))
            faces=[tuple(range(5,-1,-1))]
            for row in range(3):
                for k in range(6):faces.append((row*6+k,row*6+(k+1)%6,(row+1)*6+(k+1)%6,(row+1)*6+k))
            obj=C.mesh('amethyst terminated crystal',verts,faces,violet);obj.data.materials.append(light);obj.data.materials.append(dark)
            for f in obj.data.polygons:f.material_index=(f.index+i)%3
            obj.location=(x,y,.10);obj.rotation_euler=(math.cos(a)*.17,math.sin(a)*.17,a)
            for band in range(2):
                z=h*(.27+band*.16);rr=radius*(.84+.16*z/(h*.68))
                detail=C.curve('crystal growth striation',[(math.cos(k*math.tau/6)*rr+.025*z/(h*.68),math.sin(k*math.tau/6)*rr,z) for k in range(7)],.003,light);detail.parent=obj
        for i in range(7):
            a=i*2.4;E.rock('amethyst fallen splinter',(math.cos(a)*.65,math.sin(a)*.54,.015),(.045,.035,.11),violet)
    elif asset=='reeds':
        pale=C.material('reed fresh leaf','a0ad68');seed=C.material('cattail velvet seed head','6b4e31')
        for i in range(13):
            a=i*2.399;r=.10+(i%3)*.12;x,y=math.cos(a)*r,math.sin(a)*r;h=.42+(i%5)*.09
            tip=(x+math.cos(a)*.09,y+math.sin(a)*.09,h)
            branch('jointed reed stalk',[(x,y,0),(x+.015,y,h*.55),tip],[.012,.010,.004],m['reed'],6)
            for side in (-1,1):
                angle=a+side*.8
                blade('arching reed ribbon',[(x,y,h*.18),(x+math.cos(angle)*.12,y+math.sin(angle)*.12,h*.66),(x+math.cos(angle)*.26,y+math.sin(angle)*.26,h*.54)],[.004,.025,0],pale if side==1 else m['reed'])
            if i%3==0:
                C.uv('cattail seed cylinder',(tip[0],tip[1],h-.025),(.028,.028,.095),seed)
                branch('cattail dry tip',[(tip[0],tip[1],h+.055),(tip[0],tip[1],h+.12)],[.007,.002],m['wood'],6)
    else:
        kind=asset[5:];mat={'water':'water','shallows':'shallow','mud':'mud','rock':'rock','bridge':'wood'}[kind]
        C.box('terrain tile',(0,0,-.015),(1,1,.025),m[mat],0)
        if kind=='bridge':
            worn=C.material('bridge worn heartwood','96794f');iron=C.material('bridge iron nails','3c443e',metallic=.5)
            for x in (-.34,.34):C.box('bridge supporting sleeper',(x,0,.013),(.10,1,.08),m['wood'],.01)
            for i in range(7):
                y=-.45+i*.15
                C.box('individual bridge plank',(0,y,.05),(.98,.132,.046),worn if i%3 else m['wood'],.006)
                for j in range(2):fissure('plank long grain',[(-.43,y-.03+j*.05,.075),(-.13,y-.024+j*.05,.076),(.18,y-.032+j*.05,.075),(.44,y-.027+j*.05,.075)],m['wood'],.0025)
                for x in (-.34,.34):C.cone('square cut iron nail',(x,y,.078),.012,.012,.006,iron,4)
                if i%3==0:fissure('split board end',[(.49,y,.077),(.38,y+.008,.077),(.29,y+.006,.077)],iron,.003)
        elif kind in ('water','shallows'):
            tint=C.material('water soft reflected sky','71aeb0' if kind=='water' else '93bdb2',roughness=.3)
            # Small wave crests remain inside the tile; the base fixes the shared edge.
            for j in range(5):
                y=-.36+j*.18;left=-.38+(j%2)*.09
                fissure('curved water crest',[(left,y,.003),(left+.13,y-.014,.009),(left+.30,y+.005,.006),(left+.46,y-.012,.003)],tint,.004 if j%2 else .006)
            if kind=='shallows':
                for i in range(9):
                    x,y=rng.uniform(-.4,.4),rng.uniform(-.4,.4)
                    C.uv('sand under shallows',(x,y,.001),(.025,.018,.003),m['sand'],10,6)
        elif kind=='rock':
            face=C.material('weathered cliff face','82908b');seam=C.material('cliff sediment seam','4a5b59')
            for i in range(4):
                x,y=(i%2-.5)*.43,(i//2-.5)*.43
                o=E.rock('broken layered bedrock',(x,y,.005),(.25,.25,.15+(i%2)*.06),face if i%2 else m['rock'])
                for z in (.055,.095):fissure('rock bedding plane',[(x-.18,y-.20,z),(x,y-.245,z+.008),(x+.17,y-.19,z)],seam,.004)
        elif kind=='mud':
            rim=C.material('dry mud rims','958064');wet=C.material('wet silt','4e655a',roughness=.24)
            for i in range(5):
                x,y=rng.uniform(-.28,.28),rng.uniform(-.30,.30);radius=rng.uniform(.09,.17)
                verts=[(x,y,.006)]+[(x+math.cos(a)*radius*(1+.12*math.sin(a*3)),y+math.sin(a)*radius*.58,.005) for a in [j*math.tau/14 for j in range(14)]]
                C.mesh('irregular shallow puddle',verts,[(0,j+1,(j+1)%14+1) for j in range(14)],wet)
                fissure('puddle silt lip',verts[1:8],rim,.006)
            for i in range(4):
                x,y=-.36+i*.22,-.37
                fissure('drying mud crack',[(x,y,.003),(x+.03,y+.12,.003),(x-.025,y+.20,.003)],m['wood'],.004)

def export_unit(asset,sample=False):
    C.reset_scene();rig=unit(asset,palette());w=h=192;anchor=[96,144]
    scene=C.setup_render(w,h,anchor,samples=24);scene['asset_id']=asset;scene['generator']='world_expansion.py';scene['reference']='art/reference/tideborn-and-automata.png';scene['animation_contract']=json.dumps(ANIMS)
    for state,cfg in ANIMS.items():
        for o in rig.values():o.animation_data_clear();o.animation_data_create();o.animation_data.action=bpy.data.actions.new(asset+' / '+state+' / '+o.name);o.animation_data.action.use_fake_user=True
        for frame in range(cfg['frames']):pose(rig,asset,state,frame,cfg['frames'],key=True)
    for o in rig.values():o.animation_data_clear()
    pose(rig,asset,'idle',0,4);C.save(BASE/'scenes'/f'unit-{asset}.blend')
    out=BASE/'raw/units'/asset;out.mkdir(parents=True,exist_ok=True)
    (out/'meta.json').write_text(json.dumps({'id':asset,'kind':'unit','width':w,'height':h,'anchor':anchor,'animations':ANIMS},indent=2))
    jobs=[('idle',0,0),('attack',1,2),('death',0,5)] if sample else [(st,d,f) for st,cfg in ANIMS.items() for d in range(8) for f in range(cfg['frames'])]
    for state,d,frame in jobs:pose(rig,asset,state,frame,ANIMS[state]['frames'],d);C.render(out/f'{state}-{d}-{frame:02}.png')
    print('UNIT COMPLETE',asset,len(jobs),flush=True)

def export_building(asset,sample=False):
    w=384 if asset.endswith(('hq','barracks')) else 256;anchor=[w//2,288];out=BASE/'raw/buildings'/asset;out.mkdir(parents=True,exist_ok=True)
    jobs=[('idle',0)] if sample else [('idle',0),('construction',0),('construction',1),('construction',2),('death',0)]
    for state,frame in jobs:
        C.reset_scene();building(asset,palette(),state,frame);scene=C.setup_render(w,384,anchor,samples=24);scene['asset_id']=asset;scene['generator']='world_expansion.py';scene['reference']='art/reference/tideborn-and-automata.png'
        if state=='idle':C.save(BASE/'scenes'/f'building-{asset}.blend')
        C.render(out/f'{state}-0-{frame:02}.png')
    (out/'meta.json').write_text(json.dumps({'id':asset,'kind':'building','width':w,'height':384,'anchor':anchor,'animations':{'idle':{'frames':1,'fps':1,'loop':True},'construction':{'frames':3,'fps':1,'loop':False},'death':{'frames':1,'fps':1,'loop':False}}},indent=2))
    print('BUILDING COMPLETE',asset,flush=True)

def export_environment(asset):
    C.reset_scene();environment(asset,palette());w,h,anchor=ENV[asset];C.setup_render(w,h,anchor,samples=24);C.save(BASE/'scenes'/f'environment-{asset}.blend')
    out=BASE/'raw/environment';out.mkdir(parents=True,exist_ok=True);C.render(out/f'{asset}.png');print('ENVIRONMENT COMPLETE',asset,flush=True)

def update_environment_manifest():
    path=BASE/'raw/environment/manifest.json';old=json.loads(path.read_text()) if path.exists() else {'assets':[]}
    entries={a['id']:a for a in old['assets']}
    for asset,(w,h,anchor) in ENV.items():
        if (path.parent/f'{asset}.png').exists():entries[asset]={'id':asset,'width':w,'height':h,'anchor':anchor,'file':f'{asset}.png'}
    path.write_text(json.dumps({'assets':list(entries.values())},indent=2))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--sample',action='store_true');p.add_argument('--all',action='store_true');p.add_argument('--asset',choices=UNITS+BUILDINGS+list(ENV));args=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if not(args.sample or args.all or args.asset):p.error('choose --sample, --all or --asset')
    for asset in ([args.asset] if args.asset else UNITS+BUILDINGS+list(ENV)):
        if asset in UNITS:export_unit(asset,args.sample)
        elif asset in BUILDINGS:export_building(asset,args.sample)
        else:export_environment(asset)
    update_environment_manifest()

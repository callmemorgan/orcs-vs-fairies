"""Dwarven engineering and skeletal Undead, using the existing calibrated art pipeline.
Run blender --background --python art/blender/expansion.py -- --sample or --all.
Every production sprite is rendered from an editable named Blender model.
"""
import bpy, math, sys, json, argparse
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import common as C
from units import group, pivot, loft, profile, ANIMS, parent_keep
BASE=Path(__file__).resolve().parent
UNITS=[f'{f}-{r}' for f in ('dwarf','undead') for r in ('worker','melee','ranged','special')]
BUILDINGS=[f'{f}-{r}' for f in ('dwarf','undead') for r in ('hq','depot','barracks','tower')]

def palette():
    return {n:C.material(n,c,metallic=.5 if n in ('steel','brass') else 0,emission=1.4 if n=='soul' else 0) for n,c in {'steel':'52636d','brass':'d7ac56','stone':'72828a','dark':'222b35','wood':'644732','skin':'dbb38a','beard':'ba6a37','leather':'4a3430','bone':'d3ccaa','purple':'665184','cloth':'34314c','soul':'82dec8','black':'121922','red':'aa553f'}.items()}

def skull(pos,scale,m):
    x,y,z=pos
    C.uv('angular cranium',(x,y,z),(.18*scale,.19*scale,.22*scale),m['bone'])
    C.box('jaw',(x+.09*scale,y,z-.16*scale),(.19*scale,.25*scale,.10*scale),m['bone'],.015)
    for s in (-1,1):
        C.uv('deep eye socket',(x+.16*scale,y+s*.09*scale,z+.01*scale),(.044*scale,.068*scale,.061*scale),m['black'])
        C.uv('soul eye',(x+.188*scale,y+s*.09*scale,z+.01*scale),(.016*scale,.023*scale,.020*scale),m['soul'])
    for j in range(4):C.box('separate tooth',(x+.20*scale,y+(j-1.5)*.05*scale,z-.105*scale),(.06*scale,.034*scale,.07*scale),m['bone'],.004)
    C.mesh('triangular nasal cavity',[(x+.197*scale,y-.027*scale,z-.02*scale),(x+.21*scale,y+.027*scale,z-.02*scale),(x+.22*scale,y,z-.09*scale)],[(0,1,2)],m['black'])
    for s in (-1,1):
        C.curve('sculpted cheekbone',[(x+.10*scale,y+s*.17*scale,z+.04*scale),(x+.19*scale,y+s*.16*scale,z-.05*scale),(x+.13*scale,y+s*.11*scale,z-.13*scale)],.025*scale,m['bone'])

def unit(asset,m):
    dwarf=asset.startswith('dwarf');role=asset.split('-')[1];root=pivot('POSE root',(0,0,0));rig={'root':root}
    if dwarf and role=='special':
        def carriage():
            C.box('oak gun carriage',(-.1,0,.4),(1.45,.65,.22),m['wood'])
            for s in (-1,1):
                wheel=C.cone('iron-rimmed wheel',(-.25,s*.52,.4),.4,.4,.13,m['steel'],16);wheel.rotation_euler.x=math.pi/2
                hub=C.cone('brass hub',(-.25,s*.60,.4),.14,.14,.06,m['brass'],12);hub.rotation_euler.x=math.pi/2
                for a in range(8):C.beam('wheel spoke',(-.25,s*.61,.4),(-.25+math.cos(a*math.pi/4)*.31,s*.61,.4+math.sin(a*math.pi/4)*.31),.027,m['brass'])
            C.beam('trail',(-.4,0,.4),(-1.03,0,.12),.12,m['wood'])
            for sign in (-1,1):
                C.beam('folded stabilizer',(-.1,sign*.28,.4),(-.75,sign*.42,.22),.05,m['brass'])
                C.box('stabilizer foot',(-.75,sign*.42,.19),(.24,.22,.08),m['steel'])
        rig['body']=group('POSE carriage',(0,0,0),root,carriage)
        def gun():
            C.beam('long cast barrel',(-.48,0,.75),(.92,0,.92),.20,m['steel'],16)
            muzzle=C.cone('heavy muzzle',(.94,0,.925),.245,.245,.16,m['brass'],16);muzzle.rotation_euler.y=math.pi/2
            bore=C.cone('dark cannon bore',(1.027,0,.925),.15,.15,.01,m['black'],16);bore.rotation_euler.y=math.pi/2
            for x in (-.3,.15,.65):
                ring=C.cone('reinforcing band',(x,0,.81+x*.12),.22,.22,.085,m['brass'],16);ring.rotation_euler.y=math.pi/2
            C.box('recoil cradle',(-.2,0,.65),(.45,.55,.22),m['steel'])
        rig['weapon']=group('POSE cannon recoil',(0,0,.75),root,gun)
    else:
        z=1.05 if dwarf else 1.26
        def body():
            if dwarf:
                loft('stout quilted torso',[(.38,0,0,.21,.26),(.7,0,0,.28,.34),(.99,0,0,.24,.31)],m['leather'])
                if role!='worker':
                    C.box('square steel breastplate',(.2,0,.79),(.16,.57,.39),m['steel'],.075)
                    for s in (-1,1):C.uv('brass shoulder',(-.02,s*.32,.94),(.22,.18,.14),m['brass'])
                C.box('wide utility belt',(.02,0,.48),(.48,.63,.10),m['dark'])
                C.box('belt clasp',(.29,0,.48),(.08,.17,.13),m['brass'])
                for sign in (-1,1):
                    C.box('belt satchel',(-.06,sign*.32,.44),(.18,.14,.21),m['leather'])
                    for h in (.67,.87):C.uv('armor rivet',(.29,sign*.20,h),(.027,.027,.027),m['brass'])
                for sign in (-1,1):
                    tab=profile('blue split tabard',[(.22,.55),(.31,.55),(.34,.25),(.23,.30)],.18,m['steel']);tab.location.y=sign*.15
            else:
                C.beam('exposed spine',(0,0,.56),(0,0,1.24),.065,m['bone'])
                for h in range(5):
                    for s in (-1,1):C.curve('separate rib',[(0,0,.78+h*.075),(.02,s*.22,.81+h*.075),(.17,s*.15,.76+h*.075),(.20,0,.75+h*.075)],.028,m['bone'])
                C.box('pelvic bone',(0,0,.59),(.20,.34,.16),m['bone'])
                if role=='special':
                    loft('ragged purple robes',[(.12,0,0,.35,.4),(.38,0,0,.27,.31),(.7,0,0,.2,.25),(1.16,0,0,.21,.27)],m['cloth'])
                    for s in (-1,1):C.beam('violet stole',(.22,s*.15,1.16),(.32,s*.23,.22),.055,m['purple'])
                elif role=='melee':C.box('rusted chest remnant',(.17,-.1,1.02),(.08,.25,.28),m['steel'],.015)
        rig['body']=group('POSE body',(0,0,.55),root,body)
        def head():
            if dwarf:
                C.uv('round weathered face',(.015,0,1.16),(.24,.23,.26),m['skin'])
                C.uv('broad nose',(.25,0,1.16),(.095,.085,.08),m['skin'])
                for s in (-1,1):
                    C.uv('dark eye',(.22,s*.11,1.24),(.03,.032,.025),m['black'])
                    C.beam('heavy brow',(.235,s*.06,1.29),(.20,s*.17,1.29),.037,m['beard'])
                for j in range(5):
                    y=(j-2)*.075
                    # Interwoven locks have a tapered silhouette and real relief.
                    for strand in range(2):
                        pts=[]
                        for k in range(15):
                            t=k/14;phase=t*math.pi*5+strand*math.pi;r=.025*(1-t*.6)
                            pts.append((.32+math.cos(phase)*r,y+math.sin(phase)*r,1.20-t*.43))
                        C.curve('interwoven beard lock',pts,.027,m['beard'])
                    C.cone('beard gold clasp',(.32,(j-2)*.075,.79),.037,.037,.055,m['brass'],8)
                if role=='worker':
                    C.cone('leather work cap',(.01,0,1.37),.25,.19,.12,m['leather'])
                    C.uv('mining lamp',(.24,0,1.39),(.06,.08,.065),m['brass'])
                else:
                    loft('forged domed helmet',[(1.265,-.02,0,.26,.255),(1.36,-.035,0,.25,.25),(1.47,-.04,0,.18,.21),(1.50,-.055,0,.06,.10)],m['steel'],n=20)
                    for s in (-1,1):
                        C.curve('helmet rolled brow',[(.23,0,1.29),(.17,s*.18,1.29),(-.05,s*.25,1.29),(-.25,s*.10,1.30)],.016,m['brass'])
                        C.box('hinged helmet cheek',(.02,s*.24,1.23),(.17,.04,.20),m['steel'],.035)
                    C.box('helmet crest',(-.06,0,1.52),(.28,.055,.12),m['brass'])
            else:
                skull((.01,0,1.47),1,m)
                if role=='special':
                    C.cone('necromancer crown',(-.03,0,1.69),.23,.23,.09,m['purple'],10)
                    for s in (-1,1):C.cone('crown point',(-.03,s*.18,1.84),.055,0,.30,m['bone'],6)
        rig['head']=group('POSE head',(0,0,z),rig['body'],head)
        for s in (-1,1):
            def leg(s=s):
                if dwarf:
                    C.beam('short trouser leg',(0,s*.19,.48),(0,s*.22,.15),.14,m['leather'])
                    C.box('square iron boot',(.08,s*.22,.10),(.39,.28,.20),m['steel'])
                    C.box('boot brass band',(.17,s*.22,.21),(.08,.29,.035),m['brass'])
                else:
                    C.beam('femur',(0,s*.14,.60),(-.04,s*.17,.32),.047,m['bone'])
                    C.uv('knee',(-.04,s*.17,.32),(.065,.065,.065),m['bone'])
                    C.beam('shin',(-.04,s*.17,.32),(.02,s*.18,.08),.037,m['bone'])
                    for j in range(3):C.beam('bony toe',(.01,s*.18+(j-1)*.042,.06),(.21,s*.18+(j-1)*.042,.035),.02,m['bone'])
            rig['leg'+str(s)]=group('POSE leg '+str(s),(0,s*.17,.5),root,leg)
            def arm(s=s):
                if dwarf:
                    C.beam('thick sleeve',(0,s*.30,.93),(.05,s*.40,.69),.105,m['leather'])
                    C.beam('forearm',(.05,s*.40,.69),(.29,s*.36,.65),.085,m['skin'])
                else:
                    C.beam('upper arm',(0,s*.23,1.17),(.0,s*.33,.92),.04,m['bone'])
                    C.uv('elbow',(.0,s*.33,.92),(.055,.055,.055),m['bone'])
                    C.beam('forearm',(.0,s*.33,.92),(.30,s*.33,.89),.035,m['bone'])
                C.uv('hand',(.31,s*.35,.66 if dwarf else .88),(.08,.07,.085),m['skin' if dwarf else 'bone'])
            rig['arm'+str(s)]=group('POSE arm '+str(s),(0,s*.29,.93 if dwarf else 1.17),rig['body'],arm)
        def equipment():
            y=-.40;h=.70 if dwarf else .90
            if role=='worker':
                C.beam('tool haft',(.30,y,.30),(.30,y,1.32),.038,m['wood'])
                if dwarf:C.beam('pick head',(.05,y,1.25),(.58,y,1.30),.07,m['steel'])
                else:C.box('grave shovel blade',(.30,y,.22),(.30,.07,.36),m['steel'])
            elif role=='melee':
                C.beam('weapon grip',(.32,y,h-.20),(.32,y,h+.20),.04,m['wood'])
                if dwarf:
                    C.box('war hammer',(.32,y,h+.35),(.45,.25,.24),m['brass'])
                    C.box('tower shield',(.22,.47,.67),(.16,.45,.72),m['steel'],.06)
                    C.box('shield gold stripe',(.315,.47,.67),(.035,.10,.67),m['brass'])
                    for h in (.39,.95):C.box('shield rim',(.31,.47,h),(.035,.44,.055),m['brass'])
                else:
                    blade=profile('chipped sword',[(.29,h+.12),(.38,h+.12),(.42,h+.66),(.31,h+.82)],.045,m['steel']);blade.location.y=y
                    C.cone('round bone shield',(.13,.44,.95),.25,.25,.09,m['dark'],12).rotation_euler.x=math.pi/2
            elif role=='ranged':
                if dwarf:
                    C.box('musket stock',(.22,y,h),(.55,.11,.14),m['wood'])
                    C.beam('musket barrel',(.35,y,h+.08),(1.0,y,h+.11),.055,m['steel'])
                    C.box('musket lock',(.45,y-.08,h),(.12,.07,.11),m['brass'])
                else:
                    C.curve('bone longbow',[(.32,y,.42),(.57,y,.65),(.61,y,1.03),(.48,y,1.47)],.038,m['bone'])
                    C.beam('bowstring',(.32,y,.42),(.48,y,1.47),.008,m['cloth'])
                    C.beam('nocked arrow',(.05,y,.94),(.95,y,.94),.015,m['wood'])
            else:
                C.beam('grave staff',(.30,y,.08),(.30,y,1.82),.038,m['wood'])
                skull((.30,y,1.92),.55,m)
                C.uv('captured soul',(.30,y,2.16),(.10,.10,.15),m['soul'])
        rig['weapon']=group('POSE equipment',(.30,-.35,.70 if dwarf else .90),rig['arm-1'],equipment)
    for o in rig.values():o['rest_location']=list(o.location);o['rest_rotation']=list(o.rotation_euler)
    return rig

def pose(rig,asset,state,f,count,direction=0,key=False):
    for o in rig.values():o.location=o['rest_location'];o.rotation_euler=o['rest_rotation'];o.scale=(1,1,1)
    t=f/max(1,count-1);phase=f/count*math.pi*2;root=rig['root'];root.rotation_euler.z=-direction*math.pi/4
    cannon=asset=='dwarf-special'
    if state=='idle':rig['body'].location.z+=.008*math.sin(phase)
    if state=='walk':
        if cannon:rig['body'].location.z+=.015*abs(math.sin(phase))
        else:
            for sign in (-1,1):rig['leg'+str(sign)].rotation_euler.y=sign*.35*math.sin(phase);rig['arm'+str(sign)].rotation_euler.y=-sign*.16*math.sin(phase)
            rig['body'].location.z+=.025*abs(math.sin(phase))
    if state=='attack':
        if cannon:rig['weapon'].location.x-=[0,.02,.19,.12,.05,0][f]
        elif asset.endswith(('worker','melee')):rig['arm-1'].rotation_euler.y=[.4,.8,-.65,-.35,-.1,0][f]
        elif asset=='undead-special':
            for sign in (-1,1):rig['arm'+str(sign)].rotation_euler.x=sign*.55*math.sin(math.pi*t)
        else:rig['weapon'].location.x-=[0,.01,.13,.08,.03,0][f]
    if state=='death':root.rotation_euler.y=-1.46*t;root.location.z=.12*t;root.location.x=.35*t*math.cos(-direction*math.pi/4);root.location.y=.35*t*math.sin(-direction*math.pi/4)
    if key:
        for o in rig.values():
            for prop in ('location','rotation_euler','scale'):o.keyframe_insert(data_path=prop,frame=f+1,group=state)
    bpy.context.view_layer.update()

def building(asset,m,state='idle',frame=0):
    dwarf=asset.startswith('dwarf');role=asset.split('-')[1];wide=role in ('hq','barracks');s=1.28 if wide else .83
    C.box('stone foundation',(0,0,.10),(s*2+.25,s*2+.25,.2),m['stone' if dwarf else 'dark'])
    if state=='death':
        for i in range(12):
            a=i*2.399;C.box('fallen masonry',(math.cos(a)*s*.75,math.sin(a)*s*.75,.2+(i%3)*.1),(.45,.35,.28),m['stone' if dwarf else 'bone'])
        return
    if dwarf:
        height=1.55 if wide else .65 if role=='depot' else 1.8
        # Courses and buttresses preserve a stone silhouette at gameplay scale.
        for z in range(int(height/.3)):
            for side in (-1,1):
                for j in range(5 if wide else 3):
                    x=-s+(j+.5)*2*s/(5 if wide else 3)
                    C.box('stone block',(x,side*(s-.15),.35+z*.3),(2*s/(5 if wide else 3)-.025,.3,.28),m['stone'])
        for x in (-s+.12,s-.12):C.box('side wall',(x,0,height/2+.2),(.3,s*2,height),m['stone'])
        C.box('roof slab',(0,0,height+.22),(s*2+.10,s*2+.10,.2),m['steel'])
        for x in (-s,s):
            for y in (-s,s):C.box('brass corner cap',(x,y,height+.45),(.28,.28,.4),m['brass'])
        C.box('heavy door',(0,-s-.025,.67),(.68,.07,1.05),m['dark'])
        for j in (-1,0,1):C.box('door iron strip',(j*.20,-s-.075,.67),(.045,.04,1.00),m['brass'])
        if role=='hq':
            C.box('keep upper tower',(0,.3,2.05),(1.1,1.1,.95),m['stone'])
            C.cone('copper roof',(0,.3,2.70),.89,.15,.55,m['brass'],4).rotation_euler.z=math.pi/4
            for j in (-1,1):C.box('keep window',(j*.29,-.265,2.1),(.18,.02,.30),m['dark'])
        elif role in ('barracks','tower'):
            for y in (-.38,.38):
                C.beam('mounted cannon',(-.5,y,height+.48),(.95,y,height+.65),.18,m['steel'])
                muzzle=C.cone('gun mouth',(.99,y,height+.65),.20,.20,.09,m['brass']);muzzle.rotation_euler.y=math.pi/2
            if role=='barracks':
                C.box('forge chimney',(-.7,.5,2.0),(.45,.45,1.3),m['dark'])
                C.box('glowing furnace mouth',(-.7,-s-.06,.75),(.35,.025,.5),m['red'])
        else:
            for j in range(3):C.box('supply chest',(-.45+j*.46,0,height+.48),(.4,.55,.4),m['wood'])
    else:
        height=1.4 if wide else .65 if role=='depot' else 2.2
        C.box('crypt walls',(0,0,height/2+.2),(s*1.8,s*1.8,height),m['cloth'])
        C.cone('sloped slate roof',(0,0,height+.5),s*1.5,s*.45,.65,m['purple'],4).rotation_euler.z=math.pi/4
        C.box('tomb entrance',(0,-s*.92,.67),(.62,.08,.98),m['black'])
        for x in (-s*.85,s*.85):
            for y in (-s*.85,s*.85):
                C.beam('bone buttress',(x,y,.2),(x*.8,y*.8,height+.65),.095,m['bone'])
                C.cone('spire tooth',(x*.8,y*.8,height+.88),.12,0,.5,m['bone'],6)
        if role in ('hq','tower'):
            C.cone('ritual obelisk',(0,0,height+1.0),.34,.15,.9,m['dark'],6)
            C.uv('soul beacon',(0,0,height+1.65),(.19,.19,.28),m['soul'])
            for i in range(6):
                a=i*math.pi/3;C.beam('bone beacon cage',(math.cos(a)*.35,math.sin(a)*.35,height+1.18),(math.cos(a)*.21,math.sin(a)*.21,height+1.92),.04,m['bone'])
        elif role=='barracks':
            for x in (-.65,.65):
                C.box('sarcophagus',(x,.15,1.95),(.46,1.2,.3),m['stone'])
                C.beam('coffin seal',(x,-.25,2.12),(x,.55,2.12),.04,m['bone'])
        else:
            for i in range(6):skull((-.4+(i%3)*.38,-.3+(i//3)*.45,1.2),.6,m)
    # Reference details are modeled geometry, including ribs, stairs and buttresses.
    if dwarf:
        for x in (-s+.18,s-.18):
            C.box('sloped fortress buttress',(x,-s-.18,.6),(.36,.48,1.12),m['stone'])
            C.box('buttress brass cap',(x,-s-.18,1.18),(.39,.51,.09),m['brass'])
        for i in range(3):C.box('entry stair',(0,-s-.23-i*.16,.10+(2-i)*.10),(.9,.27,.20+(2-i)*.13),m['stone'])
        for x in (-s-.055,s+.055):
            for j in range(3):
                yy=-s*.62+j*s*.62
                C.box('side wall recessed panel',(x,yy,.78),(.025,.25,.68),m['dark'])
                C.box('side panel iron trim',(x,yy,1.13),(.035,.3,.05),m['brass'])
        if role=='hq':
            for x in (-.83,.83):
                C.box('keep corner tower',(x,.55,1.58),(.62,.7,2.5),m['stone'])
                C.cone('corner copper roof',(x,.55,2.97),.51,0,.6,m['brass'],4).rotation_euler.z=math.pi/4
            C.box('deep blue banner',(.7,-s-.07,1.25),(.37,.04,.65),m['steel'])
            C.box('banner gold cross',(.7,-s-.10,1.26),(.05,.025,.43),m['brass'])
        elif role=='barracks':
            roof=C.cone('forge pitched roof',(0,.0,1.98),1.7,.2,.8,m['steel'],4);roof.rotation_euler.z=math.pi/4
            for j in range(5):
                C.beam('roof copper band',(-1.08+j*.54,-1.10,1.75),(-1.08+j*.54,0,2.5),.035,m['brass'])
            C.box('chimney collar',(-.7,.5,2.68),(.55,.55,.13),m['brass'])
            C.box('chimney soot mouth',(-.7,.5,2.77),(.32,.32,.03),m['black'])
        elif role=='tower':
            for z in (.75,1.4,1.85):C.box('tower belt',(0,0,z),(s*2+.17,s*2+.17,.08),m['brass'])
            C.box('bastion blue banner',(.40,-s-.08,1.17),(.36,.035,.9),m['steel'])
            C.box('banner gold stripe',(.40,-s-.11,1.17),(.06,.025,.70),m['brass'])
        else:
            for x in (-.63,.63):
                C.box('vault side chest',(x,-.15,.76),(.36,.85,.38),m['wood'])
                for yy in (-.43,.12):C.box('chest metal band',(x,yy,.97),(.38,.065,.03),m['brass'])
            for yy in (-.55,.0,.55):C.beam('stacked timber',(-.55,yy,1.14),(.55,yy,1.14),.12,m['wood'])
    else:
        for x in (-s*.83,s*.83):
            C.curve('flying rib buttress',[(x*1.4,-s,.15),(x*1.35,-s,1.0),(x,-s*.6,height+.48)],.07,m['bone'])
        for i in range(4):C.box('tomb steps',(0,-s-.10-i*.14,.10+(3-i)*.07),(.90,.25,.13+(3-i)*.07),m['stone'])
        # Tall recessed arch and skull over the entrance.
        C.curve('bone entry arch',[(-.38,-s*.94,.3),(-.38,-s*.94,1.04),(0,-s*.94,1.36),(.38,-s*.94,1.04),(.38,-s*.94,.3)],.055,m['bone'])
        head=group('door skull',(0,0,0),None,lambda:skull((0,-s-.07,1.32),.55,m))
        head.rotation_euler.z=-math.pi/2
        for x in (-s*.91,s*.91):
            for yy in (-s*.45,s*.45):
                C.box('tall black lancet',(x,yy,.88),(.026,.24,.64),m['black'])
                C.beam('glowing lancet rune',(x*1.025,yy,.68),(x*1.025,yy,1.02),.018,m['soul'])
        if role=='hq':
            for x in (-.94,.94):
                C.cone('necropolis corner spire',(x,.48,2.0),.27,.18,1.7,m['dark'],6)
                C.cone('needle roof',(x,.48,3.13),.33,0,.8,m['purple'],6)
            C.box('upper shrine',(0,.15,2.13),(.78,.72,.9),m['dark'])
        elif role=='barracks':
            for x in (-.75,.75):
                C.box('standing sarcophagus',(x,-s-.04,.84),(.39,.18,1.08),m['stone'])
                C.beam('sarcophagus bone cross',(x-.12,-s-.15,.92),(x+.12,-s-.15,.92),.032,m['bone'])
                C.beam('sarcophagus bone spine',(x,-s-.15,.52),(x,-s-.15,1.20),.032,m['bone'])
        elif role=='tower':
            for sign in (-1,1):C.curve('great soul cage',[(sign*.7,0,.16),(sign*.95,0,1.1),(sign*.63,0,2.5),(0,0,3.35)],.085,m['bone'])
        else:
            for i in range(5):skull((-.55+i*.26,-s-.06,.75),.5,m)
    if state=='construction':
        bpy.context.view_layer.update();limit=(1.0,1.8,2.5)[frame]
        for o in bpy.context.scene.objects:
            if o.type in ('MESH', 'CURVE') and min((o.matrix_world @ __import__('mathutils').Vector(c)).z for c in o.bound_box)>limit:o.hide_render=True
        for x in (-s,s):
            for y in (-s,s):C.beam('construction upright',(x,y,.1),(x,y,limit+.15),.04,m['wood'])
        for y in (-s,s):C.beam('construction crossbar',(-s,y,limit),(s,y,limit),.04,m['wood'])

def export_unit(asset,sample=False):
    C.reset_scene();rig=unit(asset,palette());w=192;h=192;anchor=[96,144]
    scene=C.setup_render(w,h,anchor,samples=24);scene['asset_id']=asset;scene['generator']='expansion.py';scene['animation_contract']=json.dumps(ANIMS)
    for state,cfg in ANIMS.items():
        for o in rig.values():
            o.animation_data_clear();o.animation_data_create();o.animation_data.action=bpy.data.actions.new(asset+' / '+state+' / '+o.name);o.animation_data.action.use_fake_user=True
        for f in range(cfg['frames']):pose(rig,asset,state,f,cfg['frames'],key=True)
    for o in rig.values():o.animation_data_clear()
    pose(rig,asset,'idle',0,4);C.save(BASE/'scenes'/f'unit-{asset}.blend')
    out=BASE/'raw/units'/asset;out.mkdir(parents=True,exist_ok=True)
    (out/'meta.json').write_text(json.dumps({'id':asset,'kind':'unit','width':w,'height':h,'anchor':anchor,'animations':ANIMS},indent=2))
    jobs=[('idle',0,0),('attack',1,2),('death',0,5)] if sample else [(st,d,f) for st,cfg in ANIMS.items() for d in range(8) for f in range(cfg['frames'])]
    for state,d,f in jobs:pose(rig,asset,state,f,ANIMS[state]['frames'],d);C.render(out/f'{state}-{d}-{f:02}.png')
    print('UNIT COMPLETE',asset,len(jobs),flush=True)

def export_building(asset,sample=False):
    w=384 if asset.endswith(('hq','barracks')) else 256;anchor=[w//2,288];out=BASE/'raw/buildings'/asset;out.mkdir(parents=True,exist_ok=True)
    jobs=[('idle',0)] if sample else [('idle',0),('construction',0),('construction',1),('construction',2),('death',0)]
    for state,f in jobs:
        C.reset_scene();building(asset,palette(),state,f);scene=C.setup_render(w,384,anchor,samples=24);scene['asset_id']=asset;scene['generator']='expansion.py'
        if state=='idle':C.save(BASE/'scenes'/f'building-{asset}.blend')
        C.render(out/f'{state}-0-{f:02}.png')
    (out/'meta.json').write_text(json.dumps({'id':asset,'kind':'building','width':w,'height':384,'anchor':anchor,'animations':{'idle':{'frames':1,'fps':1,'loop':True},'construction':{'frames':3,'fps':1,'loop':False},'death':{'frames':1,'fps':1,'loop':False}}},indent=2))
    print('BUILDING COMPLETE',asset,flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--sample',action='store_true');p.add_argument('--all',action='store_true');p.add_argument('--asset',choices=UNITS+BUILDINGS);args=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if not(args.sample or args.all or args.asset):p.error('choose --sample, --all or --asset')
    for asset in ([args.asset] if args.asset else UNITS+BUILDINGS):
        (export_unit if asset in UNITS else export_building)(asset,args.sample)

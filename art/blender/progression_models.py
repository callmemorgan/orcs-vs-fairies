"""Faction-specific three-age units, built from the original faction sculpt vocabulary.

Forward is +X. Every animated part belongs to a named pivot. Character builders
reuse the original bodies (and their palettes), not the old generic pikeman.
"""
import math
import bpy
from mathutils import Vector
import common as C
import units as U
import expansion as E
import world_expansion as W


def remove_tree(obj):
    for child in list(obj.children):
        remove_tree(child)
    bpy.data.objects.remove(obj, do_unlink=True)


def character(faction):
    if faction in ('orc', 'fairy'):
        m = U.palette()
        rig = (U.make_orc if faction == 'orc' else U.make_fairy)(f'{faction}-spear', m)
        rig['body'] = rig.pop('torso')
        if 'equipment' in rig:
            remove_tree(rig.pop('equipment'))
    elif faction in ('dwarf', 'undead'):
        m = E.palette()
        rig = E.unit(f'{faction}-melee', m)
        remove_tree(rig.pop('weapon'))
    else:
        m = W.palette()
        rig = W.unit(f'{faction}-melee', m)
        remove_tree(rig.pop('weapon'))
    return rig, m


def leaf_blade(name, tip, base, width, mat):
    """A solid diamond blade whose spine follows the weapon direction."""
    tip, base = Vector(tip), Vector(base)
    v = tip - base
    side = Vector((-v.z, 0, v.x)).normalized() * width
    middle = base + v * .35
    verts = [base, middle + side, tip, middle - side,
             middle + Vector((0, .035, 0)), middle - Vector((0, .035, 0))]
    return C.mesh(name, [tuple(p) for p in verts],
                  [(4, i, (i + 1) % 4) for i in range(4)] +
                  [(5, (i + 1) % 4, i) for i in range(4)], mat)


def pike(faction, rig, m):
    # Grip positions come from the original characters' hands.
    y, z = {'orc':(-.49,.79), 'fairy':(-.33,.85), 'dwarf':(-.36,.66),
            'undead':(-.35,.88), 'tideborn':(-.36,.86), 'automata':(-.36,.86)}[faction]
    grip = (.24, y, z)
    start = (-.65, y, z - .35)
    end = (1.52, y, z + .52)
    tip = (1.99, y, z + .71)
    def build():
        if faction == 'orc':
            C.beam('black iron pike haft', start, end, .045, m['wood'])
            leaf_blade('broad jagged pike head', tip, end, .16, m['edge'])
            for x in (1.52, 1.67):
                C.beam('hooked pike barb', (x,y,z+.48+(x-1.52)*.4),
                       (x-.16,y,z+.23+(x-1.52)*.4), .036, m['iron'])
            C.mesh('crimson pike pennant',[(.78,y,z+.23),(1.2,y,z+.4),(.90,y,z-.07)],[(0,1,2)],m['red'])
        elif faction == 'fairy':
            C.curve('living briar shaft', [start, grip, (.86,y,z+.18), end], .026, m['wood'])
            leaf_blade('golden willow lance', tip, end, .11, m['gold'])
            for i in range(4):
                x=.42+i*.25;h=z+(x-.24)*.38
                C.beam('briar thorn',(x,y,h),(x-.10,y,h+.17),.024,m['gold'])
            U.leaf_panel('pike leaf',(.60,y,z+.14),(.35,y-.18,z+.33),.10,m['leafLight'])
        elif faction == 'dwarf':
            C.beam('steel-shod deep pike',start,end,.046,m['wood'])
            leaf_blade('chisel steel pike',tip,end,.12,m['steel'])
            C.beam('brass crossguard',(1.48,y,z+.36),(1.37,y,z+.63),.045,m['brass'])
            for x in (-.25,.05,.35,.65):
                C.uv('brass haft collar',(x,y,z+(x-.24)*.4),(.055,.06,.065),m['brass'])
        elif faction == 'undead':
            C.beam('long bone pike',start,end,.035,m['bone'])
            leaf_blade('grave iron blade',tip,end,.115,m['steel'])
            E.skull((1.38,y,z+.45),.38,m)
            for i in range(3):
                C.mesh('tattered violet pennant',[(.83+i*.12,y,z+.2+i*.045),(1+i*.12,y,z+.27+i*.045),(.68+i*.12,y,z-.18)],[(0,1,2)],m['purple'])
        elif faction == 'tideborn':
            C.beam('reef pike haft',start,end,.04,m['wood'])
            leaf_blade('ivory harpoon spear',tip,end,.105,m['shell'])
            for i in range(3):
                x=1.45+i*.16;h=z+.49+i*.064
                C.beam('coral harpoon barb',(x,y,h),(x-.18,y,h-.21),.039,m['coral'])
            C.curve('bound kelp pennant',[(.97,y,z+.25),(.75,y-.1,z-.04),(.83,y-.15,z-.24)],.045,m['kelp'])
        else:
            C.beam('bronze conductor lance',start,end,.045,m['bronze'])
            leaf_blade('violet crystal lance',tip,end,.13,m['glow'])
            for x in (1.18,1.36):
                C.box('ceramic lance collar',(x,y,z+(x-.24)*.4),(.09,.14,.15),m['ceramic'])
    rig['weapon'] = U.group('POSE thrusting faction pike',grip,rig['arm-1'],build)


def infantry(faction):
    rig, m = character(faction)
    pike(faction,rig,m)
    def heraldry():
        if faction == 'orc':
            shield=C.cone('Pikejaw red shield',(.25,.66,.95),.31,.31,.09,m['red'],12)
            shield.rotation_euler.x=math.pi/2
            C.uv('iron shield boss',(.25,.72,.95),(.11,.055,.11),m['iron'])
            for x in (.10,.38):C.beam('shield tusk',(x,.73,.78),(x+.04,.73,1.12),.035,m['ivory'])
        elif faction == 'fairy':
            U.leaf_panel('Briar Pike leaf buckler',(.13,.39,.55),(.15,.40,1.14),.25,m['leaf'])
            C.curve('buckler gold vein',[(.17,.40,.6),(.21,.40,.84),(.17,.40,1.12)],.016,m['gold'])
        elif faction == 'dwarf':
            C.box('Deep Pike square shield',(.22,.46,.65),(.15,.43,.67),m['steel'],.035)
            for h in (.36,.94):C.box('brass shield end',(.31,.46,h),(.04,.45,.06),m['brass'])
            C.box('brass shield rune upright',(.315,.46,.66),(.035,.06,.41),m['brass'])
            C.beam('brass shield rune slash',(.34,.29,.8),(.34,.58,.62),.025,m['brass'])
        elif faction == 'undead':
            C.mesh('Bone Pike coffin shield',[(.23,.3,.56),(.23,.55,.53),(.23,.7,1.08),(.23,.55,1.22),(.23,.3,1.16)],[(0,1,2,3,4)],m['cloth'])
            for h in (.66,.84,1.02):C.beam('shield bone binding',(.25,.29,h),(.25,.61,h+.05),.026,m['bone'])
        elif faction == 'tideborn':
            W.shell('Reef Pike spiral shield',(.12,.48,.88),.73,m)
        else:
            W.crystal('Lance Sentinel crest',(-.05,0,1.47),.09,.32,m)
    extra = U.group('POSE faction pike shield',(0,.3,.8),rig['arm1'],heraldry)
    rig['shield']=extra
    return rig


def animal_body(faction,m):
    """Each mount has different anatomy; no recolored horse fallback."""
    if faction=='orc':
        C.uv('boar barrel',(-.12,0,.78),(.78,.43,.42),m['fur'])
        C.uv('boar massive wedge head',(.57,0,.78),(.44,.34,.36),m['fur'])
        C.uv('boar snout',(.92,0,.70),(.15,.26,.17),m['nose'])
        for s in (-1,1):
            C.uv('snout nostril',(1.056,s*.12,.73),(.018,.05,.04),m['dark'])
            C.curve('upturned ivory tusk',[(.72,s*.24,.59),(.99,s*.35,.67),(1.06,s*.36,.94)],.07,m['bone'])
            C.mesh('boar pointed ear',[(.38,s*.19,1.01),(.26,s*.40,1.27),(.66,s*.27,1.07)],[(0,1,2)],m['fur'])
            C.uv('boar amber eye',(.75,s*.30,.91),(.055,.025,.038),m['eye'])
            C.box('boar iron cheek plate',(.44,s*.36,.80),(.36,.075,.31),m['steel'])
            C.curve('boar leather bridle',[(.92,s*.22,.69),(.68,s*.32,1.02),(.38,s*.30,1.01)],.025,m['cloth'])
            C.curve('boar sculpted jowl',[(.96,s*.23,.61),(.73,s*.31,.55),(.45,s*.29,.61)],.032,m['nose'])
        for i in range(6):C.cone('boar bristle',(-.67+i*.21,0,1.19),.065,0,.29,m['dark'],5)
        C.curve('boar curled tail',[(-.84,0,.8),(-1.03,.03,.97),(-1.0,.15,1.06),(-.91,.15,.98)],.035,m['fur'])
    elif faction=='fairy':
        C.uv('white stag body',(-.15,0,.92),(.67,.29,.30),m['fur'])
        C.uv('stag proud chest',(.36,0,1.12),(.23,.26,.38),m['fur'])
        C.uv('stag long neck',(.48,0,1.42),(.17,.18,.40),m['fur'])
        C.uv('stag narrow head',(.66,0,1.74),(.25,.15,.19),m['fur'])
        C.uv('stag dark muzzle',(.87,0,1.68),(.10,.12,.09),m['nose'])
        for s in (-1,1):
            C.uv('stag luminous eye',(.73,s*.137,1.80),(.035,.02,.027),m['eye'])
            C.uv('stag leaf-shaped ear',(.41,s*.22,1.80),(.17,.07,.10),m['fur'])
            points=[(.49,s*.10,1.87),(.33,s*.28,2.11),(.09,s*.43,2.36),(-.09,s*.46,2.43)]
            C.curve('branching gold antler',points,.034,m['bone'])
            for a,b in [((.36,s*.25,2.08),(.58,s*.36,2.29)),((.24,s*.33,2.22),(.26,s*.59,2.45)),((.11,s*.41,2.34),(-.06,s*.27,2.57))]:
                C.beam('antler tine',a,b,.024,m['bone'])
        C.uv('stag white tail',(-.79,0,1.04),(.19,.11,.13),m['fur'])
        for s in (-1,1):C.curve('stag leaf harness',[(.41,s*.22,1.40),(.17,s*.30,1.01),(-.45,s*.30,.93)],.027,m['cloth'])
    elif faction=='dwarf':
        C.uv('mountain ram fleece',(-.12,0,.85),(.70,.42,.43),m['fur'])
        for x in (-.55,-.22,.10,.38):
            for s in (-1,1):C.uv('ram wool curl',(x,s*.30,1.04),(.20,.18,.18),m['fur'])
        C.uv('ram neck',(.45,0,1.08),(.28,.30,.32),m['fur'])
        C.uv('ram square face',(.72,0,1.13),(.26,.20,.26),m['nose'])
        for s in (-1,1):
            points=[]
            for i in range(25):
                t=i/24;a=t*math.pi*1.75;r=.31*(1-t*.58)
                points.append((.49+math.cos(a)*r,s*(.26+t*.06),1.29+math.sin(a)*r))
            C.curve('ram curled horn',points,.077,m['bone'])
            C.uv('ram amber eye',(.80,s*.185,1.23),(.037,.022,.032),m['eye'])
            C.box('ram brass barding',(.04,s*.42,.84),(.67,.06,.34),m['trim'])
            for j in range(3):
                x=-.20+j*.19
                C.curve('ram layered fleece lock',[(x,s*.37,.98),(x+.065,s*.435,.88),(x+.035,s*.40,.77)],.038,m['fur'])
        C.box('ram steel forehead plate',(.75,0,1.38),(.25,.29,.08),m['steel'])
    elif faction=='undead':
        C.curve('horse exposed spine',[(-.74,0,.96),(-.22,0,1.10),(.40,0,1.02),(.53,0,1.55)],.07,m['bone'])
        for x in (-.52,-.31,-.10,.11,.32):
            for s in (-1,1):C.curve('horse separate rib',[(x,0,1.05),(x,s*.32,.92),(x+.06,s*.29,.62),(x+.08,s*.08,.56)],.032,m['bone'])
        C.uv('horse elongated skull',(.66,0,1.54),(.29,.15,.23),m['bone'])
        C.uv('horse skeletal muzzle',(.86,0,1.40),(.17,.13,.13),m['bone'])
        for s in (-1,1):
            C.uv('horse hollow eye',(.79,s*.13,1.61),(.07,.026,.066),m['dark'])
            C.uv('horse soul eye',(.81,s*.151,1.61),(.027,.013,.032),m['eye'])
            C.beam('horse shoulder bone',(.28,s*.2,1.04),(.42,s*.25,.65),.055,m['bone'])
            for i in range(4):
                x=-.58+i*.22
                C.mesh('ragged spectral caparison',[(x,s*.28,1.03),(x+.23,s*.28,1.03),(x+.12,s*.38,.42+(i%2)*.15)],[(0,1,2)],m['cloth'])
        C.curve('skeletal tail',[(-.75,0,.97),(-.97,0,.77),(-1.06,0,.43)],.045,m['bone'])
    else:
        C.uv('giant shell crab body',(-.09,0,.63),(.76,.54,.27),m['fur'])
        C.uv('crab domed shell',(-.20,0,.83),(.66,.53,.38),m['shell'])
        for i in range(5):
            x=-.68+i*.23
            C.curve('shell carapace ridge',[(x,-.42,.81),(x,-.29,1.05),(x,0,1.19),(x,.29,1.05),(x,.42,.81)],.03,m['trim'])
        for s in (-1,1):
            C.beam('crab eye stalk',(.49,s*.19,.78),(.66,s*.27,1.09),.035,m['fur'])
            C.uv('crab pearl eye',(.66,s*.27,1.10),(.065,.06,.065),m['eye'])
            C.beam('crab claw arm',(.45,s*.35,.60),(.81,s*.64,.57),.075,m['fur'])
            C.uv('crab claw palm',(.97,s*.63,.59),(.24,.17,.17),m['coral'])
            for y in (-.09,.09):C.beam('crab claw pincer',(1.05,s*.63+y,.59),(1.29,s*.63+y*.35,.59),.065,m['coral'])


def mount_palette(faction):
    fur,nose,bone,cloth,eye={
        'orc':('51423b','88675b','dfcba0','85351f','e8ac3f'),
        'fairy':('dfd8bd','615452','b9a16a','246750','86ddf0'),
        'dwarf':('c2b5a0','655b50','bca57a','52636d','cfa665'),
        'undead':('3b334b','222b35','d3ccaa','665184','82dec8'),
        'tideborn':('529e94','275e61','dfd6b2','3d7462','dfd6b2'),
        'automata':('d4cbb4','2c353c','d4cbb4','816540','bc9aff'),
    }[faction]
    colors={'fur':fur,'nose':nose,'bone':bone,'cloth':cloth,'eye':eye,'steel':'424f58',
            'trim':'b99a5d','dark':'222b35','shell':'dfd6b2','coral':'d98564'}
    return {k:C.material('mount '+k,v,metallic=.45 if k in ('steel','trim') else 0,
                         emission=.7 if k=='eye' and faction in ('fairy','undead','automata') else 0)
            for k,v in colors.items()}


def mount_legs(rig,faction,m):
    crab=faction=='tideborn'
    for i,(x,s) in enumerate([(x,s) for x in ((-.48,-.06,.38) if crab else (-.52,.40)) for s in (-1,1)]):
        y=s*(.40 if crab else .25)
        def leg(x=x,y=y,s=s):
            if crab:
                C.beam('crab upper walking leg',(x,y,.65),(x-.19,s*.87,.48),.055,m['fur'])
                C.beam('crab pointed lower leg',(x-.19,s*.87,.48),(x+.03,s*1.04,.06),.04,m['coral'])
            else:
                skeletal=faction=='undead';slender=faction in ('fairy','undead')
                knee=(x+.12,y,.43);foot=(x-.04,y,.10)
                C.beam('mount upper leg',(x,y,.88),knee,.053 if slender else .105,m['bone' if skeletal else 'fur'])
                C.uv('mount knee',knee,(.064,.060,.067) if slender else (.11,.1,.11),m['bone' if skeletal else 'fur'])
                C.beam('mount lower leg',knee,foot,.034 if slender else .073,m['bone' if skeletal else 'fur'])
                C.box('split dark hoof',(foot[0]+.03,y,.075),(.15,.11,.14) if slender else (.23,.18,.15),m['dark'],.025)
        rig[f'hoof{i}']=U.group(f'POSE mount leg {i}',(x,y,.78),rig['root'],leg)


def mechanical_legs(rig,m,count=4,wide=False):
    # Alternating diagonal pairs, with all ceramic plates attached to the joints.
    xs=(-.64,0,.64) if count==6 else (-.48,.48)
    for i,(x,s) in enumerate((x,s) for x in xs for s in (-1,1)):
        hip=(x,s*.30,.82);knee=(x-.21,s*(.77 if wide else .59),.52)
        foot=(x+.14,s*(1.0 if wide else .77),.09)
        def leg(hip=hip,knee=knee,foot=foot):
            C.uv('bronze hip bearing',hip,(.13,.13,.13),m['bronze'])
            C.beam('exposed piston',hip,knee,.065,m['bronze'])
            a=Vector(hip);b=Vector(knee);v=b-a
            C.beam('telescoping piston sleeve',a+v*.08,a+v*.46,.087,m['dark'])
            C.beam('piston retaining collar',a+v*.43,a+v*.49,.097,m['bronze'])
            C.uv('black knee bearing',knee,(.10,.10,.10),m['dark'])
            C.beam('long ceramic shin',knee,foot,.095,m['ceramic'],6)
            C.beam('brass shin rail',(knee[0]+.06,knee[1],knee[2]),(foot[0]+.06,foot[1],foot[2]),.027,m['bronze'])
            C.box('articulated metal foot',foot,(.29,.22,.13),m['dark'])
        rig[f'hoof{i}']=U.group(f'POSE mechanical leg {i}',hip,rig['root'],leg)


def strider():
    m=W.palette();root=U.pivot('POSE Strider root',(0,0,0));rig={'root':root}
    def body():
        C.uv('Strider bronze core',(0,0,.99),(.53,.30,.29),m['bronze'])
        for x in (-.34,0,.34):C.box('Strider overlapping ceramic carapace',(x,0,1.13),(.40,.68,.28),m['ceramic'],.09)
        C.uv('Strider forward lens housing',(.53,0,1.08),(.20,.21,.20),m['dark'])
        C.uv('Strider single luminous lens',(.70,0,1.10),(.035,.12,.12),m['glow'])
        W.crystal('Strider dorsal power crystal',(-.28,0,1.27),.11,.47,m)
    rig['body']=U.group('POSE Strider chassis',(0,0,.85),root,body)
    mechanical_legs(rig,m)
    def lance():
        for s in (-1,1):
            C.beam('Strider jousting rail',(.0,s*.4,1.04),(1.02,s*.4,1.17),.055,m['bronze'])
            leaf_blade('Strider crystal lance',(1.48,s*.4,1.27),(.96,s*.4,1.16),.14,m['glow'])
    rig['weapon']=U.group('POSE Strider twin lances',(.2,0,1.05),rig['body'],lance)
    return rig


def cavalry(faction):
    if faction=='automata':return strider()
    rider,cm=character(faction);pike(faction,rider,cm)
    root=U.pivot('POSE mounted unit root',(0,0,0));rider_root=rider.pop('root')
    U.parent_keep(rider_root,root)
    rider_root.scale=(.70,)*3
    rider_root.location=(-.22,0,.80 if faction=='fairy' else .77)
    # Spread the legs around the saddle; rider legs stay seated during movement.
    for s in (-1,1):rider[f'leg{s}'].rotation_euler.x=s*.48
    rig={'root':root,'body':rider_root}
    rig.update({('riderleg'+k[3:] if k.startswith('leg') else 'riderbody' if k=='body' else k):v for k,v in rider.items()})
    m=mount_palette(faction)
    def body():
        animal_body(faction,m)
        C.box('faction saddle blanket',(-.24,0,1.16),(.58,.69,.10),m['cloth'])
        C.uv('leather saddle seat',(-.23,0,1.23),(.29,.22,.09),m['nose'])
        for s in (-1,1):C.curve('bridle rein',[(.64,s*.15,1.40 if faction in ('fairy','undead') else .88),(.11,s*.28,1.30),(-.06,s*.28,1.38)],.015,m['trim'])
    rig['mount']=U.group('POSE faction mount',(0,0,0),root,body)
    mount_legs(rig,faction,m)
    return rig


def wheel(rig,name,x,y,r,mat,hub):
    def build():
        o=C.cone(name,(x,y,r+.03),r,r,.13,mat,16);o.rotation_euler.x=math.pi/2
        for j in range(8):
            a=j*math.pi/4
            C.beam('wheel raised spoke',(x,y+math.copysign(.08,y),r+.03),
                   (x+math.cos(a)*r*.84,y+math.copysign(.08,y),r+.03+math.sin(a)*r*.84),.03,hub)
        C.uv('wheel axle cap',(x,y+math.copysign(.10,y),r+.03),(.10,.05,.10),hub)
    rig[f'wheel{len([k for k in rig if k.startswith("wheel")])}']=U.group('POSE '+name,(x,y,r+.03),rig['root'],build)


def siege(faction):
    root=U.pivot('POSE siege root',(0,0,0));rig={'root':root}
    if faction in ('tideborn','automata'):m=W.palette()
    elif faction in ('dwarf','undead'):m=E.palette()
    else:m=U.palette()
    def carriage():
        if faction=='orc':
            C.box('Iron Catapult heavy timber bed',(0,0,.55),(1.70,1.05,.30),m['wood'])
            for s in (-1,1):
                C.box('spiked iron side plate',(-.1,s*.53,.75),(1.3,.11,.43),m['iron'])
                for x in (-.6,-.2,.2,.6):
                    C.cone('catapult armor spike',(x,s*.55,1.04),.08,0,.32,m['edge'])
                    C.uv('catapult plate rivet',(x,s*.60,.78),(.04,.025,.04),m['gold'])
                C.beam('heavy catapult upright',(.1,s*.34,.6),(.1,s*.34,1.50),.14,m['wood'])
                C.beam('iron frame brace',(-.65,s*.35,.68),(.1,s*.35,1.44),.085,m['iron'])
            C.mesh('red war banner',[(-.88,-.32,.74),(-.88,.32,.74),(-.88,.25,.26),(-.88,0,.36),(-.88,-.25,.26)],[(0,1,2,3,4)],m['red'])
        elif faction=='fairy':
            for s in (-1,1):
                C.curve('living root runner',[(-.98,s*.47,.18),(-.67,s*.42,.41),(.43,s*.42,.42),(.94,s*.54,.17)],.105,m['wood'])
                C.curve('trebuchet growing trunk',[(-.50,s*.38,.4),(-.32,s*.37,1.00),(.0,s*.28,1.65)],.12,m['wood'])
                C.curve('trebuchet fork brace',[(.64,s*.43,.4),(.38,s*.36,1.05),(.0,s*.28,1.65)],.085,m['wood'])
                C.curve('golden bark vein',[(-.48,s*.40,.47),(-.30,s*.40,1.0),(.01,s*.30,1.65)],.015,m['gold'])
                for x in (-.68,.48):
                    U.leaf_panel('trebuchet canopy leaf',(x,s*.4,.54),(x-.26,s*.77,1.10),.22,m['leaf'])
                    U.leaf_panel('trebuchet young leaf',(x,s*.4,.59),(x+.31,s*.69,.81),.17,m['leafLight'])
            C.beam('trebuchet golden axle',(0,-.4,1.58),(0,.4,1.58),.06,m['gold'])
            C.uv('trebuchet amber heart',(-.32,0,.67),(.17,.17,.24),m['amber'])
        elif faction=='dwarf':
            C.box('Stone Thrower riveted chassis',(0,0,.53),(1.66,1.10,.27),m['steel'])
            for s in (-1,1):
                C.box('square brass pillar',(.05,s*.39,1.0),(.22,.23,.85),m['brass'])
                C.beam('steel frame brace',(-.63,s*.42,.66),(.08,s*.42,1.26),.08,m['steel'])
                C.box('brass chassis border',(-.12,s*.56,.65),(1.45,.06,.09),m['brass'])
                for x in (-.6,-.3,0,.3,.6):C.uv('chassis rivet',(x,s*.59,.54),(.035,.018,.035),m['brass'])
            C.beam('torsion axle',(.05,-.65,1.25),(.05,.65,1.25),.10,m['steel'])
            for s in (-1,1):
                o=C.cone('brass winding drum',(.05,s*.54,1.25),.21,.21,.16,m['brass'],12);o.rotation_euler.x=math.pi/2
                C.beam('winding crank',(.05,s*.67,1.25),(.27,s*.67,1.43),.043,m['steel'])
            for x in (-.5,-.15,.2):C.uv('reserve stone',(x,0,.75),(.17,.19,.15),m['stone'])
        elif faction=='undead':
            C.box('Grave Catapult coffin bed',(-.10,0,.56),(1.7,.87,.26),m['cloth'])
            for s in (-1,1):
                C.curve('giant rib frame',[(-.69,s*.4,.60),(-.33,s*.50,1.30),(.05,s*.38,1.48),(.45,s*.45,.62)],.075,m['bone'])
                for x in (-.63,-.31,.01,.33,.65):C.beam('coffin side rib',(x,s*.46,.47),(x+.09,s*.46,.90),.034,m['bone'])
                E.skull((-.65,s*.48,.94),.56,m)
                C.mesh('torn violet shroud',[(-.61,s*.48,.60),(.54,s*.48,.6),(.38,s*.56,.19),(.04,s*.55,.34),(-.39,s*.53,.18)],[(0,1,2,3,4)],m['purple'])
            C.beam('bone catapult axle',(.05,-.58,1.34),(.05,.58,1.34),.075,m['bone'])
        elif faction=='tideborn':
            C.uv('Mangonel giant shell platform',(0,0,.72),(.82,.62,.39),m['shell'])
            for x in (-.53,-.25,.03,.31,.59):C.curve('mangonel shell ridge',[(x,-.53,.65),(x,-.4,.97),(x,0,1.13),(x,.4,.97),(x,.53,.65)],.035,m['shellShade'])
            for s in (-1,1):
                W.coral('mangonel coral fork',(-.05,s*.37,.9),.68,m)
                C.beam('mangonel kelp binding',(-.10,s*.36,1.11),(.15,s*.36,1.38),.065,m['kelp'])
            for s in (-1,1):
                C.beam('siege crab eye stalk',(.61,s*.28,.78),(.82,s*.32,1.02),.045,m['sea'])
                C.uv('siege crab black eye',(.83,s*.32,1.04),(.06,.05,.06),m['dark'])
        else:
            C.box('Siege Engine hexapod bed',(0,0,.84),(1.72,.88,.32),m['bronze'],.10)
            for x in (-.60,-.20,.20,.60):C.box('Siege Engine ceramic armor',(x,0,1.02),(.35,1.0,.21),m['ceramic'],.07)
            W.crystal('rear power crystal',(-.60,0,1.17),.16,.59,m)
            for s in (-1,1):
                C.beam('crystal cannon brace',(-.3,s*.3,.91),(.22,s*.29,1.41),.075,m['bronze'])
    rig['body']=U.group('POSE faction siege chassis',(0,0,0),root,carriage)
    if faction=='automata':mechanical_legs(rig,m,6,True)
    elif faction=='tideborn':mount_legs(rig,faction,mount_palette(faction))
    else:
        wood=m['wood'];rim=m['iron'] if faction=='orc' else m['gold'] if faction=='fairy' else m['bone'] if faction=='undead' else m['steel']
        hub=m['gold'] if faction in ('orc','fairy') else m['brass'] if faction=='dwarf' else m['purple']
        for x in (-.57,.55):
            for s in (-1,1):wheel(rig,'root wheel' if faction=='fairy' else 'siege wheel',x,s*.63,.29 if faction=='fairy' else .34,wood if faction=='fairy' else rim,hub)
    pivot_height={'orc':1.42,'fairy':1.58,'dwarf':1.25,'undead':1.34,'tideborn':1.42,'automata':1.35}[faction]
    def weapon():
        h=pivot_height
        if faction=='automata':
            C.box('recoiling crystal cannon',(0,0,h),(1.36,.37,.26),m['dark'])
            for s in (-1,1):
                C.beam('split bronze accelerator rail',(-.55,s*.23,h),(1.05,s*.23,h),.06,m['bronze'])
                C.box('ceramic barrel shroud',(.12,s*.28,h+.07),(.88,.15,.23),m['ceramic'])
            leaf_blade('siege focused crystal bolt',(1.26,0,h),(.45,0,h),.20,m['glow'])
            for x in (-.43,-.04,.35):
                ring=W.ring('accelerator induction ring',(x,0,h),.25,.026,m['bronze']);ring.rotation_euler.y=math.pi/2
        else:
            mat=m['bone'] if faction=='undead' else m['coral'] if faction=='tideborn' else m['wood']
            a=(-.81,0,h-.35);b=(.86,0,h+.36)
            C.beam('faction throwing beam',a,b,.07 if faction=='fairy' else .10,mat)
            va,vb=Vector(a),Vector(b);delta=vb-va
            band=m['gold'] if faction in ('orc','fairy') else m['brass'] if faction=='dwarf' else m['bone'] if faction=='undead' else m['kelp']
            for t in (.19,.26,.66,.73):
                C.beam('throwing arm tension binding',va+delta*(t-.013),va+delta*(t+.013),.085 if faction=='fairy' else .115,band)
            if faction=='fairy':
                C.uv('trebuchet amber counterweight',(-.72,0,h-.28),(.24,.23,.31),m['amber'])
                for s in (-1,1):C.curve('trebuchet vine sling',[(.84,s*.03,h+.34),(1.0,s*.15,h+.1),(1.16,s*.15,h+.12)],.022,m['leaf'])
                C.uv('thorn seed payload',(1.13,0,h+.16),(.20,.19,.20),m['wood'])
                for s in (-1,1):C.beam('seed thorn',(1.12,s*.15,h+.20),(1.12,s*.29,h+.29),.037,m['gold'])
            elif faction=='undead':
                C.uv('bone launch cup',(.87,0,h+.33),(.26,.24,.11),m['bone'])
                E.skull((.87,0,h+.54),.90,m)
                C.uv('grave soul charge',(.89,0,h+.70),(.09,.08,.13),m['soul'])
            elif faction=='tideborn':
                W.shell('conch launch cup',(.84,0,h+.39),.56,m)
                C.uv('coral siege pearl',(.88,0,h+.62),(.16,.16,.15),m['coral'])
            else:
                C.box('iron launch spoon',(.87,0,h+.35),(.47,.43,.13),m['iron' if faction=='orc' else 'steel'])
                C.uv('loaded siege stone',(.87,0,h+.56),(.22,.22,.21),m['edge' if faction=='orc' else 'stone'])
                C.box('throwing arm heel',(-.72,0,h-.28),(.27,.30,.23),m['iron' if faction=='orc' else 'brass'])
    rig['weapon']=U.group('POSE faction siege release',(.05,0,pivot_height),root,weapon)
    return rig


def model(asset):
    faction,role=asset.split('-')
    rig={'spear':infantry,'cavalry':cavalry,'siege':siege}[role](faction)
    for obj in rig.values():
        obj['rest_location']=list(obj.location)
        obj['rest_rotation']=list(obj.rotation_euler)
        obj['rest_scale']=list(obj.scale)
    rig['root']['faction']=faction
    return rig

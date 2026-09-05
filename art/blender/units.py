"""Editable sculpted eight-direction RTS characters; run Blender --python units.py -- --sample.
All mesh parts are named, attached to named pose pivots, and baked into four actions.
No external meshes or textures. Neutral forward +X; fixed common orthographic projection.
"""
import bpy, math, sys, json, argparse, subprocess
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
import common as C
BASE=Path(__file__).resolve().parent
IDS=['orc-worker','orc-melee','orc-ranged','orc-special','fairy-worker','fairy-melee','fairy-ranged','fairy-special']
ANIMS={'idle':{'frames':4,'fps':5,'loop':True},'walk':{'frames':8,'fps':10,'loop':True},'attack':{'frames':6,'fps':10,'loop':False},'death':{'frames':6,'fps':6,'loop':False}}

def loft(name,rings,mat,n=12):
    """Elliptic cross-section sculpt, rings are (z, centerX, centerY, radiusX, radiusY)."""
    vs=[(x+rx*math.cos(i*2*math.pi/n),y+ry*math.sin(i*2*math.pi/n),z) for z,x,y,rx,ry in rings for i in range(n)]
    fs=[tuple(reversed(range(n))),tuple((len(rings)-1)*n+i for i in range(n))]
    for j in range(len(rings)-1):
        for i in range(n):fs.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
    o=C.mesh(name,vs,fs,mat)
    for p in o.data.polygons:p.use_smooth=True
    bevel=o.modifiers.new('sculpt edge softness','BEVEL');bevel.width=.012;bevel.segments=2
    return o

def limb(name,a,b,radii,mat):
    a,b=Vector(a),Vector(b);q=(b-a).to_track_quat('Z','Y');length=(b-a).length
    o=loft(name,[(t*length,0,0,r,ry) for t,r,ry in radii],mat)
    o.location=a;o.rotation_euler=q.to_euler();return o

def profile(name,points,thickness,mat):
    # Outline in X,Z, extruded along Y. Intentional blade and leaf silhouettes.
    vs=[(x,y,z) for y in (-thickness/2,thickness/2) for x,z in points];n=len(points)
    fs=[tuple(reversed(range(n))),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    o=C.mesh(name,vs,fs,mat);m=o.modifiers.new('edge glints','BEVEL');m.width=.012;m.segments=2;o.modifiers.new('plate normals','WEIGHTED_NORMAL');return o

def parent_keep(o,parent):
    bpy.context.view_layer.update();m=o.matrix_world.copy();o.parent=parent;o.matrix_world=m

def pivot(name,loc,parent=None):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=loc;o.empty_display_size=.12;o.empty_display_type='ARROWS'
    if parent:parent_keep(o,parent)
    return o

def group(name,loc,parent,fn):
    before=set(bpy.context.scene.objects);fn();children=set(bpy.context.scene.objects)-before
    p=pivot(name,loc,parent)
    for o in children:parent_keep(o,p)
    return p

def palette():
    return {k:C.material(k,c,metallic=.45 if k in ('iron','edge','gold') else 0,emission=1.2 if k=='magic' else 0) for k,c in {
      'skin':'6b792c','skinLight':'8e9745','skinShade':'424f25','iron':'333c3d','edge':'899083','leather':'362b21','red':'85351f','redLight':'b7512e','ivory':'d2c197','black':'111718','eye':'e8ac3f','gold':'ac8850','wood':'644326','fairSkin':'cfb592','hair':'202b48','leaf':'246750','leafLight':'4e9170','violet':'655097','purple':'372d68','wing':'788cb5','vein':'b4c6c9','magic':'86ddf0','amber':'b7a266'}.items()}

def fingerhand(name,pos,size,mat):
    x,y,z=pos
    C.uv(name+' palm',(x,y,z),(size*.85,size*.65,size),mat)
    for j in range(3):
        limb(name+' curled finger '+str(j),(x+.04,y+(j-1)*size*.37,z-.01),(x+.07,y+(j-1)*size*.37,z-size*.68),[(0,size*.22,size*.25),(.5,size*.24,size*.25),(1,size*.16,size*.19)],mat)
    C.uv(name+' thumb',(x+.02,y-size*.62,z+.02),(size*.5,size*.28,size*.4),mat)

def make_orc(asset,m):
    root=pivot('ROOT direction and collapse',(0,0,0));rig={'root':root}
    heavy=asset=='orc-special';w=1.12 if heavy else 1.0
    def body():
        loft('sculpted broad ribcage',[(.66,-.05,0,.19,.28*w),(.84,-.04,0,.26,.35*w),(1.12,-.03,0,.31,.44*w),(1.31,-.04,0,.23,.40*w),(1.39,-.06,0,.17,.25)],m['skin'])
        loft('layered leather cuirass',[(.8,.0,0,.26,.35*w),(1.02,.005,0,.30,.39*w),(1.21,-.025,0,.29,.39*w)],m['leather'])
        if asset!='orc-worker':
            for s in (-1,1):
                C.uv('curved breastplate',(.21,s*.16,1.13),(.13,.195,.24),m['iron'])
                C.curve('breastplate brass edging',[(.27,s*.02,1.29),(.335,s*.20,1.18),(.29,s*.28,1.0)],.018,m['edge'])
        loft('wide war belt',[(.74,0,0,.25,.34*w),(.84,0,0,.27,.36*w)],m['leather'])
        C.box('square belt clasp',(.277,0,.80),(.07,.17,.15),m['gold'],.02)
        for s in (-1,1):
            panel=profile('split red tabard',[(.14,.81),(.29,.79),(.3,.42),(.17,.47),(.10,.40)],.23,m['red']);panel.location.y=s*.18
            C.curve('tunic stitched hem',[(.31,s*.18-.09,.46),(.33,s*.18,.44),(.30,s*.18+.09,.46)],.012,m['gold'])
        C.beam('diagonal chest strap',(.25,-.30,1.3),(.28,.25,.86),.043,m['red'])
        for s in (-1,1):
            C.box('belt pouch',(-.05,s*.38,.77),(.2,.13,.22),m['leather'],.045)
    rig['torso']=group('POSE torso breathing',(0,0,.77),root,body)
    for s in (-1,1):
        def leg(s=s):
            limb('thick thigh',(0,s*.23,.72),(-.03,s*.25,.39),[(0,.16,.16),(.3,.18,.16),(1,.12,.13)],m['skin'])
            limb('leather greave',(-.03,s*.25,.4),(.02,s*.25,.14),[(0,.13,.14),(.2,.16,.15),(.8,.12,.13),(1,.12,.15)],m['leather'])
            C.uv('forged knee plate',(.085,s*.25,.38),(.10,.135,.13),m['iron'])
            C.box('heavy square boot',(.08,s*.25,.10),(.4,.28,.2),m['leather'],.07)
            for j in range(3):C.uv('armored boot toe',(.26,s*.25+(j-1)*.08,.095),(.055,.042,.052),m['edge'])
            C.box('boot upper iron strap',(.10,s*.25,.20),(.24,.29,.05),m['iron'],.012)
        rig['leg'+str(s)]=group('POSE '+('left' if s<0 else 'right')+' leg',(0,s*.23,.72),root,leg)
    def face():
        loft('neck',[(1.25,-.05,0,.15,.18),(1.51,.04,0,.18,.20)],m['skin'])
        loft('angular orc skull',[(1.39,.11,0,.16,.19),(1.49,.11,0,.23,.23),(1.68,.04,0,.235,.245),(1.82,-.005,0,.18,.20),(1.86,-.04,0,.10,.13)],m['skin'])
        C.uv('forward square muzzle',(.28,0,1.48),(.12,.20,.12),m['skinLight'])
        C.curve('mouth dark seam',[(.379,-.16,1.49),(.397,0,1.465),(.379,.16,1.49)],.013,m['black'])
        C.uv('broad nasal bridge',(.285,0,1.64),(.09,.083,.11),m['skinLight'])
        for s in (-1,1):
            C.uv('shadowed eye socket',(.236,s*.13,1.703),(.035,.077,.059),m['skinShade'])
            C.uv('amber eye',(.264,s*.13,1.705),(.023,.040,.025),m['eye'])
            C.uv('slit pupil',(.283,s*.13,1.708),(.012,.013,.023),m['black'])
            C.beam('angry heavy brow',(.245,s*.065,1.75),(.205,s*.21,1.76),.038,m['skinLight'])
            C.curve('curved protruding tusk',[(.325,s*.15,1.43),(.40,s*.18,1.51),(.407,s*.18,1.59)],.024,m['ivory'])
            ear=profile('long pointed ear',[(-.10,1.72),(-.22,1.86),(.06,1.78),(.06,1.61)],.09,m['skin']);ear.location.y=s*.25;ear.rotation_euler.x=s*.3
        if asset=='orc-melee':
            loft('beveled iron helmet',[(1.74,-.03,0,.235,.245),(1.89,-.04,0,.19,.215),(2.00,-.065,0,.06,.08)],m['iron'])
            C.beam('helmet ridge',(.18,0,1.76),(.04,0,1.98),.035,m['edge'])
            for s in (-1,1):
                C.curve('ivory battle horn',[(-.02,s*.18,1.9),(-.10,s*.30,1.94),(-.13,s*.39,2.08)],.041,m['ivory'])
                C.box('helmet cheek guard',(.02,s*.24,1.66),(.19,.055,.24),m['iron'],.027)
        else:
            loft('red head binding',[(1.74,-.01,0,.235,.25),(1.82,-.02,0,.215,.23)],m['red'])
            for j in range(4):
                C.curve('swept coarse hair',[(-.07,0,1.85),(-.18,(j-1.5)*.06,1.94),(-.31,(j-1.5)*.075,1.83)],.05,m['redLight'] if heavy else m['leather'])
            if asset=='orc-ranged':
                loft('pointed crimson hood',[(1.67,-.10,0,.19,.265),(1.9,-.12,0,.25,.26),(2.10,-.25,0,.05,.075)],m['red'])
    rig['head']=group('POSE expressive head',(0,0,1.4),rig['torso'],face)
    for s in (-1,1):
        def arm(s=s):
            limb('massive deltoid',(-.015,s*.35,1.3),(.005,s*.49,1.02),[(0,.18,.20),(.25,.205,.2),(.7,.17,.17),(1,.125,.14)],m['skin'])
            limb('shaped forearm',(.005,s*.49,1.05),(.18,s*.49,.82),[(0,.13,.14),(.3,.15,.15),(.8,.11,.11),(1,.105,.105)],m['skinLight'])
            C.uv('overlapping shoulder cap',(-.025,s*.37,1.34),(.26,.25,.115),m['iron'])
            C.curve('raised shoulder rim',[(.18,s*.28,1.34),(.15,s*.53,1.32),(-.15,s*.56,1.34),(-.24,s*.39,1.38)],.025,m['edge'])
            for j in range(3):
                C.uv('shoulder rivet',(.19-j*.16,s*.50,1.35),(.03,.027,.024),m['gold'])
                if asset!='orc-worker':
                    spike=C.cone('forged shoulder spike',(-.13+j*.14,s*.42,1.52),.06,0,.24,m['edge']);spike.rotation_euler.x=s*.3
            C.box('layered wrist bracer',(.13,s*.49,.91),(.23,.25,.14),m['iron'],.035)
            fingerhand('clenched weapon hand',(.23,s*.49,.79),.12,m['skinLight'])
            if asset=='orc-melee' and s==1:
                shield=C.cone('round shield dark iron rim',(.29,s*.65,.95),.36,.36,.10,m['edge'],24);shield.rotation_euler.x=math.pi/2
                face=C.cone('shield red wooden face',(.29,s*.71,.95),.32,.32,.065,m['red'],24);face.rotation_euler.x=math.pi/2
                C.uv('shield central iron boss',(.29,s*.77,.95),(.12,.055,.12),m['iron'])
                for j in range(8):
                    a=j*math.pi/4;C.uv('shield rim rivet',(.29+.32*math.cos(a),s*.728,.95+.32*math.sin(a)),(.026,.022,.026),m['gold'])
                for off in (-.17,.17):C.beam('shield vertical binding',(.29+off,s*.75,.70),(.29+off,s*.75,1.20),.022,m['iron'])
            elif asset=='orc-melee' or asset=='orc-worker':
                if s==-1:
                    C.beam('long haft',(.23,s*.49,.45),(.27,s*.49,1.40),.04,m['wood'])
                    if asset=='orc-melee':
                        blade=profile('broad hooked axe blade',[(.27,1.40),(.42,1.50),(.72,1.45),(.68,1.13),(.47,1.15),(.40,1.29),(.27,1.29)],.085,m['edge']);blade.location.y=s*.49
                        inlay=profile('axe dark iron core',[(.3,1.38),(.46,1.43),(.62,1.4),(.60,1.23),(.46,1.25)],.093,m['iron']);inlay.location.y=s*.49
                    else:C.box('square smith hammer',(.28,s*.49,1.33),(.38,.20,.24),m['iron'],.035)
            elif asset=='orc-special':
                C.beam('drum beater',(.25,s*.49,.75),(.58,s*.30,1.15),.035,m['wood']);C.uv('padded drum beater tip',(.58,s*.30,1.15),(.075,.075,.075),m['ivory'])
        rig['arm'+str(s)]=group('POSE '+('left weapon' if s<0 else 'right shield')+' arm',(0,s*.35,1.30),rig['torso'],arm)
        if s==-1 and asset in ('orc-melee','orc-worker'):
            wrist=pivot('POSE weapon wrist',(.23,s*.49,.79),rig['arm'+str(s)])
            for o in list(rig['arm'+str(s)].children):
                if o.name.startswith(('long haft','broad hooked axe blade','axe dark iron core','square smith hammer')):parent_keep(o,wrist)
            rig['weapon']=wrist

    def equipment():
        if asset=='orc-ranged':
            C.box('crossbow tiller',(.49,0,.93),(.62,.09,.10),m['wood'],.022)
            C.curve('wide crossbow steel bow',[(.61,-.52,1.03),(.75,-.29,.99),(.78,0,.98),(.75,.29,.99),(.61,.52,1.03)],.036,m['iron'])
            C.curve('taut crossbow string',[(.61,-.52,1.03),(.40,0,.99),(.61,.52,1.03)],.008,m['ivory']);C.beam('loaded quarrel',(.30,0,1.02),(.92,0,1.02),.012,m['edge'])
            C.box('back bolt quiver',(-.36,.14,1.14),(.17,.20,.47),m['leather'])
            for s in range(4):C.beam('spare bolt',(-.36,.07+s*.046,1.20),(-.38,.07+s*.046,1.55),.014,m['wood'])
        if asset=='orc-special':
            drum=C.cone('large strapped war drum',(.46,0,.69),.38,.35,.45,m['wood'],20);drum.rotation_euler.y=math.pi/2
            for x in (.24,.68):
                ring=C.cone('drum metal binding',(x,0,.69),.39,.39,.038,m['iron'],20);ring.rotation_euler.y=math.pi/2
            head=C.cone('taut rawhide drumhead',(.705,0,.69),.35,.35,.02,m['ivory'],24);head.rotation_euler.y=math.pi/2
            for j in range(10):
                a=j*math.pi/5;C.beam('drum tension lacing',(.26,.365*math.sin(a),.69+.365*math.cos(a)),(.66,.365*math.sin(a+.2),.69+.365*math.cos(a+.2)),.012,m['gold'])
            C.beam('drum shoulder harness',(.10,-.30,1.27),(.45,-.33,.77),.04,m['red'])
    rig['equipment']=group('POSE carried equipment',(0,0,.9),rig['torso'],equipment)
    if heavy:root.scale=(1.07,1.07,1.07)
    return rig

def leaf_panel(name,base,tip,width,mat,bend=.08):
    b,t=Vector(base),Vector(tip);v=t-b;side=Vector((0,1,0))*width
    verts=[b,b+v*.35+side,b+v*.73+side*.7,t,b+v*.73-side*.7,b+v*.35-side,b+v*.48+Vector((bend,0,0))]
    o=C.mesh(name,[tuple(x) for x in verts],[(6,i,(i+1)%6) for i in range(6)],mat);so=o.modifiers.new('cloth thickness','SOLIDIFY');so.thickness=.017
    be=o.modifiers.new('soft leaf edge','BEVEL');be.width=.009;be.segments=2
    return o

def make_fairy(asset,m):
    root=pivot('ROOT direction and collapse',(0,0,0));rig={'root':root};caster=asset=='fairy-special'
    cloth=m['violet'] if caster else m['leaf'];hair=m['ivory'] if asset=='fairy-ranged' else m['hair']
    def body():
        loft('slender sculpted torso',[(.74,0,0,.12,.16),(.95,0,0,.10,.13),(1.15,0,0,.15,.19),(1.31,-.02,0,.105,.22),(1.37,-.02,0,.08,.15)],m['fairSkin'])
        loft('fitted leaf bodice',[(.84,.0,0,.125,.17),(1.00,0,0,.115,.15),(1.2,0,0,.155,.20),(1.28,-.015,0,.115,.20)],cloth)
        for s in (-1,1):
            leaf_panel('pointed chest leaf',(.14,s*.07,1.02),(.18,s*.17,1.30),.075,m['leafLight'] if not caster else m['purple'])
        C.curve('gold bodice seam',[(.14,0,.91),(.175,0,1.15),(.12,0,1.31)],.014,m['gold'])
        for j in range(9):
            a=j*2*math.pi/9;start=(.10*math.cos(a),.16*math.sin(a),.92);end=(.24*math.cos(a),.32*math.sin(a),.47+(j%3)*.065)
            o=leaf_panel('overlapping pointed skirt petal',start,end,.10,cloth if j%2 else (m['purple'] if caster else m['leafLight']),.04)
        C.uv('waist amber jewel',(.146,0,.91),(.035,.055,.067),m['gold'])
        if caster:
            for j in range(7):
                y=(j-3)*.09
                leaf_panel('flowing split violet cape',(-.14,y,1.31),(-.48,y*1.8,.22+(j%2)*.1),.10,m['purple'] if j%2 else m['violet'],-.10)
                C.curve('cape embroidered fold',[(-.16,y,1.25),(-.27,y*1.4,.70),(-.46,y*1.8,.30+(j%2)*.1)],.009,m['gold'])
    rig['torso']=group('POSE torso breathing',(0,0,.80),root,body)
    for s in (-1,1):
        def leg(s=s):
            limb('long thigh',(.0,s*.105,.80),(.025,s*.14,.43),[(0,.078,.078),(.2,.09,.08),(1,.052,.052)],m['fairSkin'])
            limb('slender shin',(.025,s*.14,.43),(-.015,s*.15,.115),[(0,.052,.056),(.3,.061,.057),(1,.035,.038)],m['fairSkin'])
            C.uv('pointed leaf shoe',(.066,s*.15,.088),(.15,.063,.07),cloth)
            for z in (.17,.25,.34):C.curve('spiral sandal binding',[(-.015,s*.15-.044,z),(.063,s*.15,z+.02),(-.012,s*.15+.044,z+.05)],.012,m['gold'])
        rig['leg'+str(s)]=group('POSE '+str(s)+' leg',(0,s*.105,.80),root,leg)
    def face():
        limb('graceful neck',(-.025,0,1.27),(-.015,0,1.49),[(0,.066,.068),(1,.06,.06)],m['fairSkin'])
        loft('sculpted fairy face',[(1.43,.055,0,.06,.063),(1.50,.03,0,.105,.11),(1.63,-.01,0,.13,.13),(1.73,-.04,0,.10,.12),(1.78,-.05,0,.045,.065)],m['fairSkin'])
        C.uv('slender nose',(.125,0,1.59),(.028,.026,.053),m['fairSkin'])
        for s in (-1,1):
            C.curve('almond eye',[(.111,s*.035,1.641),(.113,s*.071,1.647),(.096,s*.093,1.638)],.012,m['black'])
            C.uv('eye glint',(.123,s*.060,1.645),(.008,.012,.008),m['magic'])
            C.beam('arched eyebrow',(.094,s*.031,1.681),(.084,s*.096,1.681),.011,hair)
            ear=profile('pointed elven ear',[(-.02,1.58),(-.1,1.75),(.035,1.67)],.033,m['fairSkin']);ear.location.y=s*.125;ear.rotation_euler.x=s*.5
        C.curve('rose lips',[(.113,-.029,1.532),(.126,0,1.53),(.113,.029,1.532)],.008,m['red'])
        loft('sculpted hair cap',[(1.64,-.065,0,.12,.142),(1.75,-.067,0,.11,.135),(1.81,-.065,0,.05,.078)],hair)
        for s in (-1,1):
            for j in range(3):
                C.curve('swept hair lock',[(-.0,s*.10,1.78),(-.12-j*.04,s*(.12+j*.015),1.58),(-.15-j*.04,s*.17,1.36)],.035,hair)
            C.curve('brow swept fringe',[(.02,s*.02,1.79),(.088,s*.08,1.73),(.0,s*.16,1.64)],.025,hair)
        for j in range(5):
            a=(j-2)*.48;y=.13*math.sin(a);x=.095*math.cos(a)
            C.beam('gold crown tine',(x,y,1.76),(x+.01,y*1.2,1.86+(.06 if j==2 else 0)),.011,m['gold'])
            C.uv('crown crystal',(x+.01,y*1.2,1.88+(.06 if j==2 else 0)),(.022,.022,.038),m['magic'] if caster else m['amber'])
            if asset=='fairy-worker':
                leaf_panel('gardener crown pointed leaf',(x,y,1.76),(x-.035,y*1.5,1.92+(.04 if j==2 else 0)),.034,m['leafLight'])
    rig['head']=group('POSE expressive head',(0,0,1.4),rig['torso'],face)
    for s in (-1,1):
        def wing(s=s):
            # Membrane fans sit behind the shoulders; each has a ridge and branched veins.
            specs=[(.89,2.32,.40),(.94,1.54,.37),(.63,.99,.22)] if caster else [(.62,2.1,.26),(.78,1.48,.28)]
            if asset=='fairy-melee':specs=[(.58,2.35,.18),(.66,1.65,.18)]
            if asset=='fairy-worker':specs=[(.54,1.94,.22),(.57,1.38,.20)]
            for j,(spread,z,width) in enumerate(specs):
                b=Vector((-.12,s*.13,1.25));t=Vector((-.26,s*spread,z));v=t-b
                pts=[b,b+v*.25+Vector((-.02,s*width,.03)),b+v*.72+Vector((-.01,s*width*.75,.02)),t,b+v*.65+Vector((.01,-s*width*.43,0)),b+v*.23+Vector((0,-s*width*.28,0))]
                center=b+v*.49+Vector((-.06,0,0));o=C.mesh('veined opaque wing membrane',[tuple(p) for p in pts]+[tuple(center)],[(6,k,(k+1)%6) for k in range(6)],m['violet'] if caster else (m['amber'] if asset=='fairy-ranged' else m['wing']))
                so=o.modifiers.new('wing membrane thickness','SOLIDIFY');so.thickness=.012
                C.curve('wing scalloped luminous border',[tuple(p) for p in pts]+[tuple(pts[0])],.012,m['vein'])
                C.curve('wing central vein',[tuple(b),tuple(center),tuple(t)],.014,m['vein'])
                for k in (1,2,4,5):C.curve('branching wing vein',[tuple(b+v*(.3 if k in (1,5) else .6)),tuple(pts[k])],.007,m['vein'])
                C.uv('wing tip light',t,(.022,.026,.03),m['magic'] if caster else m['ivory'])
        rig['wing'+str(s)]=group('POSE '+str(s)+' wing shoulder',(-.12,s*.13,1.25),rig['torso'],wing)
    for s in (-1,1):
        hand=(.23,s*.33,1.03 if caster else .85)
        def arm(s=s,hand=hand):
            elbow=(.01,s*.31,1.05)
            limb('slender upper arm',(-.015,s*.20,1.29),elbow,[(0,.060,.062),(.4,.063,.058),(1,.043,.043)],m['fairSkin'])
            limb('tapered forearm',elbow,hand,[(0,.045,.043),(.3,.05,.044),(1,.029,.033)],m['fairSkin'])
            leaf_panel('pointed shoulder leaf',(-.02,s*.17,1.25),(-.02,s*.28,1.38),.06,cloth)
            fingerhand('fine hand',hand,.047,m['fairSkin'])
            C.uv('gold wrist cuff',(hand[0]-.04,hand[1],hand[2]+.008),(.025,.048,.05),m['gold'])
            if caster:
                for j in range(3):C.uv('floating spell mote',(hand[0]+.055+j*.012,hand[1]+(j-1)*.055,hand[2]+.13+(.055 if j==1 else 0)),(.026,.023,.04),m['magic'])
                C.curve('spell crescent',[(hand[0]+.02,hand[1]-.085,hand[2]+.12),(hand[0]+.03,hand[1],hand[2]+.10),(hand[0]+.02,hand[1]+.085,hand[2]+.12)],.009,m['vein'])
            if s==-1 and asset=='fairy-melee':
                C.beam('long spear shaft',(.23,s*.33,.25),(.23,s*.33,2.08),.019,m['wood'])
                tip=profile('leaf spear blade',[(.23,2.35),(.12,2.10),(.23,1.98),(.34,2.10)],.025,m['gold']);tip.location.y=s*.33
                C.beam('spear blade spine',(.23,s*.35,2.02),(.23,s*.35,2.28),.010,m['ivory'])
            if s==-1 and asset=='fairy-ranged':
                C.curve('carved tall bow',[(.23,s*.33,.40),(.41,s*.33,.60),(.46,s*.33,.9),(.40,s*.33,1.22),(.22,s*.33,1.43)],.023,m['gold'])
                C.beam('taut bow string',(.23,s*.33,.40),(.22,s*.33,1.43),.006,m['ivory']);C.beam('nocked arrow',(.04,s*.33,.92),(.77,s*.33,.92),.009,m['wood'])
            if asset=='fairy-worker':
                if s==-1:
                    C.beam('gardener trowel haft',(.23,s*.33,.78),(.23,s*.33,1.12),.018,m['wood']);blade=profile('gardener leaf trowel',[(.23,1.28),(.15,1.13),(.23,1.05),(.30,1.13)],.025,m['gold']);blade.location.y=s*.33
                else:
                    C.uv('watering pitcher',(.25,s*.33,.70),(.12,.09,.12),m['gold']);C.curve('pitcher spout',[(.31,s*.33,.72),(.43,s*.33,.76),(.47,s*.33,.82)],.025,m['gold']);C.curve('pitcher loop handle',[(.18,s*.33,.79),(.10,s*.33,.82),(.10,s*.33,.69),(.17,s*.33,.66)],.015,m['gold'])
        rig['arm'+str(s)]=group('POSE '+str(s)+' arm',(-.015,s*.20,1.29),rig['torso'],arm)
    return rig

def pose(rig,asset,state,f,n,direction=0,key=False):
    t=f/max(1,n-1);phase=f/n*2*math.pi;fairy=asset.startswith('fairy')
    for o in rig.values():
        o.rotation_euler=(0,0,0)
        if '_base' not in o:o['_base']=list(o.location)
        o.location=o['_base']
    root=rig['root'];root.rotation_euler.z=-direction*math.pi/4
    if state=='idle':
        rig['torso'].scale=(1,1,1+.012*math.sin(phase));rig['head'].rotation_euler.y=.025*math.sin(phase)
    else:rig['torso'].scale=(1,1,1)
    if state=='walk':
        for s in (-1,1):
            rig['leg'+str(s)].rotation_euler.y=.42*s*math.sin(phase)
            rig['arm'+str(s)].rotation_euler.y=-.24*s*math.sin(phase)
        rig['torso'].location.z+=.028*abs(math.cos(phase))
    if state=='attack':
        # Anticipation, forceful contact at frame2, recovery.
        swing=[.65,.9,-.70,-.43,-.12,0][f]
        if asset in ('orc-melee','orc-worker','fairy-worker'):
            rig['arm-1'].rotation_euler.y=swing;rig['torso'].rotation_euler.y=.09*swing
            if 'weapon' in rig:
                rig['arm-1'].rotation_euler.y=[0,-.85,-.35,-.2,-.1,0][f]
                rig['weapon'].rotation_euler.y=[-.6,-1.1,1.35,.75,.2,0][f]
        elif asset=='orc-special':
            for s in (-1,1):rig['arm'+str(s)].rotation_euler.y=-swing*(1 if s<0 else .75)
        elif asset=='fairy-melee':
            rig['arm-1'].rotation_euler.y=-.3+swing*.5;rig['arm-1'].location.x+=.2 if f==2 else 0
        elif asset=='fairy-special':
            for s in (-1,1):rig['arm'+str(s)].rotation_euler.x=s*(.2+.5*math.sin(math.pi*t));rig['arm'+str(s)].rotation_euler.y=-.2
        else:
            rig['arm1'].rotation_euler.z=.35*math.sin(math.pi*t);rig['arm1'].location.x-=.16*math.sin(math.pi*t)
            rig['torso'].rotation_euler.y=-.08 if f==2 else .03
            if 'equipment' in rig:rig['equipment'].location.x-=.09 if f==2 else 0
    for s in (-1,1):
        if 'wing'+str(s) in rig:rig['wing'+str(s)].rotation_euler.z=s*.18*math.sin(phase)
    if state=='death':
        root.rotation_euler.y=-1.48*t;root.location.z=.22*t
        root.location.x=.55*t*math.cos(-direction*math.pi/4);root.location.y=.55*t*math.sin(-direction*math.pi/4)
        rig['arm-1'].rotation_euler.x=-.5*t;rig['arm1'].rotation_euler.x=.4*t
        for s in (-1,1):
            if 'wing'+str(s) in rig:rig['wing'+str(s)].rotation_euler.x=s*.35*t
    for o in bpy.context.scene.objects:
        if o.name.startswith(('nocked arrow','loaded quarrel')):o.hide_render=(state=='attack' and 2<=f<5)
    if key:
        for o in rig.values():
            for prop in ('location','rotation_euler','scale'):o.keyframe_insert(data_path=prop,frame=f+1,group=state)
    bpy.context.view_layer.update()

def bake_actions(rig,asset):
    for state,cfg in ANIMS.items():
        for o in rig.values():
            o.animation_data_clear();o.animation_data_create();o.animation_data.action=bpy.data.actions.new(asset+' / '+state+' / '+o.name)
            o.animation_data.action.use_fake_user=True
        for f in range(cfg['frames']):pose(rig,asset,state,f,cfg['frames'],key=True)
    for o in rig.values():o.animation_data_clear()
    pose(rig,asset,'idle',0,4)

def render_frame(path):
    # Shared renderer owns 2x supersampling and linear alpha-aware reduction.
    C.render(str(path))

def main():
    p=argparse.ArgumentParser();p.add_argument('--sample',action='store_true');p.add_argument('--all',action='store_true');p.add_argument('--asset',choices=IDS);p.add_argument('--direction',type=int);p.add_argument('--state',choices=ANIMS);p.add_argument('--models-only',action='store_true');args=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    ids=[args.asset] if args.asset else (['orc-melee','fairy-special'] if args.sample else IDS)
    if not (args.sample or args.all or args.asset or args.models_only):p.error('choose --sample, --all, --asset or --models-only')
    for asset in ids:
        C.reset_scene();m=palette();rig=make_orc(asset,m) if asset.startswith('orc') else make_fairy(asset,m)
        width=192 if asset.startswith('fairy') else 160; height=192; anchor=[width//2,144]
        scene=C.setup_render(width,height,anchor,samples=32);scene['asset_id']=asset;scene['generator']='units.py sculpted v1';scene['animation_contract']=json.dumps(ANIMS);scene['neutral_forward']='+X'
        bake_actions(rig,asset);C.save(str(BASE/'scenes'/('unit-'+asset+'.blend')))
        out=BASE/'raw/units'/asset;out.mkdir(parents=True,exist_ok=True)
        (out/'meta.json').write_text(json.dumps({'id':asset,'kind':'unit','width':width,'height':height,'anchor':anchor,'animations':ANIMS},indent=2))
        if args.models_only:continue
        if args.sample:jobs=[('idle',d,0) for d in (0,1,2)]+[('attack',0,2),('death',0,5)]
        else:jobs=[(state,d,f) for state,cfg in ANIMS.items() if not args.state or args.state==state for d in range(8) if args.direction is None or args.direction==d for f in range(cfg['frames'])]
        for state,d,f in jobs:
            pose(rig,asset,state,f,ANIMS[state]['frames'],d);render_frame(out/f'{state}-{d}-{f:02}.png')
        print('UNIT COMPLETE',asset,len(jobs),flush=True)
if __name__=='__main__':main()

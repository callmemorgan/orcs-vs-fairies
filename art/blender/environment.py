"""Editable deterministic forest, mineral and battlefield scenery."""
import bpy,sys,os,math,random,json,argparse
from pathlib import Path
sys.path.insert(0,os.path.dirname(__file__))
from common import *
from scenery_forms import branch, blade, frond, fissure, leafy_cluster
ROOT=Path(__file__).resolve().parent;OUT=ROOT/'raw/environment';SCENES=ROOT/'scenes'
R=random.Random(47)

def palette():
 return {k:material(k,c) for k,c in {'bark':'59472c','barkLight':'87704a','wood':'be9961','grass':'475c42','grassLight':'6c7c54','moss':'506548','leaf':'326955','leafLight':'53846a','leafDark':'234d43','pine':'37573b','pineLight':'587346','stone':'85877c','stoneLight':'adb0a0','stoneDark':'585f59','ore':'d39743','flower':'ad9aba','earth':'887a50','earthLight':'a5976b','grassDark':'364b35','barkDark':'3b3023','flowerLight':'d6b9cf'}.items()}

def leaf(name,loc,length,width,mat,angle=0):
 # Raised midrib catches a wide highlight; asymmetry keeps clusters irregular.
 verts=[(-length/2,0,0),(-length*.12,width/2,0),(length/2,0,.035),(-length*.08,-width/2,0),(0,0,width*.24)]
 o=mesh(name,verts,[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],mat);o.location=loc;o.rotation_euler=(R.uniform(-.35,.35),R.uniform(-.2,.2),angle)
 if length>.25:
  midrib=curve('raised leaf midrib',[(-length*.44,0,.004),(0,0,width*.25),(length*.46,0,.036)],.006,mat);midrib.parent=o
 return o

def rock(name,loc,scale,mat):
 n=7;verts=[]
 for j,(z,r) in enumerate([(0,.75),(.25,1),(.8,.65),(1,.22)]):
  for i in range(n):
   a=i*math.tau/n+(j%2)*.1;rr=r*R.uniform(.8,1.15);verts.append((math.cos(a)*rr*scale[0],math.sin(a)*rr*scale[1],z*scale[2]))
 faces=[tuple(range(n-1,-1,-1))]
 for j in range(3):
  for i in range(n):a=j*n+i;b=j*n+(i+1)%n;faces.append((a,b,b+n,a+n))
 faces.append(tuple(3*n+i for i in range(n)));o=mesh(name,verts,faces,mat);o.location=loc
 if scale[2]>.12:
  mod=o.modifiers.new('worn mineral arrises','BEVEL');mod.width=min(scale)*.045;mod.segments=2
  o.modifiers.new('broad rock face normals','WEIGHTED_NORMAL')
 return o

def roots(m,size=1):
 for i in range(7):
  a=i*math.tau/7+.12*math.sin(i);end=(math.cos(a)*size,math.sin(a)*size,.025)
  branch('flared buttress root',[(0,0,.48*min(1,size)),(end[0]*.32,end[1]*.32,.19*min(1,size)),(end[0]*.72,end[1]*.72,.055),end],[.15,.12,.055,.008],m['bark'])
  if i%2==0:
   branch('forked rootlet',[(end[0]*.65,end[1]*.65,.06),(end[0]*.85-.14,end[1]*.85+.1,.025)],[.042,.005],m['barkLight'],8)

def canopy(m,p,r,conifer=False):
 # One broad irregular crown per major branch, with overlapping leaf shells.
 colors=[m['leafDark'],m['leaf'],m['leafLight']]
 leafy_cluster('broad irregular oak crown',p,r,colors,R,count=190,proportions=(1.15,1.10,.75),leaf_scale=.43)

def oak(m):
 roots(m,.9)
 trunk=[(0,0,.10),(-.09,.025,.52),(-.13,.035,1.02),(-.03,.08,1.52),(.08,.10,2.13),(.02,.11,2.88)]
 branch('gnarled oak trunk',trunk,[.35,.29,.24,.22,.15,.045],m['bark'],14)
 for j in range(8):
  a=j*2.399;h=1.35+(j%4)*.22;r=.85+(j%3)*.10
  tip=(math.cos(a)*r,math.sin(a)*r,h+.85)
  elbow=(tip[0]*.57,tip[1]*.57,h+.16)
  branch('tapered oak scaffold limb',[(-.06,.06,h-.3),elbow,tip],[.145,.09,.022],m['bark'])
  for side in (-1,1):
   twig=(tip[0]+math.cos(a+side*.75)*.26,tip[1]+math.sin(a+side*.75)*.26,tip[2]+.16)
   branch('oak secondary fork',[elbow,tip,twig],[.062,.028,.006],m['barkLight'],8)
  canopy(m,tip,.69)
 canopy(m,(.03,.10,3.07),.72)
 for j in range(12):
  a=j*math.tau/12
  points=[(p[0]+math.cos(a+.1*i)*r,p[1]+math.sin(a+.1*i)*r,p[2]) for i,(p,r) in enumerate(zip(trunk[:-1],[.35,.295,.247,.226,.156]))]
  fissure('long oak bark furrow',points,m['barkLight'] if j%3 else m['leafDark'],.009)
 # A dark knot seated in its grown-over wooden collar on the visible trunk face.
 uv('oak knot hollow',(.13,-.19,.9),(.09,.025,.135),m['bark'],16,10)
 curve('oak knot raised collar',[(.13+math.cos(a)*.10,-.214,.9+math.sin(a)*.15) for a in [i*math.tau/20 for i in range(21)]],.024,m['barkLight'])
 for j in range(6):
  a=j*2.4;x,y=math.cos(a)*.56,math.sin(a)*.56
  for k in range(4):frond('root fern frond',(x,y,.04),a+k*.8,.28,.065,m['moss'])

def pine(m):
 roots(m,.65)
 branch('tapered pine leader',[(0,0,0),(.02,.01,1.1),(-.025,.04,2.3),(.025,0,3.85)],[.23,.15,.085,.008],m['bark'],12)
 for tier in range(7):
  h=.75+tier*.43;r=1.1-tier*.125
  for j in range(7):
   a=j*math.tau/7+tier*.61;rj=r*R.uniform(.86,1.08)
   start=(.02,0,h+.12);elbow=(math.cos(a)*rj*.52,math.sin(a)*rj*.52,h+.05);tip=(math.cos(a)*rj,math.sin(a)*rj,h-.09)
   branch('swept pine bough',[start,elbow,tip],[.046,.025,.006],m['bark'],8)
   for k in range(4):
    t=.15+k*.19;p=(tip[0]*t,tip[1]*t,h+.11-.13*t)
    for side in (-1,1):
     frond('layered pine needle fan',p,a+side*(.65-.1*k),rj*(.65-.065*k),rj*.15,m['pineLight'] if (j+k+tier)%5==0 else m['pine'] if tier%2 else m['leafDark'])
   frond('pine terminal needle fan',(tip[0]*.68,tip[1]*.68,h+.07),a,rj*.43,rj*.105,m['pineLight'])
 for j in range(7):
  a=j*2.4
  blade('pine needle crown',[(.02,0,3.50),(.02+math.cos(a)*.12,math.sin(a)*.12,3.67),(.025,0,3.96)],[.03,.065,0],m['pineLight'] if j%3==0 else m['pine'])
 for j in range(6):
  a=j*math.tau/6
  fissure('pine bark seam',[(math.cos(a)*.21,math.sin(a)*.21,.08),(math.cos(a)*.18,math.sin(a)*.18,.5),(math.cos(a)*.15+.02,math.sin(a)*.15,1.0)],m['barkLight'],.009)
 for j in range(5):
  a=j*2.4;x,y=math.cos(a)*.55,math.sin(a)*.55
  cone('fallen pine cone',(x,y,.055),.055,.018,.11,m['barkLight'],8)

def ore(m):
 m=dict(m);m['stone']=material('ore dark slate','555e58');m['stoneLight']=material('ore split face','6c766c');m['stoneDark']=material('ore deep face','414b47')
 for i,(x,y,h) in enumerate([(-.3,.15,1.15),(.25,.08,1.5),(.02,-.32,.8),(.6,.25,.55),(-.65,-.1,.45)]):
  o=rock('split mineral rock',(x,y,0),(.35,.3,h),[m['stone'],m['stoneLight'],m['stoneDark']][i%3])
  # Flat jagged veins stay inside individual triangular rock faces.
  for face in list(o.data.polygons)[8:15:2]:
   av,bv,cv=[o.data.vertices[v].co.copy()+o.location for v in list(face.vertices)[:3]]
   normal=(bv-av).cross(cv-av).normalized()*.003
   def point(u,v):return av+(bv-av)*u+(cv-av)*v+normal
   seam=[point(.18,.18),point(.43,.21),point(.50,.12),point(.72,.13),point(.71,.15),point(.50,.15),point(.44,.245),point(.18,.21)]
   mesh('flush jagged mineral vein',seam,[(0,1,6,7),(1,2,5,6),(2,3,4,5)],m['ore'])
  for k in range(2):
   q=rock('fractured ore shard',(x+.14*k,y-.20,h*.15),(.10,.08,.24),m['ore']);q.rotation_euler.y=.25*(k+1)
  for j in range(3):
   a=j*2.2+i;rock('exposed warm ore',(x+math.cos(a)*.2,y+math.sin(a)*.2,h*.23+j*.14),(.065,.05,.16),m['ore'])
 for j in range(8):
  a=R.random()*math.tau;rock('ore chips',(math.cos(a)*.8,math.sin(a)*.65,0),(.07,.05,.09),m['stone'])

def stump(m):
 roots(m,.58)
 branch('splintered stump trunk',[(0,0,.04),(-.015,0,.22),(0,.01,.48)],[.31,.27,.24],m['bark'],14)
 cone('exposed cut wood',(0,.01,.482),.228,.228,.015,m['wood'],24)
 for r in (.045,.09,.145,.197):
  curve('uneven stump growth ring',[(math.cos(a)*r*(1+.045*math.sin(a*3)),.01+math.sin(a)*r,.494) for a in [i*math.tau/36 for i in range(37)]],.004,m['barkLight'])
 for i in range(11):
  a=i*math.tau/11
  branch('raised bark plate',[(math.cos(a)*.31,math.sin(a)*.31,.04),(math.cos(a+.025)*.27,math.sin(a+.025)*.27,.27),(math.cos(a)*.235,math.sin(a)*.235,.47+(.04 if i%3==0 else 0))],[.035,.032,.014],m['barkLight'] if i%3 else m['barkDark'],6)
 for a in (.35,2.7,4.6):fissure('deep radial cut crack',[(math.cos(a)*.06,.01+math.sin(a)*.06,.499),(math.cos(a+.08)*.15,.01+math.sin(a+.08)*.15,.499),(math.cos(a)*.225,.01+math.sin(a)*.225,.499)],m['barkDark'],.008)
 for x,y in ((.27,-.12),(.30,-.04)):
  beam('shelf mushroom stem',(x,y,.13),(x+.035,y,.19),.018,m['wood'])
  uv('shelf mushroom cap',(x+.035,y,.2),(.10,.065,.03),m['wood'])

def ruin(m):
 box('sunken pillar footing',(0,0,.06),(.72,.72,.12),m['stoneDark'],.035)
 box('pillar bevelled base',(0,0,.17),(.62,.62,.12),m['stone'],.025)
 for j in range(4):
  b=box('ancient dressed stone',(0,0,.16+j*.31),(.52-j*.025,.52-j*.025,.29),m['stoneLight'] if j%2 else m['stone'],.025);b.rotation_euler.z=j*.035
 box('broken capital',(.04,0,1.35),(.7,.64,.2),m['stone'],.04)
 for j in range(3):rock('fallen masonry',(.55+R.random()*.35,R.uniform(-.4,.5),0),(.25,.2,.18),m['stoneDark'])
 for j in range(12):leaf('moss on ruin',(R.uniform(-.5,.7),R.uniform(-.5,.5),.05),.18,.12,m['moss'],R.random()*math.tau)
 for j in range(2):box('carved rune vertical',(.252,-.06+j*.12,.78),(.006,.018,.14),m['stoneDark'],0)
 fissure('capital fracture',[(.16,-.323,1.29),(.10,-.324,1.37),(.19,-.323,1.43),(.23,-.15,1.452)],m['stoneDark'],.013)
 fissure('stone face weather crack',[(.264,-.15,.41),(.262,-.11,.53),(.25,-.17,.64)],m['stoneDark'],.009)
 vine=[(.12,-.29,.07),(.23,-.28,.32),(.15,-.29,.61),(.26,-.26,.88),(.20,-.28,1.13)]
 curve('climbing ivy stem',vine,.012,m['moss'])
 for j,p in enumerate(vine):
  for sign in (-1,1):
   o=leaf('ivy on masonry',(p[0]+sign*.065,p[1]-.025,p[2]+.045),.16,.12,m['moss'],sign*.65);o.rotation_euler.x=.9


def ruin_ring(m):
 for i in range(22):
  if i in (3,4,14):continue
  a=i*math.tau/22;r=1.9+R.uniform(-.07,.07)
  b=box('broken circular paving',(math.cos(a)*r,math.sin(a)*r,.05),(.48,.4,.10),m['stone'] if i%3 else m['stoneLight'],.035);b.rotation_euler.z=a
  if i%3==0:
   x,y=math.cos(a)*r,math.sin(a)*r
   fissure('paving fracture',[(x-.13,y-.09,.107),(x-.02,y,.108),(x+.08,y+.10,.107)],m['stoneDark'],.008)
 for i in range(14):
  if i in (6,7,11):continue
  a=i*math.tau/14;r=1.08
  b=box('inner spiral stones',(math.cos(a)*r,math.sin(a)*r,.025),(.31,.24,.06),m['stoneDark'] if i%3 else m['stone'],.02);b.rotation_euler.z=a
 for j in range(18):
  a=R.random()*math.tau;r=R.uniform(1.5,2.2);leaf('moss between paving',(math.cos(a)*r,math.sin(a)*r,.115),.28,.16,m['moss'],a)

def tile(m,kind):
 base=m['grass'] if 'grass' in kind else m['earth'] if 'dirt' in kind else m['stoneDark']
 mesh('ground diamond',[(-.5,-.5,0),(.5,-.5,0),(.5,.5,0),(-.5,.5,0)],[(0,1,2,3)],base)
 if 'stone' in kind:
  for row in range(3):
   for col in range(3):
    x=-.325+col*.325;y=-.325+row*.325
    verts=[(x-.15,y-.13,.01),(x-.10,y-.155,.01),(x+.145,y-.14,.01),(x+.153,y+.09,.01),(x+.10,y+.145,.01),(x-.145,y+.14,.01)]
    mesh('chipped flagstone',verts,[(0,1,2,3,4,5)],m['stoneLight'] if (row+col)%3==0 else m['stone'])
    if (row+col)%2==0:fissure('flagstone hairline',[(x-.14,y+.04,.013),(x-.02,y,.013),(x+.07,y-.14,.013)],m['stoneDark'],.003)
 else:
  for j in range(24):
   x,y=R.uniform(-.41,.41),R.uniform(-.41,.41)
   if 'grass' in kind:
    leaf('clover ground cover',(x,y,.002),R.uniform(.05,.10),.035,m['grassLight'] if j%3 else m['moss'],R.random()*math.tau)
    if j%4==0:
     for k in range(3):
      a=k*2.4+j;h=R.uniform(.025,.07)
      blade('folded grass blade',[(x,y,.003),(x+math.cos(a)*.014,y+math.sin(a)*.014,h*.65),(x+math.cos(a)*.04,y+math.sin(a)*.04,h)],[.007,.008,0],m['grassLight'] if k==0 else m['grassDark'])
   else:rock('embedded soil pebble',(x,y,.001),(.025,.019,.013),m['earthLight'] if j%2 else m['stoneDark'])
  if 'dirt' in kind:
   for j in range(3):
    y=-.24+j*.22
    fissure('shallow weathered soil groove',[(-.32,y,.003),(-.10,y+.045,.003),(.13,y+.035,.003),(.31,y+.06,.003)],m['earthLight'],.005)

def flowers(m):
 for j in range(11):
  x,y=R.uniform(-.45,.45),R.uniform(-.3,.3);h=R.uniform(.18,.4)
  curve('bending wildflower stem',[(x,y,0),(x+.025,y,h*.55),(x+.05,y-.015,h)],.008,m['moss'])
  for sign in (-1,1):
   blade('lanceolate flower leaf',[(x,y,h*.3),(x+sign*.07,y+.03,h*.44),(x+sign*.13,y+.04,h*.43)],[.004,.032,0],m['leaf'])
  x+=.05;y-=.015
  for k in range(6):
   a=k*math.tau/6
   blade('cupped flower petal',[(x,y,h-.012),(x+math.cos(a)*.042,y+math.sin(a)*.042,h+.015),(x+math.cos(a)*.072,y+math.sin(a)*.072,h+.028)],[.005,.028,.009],m['flowerLight'] if j%3 else m['flower'])
  uv('pollen heart',(x,y,h+.008),(.023,.023,.016),m['ore'],12,6)
  if j%3==0:uv('unopened flower bud',(x-.07,y+.015,h*.73),(.022,.023,.037),m['flower'],12,6)

ENTRIES={**{f'tile-grass-{i}':(64,32,[32,16]) for i in range(4)},**{f'tile-dirt-{i}':(64,32,[32,16]) for i in range(3)},'tile-stone':(64,32,[32,16]),'tree-oak':(192,256,[96,208]),'tree-pine':(192,256,[96,208]),'ore':(128,128,[64,100]),'stump':(96,96,[48,70]),'ruin-pillar':(128,160,[64,128]),'flowers':(96,96,[48,70]),'ruin-ring':(256,160,[128,104])}

def build(asset):
 R.seed(47+sum(map(ord,asset)));reset_scene();m=palette()
 if asset.startswith('tile-'):tile(m,asset)
 else:{'tree-oak':oak,'tree-pine':pine,'ore':ore,'stump':stump,'ruin-pillar':ruin,'flowers':flowers,'ruin-ring':ruin_ring}[asset](m)
 w,h,a=ENTRIES[asset];setup_render(w,h,a);save(str(SCENES/f'environment-{asset}.blend'));render(str(OUT/f'{asset}.png'))

if __name__=='__main__':
 args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
 p=argparse.ArgumentParser();p.add_argument('--all',action='store_true');p.add_argument('--sample',action='store_true');p.add_argument('--asset',choices=list(ENTRIES));a=p.parse_args(args)
 assets=[a.asset] if a.asset else list(ENTRIES) if a.all else ['tree-oak','ore','tile-grass-0','ruin-pillar']
 for asset in assets:build(asset)
 entries=[{'id':id,'width':v[0],'height':v[1],'anchor':v[2],'file':id+'.png'} for id,v in ENTRIES.items() if (OUT/(id+'.png')).exists()]
 path=OUT/'manifest.json';existing=json.loads(path.read_text()).get('assets',[]) if path.exists() else []
 merged={item['id']:item for item in existing};merged.update({item['id']:item for item in entries})
 path.write_text(json.dumps({'assets':list(merged.values())},indent=2))

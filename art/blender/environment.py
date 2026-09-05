"""Editable deterministic forest, mineral and battlefield scenery."""
import bpy,sys,os,math,random,json,argparse
from pathlib import Path
sys.path.insert(0,os.path.dirname(__file__))
from common import *
ROOT=Path(__file__).resolve().parent;OUT=ROOT/'raw/environment';SCENES=ROOT/'scenes'
R=random.Random(47)

def palette():
 return {k:material(k,c) for k,c in {'bark':'59472c','barkLight':'87704a','wood':'be9961','grass':'475c42','grassLight':'6c7c54','moss':'506548','leaf':'326955','leafLight':'53846a','leafDark':'234d43','pine':'37573b','pineLight':'587346','stone':'85877c','stoneLight':'adb0a0','stoneDark':'585f59','ore':'d39743','flower':'ad9aba','earth':'887a50','earthLight':'a5976b'}.items()}

def leaf(name,loc,length,width,mat,angle=0):
 # Raised midrib catches a wide highlight; asymmetry keeps clusters irregular.
 verts=[(-length/2,0,0),(-length*.12,width/2,0),(length/2,0,.035),(-length*.08,-width/2,0),(0,0,width*.24)]
 o=mesh(name,verts,[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],mat);o.location=loc;o.rotation_euler=(R.uniform(-.35,.35),R.uniform(-.2,.2),angle);return o

def rock(name,loc,scale,mat):
 n=7;verts=[]
 for j,(z,r) in enumerate([(0,.75),(.25,1),(.8,.65),(1,.22)]):
  for i in range(n):
   a=i*math.tau/n+(j%2)*.1;rr=r*R.uniform(.8,1.15);verts.append((math.cos(a)*rr*scale[0],math.sin(a)*rr*scale[1],z*scale[2]))
 faces=[tuple(range(n-1,-1,-1))]
 for j in range(3):
  for i in range(n):a=j*n+i;b=j*n+(i+1)%n;faces.append((a,b,b+n,a+n))
 faces.append(tuple(3*n+i for i in range(n)));o=mesh(name,verts,faces,mat);o.location=loc;return o

def roots(m,size=1):
 for i in range(7):
  a=i*math.tau/7;curve('surface root',[(0,0,.35),(math.cos(a)*.35,math.sin(a)*.35,.1),(math.cos(a)*size,math.sin(a)*size,.015)],.065,m['bark'])

def canopy(m,p,r,conifer=False):
 # Distinct overlapping lobes, each assembled from serrated broad foliage planes.
 colors=[m['pine'],m['pineLight'],m['leafDark']] if conifer else [m['leaf'],m['leafLight'],m['leafDark']]
 for j in range(9):
  a=j*2.4;d=r*math.sqrt(j/9)*.72;x=p[0]+math.cos(a)*d;y=p[1]+math.sin(a)*d;z=p[2]+R.uniform(-.15,.2)
  uv('cluster shaded volume',(x,y,z),(r*.44,r*.4,r*.18),colors[j%3],segments=9,rings=5)
  for k in range(7):
   aa=k*2.4;dd=r*.3*math.sqrt(k/7);leaf('canopy leaf tuft',(x+math.cos(aa)*dd,y+math.sin(aa)*dd,z+r*.15),r*.45,r*.24,colors[(j+k)%3],aa)

def oak(m):
 roots(m,1.05)
 curve('old twisting oak trunk',[(0,0,.1),(-.13,.05,1),(.12,.04,1.8),(.05,.1,2.8)],.26,m['bark'])
 for j in range(8):
  a=j*2.4;h=1.45+j*.12;p=(math.cos(a)*(.85+(j%2)*.25),math.sin(a)*(.85+(j%2)*.25),h+.8)
  curve('bent spreading oak branch',[(0,0,h*.75),(p[0]*.48,p[1]*.48,h),p],.095,m['bark'])
  canopy(m,p,.7)
 canopy(m,(.03,.08,3.03),.85)
 for j in range(7):
  a=j*math.tau/7;curve('oak bark highlight',[(math.cos(a)*.26,math.sin(a)*.26,.18),(math.cos(a)*.24-.07,math.sin(a)*.24,.7),(math.cos(a)*.18,math.sin(a)*.18,1.5)],.015,m['barkLight'])
 for j in range(10):leaf('root fern',(R.uniform(-.7,.7),R.uniform(-.7,.7),.04),.35,.11,m['moss'],R.random()*math.tau)

def pine(m):
 roots(m,.7);cone('tapered pine trunk',(0,0,1.8),.2,.035,3.6,m['bark'])
 for tier in range(6):
  h=.8+tier*.5;r=1.05-tier*.15
  for j in range(5):
   a=j*math.tau/5+tier*.55;p=(math.cos(a)*r*.6,math.sin(a)*r*.6,h+.18)
   curve('drooping pine bough',[(0,0,h+.16),(p[0]*.7,p[1]*.7,h+.12),(p[0]*1.3,p[1]*1.3,h-.1)],.03,m['bark'])
   # Multiple pointed fans give a layered bough silhouette instead of a triangle.
   for k in range(3):
    aa=a+(k-1)*.48;end=(p[0]+math.cos(aa)*r*.34,p[1]+math.sin(aa)*r*.34,h)
    o=cone('needled branch fan',end,r*.44,.015,r*.4,[m['pine'],m['pineLight'],m['leafDark']][(j+k)%3],vertices=7)
    o.rotation_euler=(math.sin(aa)*.35,math.cos(aa)*.35,aa)
    for needle in range(6):
     an=aa+(needle-2.5)*.2;d=r*.18+needle%2*r*.12
     leaf('pointed pine needle spray',(end[0]+math.cos(an)*d,end[1]+math.sin(an)*d,h+r*.12),r*.55,r*.14,m['pineLight'] if needle%3==0 else m['pine'],an)
 cone('pine crown',(0,0,3.65),.19,0,.7,m['pineLight'],vertices=7)

def ore(m):
 m=dict(m);m['stone']=material('ore dark slate','555e58');m['stoneLight']=material('ore split face','6c766c');m['stoneDark']=material('ore deep face','414b47')
 for i,(x,y,h) in enumerate([(-.3,.15,1.15),(.25,.08,1.5),(.02,-.32,.8),(.6,.25,.55),(-.65,-.1,.45)]):
  rock('split mineral rock',(x,y,0),(.35,.3,h),[m['stone'],m['stoneLight'],m['stoneDark']][i%3])
  for j in range(3):
   a=j*2.2+i;rock('exposed warm ore',(x+math.cos(a)*.2,y+math.sin(a)*.2,h*.23+j*.14),(.065,.05,.16),m['ore'])
 for j in range(8):
  a=R.random()*math.tau;rock('ore chips',(math.cos(a)*.8,math.sin(a)*.65,0),(.07,.05,.09),m['stone'])

def stump(m):
 cone('cut trunk',(0,0,.24),.28,.23,.48,m['bark']);cone('pale cut grain',(0,0,.485),.22,.22,.012,m['wood']);roots(m,.55)
 for r in [.08,.14,.195]:
  curve('growth rings',[(math.cos(a)*r,math.sin(a)*r,.495) for a in [i*math.tau/18 for i in range(19)]],.006,m['barkLight'])

def ruin(m):
 for j in range(4):
  b=box('ancient dressed stone',(0,0,.16+j*.31),(.52-j*.025,.52-j*.025,.29),m['stoneLight'] if j%2 else m['stone'],.025);b.rotation_euler.z=j*.035
 box('broken capital',(.04,0,1.35),(.7,.64,.2),m['stone'],.04)
 for j in range(3):rock('fallen masonry',(.55+R.random()*.35,R.uniform(-.4,.5),0),(.25,.2,.18),m['stoneDark'])
 for j in range(12):leaf('moss on ruin',(R.uniform(-.5,.7),R.uniform(-.5,.5),.05),.18,.12,m['moss'],R.random()*math.tau)
 for j in range(2):box('carved rune vertical',(.252,-.06+j*.12,.78),(.006,.018,.14),m['stoneDark'],0)

def ruin_ring(m):
 for i in range(22):
  if i in (3,4,14):continue
  a=i*math.tau/22;r=1.9+R.uniform(-.07,.07)
  b=box('broken circular paving',(math.cos(a)*r,math.sin(a)*r,.05),(.48,.4,.10),m['stone'] if i%3 else m['stoneLight'],.035);b.rotation_euler.z=a
 for i in range(14):
  if i in (6,7,11):continue
  a=i*math.tau/14;r=1.08
  b=box('inner spiral stones',(math.cos(a)*r,math.sin(a)*r,.025),(.31,.24,.06),m['stoneDark'] if i%3 else m['stone'],.02);b.rotation_euler.z=a
 for j in range(18):
  a=R.random()*math.tau;r=R.uniform(1.5,2.2);leaf('moss between paving',(math.cos(a)*r,math.sin(a)*r,.115),.28,.16,m['moss'],a)

def tile(m,kind):
 base=m['grass'] if 'grass' in kind else m['earth'] if 'dirt' in kind else m['stone']
 mesh('ground diamond',[(-.5,-.5,0),(.5,-.5,0),(.5,.5,0),(-.5,.5,0)],[(0,1,2,3)],base)
 if 'stone' in kind:
  for x in [-.3,.05,.35]:
   for y in [-.32,.02,.35]:box('worn paving',(x,y,.003),(.28,.27,.012),m['stoneLight'] if R.random()>.7 else m['stone'],.025)
 else:
  for j in range(25):
   x,y=R.uniform(-.43,.43),R.uniform(-.43,.43)
   if 'grass' in kind:leaf('painted grass patch',(x,y,.001),R.uniform(.07,.16),.05,m['grassLight'] if j%3 else m['moss'],R.random()*math.tau)
   else:rock('flat soil brush',(x,y,.001),(.055,.03,.008),m['earthLight'] if j%2 else m['earth'])

def flowers(m):
 for j in range(10):
  x,y=R.uniform(-.45,.45),R.uniform(-.3,.3);h=R.uniform(.15,.35);beam('flower stem',(x,y,0),(x,y,h),.01,m['moss'])
  for k in range(5):
   a=k*math.tau/5;uv('wildflower petal',(x+math.cos(a)*.045,y+math.sin(a)*.045,h),(.046,.035,.018),m['flower'],8,4)
  uv('flower gold center',(x,y,h+.01),(.025,.025,.02),m['ore'],8,4)

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
 (OUT/'manifest.json').write_text(json.dumps({'assets':entries},indent=2))

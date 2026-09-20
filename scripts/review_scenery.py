#!/usr/bin/env python3
"""Verify the scenery-only pass and assemble matched-scale comparison sheets.

Run after exporting and publishing the 22 environment images, and after
art/blender/review_scenery.py. Baseline defaults to the previous refinement pass.
"""
import argparse,hashlib,json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1]
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'

def rgba(p):
    with Image.open(p) as im:return im.convert('RGBA')

def compare(ids,current,before,out,cols=3,cell=(390,260),title='Scenery refinement'):
    w,h=cell;sheet=Image.new('RGB',(w*cols,100+h*((len(ids)+cols-1)//cols)),'#20352d');d=ImageDraw.Draw(sheet)
    d.text((24,20),title,font=ImageFont.truetype(FONT,28),fill='#f1e9d1')
    d.text((24,60),'Before / refined • Matching scale within each pair',font=ImageFont.truetype(FONT,16),fill='#aabea5')
    for i,aid in enumerate(ids):
        x,y=(i%cols)*w,100+(i//cols)*h
        ims=[rgba(base/f'{aid}.png') for base in (before,current)]
        scale=min((w/2-16)/max(im.width for im in ims),(h-44)/max(im.height for im in ims))
        for side,im in enumerate(ims):
            im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
            sheet.paste(im,(x+side*w//2+(w//2-im.width)//2,y+(h-40-im.height)//2),im)
        d.text((x+18,y+h-30),aid,font=ImageFont.truetype(FONT,15),fill='#f1e9d1')
    sheet.save(out)

def gallery(ids,portraits,out):
    cols=4;cw,ch=290,340
    sheet=Image.new('RGB',(cols*cw,110+ch*((len(ids)+cols-1)//cols)),'#20352d');d=ImageDraw.Draw(sheet)
    d.text((24,22),'Elderwood / scenery models',font=ImageFont.truetype(FONT,30),fill='#f1e9d1')
    d.text((24,65),'22 editable models • Higher-resolution renders of the saved scenes',font=ImageFont.truetype(FONT,16),fill='#aabea5')
    for i,aid in enumerate(ids):
        im=rgba(portraits/f'{aid}.png');im=im.crop(im.getchannel('A').getbbox());im.thumbnail((cw-28,ch-50),Image.Resampling.LANCZOS)
        x,y=i%cols*cw,110+i//cols*ch
        sheet.paste(im,(x+(cw-im.width)//2,y+(ch-48-im.height)//2),im)
        d.text((x+16,y+ch-30),aid,font=ImageFont.truetype(FONT,15),fill='#f1e9d1')
    sheet.save(out)

def review(before,out):
    current=ROOT/'public/assets';raw=ROOT/'art/blender/raw/environment';portraits=ROOT/'work/scenery/portraits'
    out.mkdir(parents=True,exist_ok=True)
    old=json.loads((before/'manifest.json').read_text());now=json.loads((current/'manifest.json').read_text())
    assert now==old,'Runtime manifest changed'
    ids=[aid for aid,a in now['assets'].items() if a['kind']=='environment'];assert len(ids)==22
    rows=[]
    for aid in ids:
        a=now['assets'][aid];im=rgba(current/f'{aid}.png');baseline=rgba(before/f'{aid}.png')
        assert im.size==(a['width'],a['height']),aid
        assert im.tobytes()==rgba(raw/f'{aid}.png').tobytes(),f'{aid}: raw/runtime mismatch'
        assert im.tobytes()!=baseline.tobytes(),f'{aid}: unchanged'
        bounds=im.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox();assert bounds,aid
        margin=min(bounds[0],bounds[1],im.width-bounds[2],im.height-bounds[3])
        if not aid.startswith('tile-'):assert margin>=3,(aid,bounds)
        rows.append({'id':aid,'changed':True,'rawPixelsMatch':True,'alphaBounds':bounds,'margin':margin,'dimensions':im.size})
    hashes=json.loads((before/'hashes.json').read_text());allowed={f'{aid}.png' for aid in ids}
    preserved=[]
    for name,digest in hashes.items():
        if name in allowed:continue
        assert hashlib.sha256((current/name).read_bytes()).hexdigest()==digest,f'Unrelated asset changed: {name}'
        preserved.append(name)
    assert set(f.name for f in current.iterdir() if f.is_file())==set(hashes),'Unexpected public asset files'
    inventory=json.loads((portraits/'inventory.json').read_text());assert inventory['models']==22 and inventory['status']=='pass'
    (out/'model-inventory.json').write_text(json.dumps(inventory,indent=2)+'\n')
    report={'status':'pass','environmentAssets':22,'changedAssets':22,'unchangedOtherFiles':len(preserved),'manifestUnchanged':True,'assets':rows}
    (out/'report.json').write_text(json.dumps(report,indent=2)+'\n')
    compare(['tree-oak','tree-pine'],current,before,out/'trees-before-after.png',cols=2,cell=(640,490),title='Oak and pine / structural refinement')
    props=[aid for aid in ids if not aid.startswith('tile-')]
    compare(props,current,before,out/'props-before-after.png')
    compare([aid for aid in ids if aid.startswith('tile-')],current,before,out/'terrain-before-after.png',cell=(390,180),title='Terrain / ground detail')
    gallery(props+[aid for aid in ids if aid.startswith('tile-')],portraits,out/'gallery.png')
    print(json.dumps(report,indent=2))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--baseline',type=Path,default=ROOT/'work/scenery/before');p.add_argument('--out',type=Path,default=ROOT/'docs/evidence/scenery-refinement');a=p.parse_args();review(a.baseline,a.out)

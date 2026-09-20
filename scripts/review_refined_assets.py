#!/usr/bin/env python3
"""Review every packed asset and compare it to a preserved pre-refinement export.

Run after generation:
  .venv/bin/python scripts/review_refined_assets.py --baseline work/refinement/before/assets
Writes contact sheets plus machine-readable coverage, clipping and size evidence.
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
FACTIONS = ('orc', 'fairy', 'dwarf', 'undead', 'tideborn', 'automata')
ROLES = ('worker', 'melee', 'ranged', 'special', 'spear', 'cavalry', 'siege')
BUILDINGS = ('hq', 'depot', 'barracks', 'tower', 'wall', 'gate')


def load(path):
    with Image.open(path) as image:
        return image.convert('RGBA')


def contact(ids, current, baseline, out, label):
    """Keep one common scale per before/after pair; never magnify just one side."""
    cell_w, cell_h = 240, 210
    cols = 4
    rows = (len(ids) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * cell_w, rows * cell_h + 48), '#23312e')
    draw = ImageDraw.Draw(sheet)
    draw.text((16, 12), label + ' | left: before; right: refined', fill='#eee5cc')
    for index, aid in enumerate(ids):
        x, y = index % cols * cell_w, index // cols * cell_h + 48
        filename = f'selection-{aid}.png' if (current / f'selection-{aid}.png').exists() else f'{aid}.png'
        images = [load(root / filename) for root in (baseline, current)]
        # Selection portraits already have their production fit; display them
        # without rescaling either image to an independent alpha bounding box.
        factor = min(1, 110 / max(im.width for im in images), 164 / max(im.height for im in images))
        for side, im in enumerate(images):
            im = im.resize((max(1, round(im.width * factor)), max(1, round(im.height * factor))), Image.Resampling.LANCZOS)
            sheet.paste(im, (x + side * 120 + (120-im.width)//2, y + (170-im.height)//2), im)
        draw.text((x+8, y+176), aid, fill='#eee5cc')
    sheet.save(out)


def states_contact(ids, samples, out, unit=False):
    columns=([(state,d) for state in ('idle','walk','attack','death') for d in (0,2)] if unit
             else [(state,0) for state in ('idle','construction-0','construction-1','construction-2','death','open')])
    width=150 if unit else 180;height=190
    sheet=Image.new('RGB',(len(columns)*width,len(ids)*height+30),'#23312e');draw=ImageDraw.Draw(sheet)
    for i,(state,direction) in enumerate(columns):draw.text((i*width+8,8),f'{state} / {direction}' if unit else state,fill='#eee5cc')
    for row,aid in enumerate(ids):
        for col,key in enumerate(columns):
            im=samples.get(aid,{}).get(key)
            if im is None:continue
            im=im.crop(im.getbbox());im.thumbnail((width-16,height-28))
            sheet.paste(im,(col*width+(width-im.width)//2,row*height+30+(height-28-im.height)//2),im)
        draw.text((8,(row+1)*height+8),aid,fill='#eee5cc')
    sheet.save(out)


def review(current, baseline, out):
    out.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((current/'manifest.json').read_text())
    old = json.loads((baseline/'manifest.json').read_text())
    failures, margins, changed, unchanged = [], {}, [], []
    if set(old['assets']) != set(manifest['assets']):failures.append('Asset inventory changed')
    if old['projection'] != manifest['projection']:failures.append('Projection changed')
    checked = reconstructed = 0
    samples = {}
    for aid, asset in manifest['assets'].items():
        previous = old['assets'][aid]
        for field in ('kind', 'width', 'height', 'anchor'):
            if asset[field] != previous[field]:failures.append(f'{aid}: {field} changed')
        kind = asset['kind']
        scene = ROOT/'art/blender/scenes'/f'{"unit" if kind=="unit" else "building" if kind=="building" else "environment"}-{aid}.blend'
        if not scene.exists():failures.append(f'Missing scene {aid}')
        filenames = [Path(asset['image']).name] if kind=='environment' else [f'{page}.png' for page in asset['pages']]
        differs = any(hashlib.sha256((current/f).read_bytes()).digest() != hashlib.sha256((baseline/f).read_bytes()).digest() for f in filenames)
        (changed if differs else unchanged).append(aid)
        if kind=='environment':continue
        # Metadata timing and direction lists are part of gameplay's contract.
        if asset['animations'] != previous['animations']:failures.append(f'{aid}: animation contract changed')
        margin = 999
        for page in asset['pages']:
            atlas = json.loads((current/f'{page}.json').read_text())
            sheet = load(current/f'{page}.png')
            for name, record in atlas['frames'].items():
                box=record['frame'];offset=record['spriteSourceSize'];size=record['sourceSize']
                restored=Image.new('RGBA',(size['w'],size['h']))
                crop=sheet.crop((box['x'],box['y'],box['x']+box['w'],box['y']+box['h']))
                restored.paste(crop,(offset['x'],offset['y']))
                _,state,direction,frame=name.split('/')
                chosen={'idle':0,'walk':3,'attack':2,'death':5 if kind=='unit' else 0,'construction':int(frame),'open':0}
                if int(direction) in (0,2) and int(frame)==chosen[state]:
                    sample_state=f'construction-{frame}' if state=='construction' else state
                    samples.setdefault(aid,{})[(sample_state,int(direction))]=restored.copy()
                raw=ROOT/'art/blender/raw'/('units' if kind=='unit' else 'buildings')/aid/f'{state}-{direction}-{int(frame):02}.png'
                if not raw.exists() or load(raw).tobytes()!=restored.tobytes():failures.append(f'Packed pixels differ: {name}')
                else:reconstructed+=1
                bounds=restored.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox()
                value=min(bounds[0],bounds[1],size['w']-bounds[2],size['h']-bounds[3]) if bounds else 0
                margin=min(margin,value);checked+=1
                if value<2:failures.append(f'Clipped or empty frame: {name} (margin {value})')
        margins[aid]=margin
    if unchanged:failures.append(f'Unchanged assets: {unchanged}')
    for faction in FACTIONS:
        contact([f'{faction}-{r}' for r in ROLES],current,baseline,out/f'{faction}-units.png',f'{faction.title()} units')
        contact([f'{faction}-{r}' for r in BUILDINGS],current,baseline,out/f'{faction}-buildings.png',f'{faction.title()} buildings')
        states_contact([f'{faction}-{r}' for r in ROLES],samples,out/f'{faction}-poses.png',unit=True)
        states_contact([f'{faction}-{r}' for r in BUILDINGS],samples,out/f'{faction}-building-states.png')
    env=[aid for aid,a in manifest['assets'].items() if a['kind']=='environment']
    contact(env,current,baseline,out/'environment.png','Terrain and props')
    contact(['ui-halt','ui-hold'],current,baseline,out/'commands.png','Command models')
    for aid in ('ui-halt','ui-hold'):
        if load(current/f'{aid}.png').tobytes()==load(baseline/f'{aid}.png').tobytes():failures.append(f'Unchanged command model: {aid}')
    def decoded(m):
        total=0
        for page in m['atlases']:
            with Image.open(current/Path(page['image']).name) as image:total+=image.width*image.height*4
        return total
    result={'assets':len(manifest['assets']),'changedAssets':len(changed),'framesChecked':checked,
            'exactlyReconstructed':reconstructed,'minimumMargins':margins,
            'atlasPages':len(manifest['atlases']), 'decodedAtlasMiB':round(decoded(manifest)/1048576,2),
            'failures':failures,'status':'pass' if not failures else 'fail'}
    (out/'report.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))
    return bool(failures)


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--baseline',type=Path,required=True)
    p.add_argument('--current',type=Path,default=ROOT/'public/assets')
    p.add_argument('--out',type=Path,default=ROOT/'work/refinement/review');args=p.parse_args()
    raise SystemExit(review(args.current,args.baseline,args.out))

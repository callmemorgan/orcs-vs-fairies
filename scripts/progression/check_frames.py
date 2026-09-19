#!/usr/bin/env python3
"""Check every progression frame for clipping and optionally exact atlas packing."""
import argparse
import json
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]

def check(packed=False):
    raw=ROOT/'art/blender/raw/units';out=ROOT/'public/assets'
    manifest=json.loads((out/'manifest.json').read_text()) if packed else None
    count=0;minimum=999;bad=[];missing=[];mismatched=[];reconstructed=0
    for faction in ('orc','fairy','dwarf','undead','tideborn','automata'):
        for role in ('spear','cavalry','siege'):
            aid=f'{faction}-{role}';asset=raw/aid
            frames={};sheets={}
            if packed:
                meta=json.loads((asset/'meta.json').read_text());entry=manifest['assets'][aid]
                for field in ('width','height','anchor'):
                    assert meta[field]==entry[field],f'{aid}: {field} mismatch'
                for page in entry['pages']:
                    with Image.open(out/f'{page}.png') as image:sheets[page]=image.convert('RGBA')
                    atlas=json.loads((out/f'{page}.json').read_text())
                    for name,record in atlas['frames'].items():
                        assert name not in frames,f'Duplicate frame: {name}'
                        frames[name]=(page,record)
            for state,n in {'idle':4,'walk':8,'attack':6,'death':6}.items():
                for direction in range(8):
                    for frame in range(n):
                        path=asset/f'{state}-{direction}-{frame:02}.png'
                        if not path.exists():missing.append(str(path));continue
                        with Image.open(path) as source:
                            im=source.convert('RGBA')
                        box=im.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox()
                        margin=min(box[0],box[1],im.width-box[2],im.height-box[3]) if box else 0
                        minimum=min(minimum,margin);count+=1
                        if margin<2:bad.append(str(path))
                        if packed:
                            name=f'{aid}/{state}/{direction}/{frame}'
                            if name not in frames:missing.append(name);continue
                            page,record=frames[name];r=record['frame'];offset=record['spriteSourceSize'];size=record['sourceSize']
                            restored=Image.new('RGBA',(size['w'],size['h']))
                            crop=sheets[page].crop((r['x'],r['y'],r['x']+r['w'],r['y']+r['h']))
                            restored.paste(crop,(offset['x'],offset['y']))
                            if restored.size!=im.size or restored.tobytes()!=im.tobytes():mismatched.append(name)
                            else:reconstructed+=1
            for sheet in sheets.values():sheet.close()
    result={'checked':count,'minimumMarginPixels':minimum,'clippedOrEmpty':bad,'missing':missing}
    if packed:result.update({'exactlyReconstructed':reconstructed,'pixelMismatches':mismatched})
    print(json.dumps(result,indent=2))
    return bool(bad or missing or mismatched)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--packed',action='store_true',help='Reconstruct every trimmed packed frame and compare exact RGBA pixels with the raw export');a=p.parse_args()
    raise SystemExit(check(a.packed))

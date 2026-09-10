#!/usr/bin/env python3
"""Pack Blender RGBA output into Phaser atlases, preserving ground anchors."""
import argparse, json, math
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
def pack_portraits(source:Path,out:Path,kinds=('units',)):
    # Selection portraits are crops of Blender renders, never concept-art substitutes.
    portraits={}
    for faction,unit in {'orcs':'orc-melee','fairies':'fairy-special','dwarves':'dwarf-melee','undead':'undead-special','tideborn':'tideborn-special','automata':'automata-special'}.items():
        path=source/'units'/unit/'idle-0-00.png'
        if 'units' not in kinds or not path.exists():continue
        with Image.open(path) as im:
            im=im.convert('RGBA');bounds=im.getchannel('A').getbbox()
            if not bounds:raise ValueError(f'Empty portrait source: {path}')
            im=im.crop((max(0,bounds[0]-4),max(0,bounds[1]-4),min(im.width,bounds[2]+4),min(im.height,bounds[3]+4)))
            filename=f'portrait-{faction}.png';im.save(out/filename,optimize=True)
            portraits[faction]=f'/assets/{filename}'
    for kind in ('units','buildings'):
        if kind not in kinds:continue
        for path in sorted((source/kind).glob('*/idle-0-00.png')):
            with Image.open(path) as im:
                im=im.convert('RGBA');bounds=im.getchannel('A').getbbox()
                if not bounds:raise ValueError(f'Empty selection portrait: {path}')
                im=im.crop(bounds);im.thumbnail((128,128));im.save(out/f'selection-{path.parent.name}.png',optimize=True)
    return portraits

def pack(source:Path,out:Path,kinds=('units','buildings','environment')):
    out.mkdir(parents=True,exist_ok=True)
    manifest={'schemaVersion':1,'projection':{'tileWidth':64,'tileHeight':32},'atlases':[], 'assets':{}}
    for kind in ('units','buildings'):
        if kind not in kinds:continue
        for meta_path in sorted((source/kind).glob('*/meta.json')):
            meta=json.loads(meta_path.read_text());asset=meta['id'];w,h=meta['width'],meta['height'];anchor=meta['anchor']
            files=[];animations={};visual_top=h
            for state,info in meta['animations'].items():
                directions=8 if meta['kind']=='unit' else 1
                animations[state]={**info,'directions':{}}
                for direction in range(directions):
                    names=[]
                    for i in range(info['frames']):
                        name=f'{asset}/{state}/{direction}/{i}'
                        path=meta_path.parent/f'{state}-{direction}-{i:02}.png'
                        if not path.exists():raise FileNotFoundError(path)
                        names.append(name);files.append((name,path))
                    animations[state]['directions'][str(direction)]=names
            cols=max(1,2048//(w+4));rows=max(1,2048//(h+4));capacity=cols*rows;pages=[]
            for offset in range(0,len(files),capacity):
                batch=files[offset:offset+capacity];page=f'{asset}-{offset//capacity}';pages.append(page)
                used_cols=min(cols,len(batch));used_rows=math.ceil(len(batch)/cols)
                sheet=Image.new('RGBA',(used_cols*(w+4),used_rows*(h+4)))
                atlas={'frames':{},'meta':{'image':f'{page}.png','format':'RGBA8888','size':{'w':sheet.width,'h':sheet.height},'scale':'1'}}
                for j,(name,path) in enumerate(batch):
                    with Image.open(path) as img:
                        img=img.convert('RGBA')
                        if img.size!=(w,h):raise ValueError(f'{path}: {img.size} != {(w,h)}')
                        bounds=img.getchannel('A').getbbox()
                        if not bounds:raise ValueError(f'Empty asset frame: {path}')
                        if '/death/' not in name:visual_top=min(visual_top,bounds[1])
                        x=(j%cols)*(w+4)+2;y=(j//cols)*(h+4)+2;sheet.paste(img,(x,y))
                    # Keep sheet pixels and logical dimensions unchanged. Phaser
                    # renders only the alpha bounds while sourceSize/offsets keep
                    # the original ground anchor and pixel hit coordinates.
                    # One transparent pixel of padding preserves edge filtering.
                    left=max(0,bounds[0]-1);top=max(0,bounds[1]-1)
                    right=min(w,bounds[2]+1);bottom=min(h,bounds[3]+1)
                    cut_w=right-left;cut_h=bottom-top
                    atlas['frames'][name]={'frame':{'x':x+left,'y':y+top,'w':cut_w,'h':cut_h},'rotated':False,'trimmed':cut_w!=w or cut_h!=h,'spriteSourceSize':{'x':left,'y':top,'w':cut_w,'h':cut_h},'sourceSize':{'w':w,'h':h}}
                sheet.save(out/f'{page}.png',optimize=True);(out/f'{page}.json').write_text(json.dumps(atlas,separators=(',',':')))
                manifest['atlases'].append({'key':page,'image':f'/assets/{page}.png','data':f'/assets/{page}.json'})
            manifest['assets'][asset]={'kind':meta['kind'],'width':w,'height':h,'anchor':anchor,'visualTop':visual_top,'pages':pages,'animations':animations}
    env=source/'environment'/'manifest.json'
    if 'environment' in kinds and env.exists():
        data=json.loads(env.read_text());entries=data.get('assets',data) if isinstance(data,dict) else data
        if isinstance(entries,dict):entries=[dict(v,id=k) for k,v in entries.items()]
        for item in entries:
            path=env.parent/item['file'];filename=f"{item['id']}.png"
            with Image.open(path) as im:
                if im.size!=(item['width'],item['height']):raise ValueError(f'{path} wrong dimensions')
                im.convert('RGBA').save(out/filename,optimize=True)
            manifest['assets'][item['id']]={**item,'kind':'environment','image':f'/assets/{filename}'}
    manifest['portraits']=pack_portraits(source,out,kinds)
    (out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps({'assets':len(manifest['assets']),'atlasPages':len(manifest['atlases']),'output':str(out)}))
    return manifest
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source',type=Path,default=ROOT/'art/blender/raw');p.add_argument('--out',type=Path,default=ROOT/'public/assets');p.add_argument('--kinds',nargs='+',choices=['units','buildings','environment'],default=['units','buildings','environment']);a=p.parse_args();pack(a.source,a.out,a.kinds)

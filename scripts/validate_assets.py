#!/usr/bin/env python3
"""Validate actual packed game assets. Does not substitute for visual review."""
import json,hashlib
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/assets'
def validate():
    m=json.loads((OUT/'manifest.json').read_text());assert m['schemaVersion']==1
    required_units=[f'{f}-{r}' for f in ['orc','fairy'] for r in ['worker','melee','ranged','special']]
    required_buildings=[f'{f}-{r}' for f in ['orc','fairy'] for r in ['hq','depot','barracks','tower']]
    required_env=['tile-grass-'+str(i) for i in range(4)]+['tile-dirt-'+str(i) for i in range(3)]+['tile-stone','tree-pine','tree-oak','ore','stump','ruin-pillar','ruin-ring']
    missing=[i for i in required_units+required_buildings+required_env if i not in m['assets']]
    assert not missing,f'Missing assets: {missing}'
    frames={};sheets={};decoded=0
    for page in m['atlases']:
        image=Image.open(OUT/Path(page['image']).name).convert('RGBA');sheets[page['key']]=image
        assert max(image.size)<=2048,f'Oversized atlas {page["key"]}'
        decoded+=image.width*image.height*4
        atlas=json.loads((OUT/Path(page['data']).name).read_text())
        for name,record in atlas['frames'].items():
            assert name not in frames,f'Duplicate {name}'
            r=record['frame'];assert r['x']>=0 and r['y']>=0 and r['x']+r['w']<=image.width and r['y']+r['h']<=image.height
            crop=image.crop((r['x'],r['y'],r['x']+r['w'],r['y']+r['h']))
            assert crop.getchannel('A').getbbox(),f'Empty {name}'
            frames[name]=(record,hashlib.sha256(crop.tobytes()).hexdigest())
    for aid in required_units+required_buildings:
        a=m['assets'][aid];w,h=a['width'],a['height'];x,y=a['anchor'];assert 0<=x<=w and 0<=y<=h
        expected=['idle','walk','attack','death'] if aid in required_units else ['idle','construction','death']
        for state in expected:
            anim=a['animations'][state]
            for d in range(8 if aid in required_units else 1):
                names=anim['directions'][str(d)];assert len(names)==anim['frames'] and names
                for name in names:assert name in frames,f'Missing packed frame {name}'
                if state in ['walk','attack','death','construction'] and len(names)>1:assert len({frames[n][1] for n in names})>1,f'Frozen animation {aid}/{state}/{d}'
    for aid in required_env:
        a=m['assets'][aid];im=Image.open(OUT/Path(a['image']).name);assert im.size==(a['width'],a['height'])
    result={'assets':len(m['assets']),'frames':len(frames),'atlases':len(m['atlases']),'decodedAtlasMiB':round(decoded/1048576,2),'status':'pass','limits':'Checks coverage, frame bounds, alpha, and image differences. Human visual review and browser performance remain separate.'}
    print(json.dumps(result,indent=2));return result
if __name__=='__main__':validate()

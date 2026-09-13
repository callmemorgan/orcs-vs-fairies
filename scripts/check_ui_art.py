#!/usr/bin/env python3
"""Check each faction's UI portraits and Blender order icons, including transparency."""
from pathlib import Path
from PIL import Image
import json
ROOT=Path(__file__).resolve().parents[1]
assets=ROOT/'public/assets'
files=[assets/f'portrait-{f}.png' for f in ['orcs','fairies','dwarves','undead','tideborn','automata']]
files += [assets/f'selection-{f}-{role}.png' for f in ['orc','fairy','dwarf','undead','tideborn','automata'] for role in ['worker','melee','ranged','special','hq','depot','barracks','tower']]
files += [assets/f'ui-{name}.png' for name in ['halt','hold']]
results=[]
for path in files:
    with Image.open(path) as im:
        im.load()
        assert im.mode=='RGBA',path
        bounds=im.getchannel('A').getbbox()
        assert bounds and im.getchannel('A').getextrema()[0]==0,path
        results.append({'file':str(path.relative_to(ROOT)),'size':list(im.size),'alphaBounds':bounds})
print(json.dumps({'passed':len(results),'images':results},indent=2))

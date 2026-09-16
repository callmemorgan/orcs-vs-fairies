#!/usr/bin/env python3
"""Check every new unit's exported frame for transparent margins, not only samples."""
import json
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[2]/'art/blender/raw/units'
count=0;minimum=999;bad=[];missing=[]
for faction in ('orc','fairy','dwarf','undead','tideborn','automata'):
 for role in ('spear','cavalry','siege'):
  asset=root/f'{faction}-{role}'
  for state,frames in {'idle':4,'walk':8,'attack':6,'death':6}.items():
   for direction in range(8):
    for frame in range(frames):
     path=asset/f'{state}-{direction}-{frame:02}.png'
     if not path.exists():missing.append(str(path));continue
     with Image.open(path) as im:
      box=im.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox()
      margin=min(box[0],box[1],im.width-box[2],im.height-box[3]) if box else 0
      minimum=min(minimum,margin);count+=1
      if margin<2:bad.append(str(path))
print(json.dumps({'checked':count,'minimumMarginPixels':minimum,'clippedOrEmpty':bad,'missing':missing},indent=2))
raise SystemExit(bool(bad or missing))

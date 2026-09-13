#!/usr/bin/env python3
"""Compare unions of DOM panel rectangles saved from real browser renders."""
import json
from pathlib import Path
root=Path('docs/evidence/ui-overhaul')
def measure(name):
 s=json.loads((root/(name+'.json')).read_text());w=s['viewport']['width'];h=s['viewport']['height']
 rects=[(max(0,p['rect']['left']),max(0,p['rect']['top']),min(w,p['rect']['right']),min(h,p['rect']['bottom'])) for p in s['panels']]
 xs=sorted({x for r in rects for x in (r[0],r[2])});area=0
 for l,r in zip(xs,xs[1:]):
  spans=sorted((t,b) for x,t,z,b in rects if x<r and z>l);end=0;covered=0
  for t,b in spans:
   covered+=max(0,b-max(t,end));end=max(end,b)
  area+=(r-l)*covered
 return {'viewport':s['viewport'],'coveredPixels':round(area),'battlefieldPixels':round(w*h-area),'coveredPercent':round(100*area/(w*h),2)}
result={'method':'Union of rendered persistent resource, objective, minimap (including title), selection and command panel rectangles. Excludes shadows, transient notices and tooltips. Transparent gaps count as battlefield. Default medium map; persistent panel rectangles are measured in normal gameplay.'}
for size in [1280,1920]:
 old=measure(f'baseline-area-{size}');new=measure(f'final-area-{size}')
 result[str(size)]={'before':old,'after':new,'additionalBattlefieldPixels':new['battlefieldPixels']-old['battlefieldPixels']}
(root/'coverage-comparison.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))

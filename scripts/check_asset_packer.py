#!/usr/bin/env python3
"""Exercise atlas packing against distinguishable transparent frames."""
import json,tempfile
from pathlib import Path
from PIL import Image
from pack_assets import pack
with tempfile.TemporaryDirectory(prefix='ovf-packer-') as temp:
    root=Path(temp);asset=root/'raw/units/test-unit';asset.mkdir(parents=True)
    (asset/'meta.json').write_text(json.dumps({'id':'test-unit','kind':'unit','width':32,'height':40,'anchor':[16,32],'animations':{'idle':{'frames':2,'fps':5,'loop':True}}}))
    expected={}
    for d in range(8):
        for f in range(2):
            rgba=(20+d*25,30+f*100,80,255);im=Image.new('RGBA',(32,40))
            # Different offsets expose anchor jitter; an alpha hole and a faint
            # edge pixel check hit testing and preservation of antialiased art.
            left=5+d;top=6+f*3;im.paste(rgba,(left,top,left+12,top+19))
            im.putpixel((left+4,top+5),(0,0,0,0));im.putpixel((left-2,top+2),(10,30,80,1))
            name=f'test-unit/idle/{d}/{f}';expected[name]=im.copy();im.save(asset/f'idle-{d}-{f:02}.png')
    result=pack(root/'raw',root/'out');assert result['assets']['test-unit']['anchor']==[16,32]
    atlas=json.loads((root/'out/test-unit-0.json').read_text());sheet=Image.open(root/'out/test-unit-0.png')
    assert len(atlas['frames'])==16
    for name,original in expected.items():
        record=atlas['frames'][name];frame=record['frame'];offset=record['spriteSourceSize'];size=record['sourceSize']
        assert record['trimmed'] and size=={'w':32,'h':40}
        assert frame['w']*frame['h']<32*40
        crop=sheet.crop((frame['x'],frame['y'],frame['x']+frame['w'],frame['y']+frame['h']))
        restored=Image.new('RGBA',(size['w'],size['h']));restored.paste(crop,(offset['x'],offset['y']))
        assert restored.tobytes()==original.tobytes(),f'Pixel reconstruction changed {name}'
        # Phaser puts the trimmed quad at offset minus the original origin.
        # A source pixel therefore keeps the same ground-relative position.
        anchor=result['assets']['test-unit']['anchor']
        for y in range(40):
            for x in range(32):
                cx=x-offset['x'];cy=y-offset['y']
                inside=0<=cx<crop.width and 0<=cy<crop.height
                alpha=crop.getpixel((cx,cy))[3] if inside else 0
                assert alpha==original.getpixel((x,y))[3],f'Alpha hit coordinate changed {name}/{x}/{y}'
                if alpha:
                    assert (offset['x']-anchor[0]+cx,offset['y']-anchor[1]+cy)==(x-anchor[0],y-anchor[1])
    # Missing frames must fail, not produce a partial final asset silently.
    (asset/'idle-7-01.png').unlink()
    try:pack(root/'raw',root/'bad-output')
    except FileNotFoundError:pass
    else:raise AssertionError('missing frame accepted')
    print('PASS: 16 trimmed frames reconstruct exact RGBA pixels; source dimensions, anchors, alpha hit coordinates, faint edges, and missing-frame rejection preserved')

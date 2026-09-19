#!/usr/bin/env python3
"""Build review sheets and animation strips from the actual Blender exports."""
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[2]
FACTIONS=('orc','fairy','dwarf','undead','tideborn','automata')
ROLES=('spear','cavalry','siege')
FONT=ImageFont.truetype('/usr/share/fonts/TTF/DejaVuSans.ttf',16) if Path('/usr/share/fonts/TTF/DejaVuSans.ttf').exists() else ImageFont.load_default(size=16)

def review(source,out):
    out.mkdir(parents=True,exist_ok=True)
    sheet=Image.new('RGB',(6*224,3*250),(34,45,41));draw=ImageDraw.Draw(sheet)
    for col,faction in enumerate(FACTIONS):
        for row,role in enumerate(ROLES):
            aid=f'{faction}-{role}';im=Image.open(source/aid/'idle-0-00.png').convert('RGBA')
            sheet.paste(im,(col*224,row*250),im)
            draw.text((col*224+12,row*250+222),aid,font=FONT,fill=(238,229,204))
    sheet.save(out/'lineup.png')
    for faction in FACTIONS:
        sheet=Image.new('RGB',(10*224,3*250),(34,45,41));draw=ImageDraw.Draw(sheet)
        for row,role in enumerate(ROLES):
            aid=f'{faction}-{role}'
            poses=[('idle',0,0),('attack',1,2)]+[('death',d,5) for d in range(8)]
            for col,(state,d,f) in enumerate(poses):
                im=Image.open(source/aid/f'{state}-{d}-{f:02}.png').convert('RGBA')
                sheet.paste(im,(col*224,row*250),im)
                draw.text((col*224+5,row*250+222),f'{role} {state} {d}',font=FONT,fill=(238,229,204))
        sheet.save(out/f'{faction}-poses.png')
        # A looping strip proves the exported frames, not an unrelated scene pose.
        frames=[]
        if not (source/f'{faction}-spear'/'walk-0-07.png').exists():continue
        for state,count in (('idle',4),('walk',8),('attack',6),('death',6)):
            for f in range(count):
                frame=Image.new('RGB',(3*224,250),(34,45,41));draw=ImageDraw.Draw(frame)
                for col,role in enumerate(ROLES):
                    im=Image.open(source/f'{faction}-{role}'/f'{state}-0-{f:02}.png').convert('RGBA')
                    frame.paste(im,(224*col,0),im)
                    draw.text((224*col+8,226),f'{faction} {role}: {state}',font=FONT,fill=(238,229,204))
                frames.append(frame)
        frames[0].save(out/f'{faction}-animations.gif',save_all=True,append_images=frames[1:],duration=160,loop=0)
        walk=Image.new('RGB',(8*224,3*250),(34,45,41));draw=ImageDraw.Draw(walk)
        for row,role in enumerate(ROLES):
            for f in range(8):
                im=Image.open(source/f'{faction}-{role}'/f'walk-0-{f:02}.png').convert('RGBA')
                walk.paste(im,(f*224,row*250),im)
                draw.text((f*224+8,row*250+226),f'{role}: walk {f}',font=FONT,fill=(238,229,204))
        walk.save(out/f'{faction}-walk.png')
    print(out)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source',type=Path,default=ROOT/'art/blender/raw/units');p.add_argument('--out',type=Path,default=ROOT/'work/faction-assets/review');a=p.parse_args();review(a.source,a.out)

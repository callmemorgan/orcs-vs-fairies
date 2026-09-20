#!/usr/bin/env python3
"""Build delivery galleries after review_models.py --portraits and asset review."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/evidence/model-refinement'
FACTIONS = ('orc', 'fairy', 'dwarf', 'undead', 'tideborn', 'automata')
NAMES = ('Ironclad', 'Wild Court', 'Deepforge', 'Ashen Host', 'Tideborn', 'Automata')
COLORS = ('#e8a16c', '#a4dbb4', '#e6c070', '#bfa8dc', '#8bd4d5', '#d7c2ef')
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'


def font(size):
    return ImageFont.truetype(FONT, size)


def portrait(path, bounds):
    im = Image.open(path).convert('RGBA')
    im = im.crop(im.getchannel('A').getbbox())
    im.thumbnail(bounds, Image.Resampling.LANCZOS)
    return im


def gallery():
    width, row_h = 1460, 330
    canvas = Image.new('RGB', (width, 160 + row_h * 6 + 54), '#182724')
    d = ImageDraw.Draw(canvas)
    d.text((34, 25), 'Orcs vs Fairies', font=font(34), fill='#f2ead7')
    d.text((34, 74), 'Model refinement / six factions / 102 editable models', font=font(19), fill='#aabeb2')
    for col, name in enumerate(('Infantry', 'Cavalry', 'Siege', 'Gate')):
        d.text((190 + col * 312, 127), name, font=font(18), fill='#c0cbbc')
    for row, (faction, name, color) in enumerate(zip(FACTIONS, NAMES, COLORS)):
        y = 160 + row * row_h
        d.line((34, y, width - 34, y), fill='#385049', width=1)
        d.text((34, y + 28), name, font=font(20), fill=color)
        for col, role in enumerate(('melee', 'cavalry', 'siege', 'gate')):
            im = portrait(ROOT / f'work/refinement/models/{faction}-{role}.png', (284, 290))
            canvas.paste(im, (190 + col * 312 + (284 - im.width)//2, y + 24 + (290 - im.height)//2), im)
    d.text((34, canvas.height - 34), 'Production models rendered at higher resolution for detail review.', font=font(15), fill='#aabeb2')
    canvas.save(OUT / 'gallery.png')


def comparison():
    canvas = Image.new('RGB', (1460, 1580), '#182724')
    d = ImageDraw.Draw(canvas)
    d.text((34, 25), 'Before / refined', font=font(34), fill='#f2ead7')
    d.text((34, 75), 'Production portraits at the same scale within each pair', font=font(19), fill='#aabeb2')
    for col, title in enumerate(('Infantry', 'Siege machinery', 'Fortifications')):
        x = 210 + col * 410
        d.text((x, 122), title, font=font(20), fill='#f2ead7')
        d.text((x, 152), 'Before', font=font(14), fill='#aabeb2')
        d.text((x + 180, 152), 'Refined', font=font(14), fill='#aabeb2')
    for row, (faction, name, color) in enumerate(zip(FACTIONS, NAMES, COLORS)):
        y = 186 + row * 226
        d.line((34, y, 1426, y), fill='#385049')
        d.text((34, y + 25), name, font=font(20), fill=color)
        for col, role in enumerate(('melee', 'siege', 'gate')):
            paths = [ROOT / base / f'selection-{faction}-{role}.png' for base in ('work/refinement/before/assets', 'public/assets')]
            ims = [Image.open(p).convert('RGBA') for p in paths]
            scale = min(176/max(im.width for im in ims), 194/max(im.height for im in ims))
            for side, im in enumerate(ims):
                im = im.resize((round(im.width*scale), round(im.height*scale)), Image.Resampling.LANCZOS)
                canvas.paste(im, (210 + col*410 + side*180 + (176-im.width)//2, y+20+(194-im.height)//2), im)
    canvas.save(OUT / 'before-after.png')


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    gallery()
    comparison()

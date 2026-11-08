"""Generate launcher and web sizes from the supplied artwork, preserving the drawings.
Requires Python 3 and Pillow. Both originals remain in resources/.
"""
from pathlib import Path
import base64
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parent.parent
res=ROOT/'android/app/src/main/res'

def generate(suffix):
    source=Image.open(ROOT/f'resources/app-icon{suffix}.png').convert('RGBA')
    bounds=source.getchannel('A').point(lambda a:255 if a>=32 else 0).getbbox()
    art=source.crop(bounds);side=max(art.size)
    square=Image.new('RGBA',(side,side));square.alpha_composite(art,((side-art.width)//2,(side-art.height)//2))
    blue='#1048df'
    for density,size,foreground_size in [('mdpi',48,108),('hdpi',72,162),('xhdpi',96,216),('xxhdpi',144,324),('xxxhdpi',192,432)]:
        target=res/f'mipmap-{density}';target.mkdir(exist_ok=True)
        name='ic_launcher'+suffix.replace('-','_')
        square.resize((size,size),Image.Resampling.LANCZOS).save(target/f'{name}.png')
        foreground=Image.new('RGBA',(foreground_size,foreground_size));inset_size=round(foreground_size*72/108)
        foreground.alpha_composite(square.resize((inset_size,inset_size),Image.Resampling.LANCZOS),((foreground_size-inset_size)//2,)*2)
        foreground.save(target/f'{name}_foreground.png')
        circle=Image.new('RGBA',(size,size),blue);small=square.resize((round(size*.9),)*2,Image.Resampling.LANCZOS)
        circle.alpha_composite(small,((size-small.width)//2,)*2)
        mask=Image.new('L',(size,size));ImageDraw.Draw(mask).ellipse((0,0,size-1,size-1),fill=255);circle.putalpha(mask);circle.save(target/f'{name}_round.png')
    for size in [192,512]:square.resize((size,size),Image.Resampling.LANCZOS).save(ROOT/f'public/icon{suffix}-{size}.png')
    image=ROOT/f'src/assets/app-icon{suffix}.png';square.resize((512,512),Image.Resampling.LANCZOS).save(image)
    if not suffix:
        encoded=base64.b64encode(image.read_bytes()).decode('ascii')
        (ROOT/'public/icon.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><image width="512" height="512" href="data:image/png;base64,{encoded}"/></svg>\n')
    else:
        xml='<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/ic_launcher_background"/><foreground android:drawable="@mipmap/ic_launcher_alt_foreground"/></adaptive-icon>\n'
        for name in ['ic_launcher_alt.xml','ic_launcher_alt_round.xml']:(res/'mipmap-anydpi-v26'/name).write_text(xml)
    (res/'values/ic_launcher_background.xml').write_text(f'<?xml version="1.0" encoding="utf-8"?>\n<resources><color name="ic_launcher_background">{blue}</color></resources>\n')
for suffix in ['', '-alt']:generate(suffix)
print('Generated both weekly icon variants.')

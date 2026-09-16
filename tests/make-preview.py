from PIL import Image,ImageOps,ImageDraw
from pathlib import Path
root=Path(__file__).resolve().parent
names=['mock-1280.png','gm-1280.png','news-390.png']
parts=[]
for name in names:
 im=Image.open(root/'screenshots'/name).convert('RGB')
 if '1280' in name:im=im.crop((0,0,1280,min(im.height,1250)));im.thumbnail((650,700))
 else:im.thumbnail((350,900))
 parts.append(im)
out=Image.new('RGB',(1680,940),'#e9eef3');draw=ImageDraw.Draw(out)
draw.text((25,20),'DRAFT ROOM v0.4 | SPOTLIGHT | PREVIEW / GM INTERVIEW / LIVE NEWS',fill='#14263f')
x=20
for im in parts:out.paste(im,(x,65));x+=im.width+15
out.save(root/'screenshots/v04-preview.png')
print(out.size)

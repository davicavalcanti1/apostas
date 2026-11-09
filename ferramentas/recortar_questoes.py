import sys, json, io, base64; sys.path.insert(0, sys.argv[1]+"/py")
import pymupdf
from PIL import Image
S=sys.argv[1]; d=pymupdf.open(sys.argv[2]); DPI=150; X0,X1=50,522; WIDE={5:574,43:536,52:546}; TOP,BOT=18,828
marks=json.load(open(S+"/marks.json"))
Q=[m for m in marks if m[0]=="Q"]; C=[m for m in marks if m[0]=="C"]
def piece(pg,y0,y1):
    pix=d[pg].get_pixmap(dpi=DPI,clip=pymupdf.Rect(X0,y0,WIDE.get(pg,X1),y1))
    im=Image.frombytes("RGB",(pix.width,pix.height),pix.samples)
    g=im.convert("L").point(lambda v:255 if v>240 else 0)
    bb=Image.eval(g,lambda v:255-v).getbbox()
    if not bb: return None
    return im.crop((0,max(0,bb[1]-6),im.width,min(im.height,bb[3]+6)))
def span(p0,y0,p1,y1):
    parts=[]
    for pg in range(p0,p1+1):
        a=y0 if pg==p0 else TOP; b=y1 if pg==p1 else BOT
        if b-a>4:
            x=piece(pg,a,b)
            if x: parts.append(x)
    W=max(p.width for p in parts); H=sum(p.height for p in parts)
    out=Image.new("RGB",(W,H),"white"); y=0
    for p in parts: out.paste(p,(0,y)); y+=p.height
    return out
tot=0
for i,(q,c) in enumerate(zip(Q,C)):
    n=q[1]
    qi=span(q[3],q[4][3]+14,c[3],c[4][1]-14)
    if i+1<len(Q): nx=Q[i+1]; ci=span(c[3],c[4][3]+2,nx[3],nx[4][1]-14)
    else: ci=span(c[3],c[4][3]+2,len(d)-1,BOT)
    for tag,im in (("q",qi),("c",ci)):
        im.save(f"{S}/crops/{tag}{n:02d}.webp","WEBP",quality=72,method=6)
        im.save(f"{S}/crops/{tag}{n:02d}.png") if n in (21,39,41,45,47,53,58,64,65) else None
import os
print(sum(os.path.getsize(f"{S}/crops/{f}") for f in os.listdir(S+"/crops") if f.endswith(".webp"))/1e6,"MB webp")

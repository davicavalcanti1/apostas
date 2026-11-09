import sys, json; sys.path.insert(0, sys.argv[1]+"/py")
import pymupdf
from PIL import Image, ImageDraw
S=sys.argv[1]; d=pymupdf.open(sys.argv[2]); DPI=150; Z=DPI/72
X0,X1=50,522; WIDE={5:574,43:536,52:546}; TOP,BOT=18,828
marks=json.load(open(S+"/marks.json")); alts=json.load(open(S+"/alts.json"))
Q=[m for m in marks if m[0]=="Q"]; C=[m for m in marks if m[0]=="C"]
W=int((max(WIDE.values())-X0)*Z)+2
def virtual(p0,y0,p1,y1):
    segs=[]; ims=[]; off=0
    for pg in range(p0,p1+1):
        a=y0 if pg==p0 else TOP; b=y1 if pg==p1 else BOT
        if b-a<=1: continue
        pix=d[pg].get_pixmap(dpi=DPI,clip=pymupdf.Rect(X0,a,WIDE.get(pg,X1),b))
        segs.append((pg,a,b,off)); ims.append(Image.frombytes("RGB",(pix.width,pix.height),pix.samples)); off+=pix.height
    V=Image.new("RGB",(W,off),"white"); y=0
    for im in ims: V.paste(im,(0,y)); y+=im.height
    return V,segs
def items(segs):
    out=[]
    for pg,a,b,off in segs:
        p=d[pg]
        for blk in p.get_text("dict")["blocks"]:
            for l in blk.get("lines",[]):
                if not "".join(s["text"] for s in l["spans"]).strip(): continue
                y0,y1=l["bbox"][1],l["bbox"][3]
                if y1<=a or y0>=b or l["bbox"][2]<X0: continue
                out.append(("t",off+(max(y0,a)-a)*Z,off+(min(y1,b)-a)*Z,l["bbox"]))
        for im in p.get_image_info():
            y0,y1=im["bbox"][1],im["bbox"][3]
            if y1<=a or y0>=b or im["bbox"][2]-im["bbox"][0]>480: continue
            out.append(("i",off+(max(y0,a)-a)*Z,off+(min(y1,b)-a)*Z,im["bbox"]))
    return out
def trim(im,htrim):
    g=im.convert("L").point(lambda v:0 if v>238 else 255); bb=g.getbbox()
    if not bb: return im
    l=max(0,bb[0]-6) if htrim else 0; r=min(im.width,bb[2]+6) if htrim else min(im.width,max(bb[2]+6,int((X1-X0)*Z)))
    return im.crop((l,max(0,bb[1]-6),r,min(im.height,bb[3]+6)))
for q,c in zip(Q,C):
    n=q[1]; A=alts[str(n)]
    V,segs=virtual(q[3],q[4][3]+14,c[3],c[4][1]-14)
    def vy(pg,y):
        for p,a,b,off in segs:
            if p==pg: return off+(y-a)*Z
    dr=ImageDraw.Draw(V); mk=[]
    for a in A:
        b=a["mk"]; t=vy(a["pg"],b[1]); bo=vy(a["pg"],b[3]); mk.append((t,bo,(t+bo)/2))
        dr.rectangle([(b[0]-X0)*Z-2,t-2,(b[2]-X0)*Z+3,bo+2],fill="white")
    # apaga bordas verticais do cartão do PDF (colunas escuras em quase toda a altura, à direita)
    g=V.convert("L"); px=g.load(); h=V.height
    for x in range(int((X1-X0)*Z)-30, V.width):
        if sum(1 for y in range(0,h,3) if px[x,y]<=238) > 0.6*(h/3):
            dr.line([(x,0),(x,h)],fill="white",width=3)
    reg=[[m[0],m[1]] for m in mk]; stmt_bottom=0
    for kind,t,bo,bb in items(segs):
        cy=(t+bo)/2; owner=None
        if kind=="i":
            inside=[i for i,m in enumerate(mk) if t-2<=m[2]<=bo+2]
            if inside: owner=min(inside,key=lambda i:abs(mk[i][2]-cy))
        if owner is None:
            # expoentes/índices: linha separada que encosta na altura do "X)" pertence a essa letra
            ov=[i for i,m in enumerate(mk) if min(bo,m[1])-max(t,m[0])>1]
            if ov: owner=min(ov,key=lambda i:abs(mk[i][2]-cy))
        if owner is None:
            above=[i for i,m in enumerate(mk) if m[2]<=cy+3]
            owner=above[-1] if above else None
        if owner is None: stmt_bottom=max(stmt_bottom,bo); continue
        reg[owner][0]=min(reg[owner][0],t); reg[owner][1]=max(reg[owner][1],bo)
    cuts=[int((stmt_bottom+reg[0][0])/2) if stmt_bottom and stmt_bottom<reg[0][0] else int(reg[0][0]-6)]
    for i in range(4): cuts.append(int((reg[i][1]+reg[i+1][0])/2))
    cuts.append(V.height)
    trim(V.crop((0,0,W,cuts[0])),False).save(f"{S}/crops2/e{n:02d}.webp","WEBP",quality=72,method=6)
    for i,a in enumerate(A):
        # nada à esquerda do "X)" pertence à alternativa (a apostila às vezes desenha bolinhas de rádio ali)
        dr.rectangle([0,cuts[i],int((a["mk"][0]-X0)*Z)-2,cuts[i+1]],fill="white")
        trim(V.crop((0,cuts[i],W,cuts[i+1])),True).save(f"{S}/crops2/a{n:02d}{a['L']}.webp","WEBP",quality=72,method=6)
import os
fs=os.listdir(S+"/crops2"); print(len(fs), round(sum(os.path.getsize(S+"/crops2/"+f) for f in fs)/1e6,2),"MB")

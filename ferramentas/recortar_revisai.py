# Recorta os simulados do revisaí (layout em duas colunas) em eNNN/aNNNX/cNNN.webp e grava o gabarito tirado da própria apostila.
# uso: python recortar_revisai.py <simulado.pdf> <base: 100 para o Simulado 1, 200 para o 2> <saida.json>  (precisa de pymupdf e pillow; grava em ./crops)
import sys, re, json
sys.stdout.reconfigure(encoding="utf-8")
import pymupdf
from PIL import Image
d=pymupdf.open(sys.argv[1]); BASE=int(sys.argv[2]); DPI=250; Z=DPI/72
COLX={0:(40,292),1:(297,556)}; LX={0:47.5,1:304.5}
def lines(pg):
    for b in d[pg].get_text("dict")["blocks"]:
        for l in b.get("lines",[]):
            t="".join(s["text"] for s in l["spans"]).strip()
            if t: yield t,l["bbox"]
col=lambda bb:0 if bb[0]<290 else 1
# ---- marcadores das questões
Q={}
for pg in range(len(d)):
    for t,bb in lines(pg):
        m=re.match(r"QUEST.O\s+(\d+)$",t)
        if m: Q[int(m.group(1))]=(pg,col(bb),bb)
assert sorted(Q)==list(range(1,91)), sorted(Q)
order=sorted(Q,key=lambda n:(Q[n][0],Q[n][1],Q[n][2][1]))
def render(pg,x0,y0,x1,y1):
    pix=d[pg].get_pixmap(dpi=DPI,clip=pymupdf.Rect(x0,y0,x1,y1))
    return Image.frombytes("RGB",(pix.width,pix.height),pix.samples)
def clean(im,htrim=False):
    g=im.convert("L"); w,h=im.size; px=g.load()
    # apaga linhas horizontais finas (separador do cartão)
    from PIL import ImageDraw; dr=ImageDraw.Draw(im)
    for y in range(h):
        if sum(1 for x in range(0,w,4) if px[x,y]<235)>0.85*(w/4): dr.line([(0,y),(w,y)],fill="white")
    bb=im.convert("L").point(lambda v:255 if v<236 else 0).getbbox()
    if not bb: return im
    p=10
    l=max(0,bb[0]-p) if htrim else 0
    return im.crop((l,max(0,bb[1]-p),min(w,bb[2]+p) if htrim else w,min(h,bb[3]+p)))
meta={}
for i,n in enumerate(order):
    pg,c,hb=Q[n]; x0,x1=COLX[c]
    nx=order[i+1] if i+1<len(order) else None
    yend=Q[nx][2][1]-4 if nx and Q[nx][0]==pg and Q[nx][1]==c else 798
    L=[];T=None;O=None;AD=None
    for t,bb in lines(pg):
        if col(bb)!=c or not (hb[1]-6<bb[1]<yend): continue
        if re.fullmatch(r"[A-E]",t) and abs(bb[0]-(hb[0]-4))<3: L.append((t,bb))
        elif T is None and "•" in t and t.upper()==t: T=(t,bb)
        elif O is None and re.match(r"(ENEM \d{4}|OBMEP|Autoral)",t) and len(t)<40: O=t
        elif t.startswith("Adaptada de") and AD is None: AD=bb
    L.sort(key=lambda x:x[1][1])
    assert "".join(x[0] for x in L)=="ABCDE",(n,L)
    if AD: yend=AD[1]-3
    top=T[1][3]+2
    N=BASE+n
    clean(render(pg,x0,top,x1,L[0][1][1]-4)).save(f"crops/e{N}.webp","WEBP",quality=74,method=6)
    for k,(Lt,bb) in enumerate(L):
        y1=L[k+1][1][1]-4 if k<4 else yend
        clean(render(pg,bb[0]+13,bb[1]-4,x1,y1),True).save(f"crops/a{N}{Lt}.webp","WEBP",quality=74,method=6)
    meta[N]=dict(num=n,topo=T[0],origem=O)
# ---- gabarito (grade) e comentários
gpg=max(pg for pg in range(len(d)) if any(t=="Gabarito comentado" for t,_ in lines(pg)))
occ={}  # n -> lista de (pg,bb)
adg=min(pg for pg in range(gpg+1,len(d)) if any(t.startswith("Autodiagn") for t,_ in lines(pg)))
pgs=list(range(gpg,adg))
allL={}
for pg in pgs:
    ls=list(lines(pg)); allL[pg]=ls
    for t,bb in ls:
        if re.fullmatch(r"\d\d",t): occ.setdefault(int(t),[]).append((pg,bb))
gab={}; com={}
def letter_near(pg,bb,dx=(-2,40),dy=(-2,25)):
    for t,b in allL[pg]:
        if re.fullmatch(r"[A-E]",t) and dx[0]<b[0]-bb[0]<dx[1] and dy[0]<b[1]-bb[1]<dy[1]: return t,b
for n in range(1,91):
    o=occ[n]; g=letter_near(*o[0],dx=(-5,10),dy=(4,20)); gab[n]=g[0]
    # comentário: ocorrência com letra na mesma linha à direita
    cs=[(pg,bb) for pg,bb in o if letter_near(pg,bb,dx=(10,40),dy=(-4,4))]
    assert cs,(n,o); com[n]=cs[-1]
    assert letter_near(*cs[-1],dx=(10,40),dy=(-4,4))[0]==gab[n],n
starts=sorted(((pg,col(bb),bb[1],n) for n,(pg,bb) in com.items()))
for k,(pg,c,y,n) in enumerate(starts):
    nxt=starts[k+1] if k+1<len(starts) else None
    y1=nxt[2]-3 if nxt and nxt[0]==pg and nxt[1]==c else 798
    bb=com[n][1]; x0=bb[0]+18; x1=COLX[c][1]+(4 if c==0 else 0)
    clean(render(pg,x0,y-4,x1,y1),True).save(f"crops/c{BASE+n}.webp","WEBP",quality=74,method=6)
    meta[BASE+n]["gab"]=gab[n]
json.dump(meta,open(sys.argv[3],"w",encoding="utf-8"),ensure_ascii=False,indent=0)
print("ok",len(meta))

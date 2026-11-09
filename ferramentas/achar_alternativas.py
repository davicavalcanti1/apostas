import sys, json, re; sys.path.insert(0, sys.argv[1]+"/py")
import pymupdf
S=sys.argv[1]; d=pymupdf.open(sys.argv[2])
marks=json.load(open(S+"/marks.json"))
Q=[m for m in marks if m[0]=="Q"]; C=[m for m in marks if m[0]=="C"]
# todas as linhas que começam com letra + ")" , com bbox das 2 primeiras letras
lines=[]
for pg in range(len(d)):
    for b in d[pg].get_text("rawdict")["blocks"]:
        for l in b.get("lines",[]):
            chars=[c for s in l["spans"] for c in s["chars"]]
            txt="".join(c["c"] for c in chars)
            st=txt.lstrip(); off=len(txt)-len(st)
            m=re.match(r"([A-E])\)",st)
            if m:
                cs=chars[off:off+2]
                bb=[min(c["bbox"][0] for c in cs),min(c["bbox"][1] for c in cs),max(c["bbox"][2] for c in cs),max(c["bbox"][3] for c in cs)]
                lines.append((pg,l["bbox"][1],m.group(1),bb,l["bbox"]))
key=lambda p,y:(p,y)
out={}; bad=[]
for q,c in zip(Q,C):
    n=q[1]; s=key(q[3],q[4][3]); e=key(c[3],c[4][1])
    cand=[x for x in lines if s<key(x[0],x[1])<e]
    # pega a última sequência A..E em ordem
    seq=[]; lim=e
    for L in "EDCBA":
        opts=[x for x in cand if x[2]==L and key(x[0],x[1])<lim]
        if not opts: break
        x=max(opts,key=lambda x:key(x[0],x[1])); seq.insert(0,x); lim=key(x[0],x[1])
    if len(seq)!=5: bad.append((n,[x[2] for x in cand])); continue
    out[n]=[{"L":x[2],"pg":x[0],"y":x[1],"mk":x[3]} for x in seq]
json.dump(out,open(S+"/alts.json","w"))
print("ok",len(out),"bad",bad)

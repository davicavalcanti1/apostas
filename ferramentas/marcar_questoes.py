import sys, re, json; sys.path.insert(0, sys.argv[1]+"/py")
import pymupdf
d = pymupdf.open(sys.argv[2])
marks=[]
for i,p in enumerate(d):
    for b in p.get_text("dict")["blocks"]:
        for l in b.get("lines",[]):
            t="".join(s["text"] for s in l["spans"]).strip()
            m=re.match(r"QUEST.O\s+(\d+)\s*:\s*(.+)",t)
            if m: marks.append(("Q",int(m.group(1)),m.group(2),i,l["bbox"]))
            elif t.startswith("Coment"): marks.append(("C",None,None,i,l["bbox"]))
    # drawings: card boxes x-range
json.dump(marks,open(sys.argv[1]+"/marks.json","w"),ensure_ascii=False)
for m in marks: print(m[0],m[1],m[3],[round(x) for x in m[4]])

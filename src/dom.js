// Criador de elementos pequeno, para não depender de framework.
export function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "on") e.onclick = v;
    else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
    else if (k === "class") e.className = v;
    else if (k === "style") e.style.cssText = v;
    else if (v === true) e.setAttribute(k, "");
    else e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c);
  return e;
}

// Logo do tintim + nome do site. `escuro` usa a versão negativa (para o cabeçalho marinho).
export const marca = (escuro = false) =>
  el("div", { class: "marca" + (escuro ? " escuro" : "") },
    el("img", { src: escuro ? "/tintim-negativo.svg" : "/tintim.svg", alt: "tintim", width: "88", height: "30" }),
    el("span", { class: "barra", "aria-hidden": "true" }),
    el("span", { class: "nome" }, "apostas"));

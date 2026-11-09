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

export const MENU_TINTIM = "https://painel.tintim.online";

// Pergunta antes de sair do apostas para a página inicial do tintim.
export function confirmarVoltaMenu() {
  if (document.querySelector(".volta-menu")) return;
  const anterior = document.activeElement;
  const fechar = () => { caixa.remove(); document.removeEventListener("keydown", tecla); anterior?.focus?.(); };
  const tecla = (e) => { if (e.key === "Escape") fechar(); };
  const caixa = el("div", { class: "volta-menu", role: "dialog", "aria-modal": "true", "aria-labelledby": "volta-menu-t" },
    el("div", { class: "volta-fundo", on: fechar }),
    el("div", { class: "volta-cartao" },
      el("img", { src: "/favicon.svg", alt: "", class: "volta-icone", width: "56", height: "56" }),
      el("h2", { id: "volta-menu-t" }, "Deseja voltar ao menu?"),
      el("p", {}, "Você vai para a página inicial do tintim. Seu progresso aqui fica salvo."),
      el("div", { class: "volta-acoes" },
        el("button", { class: "botao", on: fechar }, "Ficar no apostas"),
        el("a", { class: "botao cheio", href: MENU_TINTIM }, "Voltar ao menu"))));
  document.addEventListener("keydown", tecla);
  document.body.append(caixa);
  caixa.querySelector(".volta-acoes .botao.cheio").focus();
}

// Logo do tintim + nome do site. `escuro` usa a versão negativa (para o cabeçalho marinho).
// Tocar no logo do tintim pergunta se a pessoa quer voltar para a página inicial do tintim.
export const marca = (escuro = false) =>
  el("div", { class: "marca" + (escuro ? " escuro" : "") },
    el("button", { class: "marca-tintim", "aria-label": "tintim: voltar ao menu", title: "Voltar ao menu do tintim", on: confirmarVoltaMenu },
      el("img", { src: escuro ? "/tintim-negativo.svg" : "/tintim.svg", alt: "tintim", width: "88", height: "30" })),
    el("span", { class: "barra", "aria-hidden": "true" }),
    el("span", { class: "nome" }, "apostas"));

import { sb, BUCKET } from "./supabase.js";
import { el, marca } from "./dom.js";

const AREAS = ["Todas", "Matemática", "Física", "Química", "Biologia"];
const COR = { "Matemática": "var(--mat)", "Física": "var(--fis)", "Química": "var(--qui)", "Biologia": "var(--bio)" };
const FUNDO = { "Matemática": "#eaf1fb", "Física": "#f1edfa", "Química": "#fdeee9", "Biologia": "#e7f5ee" };
const CURTO = { "Matemática": "Mat", "Física": "Fís", "Química": "Quí", "Biologia": "Bio" };
const MODOS = [["todas", "Todas"], ["pendentes", "Não feitas"], ["erradas", "Erradas"]];
const pad = (n) => String(n).padStart(2, "0");
const celular = () => matchMedia("(max-width: 860px)").matches;

// ícones em SVG inline (traço único, herdam a cor do texto)
const svg = (d, w = 20) => {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("width", w); s.setAttribute("height", w);
  s.setAttribute("fill", "none"); s.setAttribute("stroke", "currentColor"); s.setAttribute("stroke-width", "2.2");
  s.setAttribute("stroke-linecap", "round"); s.setAttribute("stroke-linejoin", "round"); s.setAttribute("aria-hidden", "true");
  s.innerHTML = d; return s;
};
const ICO = {
  esq: '<path d="M15 18l-6-6 6-6"/>', dir: '<path d="M9 18l6-6-6-6"/>', x: '<path d="M18 6L6 18M6 6l12 12"/>',
  filtro: '<path d="M4 6h16M7 12h10M10 18h4"/>', lupa: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5M11 8v6M8 11h6"/>',
};

export async function iniciarApp(root, user) {
  const [qs, rs] = await Promise.all([
    sb.from("bq_questoes").select("n,area,topico,gabarito,nota").order("n"),
    sb.from("bq_respostas").select("n,resposta"),
  ]);
  if (qs.error) throw qs.error;
  if (!qs.data.length) return false; // sem acesso liberado (RLS devolve vazio)

  const Q = qs.data.map((r) => ({ n: r.n, a: r.area, t: r.topico, k: r.gabarito, nota: r.nota }));
  const porN = Object.fromEntries(Q.map((q) => [q.n, q]));
  let resp = Object.fromEntries((rs.data || []).map((r) => [r.n, r.resposta]));

  // q = questão inteira (antiga), c = comentário, e = enunciado sem alternativas, aNNX = alternativa X
  const caminhos = Q.flatMap((q) => [`q${pad(q.n)}.webp`, `c${pad(q.n)}.webp`, `e${pad(q.n)}.webp`,
    ..."ABCDE".split("").map((L) => `a${pad(q.n)}${L}.webp`)]);
  const urls = {};
  for (let i = 0; i < caminhos.length; i += 200) {
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(caminhos.slice(i, i + 200), 60 * 60 * 12);
    if (error) throw error;
    data.forEach((s) => { if (s.signedUrl && !s.error) urls[s.path] = s.signedUrl; });
  }
  const img = (tipo, n, L = "") => urls[`${tipo}${pad(n)}${L}.webp`];
  // alternativas clicáveis só quando todas as imagens recortadas existem; senão, volta ao modo antigo
  const separadas = (n) => !!img("e", n) && "ABCDE".split("").every((L) => img("a", n, L));

  const st = { area: "Todas", topico: null, modo: "todas", atual: null, marcada: null };
  const nome = user.user_metadata?.nome || user.email;

  // ---------- esqueleto ----------
  const $stats = el("div", { class: "stats" });
  const $statsMini = el("div", { class: "stats-mini" });
  const $areas = el("div", { class: "pilulas" });
  const $chips = el("div", { class: "chips" });
  const $topicos = el("div", { class: "topicos" });
  const $modos = el("div", { class: "pilulas" });
  const $grade = el("div", { class: "grade" });
  const $main = el("main", { class: "questao-col" });
  const $progTxt = el("span", { class: "prog-txt" });
  const $progBarra = el("div", { class: "prog-barra" });
  const caixa = (id, titulo, corpo) => el("section", { class: "cartao lateral", id }, el("h3", { class: "rotulo" }, titulo), corpo);

  const abrirFolha = () => document.body.classList.add("folha-aberta");
  const fecharFolha = () => document.body.classList.remove("folha-aberta");

  root.replaceChildren(
    el("header", { class: "topo" }, el("div", { class: "miolo topo-in" },
      marca(true),
      el("div", { class: "topo-dir" },
        $progTxt,
        el("span", { class: "email" }, nome),
        el("button", { class: "botao-topo so-pc", on: () => sb.auth.signOut() }, "Sair"),
        el("button", { class: "botao-topo icone so-cel", "aria-label": "Filtros e progresso", on: abrirFolha }, svg(ICO.filtro), el("span", {}, "Filtros")))),
      $progBarra),
    el("div", { class: "miolo pagina" },
      $stats,
      el("div", { class: "layout" },
        el("aside", { "aria-label": "Filtros e progresso" },
          el("div", { class: "folha-cabeca so-cel" },
            el("span", { class: "puxador", "aria-hidden": "true" }),
            el("b", {}, "Filtros e progresso"),
            el("button", { class: "fechar", "aria-label": "Fechar", on: fecharFolha }, svg(ICO.x))),
          el("div", { class: "so-cel" }, $statsMini),
          caixa("c-area", "Área", $areas),
          caixa("c-topico", "Assunto", $topicos),
          caixa("c-modo", "Mostrar", $modos),
          caixa("c-grade", "Questões", $grade),
          el("div", { class: "lateral-acoes" },
            el("button", { class: "botao pequeno", on: zerarFiltro }, "Zerar este filtro"),
            el("button", { class: "botao pequeno", on: zerarTudo }, "Zerar tudo"),
            el("button", { class: "botao pequeno so-cel", on: () => sb.auth.signOut() }, `Sair (${nome})`))),
        el("div", { class: "coluna" }, $chips, $main))),
    el("div", { class: "fundo-folha", on: fecharFolha }),
    el("footer", { class: "rodape" }, el("div", { class: "miolo" },
      el("span", {}, "apostas · uso pessoal para estudo"),
      el("img", { src: "/tintim-negativo.svg", alt: "tintim", height: "22" }))));

  // ---------- estado ----------
  const situacao = (q) => (!resp[q.n] ? null : resp[q.n] === q.k ? "ok" : "erro");
  const noEscopo = (q) => (st.area === "Todas" || q.a === st.area) && (!st.topico || q.t === st.topico);
  const lista = () => Q.filter((q) => noEscopo(q) &&
    (st.modo === "todas" || (st.modo === "pendentes" ? !resp[q.n] : situacao(q) === "erro")));
  const placar = (qs) => { let ok = 0, erro = 0; qs.forEach((q) => { const s = situacao(q); if (s === "ok") ok++; else if (s === "erro") erro++; }); return { ok, erro, tot: qs.length }; };
  const barra = (s) => el("div", { class: "trilho" },
    el("i", { style: `width:${(100 * s.ok) / s.tot}%;background:var(--certo)` }),
    el("i", { style: `width:${(100 * s.erro) / s.tot}%;background:var(--errado)` }));
  const mudar = (fn) => { fn(); st.atual = null; st.marcada = null; desenhar(); };

  function desenharStats() {
    const s = placar(Q), feitas = s.ok + s.erro, pct = feitas ? Math.round((100 * s.ok) / feitas) : null;
    $progTxt.replaceChildren(el("b", {}, String(feitas)), `/${s.tot}`, pct != null ? el("em", {}, ` · ${pct}%`) : null);
    $progBarra.replaceChildren(barra(s));
    const porArea = el("div", { class: "por-area" }, AREAS.slice(1).map((a) => {
      const p = placar(Q.filter((q) => q.a === a));
      return el("div", {}, el("span", {}, CURTO[a]), barra(p), el("span", {}, `${p.ok}/${p.tot}`));
    }));
    $stats.replaceChildren(
      el("div", { class: "cartao stat" }, el("span", {}, "Respondidas"), el("b", {}, String(feitas), el("small", {}, ` / ${s.tot}`))),
      el("div", { class: "cartao stat" }, el("span", {}, "Aproveitamento"), el("b", { style: pct != null && pct >= 60 ? "color:var(--certo)" : "" }, pct == null ? "–" : `${pct}%`)),
      el("div", { class: "cartao stat" }, el("span", {}, "Acertos · erros"),
        el("b", {}, el("em", { style: "color:var(--certo)" }, String(s.ok)), el("small", {}, " · "), el("em", { style: "color:var(--errado)" }, String(s.erro)))),
      el("div", { class: "cartao stat" }, el("span", {}, "Por área"), porArea));
    $statsMini.replaceChildren(el("div", { class: "cartao mini" },
      el("div", { class: "mini-nums" },
        el("div", {}, el("b", {}, String(feitas)), el("span", {}, "respondidas")),
        el("div", {}, el("b", { style: "color:var(--certo)" }, String(s.ok)), el("span", {}, "acertos")),
        el("div", {}, el("b", { style: "color:var(--errado)" }, String(s.erro)), el("span", {}, "erros")),
        el("div", {}, el("b", {}, pct == null ? "–" : `${pct}%`), el("span", {}, "aproveit."))),
      porArea.cloneNode(true)));
  }

  function desenharLateral() {
    const botaoArea = (a) => el("button", {
      class: "pilula" + (st.area === a ? " on" : ""),
      on: () => mudar(() => { st.area = a; st.topico = null; }),
    }, a !== "Todas" ? el("i", { class: "ponto", style: `background:${COR[a]}` }) : null, a);
    $areas.replaceChildren(...AREAS.map(botaoArea));

    // no celular: chips de área roláveis em cima da questão + filtro ativo
    const extras = [];
    if (st.topico) extras.push(el("button", { class: "pilula ativo", on: () => mudar(() => { st.topico = null; }) }, st.topico, svg(ICO.x, 14)));
    if (st.modo !== "todas") extras.push(el("button", { class: "pilula ativo", on: () => mudar(() => { st.modo = "todas"; }) }, MODOS.find((m) => m[0] === st.modo)[1], svg(ICO.x, 14)));
    $chips.replaceChildren(...extras, ...AREAS.map(botaoArea));

    const base = Q.filter((q) => st.area === "Todas" || q.a === st.area);
    const item = (rot, topico, qs) => { const s = placar(qs); return el("button", {
      class: "topico" + (st.topico === topico ? " on" : ""),
      on: () => { mudar(() => { st.topico = topico; }); fecharFolha(); },
    }, el("span", {}, rot), el("span", { class: "n" }, `${s.ok}/${s.tot}`), barra(s)); };
    const itens = [item("Todos os assuntos", null, base)];
    for (const a of AREAS.slice(1)) {
      if (st.area !== "Todas" && st.area !== a) continue;
      const nomes = [...new Set(base.filter((q) => q.a === a).map((q) => q.t))].sort((x, y) => x.localeCompare(y));
      if (!nomes.length) continue;
      if (st.area === "Todas") itens.push(el("div", { class: "grupo" }, el("i", { class: "ponto", style: `background:${COR[a]}` }), a));
      nomes.forEach((nm) => itens.push(item(nm, nm, base.filter((q) => q.t === nm))));
    }
    $topicos.replaceChildren(...itens);

    $modos.replaceChildren(...MODOS.map(([k, r]) => el("button", {
      class: "pilula" + (st.modo === k ? " on" : ""), on: () => mudar(() => { st.modo = k; }),
    }, r)));

    $grade.replaceChildren(...lista().map((q) => { const s = situacao(q); return el("button", {
      class: "casa" + (s ? " " + s : "") + (q.n === st.atual ? " atual" : ""), title: `${q.a} · ${q.t}`,
      on: () => { ir(q.n); fecharFolha(); },
    }, String(q.n)); }));
  }

  function ampliar(src, alt) {
    const fechar = () => { caixaZoom.remove(); document.removeEventListener("keydown", esc); };
    const esc = (e) => { if (e.key === "Escape") fechar(); };
    const caixaZoom = el("div", { class: "zoom", role: "dialog", "aria-label": "Imagem ampliada" },
      el("button", { class: "fechar", "aria-label": "Fechar", on: fechar }, svg(ICO.x, 22)),
      el("div", { class: "zoom-area" }, el("img", { src, alt })));
    document.addEventListener("keydown", esc);
    document.body.append(caixaZoom);
  }

  function desenharQuestao() {
    const L = lista();
    if (!L.length) {
      const [t, s] = st.modo === "erradas" ? ["Nenhuma questão errada aqui", "Continue assim."]
        : st.modo === "pendentes" ? ["Tudo feito neste filtro", "Veja as erradas para revisar."] : ["Nada neste filtro", ""];
      $main.replaceChildren(el("div", { class: "cartao vazio" }, el("b", {}, t), s,
        el("button", { class: "botao", style: "margin-top:16px", on: () => mudar(() => { st.area = "Todas"; st.topico = null; st.modo = "todas"; }) }, "Ver todas as questões")));
      return;
    }
    if (!st.atual || !L.some((q) => q.n === st.atual)) st.atual = (L.find((q) => !resp[q.n]) || L[0]).n;
    const q = porN[st.atual], i = L.findIndex((x) => x.n === q.n), feita = resp[q.n];
    const anterior = L[i - 1], proxima = L[i + 1];

    const modoNovo = separadas(q.n);
    const srcEnun = img(modoNovo ? "e" : "q", q.n);
    const enunciado = el("img", { class: "qimg", alt: `Enunciado da questão ${q.n}`, src: srcEnun });
    enunciado.onload = () => enunciado.classList.add("ok");

    const estado = (X) => feita ? (X === q.k ? " certa" : X === feita ? " errada" : " apagada") : (st.marcada === X ? " marcada" : "");
    const marcar = (X) => { if (!feita) { st.marcada = X; desenharQuestao(); } };

    const alts = modoNovo
      ? el("div", { class: "opcoes", role: "radiogroup", "aria-label": "Alternativas" }, ..."ABCDE".split("").map((X) => {
          const im = el("img", { alt: `Alternativa ${X}`, src: img("a", q.n, X), draggable: "false" });
          // mesma escala do enunciado (recorte a 150 dpi; o enunciado aparece a ~69% no computador)
          im.onload = () => { im.style.width = Math.round(im.naturalWidth * 0.69) + "px"; };
          return el("button", { class: "opcao" + estado(X), disabled: !!feita, role: "radio",
            "aria-checked": String(st.marcada === X || feita === X), on: () => marcar(X) },
            el("span", { class: "letra" }, X), el("span", { class: "conteudo" }, im),
            feita && X === q.k ? el("span", { class: "selo-res ok" }, "Correta") : null,
            feita && X === feita && X !== q.k ? el("span", { class: "selo-res erro" }, "Sua resposta") : null);
        }))
      : el("div", { class: "alts" }, ..."ABCDE".split("").map((X) =>
          el("button", { class: "alt" + estado(X), disabled: !!feita, "aria-label": `Alternativa ${X}`, on: () => marcar(X) }, X)));

    const corpoResposta = [alts];
    let $resultado = null;
    if (feita) {
      const ok = feita === q.k;
      $resultado = el("div", { class: "resultado " + (ok ? "ok" : "erro") },
        el("i", {}, ok ? "✓" : "✕"),
        el("span", {}, ok ? `Acertou! A resposta é ${q.k}.` : `Errou. Você marcou ${feita}, a resposta é ${q.k}.`),
        el("button", { class: "link refazer", on: () => refazer(q.n) }, "Refazer"));
      corpoResposta.push($resultado);
      if (q.nota) corpoResposta.push(el("div", { class: "nota" }, el("b", {}, "Atenção: "), q.nota));
      const com = el("img", { class: "qimg", alt: "Comentário", loading: "lazy", src: img("c", q.n) });
      com.onload = () => com.classList.add("ok");
      corpoResposta.push(el("details", { class: "comentario" }, el("summary", {}, "Ver comentário da apostila"),
        el("div", {}, el("button", { class: "img-botao", "aria-label": "Ampliar comentário", on: () => ampliar(img("c", q.n), "Comentário") }, com))));
    }

    // barra de ação: no computador fica no fim do cartão; no celular gruda embaixo da tela
    const principal = feita
      ? el("button", { class: "botao cheio grande", disabled: !proxima, on: () => proxima && ir(proxima.n) }, proxima ? "Próxima questão" : "Última do filtro")
      : el("button", { class: "botao cheio grande", disabled: !st.marcada, on: responderAtual }, st.marcada ? `Responder ${st.marcada}` : "Escolha uma alternativa");
    const barraAcao = el("div", { class: "barra-acao" },
      el("button", { class: "botao redondo", disabled: !anterior, "aria-label": "Questão anterior", on: () => anterior && ir(anterior.n) }, svg(ICO.esq)),
      principal,
      el("button", { class: "botao redondo", disabled: !proxima, "aria-label": "Próxima questão", on: () => proxima && ir(proxima.n) }, svg(ICO.dir)));

    const cartao = el("article", { class: "cartao questao" },
      el("header", {},
        el("h2", {}, `Questão ${q.n}`),
        el("span", { class: "pos" }, `${i + 1} de ${L.length}`),
        el("div", { class: "etqs" },
          el("span", { class: "etq-area", style: `background:${FUNDO[q.a]};color:${COR[q.a]}` }, el("i", { class: "ponto", style: `background:${COR[q.a]}` }), q.a),
          el("span", { class: "etq" }, q.t))),
      el("div", { class: "enunciado" },
        el("button", { class: "img-botao", "aria-label": "Ampliar enunciado", on: () => ampliar(srcEnun, `Enunciado da questão ${q.n}`) }, enunciado),
        el("button", { class: "ampliar", on: () => ampliar(srcEnun, `Enunciado da questão ${q.n}`) }, svg(ICO.lupa, 16), "Ampliar texto")),
      el("div", { class: "resposta" + (modoNovo ? " nova" : "") }, corpoResposta),
      el("p", { class: "dica so-pc" }, "Teclas A–E marcam · Enter responde · ← → trocam de questão"));

    $main.replaceChildren(cartao, barraAcao);

    if (feita && celular() && st.rolarResultado) { st.rolarResultado = false; $resultado.scrollIntoView({ behavior: "smooth", block: "center" }); }

    if (proxima) { // pré-carrega a próxima
      const p = proxima.n;
      const fontes = separadas(p) ? [img("e", p), ..."ABCDE".split("").map((X) => img("a", p, X))] : [img("q", p)];
      fontes.forEach((src) => { new Image().src = src; });
    }
  }

  function desenhar() { desenharStats(); desenharQuestao(); desenharLateral(); }

  function ir(n) {
    st.atual = n; st.marcada = null; desenhar();
    const topo = $main.getBoundingClientRect().top;
    if (topo < 0 || topo > innerHeight * 0.6) window.scrollTo({ top: scrollY + topo - (celular() ? 112 : 84), behavior: "smooth" });
  }

  async function responderAtual() {
    if (!st.marcada || resp[st.atual]) return;
    const n = st.atual, r = st.marcada;
    resp[n] = r; st.marcada = null; st.rolarResultado = true; desenhar();
    const { error } = await sb.from("bq_respostas").upsert({ user_id: user.id, n, resposta: r });
    if (error) { delete resp[n]; desenhar(); alert("Não consegui salvar sua resposta: " + error.message); }
  }
  async function apagar(ns) {
    if (!ns.length) return;
    const antes = { ...resp }; ns.forEach((n) => delete resp[n]); st.atual = null; st.marcada = null; desenhar();
    const { error } = await sb.from("bq_respostas").delete().in("n", ns);
    if (error) { resp = antes; desenhar(); alert("Erro: " + error.message); }
  }
  async function refazer(n) { await apagar([n]); st.atual = n; desenhar(); }
  function zerarFiltro() { const ns = Q.filter(noEscopo).map((q) => q.n).filter((n) => resp[n]); if (ns.length && confirm(`Apagar ${ns.length} resposta(s) deste filtro?`)) apagar(ns); }
  function zerarTudo() { const ns = Object.keys(resp).map(Number); if (ns.length && confirm("Apagar todas as suas respostas?")) apagar(ns); }

  function vizinha(passo) {
    const L = lista(), i = L.findIndex((x) => x.n === st.atual);
    if (L[i + passo]) ir(L[i + passo].n);
  }

  const teclado = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA/.test(e.target.tagName) || document.querySelector(".zoom")) return;
    const k = e.key.toUpperCase();
    if (k.length === 1 && "ABCDE".includes(k) && !resp[st.atual]) { st.marcada = k; desenharQuestao(); }
    else if (e.key === "Enter") { if (resp[st.atual]) vizinha(1); else responderAtual(); }
    else if (e.key === "ArrowRight") vizinha(1);
    else if (e.key === "ArrowLeft") vizinha(-1);
    else if (e.key === "Escape") fecharFolha();
  };
  document.addEventListener("keydown", teclado);

  // arrastar para o lado troca de questão (só gesto claramente horizontal, com um dedo)
  let toque = null;
  $main.addEventListener("touchstart", (e) => { toque = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() } : null; }, { passive: true });
  $main.addEventListener("touchend", (e) => {
    if (!toque || e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0].clientX - toque.x, dy = e.changedTouches[0].clientY - toque.y;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 45 && Date.now() - toque.t < 600) vizinha(dx < 0 ? 1 : -1);
    toque = null;
  }, { passive: true });

  desenhar();
  return () => { document.removeEventListener("keydown", teclado); fecharFolha(); };
}

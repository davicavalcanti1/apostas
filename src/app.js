import { sb, BUCKET } from "./supabase.js";
import { el, marca } from "./dom.js";

const AREAS = ["Todas", "Matemática", "Física", "Química", "Biologia"];
const COR = { "Matemática": "var(--mat)", "Física": "var(--fis)", "Química": "var(--qui)", "Biologia": "var(--bio)" };
const FUNDO = { "Matemática": "#eaf1fb", "Física": "#f1edfa", "Química": "#fdeee9", "Biologia": "#e7f5ee" };
const MODOS = [["todas", "Todas"], ["pendentes", "Não feitas"], ["erradas", "Erradas"]];
const LISTAS = [["todas", "Simulados 1 e 2"], ["revisai-1", "Simulado 1"], ["revisai-2", "Simulado 2"]];
const NOME_LISTA = { "revisai-1": "Simulado 1", "revisai-2": "Simulado 2" };
const REVISAI_URL = "https://www.instagram.com/revisai.enem/";
const DURACAO = 5 * 60 * 60 * 1000; // 2º dia do ENEM: 5 horas
const pad = (n) => String(n).padStart(2, "0");
const celular = () => matchMedia("(max-width: 860px)").matches;
const guardado = (k, v) => {
  try {
    if (v === undefined) return localStorage.getItem(k);
    if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
  } catch { return null; }
};
const lerJSON = (k, padrao) => { try { return JSON.parse(guardado(k)) ?? padrao; } catch { return padrao; } };
const relogio = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
};
// replaceChildren transforma null em texto "null"; esta versão ignora os vazios
const trocar = ($, ...filhos) => $.replaceChildren(...filhos.flat().filter((c) => c != null && c !== false));
const horas = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); return `${Math.floor(m / 60)}h${pad(m % 60)}`; };

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
  lupa: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5M11 8v6M8 11h6"/>',
  grade: '<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/>',
  relogio: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
  grafico: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  bandeira: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
};

export async function iniciarApp(root, user) {
  const [qs, rs] = await Promise.all([
    sb.from("bq_questoes").select("n,area,topico,gabarito,nota,fonte,num,subtopico,origem").order("n"),
    sb.from("bq_respostas").select("n,resposta"),
  ]);
  if (qs.error) throw qs.error;
  if (!qs.data.length) return false; // sem acesso liberado (RLS devolve vazio)

  const Q = qs.data.map((r) => ({ n: r.n, a: r.area, t: r.topico, k: r.gabarito, nota: r.nota,
    f: r.fonte || "apostas", num: r.num ?? r.n, sub: r.subtopico, origem: r.origem }));
  const rev = (q) => q.f !== "apostas";
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

  const st = { aba: guardado("apostas.aba") === "revisai" ? "revisai" : "apostas", lista: "todas",
    area: "Todas", topico: null, modo: "todas", atual: null, marcada: null };
  const nome = user.user_metadata?.nome || user.email;
  const CHAVE_SIM = `apostas.simulado.${user.id}`, CHAVE_HIST = `apostas.simulados.${user.id}`;
  let sim = lerJSON(CHAVE_SIM, null); // simulado em andamento: { lista, inicio, resp, revisar, atual }
  let tela = "treino"; // treino | simulado | resultado
  let tique = null;

  // ---------- contas ----------
  const situacao = (q) => (!resp[q.n] ? null : resp[q.n] === q.k ? "ok" : "erro");
  const naAba = (q) => (st.aba === "apostas" ? !rev(q) : rev(q) && (st.lista === "todas" || q.f === st.lista));
  const noEscopo = (q) => naAba(q) && (st.area === "Todas" || q.a === st.area) && (!st.topico || q.t === st.topico);
  const lista = () => Q.filter((q) => noEscopo(q) &&
    (st.modo === "todas" || (st.modo === "pendentes" ? !resp[q.n] : situacao(q) === "erro")));
  const placar = (qs) => { let ok = 0, erro = 0; qs.forEach((q) => { const s = situacao(q); if (s === "ok") ok++; else if (s === "erro") erro++; }); return { ok, erro, tot: qs.length }; };
  const barra = (s) => el("div", { class: "trilho" },
    el("i", { style: `width:${(100 * s.ok) / (s.tot || 1)}%;background:var(--certo)` }),
    el("i", { style: `width:${(100 * s.erro) / (s.tot || 1)}%;background:var(--errado)` }));
  const mudar = (fn) => { fn(); st.atual = null; st.marcada = null; desenhar(); };
  const restante = () => (sim ? sim.inicio + DURACAO - Date.now() : 0);
  const salvarSim = () => guardado(CHAVE_SIM, sim ? JSON.stringify(sim) : null);

  // ---------- peças comuns ----------
  function ampliar(src, alt) {
    const fechar = () => { caixaZoom.remove(); document.removeEventListener("keydown", esc); };
    const esc = (e) => { if (e.key === "Escape") fechar(); };
    const caixaZoom = el("div", { class: "zoom", role: "dialog", "aria-label": "Imagem ampliada" },
      el("button", { class: "fechar", "aria-label": "Fechar", on: fechar }, svg(ICO.x, 22)),
      el("div", { class: "zoom-area" }, el("img", { src, alt })));
    document.addEventListener("keydown", esc);
    document.body.append(caixaZoom);
  }

  // Escala: o revisaí foi recortado a 250 dpi (coluna estreita), a monitoria a 150 dpi (página inteira).
  // Os fatores deixam a letra das duas parecida e maior que antes; no celular encolhe para caber.
  const escala = (q, largura) => {
    const natural = rev(q) ? 875 : 983, alvo = rev(q) ? 0.66 : 0.76;
    return Math.min(alvo, (largura - 8) / natural);
  };
  function cabecalhoQuestao(q, pos) {
    return el("header", {},
      el("h2", {}, `Questão ${q.num}`),
      rev(q) ? el("span", { class: "etq-fonte" }, el("img", { src: "/revisai/revisai.png", alt: "revisaí" }), NOME_LISTA[q.f]) : null,
      pos ? el("span", { class: "pos" }, pos) : null,
      el("div", { class: "etqs" },
        el("span", { class: "etq-area", style: `background:${FUNDO[q.a]};color:${COR[q.a]}` }, el("i", { class: "ponto", style: `background:${COR[q.a]}` }), q.a),
        el("span", { class: "etq", title: q.sub ? q.t : null }, q.sub || q.t),
        q.origem ? el("span", { class: "etq origem" }, q.origem) : null));
  }
  // enunciado + alternativas; `estado(X)` dá a classe de cada alternativa e `clicar(X)` trata o toque
  function corpoQuestao(q, $col, { estado, clicar, travada, selos }) {
    const modoNovo = separadas(q.n);
    const srcEnun = img(modoNovo ? "e" : "q", q.n);
    const k = escala(q, Math.min($col.clientWidth || 820, 820) - (celular() ? 16 : 56));
    const enunciado = el("img", { class: "qimg", alt: `Enunciado da questão ${q.num}`, src: srcEnun });
    enunciado.onload = () => { enunciado.classList.add("ok"); enunciado.style.width = Math.round(enunciado.naturalWidth * k) + "px"; };
    const alts = modoNovo
      ? el("div", { class: "opcoes", role: "radiogroup", "aria-label": "Alternativas" }, ..."ABCDE".split("").map((X) => {
          const im = el("img", { alt: `Alternativa ${X}`, src: img("a", q.n, X), draggable: "false" });
          im.onload = () => { im.style.width = Math.round(im.naturalWidth * k) + "px"; };
          return el("button", { class: "opcao" + estado(X), disabled: travada, role: "radio",
            "aria-checked": String(/marcada|certa|errada/.test(estado(X))), on: () => clicar(X) },
            el("span", { class: "letra" }, X), el("span", { class: "conteudo" }, im), selos ? selos(X) : null);
        }))
      : el("div", { class: "alts" }, ..."ABCDE".split("").map((X) =>
          el("button", { class: "alt" + estado(X), disabled: travada, "aria-label": `Alternativa ${X}`, on: () => clicar(X) }, X)));
    return {
      enunciado: el("div", { class: "enunciado" },
        el("button", { class: "img-botao", "aria-label": "Ampliar enunciado", on: () => ampliar(srcEnun, `Enunciado da questão ${q.num}`) }, enunciado),
        el("button", { class: "ampliar", on: () => ampliar(srcEnun, `Enunciado da questão ${q.num}`) }, svg(ICO.lupa, 16), "Ampliar texto")),
      alts,
    };
  }
  const preCarregar = (n) => {
    const fontes = separadas(n) ? [img("e", n), ..."ABCDE".split("").map((X) => img("a", n, X))] : [img("q", n)];
    fontes.forEach((src) => { if (src) new Image().src = src; });
  };

  // ---------- painel lateral (grade de questões, desempenho, simulado) ----------
  const $painel = el("aside", { class: "painel", "aria-hidden": "true" });
  const $fundo = el("div", { class: "fundo-painel", on: () => fecharPainel() });
  let painelAberto = null;
  function abrirPainel(tipo) {
    painelAberto = tipo; desenharPainel();
    document.body.classList.add("painel-aberto"); $painel.setAttribute("aria-hidden", "false");
  }
  function fecharPainel() {
    painelAberto = null; document.body.classList.remove("painel-aberto"); $painel.setAttribute("aria-hidden", "true");
  }
  const cabecaPainel = (titulo) => el("div", { class: "painel-cabeca" },
    el("span", { class: "puxador", "aria-hidden": "true" }),
    el("b", {}, titulo),
    el("button", { class: "fechar", "aria-label": "Fechar", on: fecharPainel }, svg(ICO.x)));
  function desenharPainel() {
    if (!painelAberto) return;
    const conteudo = { grade: painelGrade, desempenho: painelDesempenho, simulado: painelSimulado, cartao: painelCartao }[painelAberto]();
    trocar($painel, ...conteudo);
  }

  function painelGrade() {
    const L = lista(), s = placar(L), casas = []; let grupo = null;
    for (const q of L) {
      if (st.aba === "revisai" && st.lista === "todas" && q.f !== grupo) { grupo = q.f; casas.push(el("div", { class: "grade-grupo" }, NOME_LISTA[q.f])); }
      const sit = situacao(q);
      casas.push(el("button", {
        class: "casa" + (sit ? " " + sit : "") + (q.n === st.atual ? " atual" : ""), title: `${q.a} · ${q.sub || q.t}`,
        on: () => { fecharPainel(); ir(q.n); },
      }, String(q.num)));
    }
    return [cabecaPainel("Questões deste filtro"),
      el("p", { class: "painel-resumo" }, `${L.length} questões · `, el("b", { style: "color:var(--certo)" }, `${s.ok} certas`), " · ",
        el("b", { style: "color:var(--errado)" }, `${s.erro} erradas`), ` · ${L.length - s.ok - s.erro} por fazer`),
      L.length ? el("div", { class: "grade" }, casas) : el("p", { class: "painel-vazio" }, "Nenhuma questão neste filtro."),
      el("div", { class: "legenda" }, el("span", {}, el("i", { class: "casa ok" }), "certa"), el("span", {}, el("i", { class: "casa erro" }), "errada"),
        el("span", {}, el("i", { class: "casa" }), "não feita"))];
  }

  function painelDesempenho() {
    const s = placar(Q), feitas = s.ok + s.erro, pct = feitas ? Math.round((100 * s.ok) / feitas) : null;
    const linha = (rot, qs, acao) => { const p = placar(qs), f = p.ok + p.erro;
      return el(acao ? "button" : "div", { class: "linha-desemp", on: acao || null },
        el("span", {}, rot), el("span", { class: "n" }, f ? `${Math.round((100 * p.ok) / f)}% · ${p.ok}/${p.tot}` : `0/${p.tot}`), barra(p)); };
    const blocos = AREAS.slice(1).map((a) => {
      const daArea = Q.filter((q) => q.a === a);
      const topicos = [...new Set(daArea.map((q) => q.t))].sort((x, y) => x.localeCompare(y));
      return el("section", { class: "desemp-area" },
        el("h4", {}, el("i", { class: "ponto", style: `background:${COR[a]}` }), a),
        linha("Toda a área", daArea),
        ...topicos.map((t) => linha(t, daArea.filter((q) => q.t === t), () => {
          fecharPainel();
          mudar(() => { st.area = a; st.topico = Q.some((q) => naAba(q) && q.t === t) ? t : null; st.modo = "todas"; });
        })));
    });
    const hist = lerJSON(CHAVE_HIST, []);
    return [cabecaPainel("Seu desempenho"),
      el("p", { class: "painel-resumo" }, "Somando monitoria e revisaí. Toque num assunto para treinar só ele."),
      el("div", { class: "nums" },
        el("div", {}, el("b", {}, String(feitas)), el("span", {}, `de ${s.tot} feitas`)),
        el("div", {}, el("b", { style: pct != null && pct >= 60 ? "color:var(--certo)" : "" }, pct == null ? "–" : `${pct}%`), el("span", {}, "aproveitamento")),
        el("div", {}, el("b", { style: "color:var(--certo)" }, String(s.ok)), el("span", {}, "acertos")),
        el("div", {}, el("b", { style: "color:var(--errado)" }, String(s.erro)), el("span", {}, "erros"))),
      hist.length ? el("section", { class: "desemp-area" }, el("h4", {}, svg(ICO.relogio, 15), "Simulados feitos"),
        ...hist.slice(-5).reverse().map((h) => el("div", { class: "linha-hist" },
          el("span", {}, `${NOME_LISTA[h.lista]} · ${new Date(h.fim).toLocaleDateString("pt-BR")}`),
          el("b", {}, `${h.acertos}/90`), el("span", { class: "n" }, horas(h.tempo))))) : null,
      ...blocos,
      el("div", { class: "painel-acoes" },
        el("button", { class: "botao pequeno", on: zerarFiltro }, "Apagar respostas do filtro atual"),
        el("button", { class: "botao pequeno", on: zerarTudo }, "Apagar todas"),
        el("button", { class: "botao pequeno so-cel", on: () => sb.auth.signOut() }, `Sair (${nome})`))];
  }

  function painelSimulado() {
    if (sim) {
      return [cabecaPainel("Simulado em andamento"),
        el("div", { class: "sim-card ativo" },
          el("b", {}, `${NOME_LISTA[sim.lista]} do revisaí`),
          el("p", {}, `${Object.keys(sim.resp).length} de 90 respondidas · restam ${horas(restante())}`),
          el("button", { class: "botao cheio largo", on: () => { fecharPainel(); entrarSimulado(); } }, "Continuar simulado")),
        el("button", { class: "link perigo", on: desistir }, "Desistir deste simulado (as respostas dele são descartadas)")];
    }
    const cartaoSim = (lista) => {
      const qs = Q.filter((q) => q.f === lista), p = placar(qs);
      return el("button", { class: "sim-card", on: () => iniciarSimulado(lista) },
        el("b", {}, NOME_LISTA[lista]),
        el("span", {}, lista === "revisai-1" ? "Nível ENEM, com itens do ENEM 2024 e da OBMEP" : "Nível difícil, com itens do ENEM 2021–2025"),
        el("small", {}, `Você já fez ${p.ok + p.erro} destas 90 no treino`),
        el("span", { class: "sim-ir" }, "Começar", svg(ICO.dir, 16)));
    };
    return [cabecaPainel("Fazer simulado"),
      el("ul", { class: "sim-regras" },
        el("li", {}, el("b", {}, "90 questões"), ": 45 de Natureza e 45 de Matemática, na ordem da prova"),
        el("li", {}, el("b", {}, "5 horas"), " de cronômetro, como no 2º dia. O tempo continua correndo se você sair"),
        el("li", {}, el("b", {}, "Gabarito só no final"), ". Dá para trocar a resposta e marcar questões para revisar"),
        el("li", {}, "Ao entregar, as respostas entram no seu desempenho (substituem as do treino nessas questões)")),
      cartaoSim("revisai-1"), cartaoSim("revisai-2")];
  }

  // ---------- tela de treino ----------
  const $abas = el("nav", { class: "abas-topo", "aria-label": "Listas" });
  const $desemp = el("button", { class: "botao-topo desemp", on: () => abrirPainel("desempenho") });
  const $progBarra = el("div", { class: "prog-barra" });
  const $filtros = el("div", { class: "filtros" });
  const $acoesBarra = el("div", { class: "barra-dir" });
  const $faixa = el("div");
  const $main = el("main", { class: "questao-col" });

  function montarTreino() {
    tela = "treino";
    trocar(root, 
      el("header", { class: "topo" }, el("div", { class: "miolo topo-in" },
        marca(true), $abas,
        el("div", { class: "topo-dir" }, $desemp,
          el("button", { class: "botao-topo so-pc", on: () => sb.auth.signOut() }, "Sair"))),
        $progBarra),
      el("div", { class: "barra-filtros" }, el("div", { class: "miolo barra-in" }, $filtros, $acoesBarra)),
      el("div", { class: "pagina" }, $faixa, $main),
      $fundo, $painel,
      el("footer", { class: "rodape" }, el("div", { class: "miolo" },
        el("span", {}, "apostas · uso pessoal para estudo · questões do revisaí em parceria com ",
          el("a", { href: REVISAI_URL, target: "_blank", rel: "noopener" }, "@revisai.enem")),
        el("img", { src: "/tintim-negativo.svg", alt: "tintim", height: "22" }))));
    desenhar();
  }

  function desenharTopo() {
    const conta = (f) => { const qs = Q.filter(f), s = placar(qs); return `${s.ok + s.erro}/${qs.length}`; };
    const aba = (k, conteudo, filtro) => el("button", {
      class: "aba" + (st.aba === k ? " on" : ""), "aria-pressed": String(st.aba === k),
      on: () => { if (st.aba !== k) { guardado("apostas.aba", k); mudar(() => { st.aba = k; st.topico = null; }); } },
    }, conteudo, el("span", { class: "aba-n" }, conta(filtro)));
    trocar($abas, 
      aba("apostas", el("span", {}, "Monitoria"), (q) => !rev(q)),
      aba("revisai", el("img", { src: st.aba === "revisai" ? "/revisai/revisai.png" : "/revisai/revisai-branco.png", alt: "revisaí", class: "aba-logo" }), rev));
    const s = placar(Q), feitas = s.ok + s.erro, pct = feitas ? Math.round((100 * s.ok) / feitas) : null;
    trocar($desemp, svg(ICO.grafico, 16), el("span", { class: "prog-txt" }, el("b", {}, String(feitas)), `/${s.tot}`,
      pct != null ? el("em", {}, ` · ${pct}%`) : null));
    $desemp.setAttribute("aria-label", `Seu desempenho: ${feitas} de ${s.tot} feitas`);
    trocar($progBarra, barra(s));
  }

  function desenharBarra() {
    const seletor = (rotulo, valor, opcoes, aoMudar) => el("label", { class: "seletor" },
      el("span", { class: "seletor-rot" }, rotulo),
      el("select", { onchange: (e) => aoMudar(e.target.value) }, opcoes.map((o) => o.grupo
        ? el("optgroup", { label: o.grupo }, o.itens.map((i) => el("option", { value: i.v, selected: i.v === valor }, i.r)))
        : el("option", { value: o.v, selected: o.v === valor }, o.r))));
    const base = Q.filter((q) => naAba(q) && (st.area === "Todas" || q.a === st.area));
    const opTopico = (t) => { const qs = base.filter((q) => q.t === t), p = placar(qs); return { v: t, r: `${t} (${p.ok + p.erro}/${qs.length})` }; };
    const topicosDa = (a) => [...new Set(base.filter((q) => q.a === a).map((q) => q.t))].sort((x, y) => x.localeCompare(y)).map(opTopico);
    const opsTopico = [{ v: "", r: "Todos os assuntos" }, ...(st.area === "Todas"
      ? AREAS.slice(1).map((a) => ({ grupo: a, itens: topicosDa(a) })).filter((g) => g.itens.length)
      : topicosDa(st.area))];
    trocar($filtros, 
      st.aba === "revisai" ? seletor("Lista", st.lista, LISTAS.map(([v, r]) => ({ v, r })), (v) => mudar(() => { st.lista = v; st.topico = null; })) : null,
      seletor("Área", st.area, AREAS.map((a) => ({ v: a, r: a === "Todas" ? "Todas as áreas" : a })), (v) => mudar(() => { st.area = v; st.topico = null; })),
      seletor("Assunto", st.topico || "", opsTopico, (v) => mudar(() => { st.topico = v || null; })),
      seletor("Mostrar", st.modo, MODOS.map(([v, r]) => ({ v, r })), (v) => mudar(() => { st.modo = v; })));
    $filtros.querySelectorAll(".seletor").forEach(($s, i) => {
      const sel = $s.querySelector("select"); $s.classList.toggle("ativo", sel.selectedIndex > 0 && !(st.aba === "revisai" && i === 0 && st.lista === "todas"));
    });
    const L = lista(), pos = L.findIndex((q) => q.n === st.atual);
    trocar($acoesBarra, 
      st.aba === "revisai" ? el("button", { class: "botao-sim" + (sim ? " ativo" : ""), on: () => abrirPainel("simulado") },
        svg(ICO.relogio, 17), sim ? el("span", {}, `Simulado · ${horas(restante())}`)
          : [el("span", { class: "rot-pc" }, "Fazer simulado"), el("span", { class: "rot-cel" }, "Simulado")]) : null,
      el("button", { class: "botao-grade", on: () => abrirPainel("grade"), "aria-label": "Ver todas as questões do filtro" },
        svg(ICO.grade, 17), el("span", {}, L.length ? `${pos + 1}/${L.length}` : "0")));
    trocar($faixa, st.aba !== "revisai" ? "" : el("div", { class: "faixa-parceria" },
      el("img", { src: "/revisai/revisai.png", alt: "revisaí" }),
      el("span", {}, "Simulados 1 e 2 do revisaí, em parceria. A apostila completa (teoria, fichas e autodiagnóstico) é gratuita no perfil deles."),
      el("a", { href: REVISAI_URL, target: "_blank", rel: "noopener" }, "Ver apostilas", svg(ICO.dir, 14))));
  }

  function desenharQuestao() {
    const L = lista();
    if (!L.length) {
      const [t, s] = st.modo === "erradas" ? ["Nenhuma questão errada aqui", "Continue assim."]
        : st.modo === "pendentes" ? ["Tudo feito neste filtro", "Veja as erradas para revisar."] : ["Nada neste filtro", ""];
      trocar($main, el("div", { class: "cartao vazio" }, el("b", {}, t), s,
        el("button", { class: "botao", style: "margin-top:16px", on: () => mudar(() => { st.area = "Todas"; st.topico = null; st.modo = "todas"; }) }, "Ver todas as questões")));
      return;
    }
    if (!st.atual || !L.some((q) => q.n === st.atual)) st.atual = (L.find((q) => !resp[q.n]) || L[0]).n;
    const q = porN[st.atual], i = L.findIndex((x) => x.n === q.n), feita = resp[q.n];
    const anterior = L[i - 1], proxima = L[i + 1];

    const { enunciado, alts } = corpoQuestao(q, $main, {
      estado: (X) => feita ? (X === q.k ? " certa" : X === feita ? " errada" : " apagada") : (st.marcada === X ? " marcada" : ""),
      clicar: (X) => { if (!feita) { st.marcada = X; desenharQuestao(); } },
      travada: !!feita,
      selos: (X) => feita && X === q.k ? el("span", { class: "selo-res ok" }, "Correta")
        : feita && X === feita ? el("span", { class: "selo-res erro" }, "Sua resposta") : null,
    });
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
      const com = el("img", { class: "qimg com", alt: "Comentário", loading: "lazy", src: img("c", q.n) });
      com.onload = () => { com.classList.add("ok"); if (rev(q)) com.style.width = Math.round(com.naturalWidth * escala(q, $main.clientWidth - 60)) + "px"; };
      corpoResposta.push(el("details", { class: "comentario", open: true }, el("summary", {}, rev(q) ? "Comentário do revisaí" : "Comentário da apostila"),
        el("div", {}, el("button", { class: "img-botao", "aria-label": "Ampliar comentário", on: () => ampliar(img("c", q.n), "Comentário") }, com))));
    }

    const principal = feita
      ? el("button", { class: "botao cheio grande", disabled: !proxima, on: () => proxima && ir(proxima.n) }, proxima ? "Próxima questão" : "Última do filtro")
      : el("button", { class: "botao cheio grande", disabled: !st.marcada, on: responderAtual }, st.marcada ? `Responder ${st.marcada}` : "Escolha uma alternativa");
    trocar($main, 
      el("article", { class: "cartao questao" },
        cabecalhoQuestao(q, `${i + 1} de ${L.length}`), enunciado,
        el("div", { class: "resposta" }, corpoResposta),
        el("p", { class: "dica so-pc" }, "Teclas A–E marcam · Enter responde · ← → trocam de questão")),
      el("div", { class: "barra-acao" },
        el("button", { class: "botao redondo", disabled: !anterior, "aria-label": "Questão anterior", on: () => anterior && ir(anterior.n) }, svg(ICO.esq)),
        principal,
        el("button", { class: "botao redondo", disabled: !proxima, "aria-label": "Próxima questão", on: () => proxima && ir(proxima.n) }, svg(ICO.dir))));
    if (feita && st.rolarResultado) { st.rolarResultado = false; $resultado.scrollIntoView({ behavior: "smooth", block: "center" }); }
    if (proxima) preCarregar(proxima.n);
  }

  function desenhar() {
    if (tela !== "treino") return;
    desenharTopo(); desenharBarra(); desenharQuestao(); desenharPainel();
  }

  function ir(n) {
    st.atual = n; st.marcada = null; desenhar();
    window.scrollTo({ top: 0, behavior: "smooth" });
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
  function zerarFiltro() { const ns = Q.filter(noEscopo).map((q) => q.n).filter((n) => resp[n]); if (ns.length && confirm(`Apagar ${ns.length} resposta(s) do filtro atual?`)) apagar(ns); }
  function zerarTudo() { const ns = Object.keys(resp).map(Number); if (ns.length && confirm("Apagar todas as suas respostas?")) apagar(ns); }
  function vizinha(passo) {
    const L = lista(), i = L.findIndex((x) => x.n === st.atual);
    if (L[i + passo]) ir(L[i + passo].n);
  }

  // ---------- simulado ----------
  const simQs = () => Q.filter((q) => q.f === sim.lista);
  function iniciarSimulado(lista) {
    sim = { lista, inicio: Date.now(), resp: {}, revisar: [], atual: Q.find((q) => q.f === lista).n };
    salvarSim(); fecharPainel(); entrarSimulado();
  }
  function desistir() {
    if (!confirm("Desistir do simulado? As respostas dele serão descartadas.")) return;
    sim = null; salvarSim(); fecharPainel(); desenhar();
  }

  const $simTempo = el("span", { class: "sim-tempo" });
  const $simConta = el("span", { class: "sim-conta" });
  const $simMain = el("main", { class: "questao-col" });
  function entrarSimulado() {
    if (!sim) return;
    if (restante() <= 0) return entregar(true);
    tela = "simulado";
    trocar(root, 
      el("header", { class: "topo sim" }, el("div", { class: "miolo topo-in" },
        el("div", { class: "sim-titulo" }, el("img", { src: "/revisai/revisai-branco.png", alt: "revisaí" }), el("span", {}, NOME_LISTA[sim.lista])),
        el("div", { class: "sim-relogio" }, svg(ICO.relogio, 18), $simTempo),
        el("div", { class: "topo-dir" },
          el("button", { class: "botao-topo", on: () => abrirPainel("cartao") }, svg(ICO.grade, 16), $simConta),
          el("button", { class: "botao-topo entregar", on: () => entregar(false) }, "Entregar")))),
      el("div", { class: "pagina sim" }, $simMain,
        el("p", { class: "sim-sair" }, el("button", { class: "link", on: sairSimulado }, "Sair e continuar depois"), " · o cronômetro não para")),
      $fundo, $painel);
    atualizarRelogio();
    clearInterval(tique); tique = setInterval(atualizarRelogio, 1000);
    desenharSim();
  }
  function sairSimulado() { clearInterval(tique); fecharPainel(); montarTreino(); }
  function atualizarRelogio() {
    const r = restante();
    $simTempo.textContent = relogio(r);
    $simTempo.parentElement?.classList.toggle("alerta", r < 30 * 60000);
    if (r <= 0) entregar(true);
  }
  function desenharSim() {
    const L = simQs(), q = porN[sim.atual] || L[0], i = L.indexOf(q);
    const anterior = L[i - 1], proxima = L[i + 1], marcada = sim.resp[q.n], revisar = sim.revisar.includes(q.n);
    $simConta.textContent = `${Object.keys(sim.resp).length}/90`;
    const { enunciado, alts } = corpoQuestao(q, $simMain, {
      estado: (X) => (marcada === X ? " marcada" : ""),
      clicar: (X) => { if (sim.resp[q.n] === X) delete sim.resp[q.n]; else sim.resp[q.n] = X; salvarSim(); desenharSim(); },
      travada: false,
    });
    trocar($simMain, 
      el("article", { class: "cartao questao" },
        cabecalhoQuestao(q, `${i + 1} de 90`), enunciado,
        el("div", { class: "resposta" }, alts,
          el("button", { class: "marcar-revisar" + (revisar ? " on" : ""), on: alternarRevisar }, svg(ICO.bandeira, 16),
            revisar ? "Marcada para revisar" : "Marcar para revisar")),
        el("p", { class: "dica so-pc" }, "Teclas A–E marcam (de novo desmarca) · R marca para revisar · ← → trocam de questão")),
      el("div", { class: "barra-acao" },
        el("button", { class: "botao redondo", disabled: !anterior, "aria-label": "Questão anterior", on: () => anterior && irSim(anterior.n) }, svg(ICO.esq)),
        proxima ? el("button", { class: "botao cheio grande", on: () => irSim(proxima.n) }, marcada ? "Próxima questão" : "Pular por enquanto")
          : el("button", { class: "botao cheio grande", on: () => entregar(false) }, "Entregar simulado"),
        el("button", { class: "botao redondo", disabled: !proxima, "aria-label": "Próxima questão", on: () => proxima && irSim(proxima.n) }, svg(ICO.dir))));
    if (proxima) preCarregar(proxima.n);
    desenharPainel();
  }
  function irSim(n) { sim.atual = n; salvarSim(); desenharSim(); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function alternarRevisar() {
    const n = sim.atual; sim.revisar = sim.revisar.includes(n) ? sim.revisar.filter((x) => x !== n) : [...sim.revisar, n];
    salvarSim(); desenharSim();
  }
  function painelCartao() {
    const L = simQs(), feitas = Object.keys(sim.resp).length;
    const casa = (q) => el("button", {
      class: "casa" + (sim.resp[q.n] ? " feita" : "") + (sim.revisar.includes(q.n) ? " revisar" : "") + (q.n === sim.atual ? " atual" : ""),
      on: () => { fecharPainel(); irSim(q.n); },
    }, sim.resp[q.n] ? el("span", {}, String(q.num), el("small", {}, sim.resp[q.n])) : String(q.num));
    return [cabecaPainel("Cartão-resposta"),
      el("p", { class: "painel-resumo" }, `${feitas} respondidas · ${90 - feitas} em branco · ${sim.revisar.length} para revisar · restam ${horas(restante())}`),
      el("div", { class: "grade-grupo" }, "Ciências da Natureza"),
      el("div", { class: "grade cartao-resp" }, L.slice(0, 45).map(casa)),
      el("div", { class: "grade-grupo" }, "Matemática"),
      el("div", { class: "grade cartao-resp" }, L.slice(45).map(casa)),
      el("div", { class: "legenda" }, el("span", {}, el("i", { class: "casa feita" }), "respondida"), el("span", {}, el("i", { class: "casa revisar" }), "revisar"),
        el("span", {}, el("i", { class: "casa" }), "em branco")),
      el("button", { class: "botao cheio largo", style: "margin-top:18px", on: () => { fecharPainel(); entregar(false); } }, "Entregar simulado")];
  }

  async function entregar(acabouTempo) {
    if (!sim) return;
    const L = simQs(), brancas = L.filter((q) => !sim.resp[q.n]).length;
    if (!acabouTempo && !confirm(brancas ? `Entregar com ${brancas} questão(ões) em branco?` : "Entregar o simulado?")) return;
    clearInterval(tique); fecharPainel();
    const feito = sim; sim = null; salvarSim();
    const tempo = Math.min(DURACAO, Date.now() - feito.inicio);
    const linhas = Object.entries(feito.resp).map(([n, r]) => ({ user_id: user.id, n: Number(n), resposta: r }));
    Object.assign(resp, feito.resp);
    let erroSalvar = null;
    if (linhas.length) { const { error } = await sb.from("bq_respostas").upsert(linhas); erroSalvar = error; }
    const acertos = L.filter((q) => feito.resp[q.n] === q.k).length;
    const hist = lerJSON(CHAVE_HIST, []); hist.push({ lista: feito.lista, fim: Date.now(), acertos, respondidas: linhas.length, tempo });
    guardado(CHAVE_HIST, JSON.stringify(hist.slice(-20)));
    mostrarResultado(feito, L, acertos, tempo, acabouTempo, erroSalvar);
  }

  function mostrarResultado(feito, L, acertos, tempo, acabouTempo, erroSalvar) {
    tela = "resultado";
    const parte = (rot, qs) => { const ok = qs.filter((q) => feito.resp[q.n] === q.k).length;
      return el("div", { class: "res-linha" }, el("span", {}, rot), el("div", { class: "trilho" },
        el("i", { style: `width:${(100 * ok) / qs.length}%;background:var(--certo)` })), el("b", {}, `${ok}/${qs.length}`)); };
    const revisar = (modo) => {
      st.aba = "revisai"; guardado("apostas.aba", "revisai"); st.lista = feito.lista; st.area = "Todas"; st.topico = null; st.modo = modo; st.atual = null;
      montarTreino();
    };
    trocar(root, 
      el("header", { class: "topo" }, el("div", { class: "miolo topo-in" }, marca(true))),
      el("div", { class: "pagina" }, el("section", { class: "cartao resultado-sim" },
        el("span", { class: "rotulo" }, acabouTempo ? "O tempo acabou" : "Simulado entregue"),
        el("h2", {}, `${NOME_LISTA[feito.lista]} do revisaí`),
        el("div", { class: "res-nota" }, el("b", {}, String(acertos)), el("span", {}, "/90 acertos")),
        el("p", { class: "res-sub" }, `${Object.keys(feito.resp).length} respondidas · tempo usado ${horas(tempo)} de 5h00`),
        el("div", { class: "res-partes" },
          parte("Ciências da Natureza", L.slice(0, 45)),
          ...["Física", "Química", "Biologia"].map((a) => parte(`   ${a}`, L.slice(0, 45).filter((q) => q.a === a))),
          parte("Matemática", L.slice(45))),
        erroSalvar ? el("p", { class: "nota" }, "Não consegui salvar as respostas no seu desempenho: " + erroSalvar.message) : null,
        el("div", { class: "res-acoes" },
          el("button", { class: "botao cheio grande", on: () => revisar("erradas") }, "Revisar as erradas com comentário"),
          el("button", { class: "botao grande", on: () => revisar("todas") }, "Ver a correção completa")))));
    window.scrollTo({ top: 0 });
  }

  // ---------- teclado e gestos ----------
  const teclado = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || document.querySelector(".zoom")) return;
    if (e.key === "Escape") return fecharPainel();
    if (painelAberto) return;
    const k = e.key.toUpperCase();
    if (tela === "treino") {
      if (k.length === 1 && "ABCDE".includes(k) && !resp[st.atual]) { st.marcada = k; desenharQuestao(); }
      else if (e.key === "Enter") { if (resp[st.atual]) vizinha(1); else responderAtual(); }
      else if (e.key === "ArrowRight") vizinha(1);
      else if (e.key === "ArrowLeft") vizinha(-1);
    } else if (tela === "simulado" && sim) {
      const L = simQs(), i = L.findIndex((q) => q.n === sim.atual);
      if (k.length === 1 && "ABCDE".includes(k)) { if (sim.resp[sim.atual] === k) delete sim.resp[sim.atual]; else sim.resp[sim.atual] = k; salvarSim(); desenharSim(); }
      else if (k === "R") alternarRevisar();
      else if (e.key === "ArrowRight" && L[i + 1]) irSim(L[i + 1].n);
      else if (e.key === "ArrowLeft" && L[i - 1]) irSim(L[i - 1].n);
    }
  };
  document.addEventListener("keydown", teclado);
  // arrastar para o lado troca de questão (só gesto claramente horizontal, com um dedo)
  let toque = null;
  const inicioToque = (e) => { toque = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() } : null; };
  const fimToque = (e) => {
    if (!toque || e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0].clientX - toque.x, dy = e.changedTouches[0].clientY - toque.y;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 45 && Date.now() - toque.t < 600) {
      const passo = dx < 0 ? 1 : -1;
      if (tela === "treino") vizinha(passo);
      else if (tela === "simulado" && sim) { const L = simQs(), i = L.findIndex((q) => q.n === sim.atual); if (L[i + passo]) irSim(L[i + passo].n); }
    }
    toque = null;
  };
  for (const $m of [$main, $simMain]) {
    $m.addEventListener("touchstart", inicioToque, { passive: true });
    $m.addEventListener("touchend", fimToque, { passive: true });
  }

  if (sim && restante() <= 0) await entregar(true);
  else montarTreino();
  return () => { document.removeEventListener("keydown", teclado); clearInterval(tique); fecharPainel(); };
}

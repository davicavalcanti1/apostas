import { sb, BUCKET } from "./supabase.js";
import { el, marca } from "./dom.js";

const AREAS = ["Todas", "Matemática", "Física", "Química", "Biologia"];
const COR = { "Matemática": "var(--mat)", "Física": "var(--fis)", "Química": "var(--qui)", "Biologia": "var(--bio)" };
const FUNDO = { "Matemática": "#eaf1fb", "Física": "#f1edfa", "Química": "#fdeee9", "Biologia": "#e7f5ee" };
const CURTO = { "Matemática": "Mat", "Física": "Fís", "Química": "Quí", "Biologia": "Bio" };
const MODOS = [["todas", "Todas"], ["pendentes", "Não feitas"], ["erradas", "Erradas"]];
const pad = (n) => String(n).padStart(2, "0");

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

  // ---------- esqueleto ----------
  const $stats = el("div", { class: "stats" });
  const $areas = el("div", { class: "pilulas" });
  const $topicos = el("div", { class: "topicos" });
  const $modos = el("div", { class: "pilulas" });
  const $grade = el("div", { class: "grade" });
  const $main = el("main", { class: "questao-col" });
  const caixa = (id, titulo, corpo) => el("section", { class: "cartao lateral", id }, el("h3", { class: "rotulo" }, titulo), corpo);

  root.replaceChildren(
    el("header", { class: "topo" }, el("div", { class: "miolo topo-in" },
      marca(true),
      el("div", { class: "usuario" },
        el("span", { class: "email" }, user.user_metadata?.nome || user.email),
        el("button", { class: "botao-topo", on: () => sb.auth.signOut() }, "Sair")))),
    el("div", { class: "miolo pagina" },
      $stats,
      el("div", { class: "layout" },
        el("aside", {},
          caixa("c-area", "Área", $areas),
          caixa("c-topico", "Assunto", $topicos),
          caixa("c-modo", "Mostrar", $modos),
          caixa("c-grade", "Questões", $grade),
          el("div", { class: "lateral-acoes" },
            el("button", { class: "botao pequeno", on: zerarFiltro }, "Zerar este filtro"),
            el("button", { class: "botao pequeno", on: zerarTudo }, "Zerar tudo"))),
        $main)),
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

  function desenharStats() {
    const s = placar(Q), feitas = s.ok + s.erro, pct = feitas ? Math.round((100 * s.ok) / feitas) : null;
    $stats.replaceChildren(
      el("div", { class: "cartao stat" }, el("span", {}, "Respondidas"), el("b", {}, String(feitas), el("small", {}, ` / ${s.tot}`))),
      el("div", { class: "cartao stat" }, el("span", {}, "Aproveitamento"), el("b", { style: pct != null && pct >= 60 ? "color:var(--certo)" : "" }, pct == null ? "–" : `${pct}%`)),
      el("div", { class: "cartao stat" }, el("span", {}, "Acertos · erros"),
        el("b", {}, el("em", { style: "color:var(--certo)" }, String(s.ok)), el("small", {}, " · "), el("em", { style: "color:var(--errado)" }, String(s.erro)))),
      el("div", { class: "cartao stat" }, el("span", {}, "Por área"),
        el("div", { class: "por-area" }, AREAS.slice(1).map((a) => {
          const p = placar(Q.filter((q) => q.a === a));
          return el("div", {}, el("span", {}, CURTO[a]), barra(p), el("span", {}, `${p.ok}/${p.tot}`));
        }))));
  }

  function desenharLateral() {
    $areas.replaceChildren(...AREAS.map((a) => el("button", {
      class: "pilula" + (st.area === a ? " on" : ""),
      on: () => { st.area = a; st.topico = null; st.atual = null; desenhar(); },
    }, a !== "Todas" ? el("i", { class: "ponto", style: `background:${COR[a]}` }) : null, a)));

    const base = Q.filter((q) => st.area === "Todas" || q.a === st.area);
    const item = (rot, topico, qs) => { const s = placar(qs); return el("button", {
      class: "topico" + (st.topico === topico ? " on" : ""),
      on: () => { st.topico = topico; st.atual = null; desenhar(); },
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
      class: "pilula" + (st.modo === k ? " on" : ""),
      on: () => { st.modo = k; st.atual = null; desenhar(); },
    }, r)));

    $grade.replaceChildren(...lista().map((q) => { const s = situacao(q); return el("button", {
      class: "casa" + (s ? " " + s : "") + (q.n === st.atual ? " atual" : ""), title: `${q.a} · ${q.t}`, on: () => ir(q.n),
    }, String(q.n)); }));
  }

  function desenharQuestao() {
    const L = lista();
    if (!L.length) {
      const [t, s] = st.modo === "erradas" ? ["Nenhuma questão errada aqui", "Continue assim."]
        : st.modo === "pendentes" ? ["Tudo feito neste filtro", "Veja as erradas para revisar."] : ["Nada neste filtro", ""];
      $main.replaceChildren(el("div", { class: "cartao vazio" }, el("b", {}, t), s));
      return;
    }
    if (!st.atual || !L.some((q) => q.n === st.atual)) st.atual = (L.find((q) => !resp[q.n]) || L[0]).n;
    const q = porN[st.atual], i = L.findIndex((x) => x.n === q.n), feita = resp[q.n];

    const modoNovo = separadas(q.n);
    const enunciado = el("img", { class: "qimg", alt: `Enunciado da questão ${q.n}`, src: img(modoNovo ? "e" : "q", q.n) });
    enunciado.onload = () => enunciado.classList.add("ok");

    const estado = (X) => feita ? (X === q.k ? " certa" : X === feita ? " errada" : " apagada") : (st.marcada === X ? " marcada" : "");
    const marcar = (X) => { if (!feita) { st.marcada = X; desenharQuestao(); } };

    // modo novo: cada alternativa é um botão com a letra e o recorte da alternativa
    const alts = modoNovo
      ? el("div", { class: "opcoes", role: "radiogroup", "aria-label": "Alternativas" }, ..."ABCDE".split("").map((X) => {
          const im = el("img", { alt: `Alternativa ${X}`, src: img("a", q.n, X), draggable: "false" });
          // mesma escala do enunciado (o recorte é feito a 150 dpi, o enunciado aparece a ~69%)
          im.onload = () => { im.style.width = Math.round(im.naturalWidth * 0.69) + "px"; };
          return el("button", { class: "opcao" + estado(X), disabled: !!feita, role: "radio",
            "aria-checked": String(st.marcada === X || feita === X), on: () => marcar(X) },
            el("span", { class: "letra" }, X), el("span", { class: "conteudo" }, im),
            feita && X === q.k ? el("span", { class: "selo-res ok" }, "Correta") : null,
            feita && X === feita && X !== q.k ? el("span", { class: "selo-res erro" }, "Sua resposta") : null);
        }))
      : el("div", { class: "alts" }, ..."ABCDE".split("").map((X) =>
          el("button", { class: "alt" + estado(X), disabled: !!feita,
            "aria-label": `Alternativa ${X}`, on: () => marcar(X) }, X)));

    const responder = el("button", { class: "botao cheio", disabled: !st.marcada, on: responderAtual }, "Responder");
    const partes = [alts, el("div", { class: "acoes" },
      feita ? el("button", { class: "botao pequeno", on: () => refazer(q.n) }, "Refazer esta questão")
            : [responder, el("span", { class: "dica" }, "Teclas A–E marcam · Enter responde · ← → navegam")])];

    if (feita) {
      const ok = feita === q.k;
      partes.push(el("div", { class: "resultado " + (ok ? "ok" : "erro") },
        el("i", {}, ok ? "✓" : "✕"),
        ok ? `Acertou! A resposta é ${q.k}.` : `Errou. Você marcou ${feita}, a resposta é ${q.k}.`));
      if (q.nota) partes.push(el("div", { class: "nota" }, el("b", {}, "Atenção: "), q.nota));
      const com = el("img", { class: "qimg", alt: "Comentário", loading: "lazy", src: img("c", q.n) });
      com.onload = () => com.classList.add("ok");
      partes.push(el("details", { class: "comentario" }, el("summary", {}, "Ver comentário da apostila"), el("div", {}, com)));
    }

    const ant = el("button", { class: "botao", disabled: i === 0, on: () => ir(L[i - 1].n) }, "← Anterior");
    const prox = el("button", { class: "botao", disabled: i === L.length - 1, on: () => ir(L[i + 1].n) }, "Próxima →");

    $main.replaceChildren(
      el("article", { class: "cartao questao" },
        el("header", {},
          el("h2", {}, `Questão ${q.n}`),
          el("span", { class: "etq-area", style: `background:${FUNDO[q.a]};color:${COR[q.a]}` }, el("i", { class: "ponto", style: `background:${COR[q.a]}` }), q.a),
          el("span", { class: "etq" }, q.t),
          el("span", { class: "pos" }, `${i + 1} de ${L.length}`)),
        el("div", { class: "enunciado" }, enunciado),
        el("div", { class: "resposta" + (modoNovo ? " nova" : "") }, partes)),
      el("nav", { class: "navegar" }, ant, prox));

    const p = L[i + 1]?.n; // pré-carrega a próxima
    if (p) {
      const fontes = separadas(p) ? [img("e", p), ..."ABCDE".split("").map((X) => img("a", p, X))] : [img("q", p)];
      fontes.forEach((src) => { new Image().src = src; });
    }
  }

  function desenhar() { desenharStats(); desenharQuestao(); desenharLateral(); }

  function ir(n) {
    st.atual = n; st.marcada = null; desenhar();
    if ($main.getBoundingClientRect().top < 0 || innerWidth < 900) $main.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function responderAtual() {
    if (!st.marcada || resp[st.atual]) return;
    const n = st.atual, r = st.marcada;
    resp[n] = r; st.marcada = null; desenhar();
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

  const teclado = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const k = e.key.toUpperCase();
    if (k.length === 1 && "ABCDE".includes(k) && !resp[st.atual]) { st.marcada = k; desenharQuestao(); }
    else if (e.key === "Enter") responderAtual();
    else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const L = lista(), i = L.findIndex((x) => x.n === st.atual), j = i + (e.key === "ArrowRight" ? 1 : -1);
      if (L[j]) ir(L[j].n);
    }
  };
  document.addEventListener("keydown", teclado);

  desenhar();
  return () => document.removeEventListener("keydown", teclado);
}

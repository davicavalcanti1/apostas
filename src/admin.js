// Painel de usuários (só para quem está em bq_admin). Os dados vêm das funções bq_admin_* do banco,
// que recusam qualquer chamada de quem não é admin.
import "./admin.css";
import { sb } from "./supabase.js";
import { el, marca } from "./dom.js";

const AREAS = ["Matemática", "Física", "Química", "Biologia"];
const COR = { "Matemática": "var(--mat)", "Física": "var(--fis)", "Química": "var(--qui)", "Biologia": "var(--bio)" };
const FONTES = [["apostas", "Monitoria"], ["revisai-1", "revisaí · Simulado 1"], ["revisai-2", "revisaí · Simulado 2"]];
const NOME_LISTA = { "revisai-1": "Simulado 1", "revisai-2": "Simulado 2" };
const ORDENS = [["ativos", "Mais ativos"], ["respostas", "Mais respostas"], ["acerto", "Maior acerto"], ["nome", "Nome"], ["cadastro", "Cadastro mais novo"]];

const trocar = ($, ...f) => $.replaceChildren(...f.flat().filter((c) => c != null && c !== false));
const pct = (ok, tot) => (tot ? Math.round((100 * ok) / tot) : null);
const fmtPct = (v) => (v == null ? "–" : `${v}%`);
const dataCurta = (d) => (d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "–");
const quando = (d) => {
  if (!d) return "nunca";
  const min = Math.round((Date.now() - new Date(d)) / 60000);
  if (min < 2) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const dias = Math.round(h / 24);
  return dias === 1 ? "ontem" : `há ${dias} dias`;
};
const corPct = (v) => (v == null ? "" : v >= 70 ? "var(--certo)" : v >= 50 ? "var(--aviso)" : "var(--errado)");
const barra = (ok, erro, tot) => el("div", { class: "trilho" },
  el("i", { style: `width:${(100 * ok) / (tot || 1)}%;background:var(--certo)` }),
  el("i", { style: `width:${(100 * erro) / (tot || 1)}%;background:var(--errado)` }));

export async function montarAdmin(root, { Q, voltar }) {
  const porN = Object.fromEntries(Q.map((q) => [q.n, q]));
  const st = { busca: "", ordem: "ativos", aberto: null };
  let usuarios = [];

  const $resumo = el("div", { class: "adm-resumo" });
  const $lista = el("div", { class: "adm-lista" });
  const $busca = el("input", { class: "adm-busca", type: "search", placeholder: "Buscar por nome ou e-mail", oninput: (e) => { st.busca = e.target.value; desenharLista(); } });
  const $ordem = el("select", { class: "adm-ordem", onchange: (e) => { st.ordem = e.target.value; desenharLista(); } },
    ORDENS.map(([v, r]) => el("option", { value: v }, r)));
  const $painel = el("aside", { class: "painel adm-detalhe", "aria-hidden": "true" });
  const $fundo = el("div", { class: "fundo-painel", on: fechar });

  trocar(root,
    el("header", { class: "topo" }, el("div", { class: "miolo topo-in" },
      marca(true),
      el("span", { class: "adm-titulo" }, "Usuários"),
      el("div", { class: "topo-dir" },
        el("button", { class: "botao-topo", on: carregar }, "Atualizar"),
        el("button", { class: "botao-topo desemp", on: () => { fechar(); voltar(); } }, "Voltar ao site")))),
    el("div", { class: "adm-pagina" },
      $resumo,
      el("div", { class: "adm-controles" }, $busca, $ordem),
      $lista),
    $fundo, $painel);

  function fechar() { st.aberto = null; document.body.classList.remove("painel-aberto"); $painel.setAttribute("aria-hidden", "true"); }
  const esc = (e) => { if (e.key === "Escape") fechar(); };
  document.addEventListener("keydown", esc);

  async function carregar() {
    trocar($lista, el("p", { class: "adm-vazio" }, "Carregando…"));
    const { data, error } = await sb.rpc("bq_admin_usuarios");
    if (error) return trocar($lista, el("p", { class: "adm-vazio" }, "Não consegui carregar: " + error.message));
    usuarios = data;
    desenharResumo(); desenharLista();
  }

  function desenharResumo() {
    const dia = Date.now() - 24 * 3600e3, semana = Date.now() - 7 * 24 * 3600e3;
    const resp = usuarios.reduce((s, u) => s + u.respondidas, 0), ok = usuarios.reduce((s, u) => s + u.acertos, 0);
    const caixa = (rot, val, sub) => el("div", { class: "cartao adm-num" }, el("span", {}, rot), el("b", {}, val), sub ? el("small", {}, sub) : null);
    trocar($resumo,
      caixa("Usuários", String(usuarios.length), `${usuarios.filter((u) => u.liberado).length} com acesso`),
      caixa("Ativos nas últimas 24 h", String(usuarios.filter((u) => u.ultima_resposta && new Date(u.ultima_resposta) > dia).length),
        `${usuarios.filter((u) => u.ultima_resposta && new Date(u.ultima_resposta) > semana).length} nos últimos 7 dias`),
      caixa("Questões respondidas", resp.toLocaleString("pt-BR"), `${usuarios.filter((u) => u.respondidas > 0).length} pessoas já responderam`),
      caixa("Acerto médio", fmtPct(pct(ok, resp)), `${usuarios.reduce((s, u) => s + u.simulados, 0)} simulados entregues`));
  }

  function desenharLista() {
    const b = st.busca.trim().toLowerCase();
    const L = usuarios.filter((u) => !b || (u.nome || "").toLowerCase().includes(b) || u.email.toLowerCase().includes(b));
    const t = (d) => (d ? new Date(d).getTime() : 0);
    const cmp = {
      ativos: (x, y) => t(y.ultima_resposta) - t(x.ultima_resposta) || t(y.ultimo_login) - t(x.ultimo_login),
      respostas: (x, y) => y.respondidas - x.respondidas,
      acerto: (x, y) => (pct(y.acertos, y.respondidas) ?? -1) - (pct(x.acertos, x.respondidas) ?? -1),
      nome: (x, y) => (x.nome || x.email).localeCompare(y.nome || y.email),
      cadastro: (x, y) => t(y.criado_em) - t(x.criado_em),
    }[st.ordem];
    L.sort(cmp);
    if (!L.length) return trocar($lista, el("p", { class: "adm-vazio" }, "Ninguém encontrado."));
    trocar($lista,
      el("div", { class: "adm-linha adm-cab" },
        el("span", {}, "Pessoa"), el("span", {}, "Respondidas"), el("span", {}, "Acerto"), el("span", {}, "Simulados"),
        el("span", { class: "so-pc-adm" }, "Última atividade"), el("span", { class: "so-pc-adm" }, "Cadastro"), el("span", {}, "")),
      L.map((u) => {
        const p = pct(u.acertos, u.respondidas);
        return el("button", { class: "adm-linha" + (u.liberado ? "" : " bloqueado"), on: () => abrir(u) },
          el("span", { class: "adm-pessoa" }, el("b", {}, u.nome || "(sem nome)"), el("small", {}, u.email)),
          el("span", { class: "adm-n" }, el("b", {}, String(u.respondidas)), el("small", {}, "/260")),
          el("span", { class: "adm-n" }, el("b", { style: `color:${corPct(p)}` }, fmtPct(p))),
          el("span", { class: "adm-n" }, u.simulados ? [el("b", {}, String(u.simulados)), el("small", {}, ` · melhor ${u.melhor_simulado}/90`)] : el("small", {}, "–")),
          el("span", { class: "adm-n so-pc-adm" }, quando(u.ultima_resposta || u.ultimo_login)),
          el("span", { class: "adm-n so-pc-adm" }, dataCurta(u.criado_em)),
          el("span", { class: "adm-selo" + (u.liberado ? " ok" : "") }, u.liberado ? "com acesso" : "sem acesso"));
      }));
  }

  async function abrir(u) {
    st.aberto = u.user_id;
    trocar($painel, cabeca(u.nome || u.email), el("p", { class: "adm-vazio" }, "Carregando…"));
    document.body.classList.add("painel-aberto"); $painel.setAttribute("aria-hidden", "false");
    const [rs, ss] = await Promise.all([sb.rpc("bq_admin_respostas", { alvo: u.user_id }), sb.rpc("bq_admin_simulados", { alvo: u.user_id })]);
    if (st.aberto !== u.user_id) return;
    if (rs.error || ss.error) return trocar($painel, cabeca(u.nome || u.email), el("p", { class: "adm-vazio" }, "Erro: " + (rs.error || ss.error).message));
    trocar($painel, ...detalhe(u, rs.data, ss.data));
  }
  const cabeca = (titulo) => el("div", { class: "painel-cabeca" },
    el("span", { class: "puxador", "aria-hidden": "true" }), el("b", {}, titulo),
    el("button", { class: "fechar", "aria-label": "Fechar", on: fechar }, "×"));

  function detalhe(u, respostas, simulados) {
    const resp = respostas.map((r) => ({ ...r, q: porN[r.n] })).filter((r) => r.q);
    const placar = (filtro) => {
      const qs = Q.filter(filtro), feitas = resp.filter((r) => filtro(r.q)), ok = feitas.filter((r) => r.resposta === r.q.k).length;
      return { tot: qs.length, feitas: feitas.length, ok, erro: feitas.length - ok, p: pct(ok, feitas.length) };
    };
    const linha = (rot, s) => el("div", { class: "linha-desemp" },
      el("span", {}, rot), el("span", { class: "n" }, s.feitas ? `${s.p}% · ${s.ok}/${s.feitas} (de ${s.tot})` : `0 de ${s.tot}`), barra(s.ok, s.erro, s.tot));
    const geral = placar(() => true);

    // pontos fracos: assuntos com pelo menos 3 respondidas, do menor para o maior acerto
    const topicos = [...new Set(Q.map((q) => `${q.a}|${q.t}`))].map((k) => {
      const [a, t] = k.split("|"); return { a, t, ...placar((q) => q.a === a && q.t === t) };
    });
    const fracos = topicos.filter((x) => x.feitas >= 3).sort((x, y) => x.p - y.p || y.feitas - x.feitas).slice(0, 5);
    const fortes = topicos.filter((x) => x.feitas >= 3 && x.p >= 70).sort((x, y) => y.p - x.p).slice(0, 3);

    // atividade por dia (últimos 7 dias)
    const dias = [...Array(7)].map((_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (6 - i)); return d; });
    const porDia = dias.map((d) => resp.filter((r) => { const x = new Date(r.respondido_em); return x >= d && x < new Date(d.getTime() + 864e5); }).length);
    const maxDia = Math.max(1, ...porDia);

    const acao = async () => {
      const liberar = !u.liberado;
      if (!confirm(liberar ? `Liberar o acesso de ${u.email}?` : `Bloquear o acesso de ${u.email}? A pessoa deixa de ver as questões (as respostas ficam guardadas).`)) return;
      const { data, error } = await sb.rpc("bq_admin_acesso", { alvo_email: u.email, liberar });
      if (error) return alert("Erro: " + error.message);
      if (data === "admin") return alert("Não dá para bloquear um administrador.");
      u.liberado = liberar; desenharResumo(); desenharLista(); abrir(u);
    };

    return [cabeca(u.nome || "(sem nome)"),
      el("p", { class: "adm-sub" }, u.email, el("br"),
        `Cadastro em ${dataCurta(u.criado_em)} · último login ${quando(u.ultimo_login)} · última resposta ${quando(u.ultima_resposta)}`),
      el("div", { class: "nums" },
        el("div", {}, el("b", {}, String(geral.feitas)), el("span", {}, "de 260 feitas")),
        el("div", {}, el("b", { style: `color:${corPct(geral.p)}` }, fmtPct(geral.p)), el("span", {}, "acerto")),
        el("div", {}, el("b", { style: "color:var(--certo)" }, String(geral.ok)), el("span", {}, "acertos")),
        el("div", {}, el("b", { style: "color:var(--errado)" }, String(geral.erro)), el("span", {}, "erros"))),
      el("section", { class: "desemp-area" }, el("h4", {}, "Atividade nos últimos 7 dias"),
        el("div", { class: "adm-dias" }, dias.map((d, i) => el("div", { class: "adm-dia", title: `${porDia[i]} respostas` },
          el("i", { style: `height:${Math.max(3, (100 * porDia[i]) / maxDia)}%` }),
          el("b", {}, String(porDia[i] || "")),
          el("span", {}, d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")))))),
      fracos.length ? el("section", { class: "desemp-area" }, el("h4", {}, "Pontos fracos (menor acerto)"),
        fracos.map((x) => linha(`${x.t} · ${x.a}`, x))) : null,
      fortes.length ? el("section", { class: "desemp-area" }, el("h4", {}, "Pontos fortes"),
        fortes.map((x) => linha(`${x.t} · ${x.a}`, x))) : null,
      el("section", { class: "desemp-area" }, el("h4", {}, "Por lista"),
        FONTES.map(([f, rot]) => linha(rot, placar((q) => q.f === f)))),
      el("section", { class: "desemp-area" }, el("h4", {}, "Simulados entregues"),
        simulados.length ? simulados.map((s) => el("div", { class: "linha-hist" },
          el("span", {}, `${NOME_LISTA[s.lista]} · ${dataCurta(s.feito_em)}`), el("b", {}, `${s.acertos}/90`),
          el("span", { class: "n" }, `${s.respondidas} resp. · ${Math.floor(s.tempo_seg / 3600)}h${String(Math.round((s.tempo_seg % 3600) / 60)).padStart(2, "0")}`)))
          : el("p", { class: "adm-vazio pequeno" }, "Nenhum simulado entregue ainda.")),
      ...AREAS.map((a) => el("section", { class: "desemp-area" },
        el("h4", {}, el("i", { class: "ponto", style: `background:${COR[a]}` }), a),
        linha("Toda a área", placar((q) => q.a === a)),
        topicos.filter((x) => x.a === a).sort((x, y) => x.t.localeCompare(y.t)).map((x) => linha(x.t, x)))),
      el("div", { class: "painel-acoes" },
        el("button", { class: "botao pequeno" + (u.liberado ? " perigo" : ""), on: acao }, u.liberado ? "Bloquear acesso" : "Liberar acesso"))];
  }

  await carregar();
  return () => { document.removeEventListener("keydown", esc); fechar(); };
}

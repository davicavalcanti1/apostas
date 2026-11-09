import "./style.css";
import "./painel.css";
import { sb } from "./supabase.js";
import { telaLogin, telaSemAcesso, traduzErro, resgatarConvite, conviteDoLink } from "./auth.js";
import { iniciarApp } from "./app.js";
import { el } from "./dom.js";

const root = document.getElementById("root");
let usuarioAtual = null;
let desmontar = null;

const carregando = (txt = "Carregando…") => root.replaceChildren(el("div", { class: "carregando" }, txt));

sb.auth.onAuthStateChange((evento, sessao) => {
  // o callback não pode ser async (trava o cliente do Supabase); o trabalho vai para a fila
  setTimeout(() => trocar(evento, sessao), 0);
});

async function trocar(evento, sessao) {
  if (evento === "PASSWORD_RECOVERY") {
    const nova = prompt("Digite a nova senha (mínimo 6 caracteres):");
    if (nova) {
      const { error } = await sb.auth.updateUser({ password: nova });
      alert(error ? traduzErro(error.message) : "Senha alterada!");
    }
  }
  const user = sessao?.user ?? null;
  if (user && usuarioAtual && user.id === usuarioAtual.id) return; // só renovou o token
  usuarioAtual = user;
  desmontar?.(); desmontar = null;

  if (!user) return telaLogin(root);
  await abrir(user, true);
}

async function abrir(user, tentarConviteSalvo) {
  carregando("Carregando questões…");
  try {
    let r = await iniciarApp(root, user);
    let aviso = null;
    const salvo = user.user_metadata?.convite || conviteDoLink;
    if (r === false && tentarConviteSalvo && salvo) {
      // conta criada com código (ou aberta pelo link de convite): libera automaticamente
      const res = await resgatarConvite(salvo);
      if (res === "ok") r = await iniciarApp(root, user);
      else aviso = "O código usado no cadastro não funcionou. Digite de novo.";
    }
    if (r === false) telaSemAcesso(root, user, () => abrir(user, false), aviso);
    else desmontar = r;
  } catch (err) {
    root.replaceChildren(el("div", { class: "carregando" }, "Erro ao carregar: " + (err.message || err),
      el("button", { class: "botao", on: () => location.reload() }, "Tentar de novo")));
  }
}

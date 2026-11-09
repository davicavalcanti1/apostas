import { sb } from "./supabase.js";
import { el, marca } from "./dom.js";

const TEXTOS = {
  entrar:   { titulo: "Entrar", sub: "Use o e-mail e a senha da sua conta.", botao: "Entrar" },
  criar:    { titulo: "Criar conta", sub: "Crie sua senha. O acesso às questões é liberado pelo organizador.", botao: "Criar conta" },
  recuperar:{ titulo: "Recuperar senha", sub: "Enviamos um link para você criar uma senha nova.", botao: "Enviar link" },
};

export function traduzErro(m = "") {
  if (/Invalid login/i.test(m)) return "E-mail ou senha incorretos.";
  if (/Email not confirmed/i.test(m)) return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
  if (/already registered/i.test(m)) return "Esse e-mail já tem conta. Faça login.";
  if (/Password should/i.test(m)) return "A senha precisa ter pelo menos 6 caracteres.";
  if (/rate limit/i.test(m)) return "Muitas tentativas. Espere alguns minutos.";
  return m;
}

export function telaLogin(root, modo = "entrar", aviso = null) {
  const t = TEXTOS[modo];
  const nome = el("input", { id: "nome", type: "text", autocomplete: "name", maxlength: "80", required: modo === "criar" });
  const email = el("input", { id: "email", type: "email", autocomplete: "email", required: true });
  const senha = el("input", { id: "senha", type: "password", minlength: "6", required: modo !== "recuperar",
    autocomplete: modo === "criar" ? "new-password" : "current-password" });
  const msg = el("div", {}, aviso ? el("div", { class: `aviso ${aviso[0]}` }, aviso[1]) : null);
  const botao = el("button", { class: "botao cheio largo", type: "submit" }, t.botao);

  const form = el("form", { onsubmit: async (e) => {
    e.preventDefault();
    botao.disabled = true;
    try {
      if (modo === "entrar") {
        const { error } = await sb.auth.signInWithPassword({ email: email.value.trim(), password: senha.value });
        if (error) throw error;
      } else if (modo === "criar") {
        const { data, error } = await sb.auth.signUp({ email: email.value.trim(), password: senha.value,
          options: { emailRedirectTo: location.origin, data: { nome: nome.value.trim() } } });
        if (error) throw error;
        if (!data.session) return telaLogin(root, "entrar", ["info", "Conta criada! Confirme pelo link enviado ao seu e-mail e depois entre aqui."]);
      } else {
        const { error } = await sb.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: location.origin });
        if (error) throw error;
        return telaLogin(root, "entrar", ["info", "Se o e-mail tiver conta, o link para trocar a senha chega em instantes."]);
      }
    } catch (err) {
      msg.replaceChildren(el("div", { class: "aviso erro" }, traduzErro(err.message || String(err))));
    }
    botao.disabled = false;
  }},
    modo === "criar" ? el("label", { class: "campo" }, el("span", {}, "Nome"), nome) : null,
    el("label", { class: "campo" }, el("span", {}, "E-mail"), email),
    modo !== "recuperar" ? el("label", { class: "campo" }, el("span", {}, "Senha"), senha) : null,
    botao);

  const link = (texto, m) => el("button", { class: "link", type: "button", on: () => telaLogin(root, m) }, texto);
  const rodape = modo === "entrar"
    ? [el("span", {}, "Não tem conta? ", link("Criar conta", "criar")), link("Esqueci minha senha", "recuperar")]
    : [link("Voltar para o login", "entrar")];

  root.replaceChildren(
    el("main", { class: "tela-login" },
      el("div", { class: "login-intro" },
        marca(),
        el("h1", {}, "Treine as ", el("em", {}, "apostas"), " para o 2º dia."),
        el("p", {}, "80 questões de Matemática e Ciências da Natureza, separadas por assunto. Você marca, confere e acompanha onde precisa revisar.")),
      el("section", { class: "cartao login-cartao" },
        el("h2", {}, t.titulo),
        el("p", { class: "sub" }, t.sub),
        msg, form,
        el("div", { class: "login-rodape" }, rodape))));
  email.focus();
}

export function telaSemAcesso(root, user) {
  root.replaceChildren(
    el("main", { class: "tela-login" },
      el("section", { class: "cartao login-cartao centro" },
        marca(),
        el("h2", {}, "Falta liberar seu acesso"),
        el("p", { class: "sub" }, `Sua conta foi criada. Peça ao organizador para liberar o e-mail ${user.email} e depois recarregue a página.`),
        el("div", { class: "acoes" },
          el("button", { class: "botao cheio", on: () => location.reload() }, "Recarregar"),
          el("button", { class: "botao", on: () => sb.auth.signOut() }, "Sair")))));
}

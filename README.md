# apostas

Site de treino com as 80 questões da revisão da monitoria (2º dia do ENEM: Matemática e Ciências da Natureza). A pessoa entra com e-mail e senha, resolve por área e assunto, confere o gabarito e vê o comentário. O progresso fica salvo na conta. Visual do tintim.

- **Front:** Vite + JavaScript puro (`src/`), servido por nginx.
- **Back:** Supabase, projeto **oficina** (tabelas `bq_*` e bucket privado `banco-questoes`, ver `supabase/schema.sql`).
- **Acesso:** qualquer pessoa cria conta, mas só vê as questões quem estiver em `bq_acesso`. O conteúdo (gabarito e imagens) nunca fica no repositório.

## Rodar local

```bash
cp .env.example .env
npm install
npm run dev
```

## Deploy no Easypanel

1. Crie um serviço **App** e aponte para este repositório (branch `main`).
2. Em **Build**, escolha **Dockerfile** (caminho `Dockerfile`). Os valores do Supabase já vêm como padrão no Dockerfile; para trocar, defina os Build Args `VITE_SUPABASE_URL` e `VITE_SUPABASE_KEY`.
3. Em **Domains**, aponte o domínio para a porta **80**.
4. No Supabase (oficina) → Authentication → URL Configuration, adicione o domínio do site em **Redirect URLs** (ex.: `https://apostas.tintim.online/**`). Sem isso, os links de confirmação de e-mail e de troca de senha voltam para o endereço padrão do projeto.

## Liberar um amigo

No SQL Editor do Supabase:

```sql
insert into public.bq_acesso(email) values ('amigo@exemplo.com');
```

O e-mail precisa estar em minúsculas. Depois disso, é só a pessoa recarregar a página.

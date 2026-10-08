# Personal Chef Carolina — contexto do projeto

Site da Personal Chef Carolina (Teresópolis, RJ): marmitas fitness, caldos e cozinha particular. Dono do projeto fala português (pt-BR); responder em português.

## Infra
- Repositório: github.com/willianslack/personalchef-carolina (branch `master`, público)
- Hospedagem: Render, via Blueprint (`render.yaml`): web service Node `personalchef-carolina` (plano starter) + Postgres `personalchef-carolina-db` (plano basic-256mb)
- Site: https://personalchef-carolina.onrender.com — admin em `/admin` (Basic Auth, usuário `carolina`)
- Senha do admin = variável `ADMIN_PASSWORD`, definida só no painel do Render (Environment). NUNCA colocar no repositório.
- Todo `git push` na `master` faz deploy automático (leva ~1 a 2 min).
- Contato da Carolina: WhatsApp 21 98461-6790 (wa.me/5521984616790), Instagram @personalchef.carolina

## Estrutura
- `server.js` — Express + Postgres. Tabelas: `cadastros`, `ingredientes`, `receitas`, `avaliacoes`
- `public/index.html` — site público (abas Início / Cardápio / Cadastro; avaliações dentro de Início)
- `admin/index.html` — painel: Cadastros, Calculadora de Custo (+ receitas dos pratos), Ingredientes, Avaliações
- `assets/` — QR code do site (PNG e SVG)

## Decisões de marca e conteúdo
- Nome: "Personal Chef Carolina". Não usar "Cocina" (veio de um template genérico, não é a marca real).
- Usar "Cozinha Particular" (nunca "Chef em Casa").
- Cardápio não varia por semana: não usar "cardápio da semana".
- Paleta: creme / oliva / terracota. Tipografia: Cormorant Garamond, Petit Formal Script, Poppins.
- Site sempre no tema claro (`color-scheme: light` + `data-theme="light"`); não reativar modo escuro automático.
- Avaliações passam por moderação: só aparecem no site depois de aprovadas no admin.

## Cuidados técnicos
- Receitas (`receitas`) são chaveadas pelo nome EXATO do prato. Ao renomear um prato: atualizar `public/index.html`, o array `CARDAPIO` em `admin/index.html` e recriar a receita com o nome novo (apagar a antiga via `DELETE /api/receitas/:prato`).
- No Windows/Git Bash, texto com acento passado direto no `curl -d` chega corrompido ao servidor. Enviar JSON de arquivo UTF-8 com `--data-binary @arquivo.json`.
- Antes de funcionalidades grandes e visuais, a Carolina prefere ver uma imagem/mockup e aprovar antes de implementar.

# Landing Page — Documentação Funcional

> Página inicial do Tipo7.com. É a primeira tela que qualquer visitante vê ao entrar no site,
> esteja logado ou não. Seu objetivo é mostrar eventos relevantes e converter o visitante
> em comprador ou promotor.

---

## 1. HEADER (Barra de Navegação)

**O que é:** Faixa fixada no topo da tela que acompanha o usuário ao rolar a página.

**Altura:** 60px

**Comportamento:**
- Sempre visível — não some ao rolar
- Ao rolar a página para baixo, o fundo fica mais sólido (efeito de vidro fosco)
- No mobile, o menu hambúrguer substitui o botão de acesso

**Elementos:**

| Elemento | Posição | O que faz |
|---|---|---|
| Logo (ícone + "Tipo7.com") | Esquerda | Clicando, leva para a página inicial |
| Botão "Entrar / Cadastrar" | Direita (desktop) | Abre a tela de login/cadastro *(ainda não implementado)* |
| Ícone de menu (☰) | Direita (mobile) | Abre o menu em tela cheia no celular |

**Menu mobile (quando aberto):**
- Tela cheia com fundo escuro
- Botão "Entrar / Cadastrar" centralizado
- Texto de apoio explicando a plataforma
- Clicando no botão ou fora do menu, ele fecha

---

## 2. BARRA DE LOCALIZAÇÃO

**O que é:** Faixa fina logo abaixo do header que detecta e exibe a cidade do visitante.

**Por que existe:** Para filtrar e mostrar eventos próximos ao visitante automaticamente, mesmo sem ele estar logado.

**Estados possíveis:**

| Estado | O que aparece | Ação disponível |
|---|---|---|
| Nunca perguntamos | "Descubra eventos perto de você" | Botão **"Detectar minha localização"** |
| Detectando... | Ícone de carregamento + "Detectando sua localização..." | Nenhuma — aguarda resposta |
| Cidade encontrada | Ícone 📍 + nome da cidade + "eventos perto de você" | Botão **"Mudar cidade"** |
| Permissão negada | "Exibindo eventos de todo o Brasil" | Botão **"Tentar novamente"** |

**Botões:**

| Botão | O que faz |
|---|---|
| **Detectar minha localização** | Pede permissão ao navegador para acessar GPS/rede. Se o visitante aceitar, detecta a cidade automaticamente. |
| **Mudar cidade** | Apaga a cidade salva e volta para o estado inicial (sem localização). O visitante pode detectar novamente ou deixar sem localização. |
| **Tentar novamente** | Faz uma nova tentativa de detectar a localização caso tenha sido negada antes. |

**Regras importantes:**
- A cidade detectada é salva no navegador (localStorage) — na próxima visita, não pede permissão de novo
- Funciona para visitantes não logados e logados
- Se o visitante negar, o site continua funcionando normalmente (mostra eventos gerais)

---

## 3. CARROSSEL DE EVENTOS

**O que é:** Galeria de banners de eventos em destaque, logo abaixo da barra de localização.

**Visual:**
- 1 banner grande no centro (800px de largura, 500px de altura)
- 3 banners menores de cada lado, diminuindo progressivamente em tamanho e brilho
- Cada banner mostra a imagem do evento com overlay escuro para legibilidade
- Tag no canto superior esquerdo mostrando cidade e estado do evento

**Abaixo do carrossel (informações do evento em destaque):**
- Nome do evento (fonte Outfit, elegante e moderna)
- 📍 Cidade · Estado
- 📅 Data do evento
- Botão **"Ver ingressos"**

**Navegação:**

| Ação | O que faz |
|---|---|
| Clique na seta ← | Volta para o banner anterior |
| Clique na seta → | Avança para o próximo banner |
| Clique em um banner lateral | Centraliza aquele banner |
| Clique nas bolinhas (●) | Vai direto para o banner correspondente |
| Arrastar para o lado (mobile) | Navega entre banners (swipe) |
| Deixar parado | Avança automaticamente a cada 5 segundos |
| Passar o mouse por cima | Pausa o avanço automático |

**Regras de conteúdo:**
- Os eventos exibidos são buscados diretamente do banco de dados
- Se a cidade do visitante foi detectada → mostra eventos daquela cidade
- Se não encontrou eventos na cidade → mostra os próximos eventos de qualquer lugar
- Se não tem localização → mostra os 7 eventos mais próximos da data
- Ao mudar de cidade na barra de localização, o carrossel atualiza automaticamente

**Botão "Ver ingressos":**
- Aparece abaixo do carrossel, referente ao evento centralizado
- *(Ainda não implementado: levará para a página de detalhes e compra do evento)*

---

## O QUE AINDA SERÁ CONSTRUÍDO NESTA PÁGINA

| Seção | Descrição |
|---|---|
| **Filtros de categoria** | Linha de ícones clicáveis: Show, Festival, Teatro, Esporte, Comédia, Gastronomia, Cursos, Gratuitos. Ao clicar, filtra os eventos exibidos. |
| **Barra de busca** | Campo de texto para buscar evento por nome ou artista. |
| **Grade de eventos** | Cards de eventos em grid responsivo (foto, nome, data, cidade, preço). |
| **Seção "Crie seu evento"** | Bloco para atrair promotores com chamada para cadastro. |
| **Rodapé** | Links institucionais, cidades, categorias, redes sociais. |

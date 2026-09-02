# Link preview no wuzapi com imagem, título e descrição que você controla

O wuzapi já monta card de link preview, mas todos os campos vêm da página de destino. Este patch adiciona três campos opcionais em `POST /chat/send/text` para o chamador decidir o que aparece no card — incluindo a imagem.

Escrito depois de fazer funcionar num bot de ofertas em produção. Inclui os erros que custaram mensagem feia no grupo.

---

## O problema

Mandar oferta como mensagem de imagem com legenda tem um defeito: quem desliga o download automático de mídia no WhatsApp vê um borrão no lugar da foto. Justamente quem está passando o olho no grupo.

Card de link preview não tem esse problema — ele vem embutido na mensagem e renderiza independente dessa configuração. O wuzapi suporta isso de fábrica:

```json
{ "Phone": "...", "Body": "olha isso https://exemplo.com/x", "LinkPreview": true }
```

Com a flag ligada ele extrai a primeira URL do corpo, busca os metadados Open Graph da página, gera uma miniatura de 192px, sobe um thumbnail de até 600px para os servidores de mídia do WhatsApp (é isso que faz o card grande aparecer em vez do ícone pequeno) e manda.

Funciona. O problema é que **tudo vem da página**, e a página raramente coopera:

- **A descrição é institucional.** No Mercado Livre, todo card saía com *"Visite a página e encontre todos os produtos de fulano em um só lugar"* — texto que não fala nada da oferta.
- **A imagem é recortada no contorno do produto.** O `og:image` de um óculos vinha 500x174; de um shampoo, 182x500; de um kit facial, 500x248. Cada card saía com uma proporção diferente, e o feed do grupo ficava desalinhado.
- **O título repete o corpo da mensagem.** O nome do produto já está no texto logo abaixo.

A imagem que eu queria já estava na minha mão — a do catálogo, quadrada em 100% dos casos que medi (448x448 ou 560x560). Só não tinha como mandar.

---

## 1. O patch

Dois arquivos, 35 linhas.

A ideia é usar **ponteiro** nos campos novos, para o Go distinguir três estados: chave ausente (mantém o Open Graph, comportamento original), chave presente com valor, e chave presente vazia (sobrescreve com vazio). Com `string` comum não dá para separar "não mandou" de "mandou vazio".

### `handlers.go` — struct do `SendMessage`

```diff
 		Phone         string
 		Body          string
 		LinkPreview   bool
+		Title         *string        `json:"Title,omitempty"`
+		Description   *string        `json:"Description,omitempty"`
+		PreviewImage  *string        `json:"PreviewImage,omitempty"`
 		Id            string
 		ContextInfo   waE2E.ContextInfo
```

### `handlers.go` — logo depois da busca do Open Graph

```diff
 		if t.LinkPreview {
 			url = extractFirstURL(t.Body)
 			if url != "" {
 				og = getOpenGraphData(r.Context(), url, txtid)
 			}
 		}
+		// A caller-supplied image replaces the one advertised by the page.
+		// Sites crop their og:image to the content, so every link would
+		// otherwise render at a different aspect ratio; the sender usually
+		// has a cleaner, uniform image for the same item.
+		if t.PreviewImage != nil && *t.PreviewImage != "" {
+			applyPreviewImage(r.Context(), url, *t.PreviewImage, &og)
+		}
+		// The caller may override the preview card title and description.
+		// A nil pointer keeps the Open Graph value; an empty string is an
+		// explicit choice, and renders a bare card with just the thumbnail
+		// and the domain.
+		previewTitle := og.Title
+		previewDescription := og.Description
+		if t.Title != nil {
+			previewTitle = *t.Title
+		}
+		if t.Description != nil {
+			previewDescription = *t.Description
+		}
 		msg := &waE2E.Message{
 			ExtendedTextMessage: &waE2E.ExtendedTextMessage{
 				Text:          proto.String(t.Body),
 				MatchedText:   proto.String(url),
-				Title:         proto.String(og.Title),
-				Description:   proto.String(og.Description),
+				Title:         proto.String(previewTitle),
+				Description:   proto.String(previewDescription),
 				JPEGThumbnail: og.ImageData,
 			},
 		}
```

### `helpers.go` — função nova

```go
// applyPreviewImage swaps the preview thumbnail for a caller-supplied
// image, reusing the same decode/resize/upload path as the Open Graph one.
func applyPreviewImage(ctx context.Context, pageURLStr, imageURLStr string, result *openGraphResult) {
	pageURL, err := url.Parse(pageURLStr)
	if err != nil {
		log.Warn().Err(err).Str("url", pageURLStr).Msg("Failed to parse page URL for preview image override")
		return
	}
	fetchOpenGraphImage(ctx, pageURL, imageURLStr, result)
}
```

> **Por que o helper mora no `helpers.go` e não junto do resto.**
> Dentro do `SendMessage` existe uma variável local chamada `url`, que sombreia o pacote `net/url`. Chamar `url.Parse` ali dentro não compila. No `helpers.go` não tem esse conflito — e é lá que o `fetchOpenGraphImage` já vive.

O `applyPreviewImage` não reimplementa nada: ele chama o mesmo `fetchOpenGraphImage` que o fluxo normal usa. Então o resize para 600px, a miniatura inline de 192px e o upload do thumbnail HQ seguem idênticos. Só a URL de origem muda.

---

## 2. Compilar e trocar o container

Se você subiu o wuzapi por `docker-compose` e ele funciona, é só `build` e `up -d`. Se não funcionar, dá para fazer na mão sem depender dele:

```bash
docker build -t wuzapi:local .
```

```bash
docker inspect wuzapi-server --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -v '^PATH=' | grep -v '^$' > /tmp/wuzapi.env
```

```bash
docker stop wuzapi-server && docker rename wuzapi-server wuzapi-server-rollback
```

```bash
docker run -d --name wuzapi-server --network SUA_REDE -p 127.0.0.1:8080:8080 --add-host host.docker.internal:host-gateway --restart unless-stopped --env-file /tmp/wuzapi.env wuzapi:local
```

```bash
rm -f /tmp/wuzapi.env
```

O `--env-file` a partir do `docker inspect` preserva as variáveis do container atual sem você precisar redigitar segredo nenhum. E renomear o antigo em vez de removê-lo deixa o rollback a dois comandos de distância.

Confira a rede e as portas do seu container com `docker inspect` antes — o `docker-compose.yml` do repositório pode não refletir como o container foi criado de fato.

> **A sessão do WhatsApp sobrevive.**
> Ela mora no banco (postgres, em volume separado), não no container do servidor. Recompilar e recriar o `wuzapi-server` não desloga. Ainda assim, tire um dump antes:
> ```bash
> docker exec SEU_DB pg_dump -U USUARIO BANCO > backup.sql
> ```

---

## 3. Como chamar

```json
{
  "Phone": "120363000000000000@g.us",
  "Body": "Oferta boa\n\nCompre aqui: https://exemplo.com/abc",
  "LinkPreview": true,
  "Title": " ",
  "Description": "",
  "PreviewImage": "https://cdn.exemplo.com/foto-quadrada.webp"
}
```

| Campo | Efeito |
|---|---|
| ausente | Usa o valor do Open Graph da página. É o comportamento original — nada quebra para quem já usa. |
| `"Title": " "` | Um espaço. Card sem título visível, **e com a imagem**. Ver o aviso abaixo. |
| `"Description": ""` | Some a descrição da página. |
| `"PreviewImage"` | URL da imagem que você quer no card, no lugar do `og:image`. |

### ⚠️ O erro que me custou mensagem feia no grupo

**Título vazio faz o cliente do WhatsApp não desenhar a imagem do card.**

Mandei `"Title": ""` junto com `"Description": ""` achando que ia ficar limpo, e o card saiu *sem foto nenhuma*.

O gateway não tem culpa: conferi o log e o thumbnail foi buscado, gerado e enviado normalmente, sem um único aviso. Quem decidiu não renderizar foi o aplicativo.

**Um espaço resolve.** `"Title": " "` passa na validação, não aparece na tela e a imagem volta. Isolei isso mandando a mesma oferta três vezes num grupo de teste, mudando só esse campo.

---

## 4. Duas armadilhas que valem saber antes

### O gateway responde 200 mesmo quando o Open Graph falha

O corpo da resposta traz só o `Id` da mensagem. Não existe como descobrir pela resposta que o card saiu vazio. Se você quiser um fallback — mandar como imagem quando o preview não for dar certo — precisa checar antes de enviar, do seu lado.

No meu caso o fallback busca o `og:image` da página primeiro; se não achar, manda mensagem de imagem normal. Vale notar o limite disso: confirmar que a *tag* existe não garante que o gateway vai conseguir *baixar* o arquivo a tempo.

### Não compile na mesma máquina que está enviando

O wuzapi tem timeout de 5 segundos para baixar a imagem do card (`openGraphFetchTimeout`). Rodei o `docker build` do Go num VPS de 2 núcleos com o bot enviando: o load foi a 7,5, o download da imagem estourou os 5s e a oferta saiu sem foto. O log registrou direitinho:

```
WARN Failed to fetch Open Graph image
error="Get https://cdn.exemplo.com/foto.webp: context deadline exceeded"
```

Pause o envio antes de compilar, ou compile em outra máquina.

---

## 5. Se for atualizar o wuzapi depois

Esse patch mora em arquivo, não em pacote — um `git pull` do upstream apaga ele sem deixar rastro. Se o seu clone do wuzapi não for repositório git ainda, vale fazer assim:

1. Commit do código **original**, sem tocar em nada.
2. Aplicar o patch e commitar por cima.

Aí um `git diff` entre os dois mostra exatamente as suas 35 linhas, e reaplicar depois de um upgrade vira trabalho de minutos em vez de arqueologia.

---

O suporte a `LinkPreview`, a busca de Open Graph e o upload do thumbnail HQ são do wuzapi — nada disso é meu. O patch só abre esses três campos para quem chama a API.

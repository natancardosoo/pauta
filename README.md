# Pauta

Uma entrada central para todas as tarefas que aparecem no dia: o chefe pediu um relatório, surgiu uma demanda da Retake, lembrou de algo no caminho. Anota em segundos (só o título é obrigatório), organiza por empresa e prioridade arrastando, e marca como concluída.

Feito pensando primeiro no celular, funciona também no PC.

## Como funciona

- **Captura rápida**: o campo fica sempre no rodapé, ao alcance do polegar. Digite e envie. No PC, aperte `/` ou `n` para ir direto a ele.
- **Entrada**: tudo o que ainda não tem empresa cai aqui. Toque numa tarefa para mandar para uma empresa.
- **Empresas**: cada uma vira uma aba (Trabalho, Retake...). Crie, renomeie, mude a cor e a ordem pelo botão de ajustes no topo.
- **Prioridade**: arraste pela alça (⋮⋮) para cima ou para baixo. Com teclado, foque a alça e use as setas.
- **Detalhes opcionais**: prazo (Hoje, Amanhã, Sexta, Segunda ou qualquer data), quem pediu e anotações.
- **Concluir**: toque no quadradinho. Dá para desfazer pelo aviso que aparece.
- **Backup**: exporte/importe um arquivo `.json` pelo painel de Empresas.

Os dados ficam salvos no próprio aparelho (localStorage). Sincronizar celular e PC é o próximo passo.

## Design

- **Fundo branco** com paleta índigo (`#4f46e5`), tinta quase preta (`#14161f`) e cinzas levemente azulados. Tokens em `src/index.css`.
- **Grid de 8pt**: espaçamentos e tamanhos em múltiplos de 8px (4px só em ajustes finos). Alvos de toque com 40–48px.
- **Componentes** da [beUI](https://beui.dev) (React + Tailwind + Motion), em `src/components/motion/`: lista ordenável, checkbox, input, bottom sheet, abas e avisos.

## Rodando

```bash
npm install
npm run dev      # desenvolvimento
npm run build    # produção (gera dist/)
```

Para abrir no celular durante o desenvolvimento: `npm run dev -- --host` e acesse o IP do PC na mesma rede.

## Instalar no celular

O app é um PWA. Publicado no GitHub Pages (workflow em `.github/workflows/deploy.yml`), abra o link no celular e escolha **Adicionar à tela inicial**.

## Stack

Vite · React 19 · TypeScript · Tailwind CSS 4 · Motion · beUI · vite-plugin-pwa

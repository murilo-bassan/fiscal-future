# ZeroAbi

A Reforma Tributária sem susto. O ZeroAbi mostra para PMEs e escritórios contábeis
quanto a empresa vai pagar com IBS e CBS de 2026 a 2033, que preço cobrar para manter
a margem, se vale sair do Simples puro para o regime regular de IBS/CBS e quanto caixa
o split payment vai prender.

## Rodando

```bash
npm install
cp .env.example .env       # preencha AUTH_SECRET (o comando para gerar está no arquivo)
npx prisma migrate dev
npm run dev                # http://localhost:3000
npm test                   # testes do motor tributário
```

Sem `ANTHROPIC_API_KEY`, a classificação de produtos usa busca por palavras-chave.
Sem `STRIPE_SECRET_KEY`, o checkout fica em modo demonstração (só fora de produção).

## Estrutura

| Caminho | O que é |
|---|---|
| `src/lib/tax/` | Motor de cálculo: transição 2026–2033, simulação, Simples × híbrido, split payment, categorias da LC 214 |
| `src/lib/planos.ts` | Planos, preços e limites |
| `src/app/(auth)`, `src/app/app` | Cadastro, login e área logada |
| `src/app/api/classificar` | Classificação de produtos com Claude |
| `src/app/api/checkout`, `api/stripe/webhook` | Assinaturas |

**Atualize `src/lib/tax/params.ts` quando o Senado publicar a alíquota de referência da CBS
(prazo: 15/12/2026).** O produto inteiro depende desse número.

## Premissas do modelo

- Os valores pagos a fornecedores ficam constantes; muda só a parte que volta como crédito.
- Durante a transição, ICMS, ISS e PIS/Cofins não entram na base do IBS/CBS.
- Em 2029–2032, o IBS é a fração da alíquota de referência equivalente ao ICMS/ISS que saiu.
- A partilha do DAS usa médias das faixas intermediárias da LC 123/2006.
- Regimes específicos (combustíveis, financeiro, imóveis, restaurantes etc.) ficam fora do simulador genérico.

São estimativas para planejamento, não apuração.

---

## Plano de negócio

### Por que agora
- **1º/1/2027:** a CBS entra integralmente e PIS/Cofins acabam. Toda empresa do lucro
  presumido e do lucro real precisa reprecificar.
- **Até 15/12/2026:** o Senado fixa a alíquota da CBS. Quem simular antes sai na frente.
- **Opção semestral do Simples:** milhões de optantes do Simples que vendem para outras empresas
  vão perder competitividade (o cliente PJ deixa de creditar ~9,25% de PIS/Cofins) e precisam
  decidir entre ficar só no DAS ou ir para o híbrido.
- A transição dura 7 anos, e cada ano muda a conta. É uma dor recorrente, que combina com assinatura.

### Preço

| Plano | R$/mês | Para quem | Âncora |
|---|---|---|---|
| Grátis | 0 | Isca: vê o tamanho do problema | — |
| Essencial | 97 | Dono de PME, 1 CNPJ | Uma hora de consultoria tributária |
| Profissional | 297 | Grupos, empresas com catálogo grande | Um estudo de impacto custa R$ 5–30 mil |
| Escritório | 797 | Contadores, até 60 clientes (R$ 13/cliente) | O contador revende como serviço de R$ 200–500/cliente |

O plano Escritório é o motor de crescimento. O Brasil tem cerca de 70 mil escritórios
contábeis, e cada um que assina leva dezenas de empresas e cobra delas pelo relatório
com a própria marca.

### Conta para ficar rico (cenário de 24 meses)
- 300 escritórios × R$ 797 = R$ 239 mil/mês
- 1.500 PMEs × R$ 120 (mix) = R$ 180 mil/mês
- **≈ R$ 420 mil de receita recorrente mensal, ≈ R$ 5 milhões por ano.** Margem bruta acima de 90%
  (o maior custo variável é IA, centavos por classificação).

### Aquisição
1. **Conteúdo com calculadora grátis**: "Quanto sua empresa vai pagar em 2027?" ranqueia
   no Google justamente agora. O plano Grátis é a própria calculadora.
2. **Contadores como canal**: webinar "Como vender o estudo de impacto da reforma para os
   seus clientes", trial de 14 dias no plano Escritório e parcerias com CRCs e sindicatos.
3. **Associações setoriais** (Simples que vende B2B: distribuidores, prestadores de serviço
   para empresas): relatórios setoriais gratuitos que geram leads.
4. **Gatilhos de calendário**: 15/12 (alíquota da CBS), 1º/1/2027 (virada), janelas de opção
   do Simples. Uma campanha em cada data.

### Próximas features (ordem de receita)
1. Importação do SPED/XML de NF-e para preencher o perfil e classificar o catálogo inteiro
   automaticamente (corta o atrito do formulário).
2. Validação das notas de 2026 com os campos de IBS/CBS (cClassTrib, CST), alertando erros
   antes da rejeição.
3. Tabela de preços em lote: preço novo por SKU para importar no ERP.
4. Integrações com ERPs (Omie, Bling, Conta Azul, Tiny) e uma API para softwares contábeis.
5. Alertas quando mudam alíquotas e regulamentos (retenção).

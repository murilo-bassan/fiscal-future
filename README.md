# Fiscal Future

A Reforma Tributária sem susto. O Fiscal Future mostra para PMEs e escritórios contábeis
quanto a empresa vai pagar com IBS e CBS de 2026 a 2033, que preço cobrar para manter
a margem, se vale sair do Simples puro para o regime regular de IBS/CBS e quanto caixa
o split payment vai prender. Também emite NF-e e NFS-e já com IBS/CBS (via emissor homologado)
e converte notas antigas (XML, PDF, foto, digitação ou planilha) para o layout novo (NT 2025.002).

## Rodando

```bash
npm install
cp .env.example .env       # preencha AUTH_SECRET (o comando para gerar está no arquivo)
npx prisma migrate dev
npm run dev                # http://localhost:3000
npm test                   # testes do motor tributário
```

Sem `ANTHROPIC_API_KEY`, a classificação de produtos usa busca por palavras-chave e o conversor não lê PDF nem foto (XML, digitação e planilha continuam funcionando).
Sem `STRIPE_SECRET_KEY`, o checkout fica em modo demonstração (só fora de produção).

Notas "processando" se resolvem sozinhas de dois jeitos:

- **Webhook do Focus** (`/api/focus/webhook`): defina `FOCUS_WEBHOOK_SECRET` e crie no painel do Focus
  um gatilho para essa URL com o header `Authorization` igual ao segredo. O corpo do aviso só fornece a ref;
  o status é sempre consultado de novo no Focus.
- **Rotina periódica** (`/api/cron`, a cada 10 minutos pelo `vercel.json`): defina `CRON_SECRET`.
  Consulta até 20 notas pendentes e apaga contadores de tentativas e links de senha vencidos.
  Fora da Vercel, chame `GET /api/cron` com `Authorization: Bearer $CRON_SECRET`.

## Segurança

- **Sessão** em cookie httpOnly assinado (JWT HS256). Trocar a senha ou usar "Sair de todos os
  aparelhos" incrementa `User.sessaoVersao` e derruba as outras sessões.
- **Verificação em duas etapas** (TOTP, qualquer app autenticador). O segredo é criptografado com `ENCRYPTION_KEY`,
  e o mesmo código não é aceito duas vezes.
- **Limite de tentativas** no banco (`src/lib/limite.ts`) para login, cadastro, código 2FA, recuperação de senha,
  IA e emissão. Funciona com várias instâncias do servidor.
- **Recuperação de senha** por link de uso único válido por 1 hora (só o SHA-256 vai para o banco).
- **Headers** CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy e Permissions-Policy (`next.config.ts`).
- **Isolamento:** toda consulta filtra por `userId`. Os tokens do emissor ficam criptografados (AES-256-GCM).
- **Auditoria:** login, senha, 2FA, emissão, cancelamento, dados fiscais e exclusões vão para `EventoAuditoria`,
  e o usuário vê esses eventos em Conta.
- **LGPD:** em Conta, o usuário exporta os próprios dados (JSON) e exclui a conta, o que também cancela a assinatura no Stripe.

## Antes de ir para produção (depende de pessoas)

1. **Banco:** trocar o SQLite por Postgres gerenciado (Neon, Supabase, RDS), com backup diário e restauração
   point-in-time. Em `prisma/schema.prisma`, mude `provider` para `"postgresql"` e gere uma migração inicial nova
   (as atuais são SQLite). A migração `seguranca_auditoria` usa `json_extract`, que só existe no SQLite.
2. **Hospedagem:** Vercel Pro (o conversor usa `maxDuration = 300`, e o cron de 10 em 10 minutos exige o Pro).
   Configure as variáveis do `.env.example`, com `AUTH_SECRET` e `ENCRYPTION_KEY` novas e guardadas num cofre.
3. **Domínio e e-mail:** domínio próprio, conta no Resend com o domínio verificado (SPF/DKIM) e `EMAIL_FROM`.
4. **Focus NFe:** contrato (de preferência como revenda), certificado A1 de cada empresa cadastrado no Focus,
   gatilho do webhook e testes em homologação em cada UF e município atendido.
5. **Stripe:** conta ativada, produtos e preços, webhook apontando para `/api/stripe/webhook`.
6. **Jurídico:** advogado revisa Termos e Privacidade (responsabilidade pelo conteúdo das notas, limitação de
   responsabilidade, papel de operador de dados para escritórios contábeis), indica o encarregado (DPO) e o canal LGPD.
7. **Monitoramento:** Sentry (ou similar) para erros, alerta de notas presas em "processando" e de webhooks com falha.
8. **Pentest** externo antes de abrir para clientes pagantes.
9. **Alíquota da CBS:** atualizar `src/lib/tax/params.ts` quando o Senado publicar o valor (prazo: 15/12/2026).

## Estrutura

| Caminho | O que é |
|---|---|
| `src/lib/tax/` | Motor de cálculo: transição 2026–2033, simulação, Simples × híbrido, split payment, categorias da LC 214 |
| `src/lib/planos.ts` | Planos, preços e limites |
| `src/app/(auth)`, `src/app/app` | Cadastro, login e área logada |
| `src/app/api/classificar` | Classificação de produtos com Claude |
| `src/app/api/checkout`, `api/stripe/webhook` | Assinaturas |
| `src/app/api/focus/webhook`, `api/cron` | Aviso de status do Focus NFe e rotina periódica |
| `src/lib/auth.ts`, `limite.ts`, `totp.ts`, `senha.ts`, `auditoria.ts` | Sessão, limite de tentativas, 2FA, links de senha e auditoria |
| `src/lib/painel.ts` | Agregações do dashboard de notas |
| `src/lib/nfe/` | Leitura de NF-e, cálculo de IBS/CBS por item, conversão e XML no layout novo |
| `src/lib/emissao/` | Contrato de emissão, cálculo do rascunho e provedores (simulado, Focus NFe) |

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
| Essencial | 127 | Dono de PME, 1 CNPJ, 50 notas/mês | Emissor e estudo de impacto num lugar só |
| Profissional | 347 | Grupos, empresas com catálogo grande | Um estudo de impacto custa R$ 5–30 mil |
| Escritório | 897 | Contadores, até 60 clientes (R$ 15/cliente) | O contador revende como serviço de R$ 200–500/cliente |

Cada nota emitida tem custo no emissor homologado: revise a margem quando fechar o contrato.

O plano Escritório é o motor de crescimento. O Brasil tem cerca de 70 mil escritórios
contábeis, e cada um que assina leva dezenas de empresas e cobra delas pelo relatório
com a própria marca.

### Conta para ficar rico (cenário de 24 meses)
- 300 escritórios × R$ 897 = R$ 269 mil/mês
- 1.500 PMEs × R$ 160 (mix) = R$ 240 mil/mês
- **≈ R$ 510 mil de receita recorrente mensal, ≈ R$ 6 milhões por ano.** Os custos variáveis são o
  emissor (por nota ou por CNPJ) e a IA (centavos por classificação).

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
1. Importação do SPED para preencher o perfil e classificar o catálogo inteiro automaticamente.
2. Validação em lote das notas emitidas pelo ERP (CST/cClassTrib errados), antes da rejeição.
3. Tabela de preços em lote: preço novo por SKU para importar no ERP.
4. Integrações com ERPs (Omie, Bling, Conta Azul, Tiny) e uma API para softwares contábeis.
5. Alertas quando mudam alíquotas e regulamentos (retenção).

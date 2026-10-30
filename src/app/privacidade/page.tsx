import type { Metadata } from "next";
import { Documento } from "@/components/marketing/Documento";

export const metadata: Metadata = {
  title: "Privacidade",
  description: "Como o ZeroAbi trata os seus dados, de acordo com a LGPD (Lei 13.709/2018).",
};

export default function PrivacidadePage() {
  return (
    <Documento titulo="Política de privacidade" atualizado="30 de outubro de 2026">
      <p>
        Esta política explica quais dados o ZeroAbi coleta, para que usa e quais são os seus
        direitos, de acordo com a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018).
      </p>

      <h2>Quais dados coletamos</h2>
      <ul>
        <li>Dados da conta: nome, e-mail e senha (guardada de forma criptografada).</li>
        <li>
          Dados das empresas que você simula: nome, regime, atividade, faturamento, compras,
          despesas e as demais informações pedidas no formulário.
        </li>
        <li>Descrições de produtos e serviços que você envia para classificação.</li>
        <li>Dados de pagamento, tratados pelo processador de pagamentos. Não guardamos o número do cartão.</li>
      </ul>

      <h2>Para que usamos</h2>
      <p>
        Usamos os dados da empresa só para fazer a simulação, mostrar os resultados e gerar os
        relatórios que você pedir. Os dados da conta servem para o login, a cobrança e avisos sobre
        o serviço, como a atualização das alíquotas. Não vendemos dados nem os usamos para
        publicidade.
      </p>

      <h2>Com quem compartilhamos</h2>
      <p>
        Só com os fornecedores necessários para o serviço funcionar: hospedagem e banco de dados,
        processamento de pagamentos e o provedor de inteligência artificial que classifica produtos
        e serviços (para ele vai apenas a descrição do item). Esses fornecedores só podem usar os
        dados para prestar o serviço ao ZeroAbi.
      </p>

      <h2>Por quanto tempo guardamos</h2>
      <p>
        Enquanto a sua conta estiver ativa. Se você excluir a conta, apagamos os dados das
        simulações, exceto o que a lei nos obriga a manter, como registros de cobrança.
      </p>

      <h2>Seus direitos</h2>
      <p>
        Você pode pedir a qualquer momento acesso, correção, cópia ou exclusão dos seus dados, e
        saber com quem eles foram compartilhados. Basta escrever pelo canal de suporte do app.
      </p>

      <h2>Segurança</h2>
      <p>
        Os dados trafegam com criptografia, as senhas são guardadas com hash e o acesso a cada
        empresa é restrito à conta que a cadastrou. Nenhum sistema é infalível; se houver um
        incidente que afete os seus dados, avisaremos você e a ANPD, como manda a lei.
      </p>
    </Documento>
  );
}

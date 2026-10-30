import type { Metadata } from "next";
import Link from "next/link";
import { Documento } from "@/components/marketing/Documento";
import { foco } from "@/components/marketing/Header";

export const metadata: Metadata = {
  title: "Termos de uso",
  description: "Condições de uso do Fiscal Future, ferramenta de estimativa do impacto da Reforma Tributária.",
};

export default function TermosPage() {
  return (
    <Documento titulo="Termos de uso" atualizado="30 de outubro de 2026">
      <p>
        Estes termos valem para quem usa o Fiscal Future. Ao criar uma conta, você concorda com eles.
        Escrevemos em linguagem direta para que fique claro o que o serviço faz e o que não faz.
      </p>

      <h2>O que o Fiscal Future é</h2>
      <p>
        O Fiscal Future é uma ferramenta de estimativa. A partir dos dados que você informa, ele calcula
        o impacto provável da Reforma Tributária (EC 132/2023 e LC 214/2025) sobre a sua empresa:
        carga de tributos de 2026 a 2033, preço para manter a margem, comparação entre Simples puro
        e híbrido, efeito do split payment no caixa e classificação de produtos e serviços.
      </p>

      <h2>O que o Fiscal Future não é</h2>
      <ul>
        <li>
          Não é consultoria tributária, contábil ou jurídica, e os resultados não substituem a
          análise de um profissional.
        </li>
        <li>
          Não faz apuração de tributos nem emissão de guias ou notas fiscais.
        </li>
        <li>
          Não garante que os valores reais serão iguais aos estimados. As alíquotas definitivas
          ainda dependem de resolução do Senado e de regulamentação, e o modelo simplifica regras
          que variam por produto, estado e município.
        </li>
      </ul>
      <p>
        A classificação de produtos por inteligência artificial é uma sugestão. Confira sempre o
        enquadramento (NCM/NBS) no texto da lei e com o seu contador antes de usá-lo em nota fiscal.
      </p>

      <h2>Sua responsabilidade</h2>
      <p>
        Os resultados dependem dos dados informados. Você é responsável por eles e pelas decisões
        tomadas a partir das estimativas. Não use o serviço para fins ilegais nem tente acessar
        dados de outras contas.
      </p>

      <h2>Planos e cobrança</h2>
      <p>
        Os planos pagos são cobrados por mês ou por ano, de forma antecipada, conforme a{" "}
        <Link href="/precos" className={`text-brand underline ${foco}`}>
          tabela de preços
        </Link>
        . Você pode cancelar a qualquer momento; o acesso continua até o fim do período pago. Os
        limites de cada plano (empresas e classificações por mês) estão descritos na mesma página.
      </p>

      <h2>Limitação de responsabilidade</h2>
      <p>
        Fazemos o possível para manter os cálculos corretos e os parâmetros atualizados, mas o
        serviço é oferecido como está. Não respondemos por perdas decorrentes de decisões tomadas
        apenas com base nas estimativas, na medida permitida pela lei.
      </p>

      <h2>Mudanças nestes termos</h2>
      <p>
        Podemos atualizar estes termos quando o produto ou a lei mudarem. Avisaremos por e-mail ou
        dentro do app antes de mudanças relevantes entrarem em vigor.
      </p>

      <p>
        O tratamento dos seus dados está descrito na{" "}
        <Link href="/privacidade" className={`text-brand underline ${foco}`}>
          política de privacidade
        </Link>
        .
      </p>
    </Documento>
  );
}

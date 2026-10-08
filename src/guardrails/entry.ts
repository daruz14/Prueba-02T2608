export type DerivationReason =
  | "complaint"
  | "subsidy"
  | "discount"
  | "out_of_catalog"
  | "personal_data"
  | "human_request";

export type InputAssessment = {
  readonly reasons: readonly DerivationReason[];
  readonly urgent: boolean;
  readonly requestedHuman: boolean;
  readonly needsLlmClassifier: boolean;
};

type Rule = {
  readonly reason: DerivationReason;
  readonly pattern: RegExp;
};

const RULES: readonly Rule[] = [
  {
    reason: "complaint",
    pattern:
      /(sernac|reclam\w*|demanda|querella|nadie (me llam|aparec)|esperando (desde|hace)|no responden|no me atienden|queja|mala atenci|no concretaron|no se present)/i,
  },
  { reason: "subsidy", pattern: /(ds19|subsidio|ayuda del estado)/i },
  {
    reason: "discount",
    pattern: /(descuent\w*|rebaj\w*|promoci\w*|bonificaci\w*|baj[ae]r? (el )?precio)|\d{1,2}\s?%/i,
  },
  {
    reason: "out_of_catalog",
    pattern: /\b(arriend|alquiler|amoblad|casas?|local(?:es)?(?:\s+comercial)?|quint[oa]\s*dorm|4\s*dorm|cuatro\s*dorm)/i,
  },
  {
    reason: "personal_data",
    pattern: /\d{1,2}\.\d{3}\.\d{3}-[\dkK]|\brut\b|\bcuenta bancaria\b|\btarjeta de cr|[\w.+-]+@[\w.-]+\.\w+/i,
  },
  {
    reason: "human_request",
    pattern:
      /(hablar con (alguien|una persona|un(a)? (ejecutivo|humano|persona))|persona humana|que me (llame|atienda) (alguien|una persona)|alguien real|con un humano)/i,
  },
];

export function assessInput(message: string): InputAssessment {
  const reasons = RULES.filter((rule) => rule.pattern.test(message)).map((rule) => rule.reason);
  return {
    reasons,
    urgent: reasons.includes("complaint"),
    requestedHuman: reasons.includes("human_request"),
    needsLlmClassifier: reasons.length === 0 && message.trim().length > 25,
  };
}

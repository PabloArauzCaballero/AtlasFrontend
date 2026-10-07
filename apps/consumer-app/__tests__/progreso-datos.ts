import type {
  CardTier,
  CardTierCode,
  CardView,
  Progress,
  TierCode,
} from "../src/api/endpoints/credit-line";

const TARJETAS: Array<[CardTierCode, string, TierCode, string[], string]> = [
  ["NORMAL", "Normal", "NUEVO", ["#16314F", "#0A2038"], "azul marino"],
  ["SILVER", "Silver", "EN_CONSTRUCCION", ["#E4E9EF", "#7B8794"], "plata"],
  ["GOLD", "Gold", "ESTABLECIDO", ["#F7E08A", "#9C6F14"], "oro"],
  ["PREMIUM", "Premium", "CONSOLIDADO", ["#6B3FA0", "#2A1250"], "violeta"],
  ["BLACK", "Black", "PREFERENTE", ["#2B2B2B", "#000000"], "negro mate"],
];

/** El catálogo de cinco tarjetas con `actual` como la vigente. */
export function catalogoDePrueba(actual: CardTierCode): CardTier[] {
  return TARJETAS.map(([code, label, levelCode, gradient, finish], i) => ({
    code,
    label,
    levelCode,
    displayOrder: i + 1,
    description: `Descripción ${label}`,
    benefits: [],
    theme: { gradient, ink: "#FFFFFF", accent: "#CCCCCC", finish },
    current: code === actual,
  }));
}

export function tarjetaDePrueba(
  actual: CardTierCode = "NORMAL",
  extra: Partial<CardView> = {},
): CardView {
  const catalog = catalogoDePrueba(actual);
  const vigente = catalog.find((t) => t.code === actual) as CardTier;
  return {
    ...vigente,
    source: "AUTOMATICA",
    automatic: { code: actual, label: vigente.label },
    manual: null,
    catalog,
    ...extra,
  };
}

/** Un nivel de ejemplo con el contrato COMPLETO (cuenta por parte, topes, experiencia e insignias). */
export const PROGRESO_DE_PRUEBA: Progress = {
  customerId: "42",
  hasCreditLine: false,
  score: 24,
  rawScore: 33,
  caps: [
    {
      code: "RELACION_NUEVA",
      limit: 24,
      detail:
        "Hasta cumplir 3 meses con Atlas o cerrar una compra, el máximo es 24: el nivel mide confianza ganada, no sólo datos.",
    },
  ],
  tier: { code: "NUEVO", label: "Nuevo", index: 1, of: 5, multiplier: 1 },
  nextTier: {
    code: "EN_CONSTRUCCION",
    label: "En crecimiento",
    from: 25,
    pointsMissing: 1,
    multiplier: 1.5,
  },
  ladder: [
    { code: "NUEVO", label: "Nuevo", from: 0, multiplier: 1, reached: true },
    {
      code: "EN_CONSTRUCCION",
      label: "En crecimiento",
      from: 25,
      multiplier: 1.5,
      reached: false,
    },
    {
      code: "ESTABLECIDO",
      label: "Establecido",
      from: 50,
      multiplier: 2.5,
      reached: false,
    },
    {
      code: "CONSOLIDADO",
      label: "Consolidado",
      from: 70,
      multiplier: 4,
      reached: false,
    },
    {
      code: "PREFERENTE",
      label: "Preferente",
      from: 85,
      multiplier: 6,
      reached: false,
    },
  ],
  components: [
    {
      code: "paymentHistory",
      label: "Pagos a tiempo",
      value: 50,
      weight: 0.45,
      points: 22.5,
      why: "Todavía no hay cuotas que pagar, así que partes de 50: un valor neutro, para no castigarte por no haber pedido nunca.",
    },
    {
      code: "loyalty",
      label: "Compras terminadas de pagar",
      value: 0,
      weight: 0.25,
      points: 0,
      why: "Todavía no cerraste ninguna compra: cada una terminada de pagar suma 20 (hasta 60) y cada una activa, 10 (hasta 20).",
    },
    {
      code: "tenure",
      label: "Antigüedad",
      value: 8,
      weight: 0.2,
      points: 1.6,
      why: "Llevas 1 mes(es) con Atlas; esta parte llega a 100 a los 12 meses.",
    },
    {
      code: "verification",
      label: "Identidad verificada",
      value: 100,
      weight: 0.1,
      points: 10,
      why: "Tu identidad, domicilio y contacto están verificados.",
    },
  ],
  missions: [
    {
      code: "verificar_identidad",
      label: "Verifica tu identidad",
      detail: "Cédula confirmada.",
      done: true,
      points: "hasta +10",
    },
    {
      code: "terminar_una_compra",
      label: "Termina de pagar una compra",
      detail: "Cada compra cerrada suma.",
      done: false,
      points: "hasta +15",
    },
  ],
  signals: {
    tenureMonths: 1,
    loansSettled: 0,
    loansActive: 0,
    onTimeRatio: null,
    kycComplete: true,
  },
  card: tarjetaDePrueba("NORMAL"),
  experience: {
    xp: 350,
    onTimeInstallments: 3,
    currentStreak: 3,
    bestStreak: 3,
    badges: [
      {
        code: "primera_compra",
        label: "Primera compra",
        detail: "Hiciste tu primera compra con Atlas.",
        icon: "comercio",
        earned: true,
        current: 1,
        target: 1,
      },
      {
        code: "racha_3",
        label: "Racha de 3",
        detail: "Tres cuotas seguidas a tiempo.",
        icon: "tendencia",
        earned: true,
        current: 3,
        target: 3,
      },
      {
        code: "racha_6",
        label: "Racha de 6",
        detail: "Seis cuotas seguidas a tiempo.",
        icon: "tendencia",
        earned: false,
        current: 3,
        target: 6,
      },
      {
        code: "mil_bs",
        label: "1.000 Bs a tiempo",
        detail: "Pagaste 1.000 Bs sin atrasos.",
        icon: "billetera",
        earned: false,
        current: 350,
        target: 1000,
      },
    ],
  },
  history: [],
};

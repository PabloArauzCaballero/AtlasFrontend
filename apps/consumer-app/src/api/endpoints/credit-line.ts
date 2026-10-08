/**
 * La linea de credito del cliente y el extracto que la recalcula.
 *
 * ## Por que esto sustituye a una constante
 *
 * El «Limite aprobado» de la pantalla de inicio era `DEFAULT_LIMIT = minor(500_000)`: Bs 5.000
 * escritos en el codigo de la app, el mismo numero para todos los clientes. No lo habia decidido
 * nadie. Ahora sale del motor de decision, calculado con el expediente real de cada persona.
 *
 * ## Que trae ademas del numero
 *
 * El porque. El ingreso disponible con el que se calculo, la cuota maxima que sostiene, el puntaje
 * con su tramo, los motivos de la politica y —lo mas importante— de donde salio cada variable:
 * `expediente`, `derivado` o `ausente`. «No tienes buro» y «tu buro es malo» no son lo mismo, y la
 * segunda no es culpa del cliente.
 */
import { request } from "../client";

export type ScoringBand = { code: string; label: string; tone: string };

export type CreditLine = {
  customerId: string;
  currencyCode: string;

  approvedLimit: number;
  used: number;
  available: number;

  maxAffordableInstallment: number | null;
  /** El ingreso con el que se calculo todo. Es la cifra que el cliente reconoce como suya. */
  disposableIncome: number | null;

  scoring: number | null;
  scoringBand: ScoringBand;
  scoringScale: {
    min: number;
    max: number;
    bands: { from: number; code: string; label: string; tone: string }[];
  };

  riskBand: string | null;
  pricingTier: string | null;
  annualPercentageRate: number | null;
  affordabilityScore: number | null;
  affordabilityDecision: string | null;
  probabilityOfDefault: number | null;

  decision: {
    outcome: string;
    executionId: string | null;
    artifactCode: string | null;
    artifactVersionId: string | null;
    trigger: string;
    calculatedAt: string;
  };

  reasons: {
    code: string;
    message: string;
    category: string | null;
    adverseAction: boolean;
  }[];
  /** Que variable era dato real, cual derivada y cual ausente al decidir. */
  inputs: Record<string, "expediente" | "derivado" | "ausente">;
  nextSteps: { code: string; label: string; detail: string }[];

  /**
   * Lo que el modelo de capacidad PROPUSO, junto al limite que la politica aprobo.
   *
   * Las dos cifras llegan al telefono porque su diferencia es informacion del cliente: cuando el
   * limite aprobado es menor que la capacidad medida, lo que falta no es dinero sino relacion — y
   * eso se construye pagando a tiempo. Con solo el numero aprobado, «¿por que no mas?» no tiene
   * respuesta.
   */
  capacity: {
    recommendedLimit: number | null;
    relationshipScore: number | null;
    relationshipTier: string | null;
    bindingConstraint: string | null;
    evidence: string | null;
    explanation: string | null;
  };
};

export const getCreditLine = (customerId: string) =>
  request<CreditLine>(`/customers/${customerId}/credit-line`);

export type CreditLineHistory = {
  items: {
    approvedLimit: number;
    scoring: number | null;
    scoringBand: ScoringBand;
    trigger: string;
    outcome: string;
    validFrom: string;
    validUntil: string | null;
  }[];
};

export const getCreditLineHistory = (customerId: string) =>
  request<CreditLineHistory>(`/customers/${customerId}/credit-line/history`);

/**
 * Que se le dice a alguien cuando su extracto no sirve.
 *
 * Una categoria por ACCION distinta, y por eso son seis y no una. Antes habia un solo motivo y la
 * app decia la misma frase tanto si el documento era una factura de la luz, como si era un PDF
 * editado, como si cubria un mes en vez de tres. Ninguna de las tres personas podia saber que
 * hacer, asi que las tres volvian a subir el mismo archivo hasta rendirse.
 */
export type RejectionCategory =
  | "NO_ES_EXTRACTO"
  | "EMISOR_NO_RECONOCIDO"
  | "DOCUMENTO_MANIPULADO"
  | "PERIODO_INSUFICIENTE"
  | "EXTRACTO_VENCIDO"
  | "ARCHIVO_ILEGIBLE"
  | "LECTURA_INSUFICIENTE";

/** Lo que el extracto demostro. Ningun movimiento individual viaja: solo las cifras del calculo. */
export type StatementCapacity = {
  monthsAnalyzed: number | null;
  monthlyIncome: number | null;
  committedExpenses: number | null;
  monthlyObligations: number | null;
  maxAffordableInstallment: number | null;
  score: number | null;
  band: string | null;
  reasons: { code: string; message: string; severity: string }[];
};

/** El extracto bancario en revision. `promisedBy` es el compromiso, no una estimacion. */
export type BankStatementReview = {
  reviewId: string;
  status: "received" | "processing" | "applied" | "rejected";
  statusLabel: string;
  statusDetail: string;
  submittedAt: string;
  promisedBy: string;
  appliedCreditLineId: string | null;
  rejectionReason: string | null;
  /** Codigo estable de la categoria del rechazo. El texto se puede reescribir; esto no. */
  rejectionCategory: RejectionCategory | null;
  /** El banco que emitio el extracto, cuando el motor lo reconocio. */
  institutionName: string | null;
  period: { from: string | null; to: string | null } | null;
  /** Solo cuando se pudo evaluar: tres meses completos y legibles. */
  capacity: StatementCapacity | null;
};

export const getLatestBankStatement = (customerId: string) =>
  request<BankStatementReview | null>(
    `/customers/${customerId}/bank-statements/latest`,
  );

/** Un extracto del historial: la misma revisión, más lo que hace falta para descargar su archivo. */
export type BankStatementArchiveItem = BankStatementReview & {
  /** `available` es falso cuando el archivo ya no está en el almacén: se enseña, pero sin botón. */
  file: { available: boolean; fileName: string };
};

/** Todos los extractos que subió la persona, del más reciente al más antiguo. */
export const listBankStatements = (customerId: string) =>
  request<{ items: BankStatementArchiveItem[] }>(
    `/customers/${customerId}/bank-statements`,
  );

export const submitBankStatement = (customerId: string, storageKey: string) =>
  request<BankStatementReview>(`/customers/${customerId}/bank-statements`, {
    method: "POST",
    body: { storageKey },
  });

/** El permiso de subida firmado. El archivo viaja directo al almacen cifrado, no por la API. */
export type UploadPermit = {
  storageKey: string;
  uploadUrl: string;
  method: string;
  requiredHeaders: Record<string, string>;
  expiresAt: string;
};

export const createBankStatementUploadUrl = (
  customerId: string,
  sizeBytes: number,
) =>
  request<UploadPermit>(
    `/customer-onboarding/${customerId}/documents/upload-url`,
    {
      method: "POST",
      body: {
        documentType: "bank_statement",
        contentType: "application/pdf",
        sizeBytes,
      },
    },
  );

/* ------------------------------------------------------------------ nivel Atlas */

export type TierCode = 'NUEVO' | 'EN_CONSTRUCCION' | 'ESTABLECIDO' | 'CONSOLIDADO' | 'PREFERENTE';

/** Qué tan difícil es una insignia. Un backend anterior al 2026-10-07 no lo manda: la app la deduce del código. */
export type BadgeRank = 'bronce' | 'plata' | 'oro' | 'platino' | 'diamante';
export type BadgeCategory = 'compras' | 'pagos' | 'rachas' | 'dinero' | 'estilo' | 'cuenta' | 'coleccion';

export type Badge = {
  code: string;
  label: string;
  detail: string;
  icon: string;
  rank?: BadgeRank;
  category?: BadgeCategory;
  /** Secreta: hasta ganarla se enseña sólo `hint`. */
  secret?: boolean;
  hint?: string | null;
  earned: boolean;
  current: number;
  target: number;
  /**
   * Cuándo se ganó. Opcional A PROPÓSITO: el backend de hoy calcula las insignias al vuelo y no guarda la fecha. Cuando
   * la mande, la carta la enseña; mientras no, no inventa ninguna. Las insignias NO dan puntos: los puntos son sólo por
   * boliviano pagado a tiempo (Pablo, 2026-10-07).
   */
  earnedAt?: string | null;
};

/** De dónde salen los puntos (AtlasBackend `experience.xpBreakdown`, 2026-10-08). */
export type XpBreakdown = {
  purchases: { count: number; points: number };
  onTimeInstallments: { count: number; points: number };
  earlyInstallments: { count: number; points: number };
  settledPurchases: { count: number; points: number };
};

/**
 * Puntos de experiencia (Pablo, 2026-10-08, al estilo Farmaclub pero premiando cumplir): 1 por cada Bs 10 comprados con
 * tope de 100 por compra, 50 por cuota pagada a tiempo, 25 más si fue con 3 días de adelanto y 200 por compra terminada.
 */
export type Experience = {
  xp: number;
  /** Opcional: un backend anterior al 2026-10-08 no lo manda. */
  xpBreakdown?: XpBreakdown;
  onTimeInstallments: number;
  currentStreak: number;
  bestStreak: number;
  badges: Badge[];
};

export type CardTierCode = 'NORMAL' | 'SILVER' | 'GOLD' | 'PREMIUM' | 'BLACK';

/** Cómo se pinta una tarjeta. Viene del catálogo editable del backend: la app no tiene los colores escritos. */
/**
 * `glow`: el fulgor de la tarjeta, de 0 a 1, de menos a más con la categoría (Normal → Black). Lo decide el backend;
 * ausente con uno anterior al 2026-10-07, y entonces la tarjeta se pinta como siempre, sin fulgor añadido.
 */
export type CardTheme = { gradient: string[]; ink: string; accent: string; finish: string; glow?: number };

export type CardTier = {
  code: CardTierCode;
  label: string;
  /** El nivel Atlas con el que se desbloquea sola. */
  levelCode: TierCode;
  displayOrder: number;
  description: string;
  benefits: { text: string; icon?: string }[];
  theme: CardTheme;
  current: boolean;
};

/**
 * La tarjeta del cliente (Normal, Silver, Gold, Premium, Black): presentación y estatus, NO cambia su límite de crédito.
 * `AUTOMATICA` la ganó por su nivel; `MANUAL` se la puso el personal. Nunca trae el motivo del ajuste.
 */
export type CardView = CardTier & {
  source: 'AUTOMATICA' | 'MANUAL';
  automatic: { code: CardTierCode; label: string };
  manual: { since: string; expiresAt: string | null } | null;
  catalog: CardTier[];
};

export type ProgressMission = { code: string; label: string; detail: string; done: boolean; points: string };

/**
 * El nivel del cliente. Espeja `GET /customers/:id/progress`.
 *
 * Sale de la base de datos del backend —antigüedad, pagos, compras cerradas, identidad—, NO del motor, así que
 * existe aunque `hasCreditLine` sea falso: quien todavía no tiene línea ve igual dónde está y qué le falta.
 */
export type Progress = {
  customerId: string;
  hasCreditLine: boolean;
  /** Puntuación de relación 0-100, la base de la Calificación (`rating`). No es el score 0-1000 del motor. */
  score: number;
  /** Escalón de la RELACIÓN (sobre la calificación): lo usa la capacidad de pago. El que se enseña es `level`. */
  /**
   * `creditCeiling`: hasta cuánto crédito (en la moneda de la línea) admite ese escalón. Es un TOPE por confianza, no el
   * límite: el límite real es además lo que la persona puede pagar y lo decide el motor. Ausente con un backend anterior
   * al 2026-10-07: la app enseña entonces cuántas veces crece (`multiplier`), nunca un importe inventado.
   */
  tier: { code: TierCode; label: string; index: number; of: number; multiplier: number; creditCeiling?: number };
  nextTier: { code: TierCode; label: string; from: number; pointsMissing: number; multiplier: number; creditCeiling?: number } | null;
  ladder: { code: TierCode; label: string; from: number; multiplier: number; reached: boolean; creditCeiling?: number }[];
  /**
   * La cuenta de ESTA persona: valor 0-100 de cada parte, su peso, los puntos que aporta (valor × peso) y la razón en
   * una frase. Los `points` suman `rawScore`; si un tope recortó el resultado, `score` es menor y `caps` dice cuál.
   */
  components: { code: string; label: string; value: number; weight: number; points: number; why: string }[];
  rawScore: number;
  caps: { code: string; limit: number; detail: string }[];
  experience: Experience;
  /**
   * **Calificación** de 1 a 100: qué tan buen pagador es la persona. Ausente con un backend anterior al 2026-10-06:
   * las pantallas caen a `score` acotado, nunca a 0.
   */
  rating?: { value: number; scale: { min: number; max: number } };
  /** **Puntaje**: los puntos ganados PAGANDO a tiempo (1 por boliviano). Los mismos que `experience.xp`. */
  points?: { value: number; currentStreak: number; bestStreak: number };
  /**
   * El **Nivel Atlas**, medido en PUNTOS (los que se ganan pagando a tiempo), no en la calificación. La tarjeta
   * Normal…Black sigue a este nivel. Ausente con un backend anterior al 2026-10-06: `nivelPorPuntos` lo calcula
   * con los mismos escalones a partir de `experience.xp`.
   */
  level?: { id?: string; code: TierCode; label: string; index: number; of: number; points: number };
  nextLevel?: { id?: string; code: TierCode; label: string; from: number; pointsMissing: number } | null;
  levelLadder?: { id?: string; code: TierCode; label: string; from: number; reached: boolean }[];
  /** Ausente si el backend todavía no trae las tarjetas: las pantallas lo toleran y no la pintan. */
  card?: CardView;
  missions: ProgressMission[];
  signals: { tenureMonths: number; loansSettled: number; loansActive: number; onTimeRatio: number | null; kycComplete: boolean };
  history: {
    validFrom: string;
    trigger: string;
    scoring: number | null;
    approvedLimit: number;
    relationshipScore: number | null;
    relationshipTier: TierCode | null;
  }[];
};

export const getProgress = (customerId: string) => request<Progress>(`/customers/${customerId}/progress`);

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
import { request } from '../client';

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
  scoringScale: { min: number; max: number; bands: Array<{ from: number; code: string; label: string; tone: string }> };

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

  reasons: Array<{ code: string; message: string; category: string | null; adverseAction: boolean }>;
  /** Que variable era dato real, cual derivada y cual ausente al decidir. */
  inputs: Record<string, 'expediente' | 'derivado' | 'ausente'>;
  nextSteps: Array<{ code: string; label: string; detail: string }>;
};

export const getCreditLine = (customerId: string) => request<CreditLine>(`/customers/${customerId}/credit-line`);

export type CreditLineHistory = {
  items: Array<{
    approvedLimit: number;
    scoring: number | null;
    scoringBand: ScoringBand;
    trigger: string;
    outcome: string;
    validFrom: string;
    validUntil: string | null;
  }>;
};

export const getCreditLineHistory = (customerId: string) =>
  request<CreditLineHistory>(`/customers/${customerId}/credit-line/history`);

/** El extracto bancario en revision. `promisedBy` es el compromiso, no una estimacion. */
export type BankStatementReview = {
  reviewId: string;
  status: 'received' | 'processing' | 'applied' | 'rejected';
  statusLabel: string;
  statusDetail: string;
  submittedAt: string;
  promisedBy: string;
  appliedCreditLineId: string | null;
  rejectionReason: string | null;
};

export const getLatestBankStatement = (customerId: string) =>
  request<BankStatementReview | null>(`/customers/${customerId}/bank-statements/latest`);

export const submitBankStatement = (customerId: string, storageKey: string) =>
  request<BankStatementReview>(`/customers/${customerId}/bank-statements`, { method: 'POST', body: { storageKey } });

/** El permiso de subida firmado. El archivo viaja directo al almacen cifrado, no por la API. */
export type UploadPermit = {
  storageKey: string;
  uploadUrl: string;
  method: string;
  requiredHeaders: Record<string, string>;
  expiresAt: string;
};

export const createBankStatementUploadUrl = (customerId: string, sizeBytes: number) =>
  request<UploadPermit>(`/customer-onboarding/${customerId}/documents/upload-url`, {
    method: 'POST',
    body: { documentType: 'bank_statement', contentType: 'application/pdf', sizeBytes },
  });

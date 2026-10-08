/**
 * La parte de CRÉDITO de la API simulada: la línea, los puntos y la calificación, y los extractos bancarios.
 *
 * Habla el mismo contrato que AtlasBackend (`credit-line`, `progress`, `bank-statements`) con datos fijos, para que
 * `portada-y-extractos.mjs` pueda medir en un navegador real lo que las pruebas de jest sólo ven como árbol: en qué
 * orden queda la portada y que el PDF de un extracto de verdad se descarga.
 *
 * Va aparte de `api-simulada.mjs` porque aquélla implementa REGLAS (las del cambio de PIN) y esto son datos.
 */
import { Buffer } from 'node:buffer';

/** Un PDF mínimo pero válido: lo que importa es que lleguen estos bytes, no su contenido. */
export const PDF_DE_PRUEBA = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
);

export const LINEA = {
  customerId: '53',
  currencyCode: 'BOB',
  approvedLimit: 1250,
  used: 250,
  available: 1000,
  maxAffordableInstallment: 450,
  disposableIncome: 1800,
  scoring: 640,
  scoringBand: { code: 'BUENO', label: 'Bueno', tone: 'success' },
  scoringScale: { min: 0, max: 1000, bands: [{ from: 0, code: 'BAJO', label: 'Bajo', tone: 'danger' }, { from: 600, code: 'BUENO', label: 'Bueno', tone: 'success' }] },
  riskBand: 'B',
  pricingTier: 'B',
  annualPercentageRate: 24,
  affordabilityScore: null,
  affordabilityDecision: null,
  probabilityOfDefault: 0.09,
  decision: { outcome: 'APPROVE', executionId: '101', artifactCode: 'ATLAS_BNPL_UNDERWRITING', artifactVersionId: '5', trigger: 'onboarding', calculatedAt: '2026-10-05T12:00:00Z' },
  reasons: [{ code: 'APROBADO_UNDERWRITING_V2', message: 'Tu solicitud fue aprobada.', category: 'CREDIT_UNDERWRITING', adverseAction: false }],
  inputs: { monthlyIncome: 'expediente', dependents: 'expediente' },
  nextSteps: [],
  capacity: { recommendedLimit: 1500, relationshipScore: 24, relationshipTier: 'NUEVO', bindingConstraint: 'RELACION', evidence: 'DECLARADO', explanation: null },
};

export const PROGRESO = {
  customerId: '53',
  hasCreditLine: true,
  score: 24,
  rawScore: 34,
  caps: [{ code: 'RELACION_NUEVA', limit: 24, detail: 'Hasta cumplir 3 meses con Atlas o cerrar una compra, el máximo es 24.' }],
  tier: { code: 'NUEVO', label: 'Nuevo', index: 1, of: 5, multiplier: 1, creditCeiling: 1500 },
  nextTier: { code: 'EN_CONSTRUCCION', label: 'En construcción', from: 25, pointsMissing: 1, multiplier: 1.5, creditCeiling: 2250 },
  ladder: [
    { code: 'NUEVO', label: 'Nuevo', from: 0, multiplier: 1, creditCeiling: 1500, reached: true },
    { code: 'EN_CONSTRUCCION', label: 'En construcción', from: 25, multiplier: 1.5, creditCeiling: 2250, reached: false },
    { code: 'ESTABLECIDO', label: 'Establecido', from: 50, multiplier: 2.5, creditCeiling: 3750, reached: false },
    { code: 'CONSOLIDADO', label: 'Consolidado', from: 70, multiplier: 4, creditCeiling: 6000, reached: false },
    { code: 'PREFERENTE', label: 'Preferente', from: 85, multiplier: 6, creditCeiling: 9000, reached: false },
  ],
  components: [
    { code: 'paymentHistory', label: 'Pagos a tiempo', value: 50, weight: 0.45, points: 22.5, why: 'Pagaste a tiempo 2 de tus 2 cuotas.' },
    { code: 'loyalty', label: 'Compras terminadas de pagar', value: 0, weight: 0.25, points: 0, why: 'Todavía no cerraste ninguna compra.' },
    { code: 'tenure', label: 'Antigüedad', value: 8, weight: 0.2, points: 1.6, why: 'Llevas 1 mes(es) con Atlas.' },
    { code: 'verification', label: 'Identidad verificada', value: 100, weight: 0.1, points: 10, why: 'Tu identidad, domicilio y contacto están verificados.' },
  ],
  experience: { xp: 350, onTimeInstallments: 2, currentStreak: 2, bestStreak: 2, badges: [] },
  missions: [],
  // La tarjeta Gold, con el tema del catálogo real: así «Perfil» y «Tu nivel» pintan la tarjeta y se pueden capturar.
  card: {
    code: 'GOLD',
    label: 'Gold',
    levelCode: 'ESTABLECIDO',
    displayOrder: 3,
    description: 'La tarjeta de quien ya demostró que paga a tiempo.',
    benefits: [],
    theme: { gradient: ['#F7E08A', '#C9A24A', '#9C6F14'], ink: '#2A1D05', accent: '#FFF1B8', finish: 'oro', glow: 0.6 },
    current: true,
    source: 'AUTOMATICA',
    automatic: { code: 'GOLD', label: 'Gold' },
    manual: null,
    catalog: [],
  },
  signals: { tenureMonths: 1, loansSettled: 0, loansActive: 1, onTimeRatio: 1, kycComplete: true },
  history: [],
};

const extracto = (reviewId, extra) => ({
  reviewId,
  status: 'applied',
  statusLabel: 'Aplicado a tu línea',
  statusDetail: 'Tu línea se recalculó con este extracto.',
  submittedAt: '2026-09-14T15:30:00.000Z',
  promisedBy: '2026-09-15T15:30:00.000Z',
  appliedCreditLineId: '3',
  rejectionReason: null,
  rejectionCategory: null,
  institutionName: 'Banco Unión',
  period: { from: '2026-06-01', to: '2026-08-31' },
  capacity: null,
  file: { available: true, fileName: 'extracto-2026-09-14.pdf' },
  ...extra,
});

export const EXTRACTOS = [
  extracto('7', {}),
  extracto('5', {
    status: 'rejected',
    statusLabel: 'No pudimos usarlo',
    submittedAt: '2026-08-02T10:00:00.000Z',
    institutionName: null,
    period: null,
    file: { available: false, fileName: 'extracto-2026-08-02.pdf' },
  }),
];

/**
 * Atiende una ruta de crédito. Devuelve `true` si era suya (y ya respondió).
 *
 * `vencido` (Bs) pinta la portada con mora, para comprobar que ni así el aviso rojo pasa por encima de la línea.
 */
export function atenderCredito({ ruta, res, ok, fallo, vencido = 0 }) {
  if (ruta === '/customers/53/credit-line') return (ok(res, LINEA), true);
  if (ruta === '/customers/53/progress') return (ok(res, PROGRESO), true);
  if (ruta === '/customers/53/loans') return (ok(res, { items: [] }), true);
  if (ruta === '/customers/53/payment-calendar') return (ok(res, { entries: [] }), true);
  if (ruta === '/customers/53/spending-by-category')
    return (ok(res, { currencyCode: 'BOB', categories: [], totals: { financed: 250, outstanding: 250, overdue: vencido, loanCount: 1 } }), true);
  if (ruta === '/customers/53/bank-statements') return (ok(res, { items: EXTRACTOS }), true);
  if (ruta === '/customers/53/bank-statements/latest') return (ok(res, EXTRACTOS[0]), true);

  const archivo = /^\/customers\/53\/bank-statements\/(\d+)\/file$/.exec(ruta);
  if (archivo) {
    const pedido = EXTRACTOS.find((item) => item.reviewId === archivo[1]);
    if (!pedido) return (fallo(res, 404, 'BANK_STATEMENT_NOT_FOUND', 'No existe.'), true);
    if (!pedido.file.available) return (fallo(res, 404, 'BANK_STATEMENT_FILE_NOT_AVAILABLE', 'Ya no está en el almacén.'), true);
    res.writeHead(200, {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="${pedido.file.fileName}"`,
      'content-length': String(PDF_DE_PRUEBA.length),
      'cache-control': 'private, no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
    });
    res.end(PDF_DE_PRUEBA);
    return true;
  }
  return false;
}

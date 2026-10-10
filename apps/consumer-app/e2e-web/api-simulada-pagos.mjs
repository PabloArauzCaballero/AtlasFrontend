/**
 * La parte de PAGOS de la API simulada: un crédito con una cuota pendiente, el QR del comercio, el comprobante y el
 * aviso de pago, con la confirmación DIFERIDA del servidor.
 *
 * Es lo que hace falta para reproducir en un navegador real «al hacer un pago tenés que cerrar la app para que
 * recarguen las compras y los puntos» (Pablo, 2026-10-09): el aviso se acepta en el acto, pero la cuota, la línea
 * disponible y los puntos cambian `retrasoMs` DESPUÉS —el comercio confirma y el desembolso termina más tarde—, que es
 * justo lo que la app perdía. Ver `sesion-y-refresco.mjs`.
 *
 * Sólo se activa con `crearApiSimulada({ pagos: true })`: las demás pruebas siguen viendo sus datos fijos.
 */
import { LINEA, PROGRESO } from './api-simulada-credito.mjs';

/** Un PNG de 1×1: lo que importa es que lleguen bytes de imagen, no su contenido. */
const PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

export function crearMundoDePagos({ retrasoMs = 2_000 } = {}) {
  const estado = { avisado: false, confirmado: false, avisos: 0, subidas: 0 };
  const comercio = { partnerProfileId: '77', displayName: 'Farmacia Andina', businessCategory: 'salud' };

  const cuota = () => ({
    installmentId: '9',
    installmentNumber: 1,
    dueDate: '2026-10-20',
    principalAmount: '230.00',
    interestAmount: '20.00',
    lateFeeAmount: '0.00',
    paidPrincipal: estado.confirmado ? '230.00' : '0.00',
    paidInterest: estado.confirmado ? '20.00' : '0.00',
    paidLateFee: '0.00',
    status: estado.confirmado ? 'paid' : 'pending',
    daysPastDue: 0,
  });
  const credito = () => ({
    loanId: '5',
    loanCode: 'L-5',
    currencyCode: 'BOB',
    principalAmount: '250.00',
    annualInterestRate: '24',
    termMonths: 1,
    status: estado.confirmado ? 'paid_off' : 'active',
    disbursedAt: '2026-09-20T12:00:00Z',
    firstDueDate: '2026-10-20',
    maturityDate: '2026-10-20',
    paidPrincipal: estado.confirmado ? '230.00' : '0.00',
    paidInterest: estado.confirmado ? '20.00' : '0.00',
    outstandingPrincipal: estado.confirmado ? '0.00' : '230.00',
    daysPastDue: 0,
    delinquencyBucket: 'current',
    merchant: comercio,
    decision: { executionId: null, artifactVersionId: null },
  });

  function atender({ req, ruta, res, ok }) {
    const metodo = req.method;
    if (ruta === '/customers/53/credit-line')
      return (ok(res, { ...LINEA, used: estado.confirmado ? 40 : 250, available: estado.confirmado ? 1210 : 1000 }), true);
    if (ruta === '/customers/53/progress') {
      const xp = PROGRESO.experience.xp + (estado.confirmado ? 120 : 0);
      return (ok(res, { ...PROGRESO, experience: { ...PROGRESO.experience, xp, onTimeInstallments: estado.confirmado ? 3 : 2 } }), true);
    }
    if (ruta === '/customers/53/loans') return (ok(res, { items: [credito()] }), true);
    if (ruta === '/loans/5') return (ok(res, { ...credito(), schedule: [cuota()], payments: [] }), true);
    if (ruta === '/customers/53/payment-calendar') {
      const entrada = {
        loanId: '5',
        loanCode: 'L-5',
        installmentNumber: 1,
        dueDate: '2026-10-20',
        state: estado.confirmado ? 'paid' : 'upcoming',
        daysPastDue: 0,
        totalAmount: 250,
        paidAmount: estado.confirmado ? 250 : 0,
        pendingAmount: estado.confirmado ? 0 : 250,
        principalAmount: 230,
        interestAmount: 20,
        lateFeeAmount: 0,
        currencyCode: 'BOB',
        merchant: comercio,
      };
      return (
        ok(res, {
          customerId: '53',
          currencyCode: 'BOB',
          generatedAt: new Date().toISOString(),
          today: '2026-10-09',
          nextDueDate: estado.confirmado ? null : '2026-10-20',
          totals: {
            overdue: 0,
            upcoming: estado.confirmado ? 0 : 250,
            paid: estado.confirmado ? 250 : 0,
            overdueCount: 0,
            upcomingCount: estado.confirmado ? 0 : 1,
            paidCount: estado.confirmado ? 1 : 0,
          },
          entries: [entrada],
        }),
        true
      );
    }
    if (ruta === '/customers/53/spending-by-category')
      return (ok(res, { currencyCode: 'BOB', categories: [], totals: { financed: 250, outstanding: estado.confirmado ? 0 : 250, overdue: 0, loanCount: 1 } }), true);

    if (ruta === '/mobile/customers/53/payment-claims/instructions/9')
      return (
        ok(res, {
          installmentId: '9',
          loanId: '5',
          loanCode: 'L-5',
          installmentNumber: 1,
          dueDate: '2026-10-20',
          currencyCode: 'BOB',
          amountDue: '250.00',
          amountOutstanding: estado.confirmado ? '0.00' : '250.00',
          status: estado.confirmado ? 'paid' : 'pending',
          merchant: { partnerProfileId: '77', displayName: comercio.displayName },
          paymentQr: { qrId: '1', bankInstitutionCode: 'BUN', accountNumberMasked: '****4321', fingerprint: 'abc', status: 'approved', contentType: 'image/png', imageDataUrl: PNG_1X1 },
          paymentQrUnavailableReason: null,
          openClaim: estado.avisado && !estado.confirmado ? { claimId: '1', claimCode: 'CLM-1', status: 'pending_verification', submittedAt: new Date().toISOString(), rejectionReason: null } : null,
        }),
        true
      );
    if (ruta === '/mobile/customers/53/payment-claims/proof-tickets' && metodo === 'POST')
      return (
        ok(res, {
          uploadUrl: `http://${req.headers.host}/__almacen/comprobante-1`,
          storageKey: 'comprobantes/comprobante-1',
          method: 'PUT',
          requiredHeaders: { 'content-type': 'image/png' },
          expiresAt: new Date(Date.now() + 600_000).toISOString(),
        }),
        true
      );
    if (ruta === '/__almacen/comprobante-1' && metodo === 'PUT') {
      estado.subidas += 1;
      return (ok(res, {}), true);
    }
    if (ruta === '/mobile/customers/53/payment-claims' && metodo === 'POST') {
      estado.avisado = true;
      estado.avisos += 1;
      // El servidor acepta el aviso YA; la cuota, la línea y los puntos cambian después (comercio + desembolso).
      setTimeout(() => {
        estado.confirmado = true;
      }, retrasoMs);
      return (ok(res, { claimId: '1', claimCode: 'CLM-1', status: 'pending_verification', installmentId: '9', submittedAt: new Date().toISOString() }), true);
    }
    return false;
  }

  return { estado, atender };
}

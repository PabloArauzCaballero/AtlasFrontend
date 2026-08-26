/**
 * Estado del dominio de compra en el dispositivo.
 *
 * Es el ADAPTADOR de datos para las pantallas de compra y pagos. Hoy resuelve contra el motor local
 * (`engine.ts`); cuando AtlasBackend exponga el dominio V3, se reemplaza la implementacion de estas
 * mismas funciones por llamadas HTTP y las pantallas no cambian.
 *
 * Persiste en AsyncStorage —no en SecureStore— porque aqui no hay secretos: son ordenes, cuotas e
 * instrucciones. Los tokens de sesion viven en almacenamiento seguro, en otro modulo.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { type Minor, minor } from '../domain/money';
import { POS_QRS, findPosQrByToken, type PosQr } from './fixtures';
import {
  type CommitRejection,
  type ScanRejection,
  availableCredit,
  commitPurchase,
  DECISION_TTL_MS,
  createOrder,
  emptyState,
  evaluateOrder,
  isExpired,
  issueInstruction,
  nextDueItem,
  openResolvedScanSession,
  openScanSession,
  outstandingAmount,
} from './engine';
import type { PaymentInstruction, PaymentSchedule, PurchaseOrder, SandboxState, ScanSession, ScheduleItem } from './types';
import type { CreditDecision } from './types';
import { isBackendDecision } from '../api/config';
import { useSession } from '../session/session';
import { requestLiveDecision } from '../features/credit-evaluation';
import { listCreditApplications } from '../api/endpoints/credit';

/**
 * De donde salio la decision que se esta mostrando.
 *
 * Se expone a proposito: una pantalla que dice «aprobado» sin decir quien aprobo no es auditable, y
 * la diferencia entre el motor local y el motor real es justo lo que hay que poder ver.
 */
export type DecisionOrigin =
  | { source: 'sandbox' }
  | { source: 'backend'; applicationCode: string; executionId: string | null; decisionMode: string | null }
  | { source: 'backend-unavailable'; code: string; message: string };

const STORAGE_KEY = 'atlas.sandbox.purchase.v1';
/** Limite de la linea con la que arranca el entorno de demostracion. Bs 5.000,00. */
const DEFAULT_LIMIT: Minor = minor(500_000);

/** Latencia simulada del comercio al revisar la orden en su portal. */
const MERCHANT_REVIEW_MS = 4_500;
/** Cada cuanto se le pregunta al backend si el comercio ya acepto la venta. */
const MERCHANT_ACCEPTANCE_POLL_MS = 4_000;

type SandboxContextValue = {
  ready: boolean;
  state: SandboxState;
  available: Minor;
  outstanding: Minor;
  nextDue: { schedule: PaymentSchedule; item: ScheduleItem } | null;
  scan(token: string): { ok: true; sessionId: string } | { ok: false; rejection: ScanRejection };
  /**
   * Abre la sesion con el comercio que ya resolvio el backend, sin pasar por las fixtures.
   * Es el camino de un QR real; `scan` queda para los codigos de demostracion.
   */
  scanResolved(resolved: {
    partnerProfileId: string;
    branchId: string;
    posTerminalId: string;
    displayName: string;
    businessCategory: string | null;
  }): { sessionId: string };
  submitAmount(sessionId: string, grossAmount: Minor): { ok: true; orderId: string } | { ok: false; code: string };
  /** Pide la decision. En modo `live` la resuelve AtlasBackend contra el motor de decision. */
  evaluate(orderId: string): Promise<void>;
  /** Origen de la ultima decision aplicada, para poder declararlo en pantalla. */
  decisionOrigin: DecisionOrigin | null;
  /** Aceptacion del comercio. En produccion llega por push desde el portal merchant. */
  merchantAccept(orderId: string): void;
  merchantReject(orderId: string): void;
  commit(orderId: string): { ok: true } | { ok: false; rejection: CommitRejection };
  cancelOrder(orderId: string): void;
  instructionFor(itemId: string): PaymentInstruction | null;
  /** Emite la instruccion de una cuota la primera vez que se abre su pantalla de pago. */
  ensureInstruction(itemId: string): void;
  claimPayment(input: { instructionId: string; reference: string | null; proofUri: string | null }): void;
  /** Confirmacion del comercio: unica fuente que resuelve un pago como pagado en el sandbox. */
  confirmMerchantReceipt(itemId: string): void;
  openDispute(itemId: string, reasonCode: string): void;
  orderById(orderId: string): PurchaseOrder | null;
  scheduleForOrder(orderId: string): PaymentSchedule | null;
  posQrForOrder(orderId: string): PosQr | null;
  reset(): void;
};

const SandboxContext = createContext<SandboxContextValue | null>(null);

export function SandboxProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SandboxState>(() => emptyState(DEFAULT_LIMIT));
  const [ready, setReady] = useState(false);
  const [decisionOrigin, setDecisionOrigin] = useState<DecisionOrigin | null>(null);
  const { customerId } = useSession();
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  /** Lectura sincrona del estado vigente para las acciones que deben validar antes de escribir. */
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!active) return;
        if (raw) {
          try {
            setState(JSON.parse(raw) as SandboxState);
          } catch {
            setState(emptyState(DEFAULT_LIMIT));
          }
        }
        setReady(true);
      })
      .catch(() => setReady(true));
    return () => {
      active = false;
      Object.values(timers.current).forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [ready, state]);

  const scan = useCallback<SandboxContextValue['scan']>((token) => {
    const result = openScanSession(token, Date.now());
    if ('code' in result) return { ok: false, rejection: result };
    setState((current) => ({ ...current, scanSessions: [result.session, ...current.scanSessions].slice(0, 30) }));
    return { ok: true, sessionId: result.session.id };
  }, []);

  const scanResolved = useCallback<SandboxContextValue['scanResolved']>((resolved) => {
    const { session } = openResolvedScanSession(resolved, Date.now());
    setState((current) => ({ ...current, scanSessions: [session, ...current.scanSessions].slice(0, 30) }));
    return { sessionId: session.id };
  }, []);

  const submitAmount = useCallback<SandboxContextValue['submitAmount']>((sessionId, grossAmount) => {
    const now = Date.now();
    const session = stateRef.current.scanSessions.find((item) => item.id === sessionId);
    if (!session) return { ok: false, code: 'SESSION_NOT_FOUND' };

    const result = createOrder({ session, grossAmount, now });
    if ('code' in result) return { ok: false, code: result.code };

    setState((current) => ({
      ...current,
      scanSessions: current.scanSessions.map((item) => (item.id === sessionId ? result.session : item)),
      orders: [result.order, ...current.orders],
    }));
    return { ok: true, orderId: result.order.id };
  }, []);

  /**
   * Aplica una decision ya tomada al estado local.
   *
   * Aislado del origen a proposito: la reserva sobre la linea se toma AL APROBAR y con las mismas
   * reglas venga la decision de donde venga (R48/R49). Que decide es una cosa; que hace el estado
   * con lo decidido es otra, y mezclarlas era lo que ataba las pantallas al motor local.
   */
  const applyDecision = useCallback((orderId: string, decision: CreditDecision, backendApplicationId: string | null = null) => {
    setState((current) => {
      const order = current.orders.find((item) => item.id === orderId);
      if (!order || order.decision) return current;

      const approved = decision.decision === 'APPROVED';
      const status: PurchaseOrder['status'] =
        decision.decision === 'APPROVED' ? 'PENDING_MERCHANT_ACCEPTANCE' : decision.decision === 'DECLINED' ? 'DECLINED' : 'REVIEW';

      return {
        ...current,
        orders: current.orders.map((item) =>
          item.id === orderId
            ? { ...item, decision, status, backendApplicationId, rowVersion: item.rowVersion + 1 }
            : item,
        ),
        creditLine: approved
          ? {
              ...current.creditLine,
              reservations: [
                ...current.creditLine.reservations,
                {
                  id: `res_${orderId}`,
                  orderId,
                  amount: order.financedAmount,
                  status: 'ACTIVE',
                  expiresAt: decision.validUntil,
                },
              ],
            }
          : current.creditLine,
      };
    });
  }, []);

  /**
   * Pide la decision de credito de una orden.
   *
   * En `live` la decide AtlasBackend: la app manda el importe financiado y el plazo, el backend
   * proyecta las features del cliente, llama al motor de decision con ese payload y devuelve el
   * expediente resuelto con su `executionId`. La app no puntua ni aprueba nada.
   *
   * Si el backend no contesta NO se cae al motor local: eso convertiria una averia en un credito
   * concedido por el telefono. La orden queda en `UNDER_EVALUATION` y el origen del fallo se
   * publica para que la pantalla lo diga con todas las letras.
   */
  const evaluate = useCallback<SandboxContextValue['evaluate']>(
    async (orderId) => {
      // La orden se lee del ACTUALIZADOR, no de `stateRef`.
      //
      // `stateRef` se refresca al renderizar, y esta funcion se llama inmediatamente despues de
      // `submitAmount`: la orden recien creada todavia no ha llegado al ref. Leerla de ahi devolvia
      // `undefined` y la evaluacion se abandonaba en silencio —sin error, sin decision— dejando la
      // compra en «evaluando» para siempre. El actualizador si ve el estado ya aplicado.
      const current = await new Promise<SandboxState>((resolve) => {
        setState((state) => {
          resolve(state);
          return state;
        });
      });
      const order = current.orders.find((item) => item.id === orderId);
      if (!order || order.decision) return;

      const now = Date.now();

      if (!isBackendDecision || !customerId) {
        setDecisionOrigin({ source: 'sandbox' });
        applyDecision(orderId, evaluateOrder({ order, line: current.creditLine, now }));
        return;
      }

      setState((prev) => ({
        ...prev,
        orders: prev.orders.map((item) =>
          item.id === orderId ? { ...item, status: 'UNDER_EVALUATION', rowVersion: item.rowVersion + 1 } : item,
        ),
      }));

      const result = await requestLiveDecision({
        customerId,
        financedAmount: order.financedAmount,
        // Siempre 1: arriba se descarta la orden que ya tiene decision, asi que no hay reevaluacion.
        decisionSeq: 1,
        now,
        ttlMs: DECISION_TTL_MS,
        // El comercio viaja en el contexto de la orden desde que se resolvio el QR. Es lo que hace
        // que la solicitud aparezca en el portal del negocio para que la acepte: sin esto la compra
        // se decidia de verdad pero el comercio no la veia nunca.
        partnerProfileId: order.context.organizationId,
        // Y la caja: en el flujo real `posId` ES el id del terminal resuelto, del que cuelga la
        // sucursal que el comercio necesita ver.
        posTerminalId: order.context.posId,
      });

      if (result.kind === 'unavailable') {
        setDecisionOrigin({ source: 'backend-unavailable', code: result.code, message: result.message });
        return;
      }

      setDecisionOrigin({
        source: 'backend',
        applicationCode: result.application.applicationCode,
        executionId: result.application.executionId ?? null,
        decisionMode: result.application.decisionMode ?? null,
      });
      // Se guarda el id de la solicitud REAL: es a ella a la que despues se le pregunta si el
      // comercio ya acepto. Sin esto, la orden aprobada por Atlas no tendria como esperar al negocio.
      applyDecision(orderId, result.decision, result.application.applicationId);
    },
    [applyDecision, customerId],
  );

  const merchantAccept = useCallback<SandboxContextValue['merchantAccept']>((orderId) => {
    setState((current) => {
      const order = current.orders.find((item) => item.id === orderId);
      if (!order || order.status !== 'PENDING_MERCHANT_ACCEPTANCE') return current;
      return {
        ...current,
        orders: current.orders.map((item) =>
          item.id === orderId
            ? {
                ...item,
                // Se guarda el hash EXACTO que el comercio acepto. Si la orden cambiara despues,
                // esta aceptacion deja de servir y el commit falla (R37).
                acceptance: { acceptedAt: new Date().toISOString(), orderContentHash: item.contentHash, memberRole: 'OPERATOR' },
                rowVersion: item.rowVersion + 1,
              }
            : item,
        ),
      };
    });
  }, []);

  const merchantReject = useCallback<SandboxContextValue['merchantReject']>((orderId) => {
    setState((current) => ({
      ...current,
      orders: current.orders.map((item) => (item.id === orderId ? { ...item, status: 'REJECTED_BY_MERCHANT' } : item)),
      creditLine: releaseReservation(current.creditLine, orderId),
    }));
  }, []);

  const commit = useCallback<SandboxContextValue['commit']>((orderId) => {
    const current = stateRef.current;
    const order = current.orders.find((item) => item.id === orderId);
    if (!order) return { ok: false, rejection: { code: 'ORDER_NOT_ACCEPTED' } };

    const result = commitPurchase({ order, line: current.creditLine, now: Date.now() });
    if ('code' in result) return { ok: false, rejection: result };

    const posQr = POS_QRS.find((item) => item.context.posId === order.context.posId);
    const initialItem = result.schedule.items.find((item) => item.itemType === 'INITIAL');
    const instruction =
      posQr && initialItem ? issueInstruction({ item: initialItem, posQr, currency: order.currency, now: Date.now() }) : null;

    setState((previous) => ({
      ...previous,
      orders: previous.orders.map((item) => (item.id === orderId ? result.order : item)),
      creditLine: result.line,
      schedules: [result.schedule, ...previous.schedules],
      instructions: instruction ? [instruction, ...previous.instructions] : previous.instructions,
    }));
    return { ok: true };
  }, []);

  const cancelOrder = useCallback<SandboxContextValue['cancelOrder']>((orderId) => {
    setState((current) => ({
      ...current,
      orders: current.orders.map((item) =>
        item.id === orderId && item.status !== 'WAITING_INITIAL_PAYMENT' && item.status !== 'ACTIVE'
          ? { ...item, status: 'CANCELLED' }
          : item,
      ),
      creditLine: releaseReservation(current.creditLine, orderId),
    }));
  }, []);

  const ensureInstruction = useCallback<SandboxContextValue['ensureInstruction']>((itemId) => {
    setState((current) => {
      if (current.instructions.some((item) => item.scheduleItemId === itemId)) return current;

      const schedule = current.schedules.find((entry) => entry.items.some((item) => item.id === itemId));
      const item = schedule?.items.find((entry) => entry.id === itemId);
      const order = current.orders.find((entry) => entry.id === schedule?.purchaseOrderId);
      const posQr = POS_QRS.find((entry) => entry.context.posId === order?.context.posId);
      if (!schedule || !item || !order || !posQr) return current;

      return {
        ...current,
        instructions: [issueInstruction({ item, posQr, currency: order.currency, now: Date.now() }), ...current.instructions],
      };
    });
  }, []);

  const claimPayment = useCallback<SandboxContextValue['claimPayment']>((input) => {
    setState((current) => {
      const instruction = current.instructions.find((item) => item.id === input.instructionId);
      if (!instruction) return current;
      return {
        ...current,
        claims: [
          {
            id: `clm_${Date.now().toString(36)}`,
            instructionId: instruction.id,
            reportedAmount: instruction.amount,
            transactionReference: input.reference,
            proofUri: input.proofUri,
            // El comprobante NO resuelve el pago: abre una revision. Invariante R59.
            status: 'UNDER_REVIEW',
            reportedAt: new Date().toISOString(),
          },
          ...current.claims,
        ],
      };
    });
  }, []);

  const confirmMerchantReceipt = useCallback<SandboxContextValue['confirmMerchantReceipt']>((itemId) => {
    setState((current) => {
      const now = new Date().toISOString();
      const schedules = current.schedules.map((schedule) => ({
        ...schedule,
        items: schedule.items.map((item) => (item.id === itemId ? { ...item, status: 'PAID' as const, resolvedPaidAt: now } : item)),
      }));

      const affected = schedules.find((schedule) => schedule.items.some((item) => item.id === itemId));
      const item = affected?.items.find((entry) => entry.id === itemId);

      // Al resolverse el inicial como PAGADO se activa la financiacion, no antes (R63).
      const orders =
        affected && item?.itemType === 'INITIAL'
          ? current.orders.map((order) => (order.id === affected.purchaseOrderId ? { ...order, status: 'ACTIVE' as const } : order))
          : current.orders;

      const allPaid = affected?.items.every((entry) => entry.id === itemId || entry.status === 'PAID') ?? false;

      return {
        ...current,
        schedules: schedules.map((schedule) =>
          schedule.id === affected?.id && item?.itemType === 'INSTALLMENT'
            ? { ...schedule, items: promoteNextInstallment(schedule.items) }
            : schedule,
        ),
        orders: allPaid && affected ? orders.map((order) => (order.id === affected.purchaseOrderId ? { ...order, status: 'COMPLETED' } : order)) : orders,
        claims: current.claims.map((claim) => (claim.instructionId === instructionIdFor(current.instructions, itemId) ? { ...claim, status: 'ACCEPTED' } : claim)),
        resolutions: [
          {
            id: `res_${Date.now().toString(36)}`,
            scheduleItemId: itemId,
            resolutionSeq: current.resolutions.filter((entry) => entry.scheduleItemId === itemId).length + 1,
            resolvedStatus: 'PAID',
            resolvedAmount: item?.amount ?? minor(0),
            resolutionSource: 'MERCHANT_CONFIRMATION',
            isFinal: true,
            createdAt: now,
          },
          ...current.resolutions,
        ],
      };
    });
  }, []);

  const openDispute = useCallback<SandboxContextValue['openDispute']>((itemId, reasonCode) => {
    setState((current) => ({
      ...current,
      disputes: [
        { id: `dsp_${Date.now().toString(36)}`, scheduleItemId: itemId, reasonCode, status: 'OPEN', openedAt: new Date().toISOString() },
        ...current.disputes,
      ],
      // La disputa no borra el vencimiento: lo marca (R64).
      schedules: current.schedules.map((schedule) => ({
        ...schedule,
        items: schedule.items.map((item) => (item.id === itemId ? { ...item, status: 'DISPUTED' as const } : item)),
      })),
    }));
  }, []);

  /**
   * El comercio revisa la orden en su portal y responde.
   *
   * En una compra REAL esto NO se simula: la respuesta la da el negocio de verdad desde su ERP, y el
   * telefono la espera preguntandole al backend por la solicitud (ver el efecto de sondeo mas abajo).
   * Auto-aceptarla aqui seria pagar el inicial antes de que el comercio confirme la venta —el orden
   * correcto es Atlas aprueba el credito, LUEGO el comercio acepta, y recien entonces se habilita el
   * pago—.
   *
   * El disparo automatico queda SOLO para las compras de demostracion (sin solicitud real detras),
   * para poder recorrer el flujo sin un comercio del otro lado.
   */
  useEffect(() => {
    state.orders
      .filter(
        (order) =>
          order.status === 'PENDING_MERCHANT_ACCEPTANCE' &&
          !order.acceptance &&
          !order.backendApplicationId &&
          !timers.current[order.id],
      )
      .forEach((order) => {
        timers.current[order.id] = setTimeout(() => {
          delete timers.current[order.id];
          merchantAccept(order.id);
        }, MERCHANT_REVIEW_MS);
      });
  }, [merchantAccept, state.orders]);

  /**
   * Espera la aceptacion REAL del comercio, preguntandole al backend por la solicitud.
   *
   * Solo para ordenes con una solicitud real detras y todavia esperando respuesta. Mientras el
   * comercio no acepte, la orden se queda en «esperando comercio» y el pago del inicial sigue
   * bloqueado —que es justo lo que pedia el flujo—. Cuando el negocio acepta, la orden avanza; si
   * rechaza, se marca rechazada y no se cobra nada.
   */
  useEffect(() => {
    if (!isBackendDecision || !customerId) return;
    const pendientes = state.orders.filter(
      (order) => order.status === 'PENDING_MERCHANT_ACCEPTANCE' && !order.acceptance && order.backendApplicationId,
    );
    if (pendientes.length === 0) return;

    let cancelado = false;
    const intervalo = setInterval(async () => {
      let resumen;
      try {
        resumen = await listCreditApplications(customerId);
      } catch {
        // Una lectura fallida no cambia nada: se reintenta al siguiente tick. La orden sigue en
        // espera, que es el estado seguro —nunca se habilita el pago por no haber podido preguntar—.
        return;
      }
      if (cancelado) return;
      const porId = new Map(resumen.applications.map((app) => [app.applicationId, app]));
      for (const order of pendientes) {
        const app = porId.get(order.backendApplicationId!);
        if (!app) continue;
        if (app.businessAcceptance === 'accepted') {
          merchantAccept(order.id);
        } else if (app.businessAcceptance === 'declined') {
          merchantReject(order.id);
        }
      }
    }, MERCHANT_ACCEPTANCE_POLL_MS);

    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, [customerId, merchantReject, merchantAccept, state.orders]);

  /** Expira sesiones y ordenes vencidas: el TTL debe verse, no solo existir en el modelo. */
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setState((current) => {
        let changed = false;
        const scanSessions = current.scanSessions.map((session) => {
          if (session.status === 'OPEN' && isExpired(session.expiresAt, now)) {
            changed = true;
            return { ...session, status: 'EXPIRED' as const };
          }
          return session;
        });
        const orders = current.orders.map((order) => {
          const pending = order.status === 'PENDING_MERCHANT_ACCEPTANCE' || order.status === 'UNDER_EVALUATION';
          if (pending && isExpired(order.expiresAt, now)) {
            changed = true;
            return { ...order, status: 'EXPIRED' as const };
          }
          return order;
        });
        return changed ? { ...current, scanSessions, orders, creditLine: releaseExpired(current.creditLine, orders) } : current;
      });
    }, 5_000);
    return () => clearInterval(interval);
  }, []);

  const value = useMemo<SandboxContextValue>(
    () => ({
      ready,
      state,
      available: availableCredit(state.creditLine),
      outstanding: outstandingAmount(state.schedules),
      nextDue: nextDueItem(state.schedules),
      scan,
      scanResolved,
      submitAmount,
      evaluate,
      decisionOrigin,
      merchantAccept,
      merchantReject,
      commit,
      cancelOrder,
      instructionFor: (itemId) => state.instructions.find((item) => item.scheduleItemId === itemId) ?? null,
      ensureInstruction,
      claimPayment,
      confirmMerchantReceipt,
      openDispute,
      orderById: (orderId) => state.orders.find((item) => item.id === orderId) ?? null,
      scheduleForOrder: (orderId) => state.schedules.find((item) => item.purchaseOrderId === orderId) ?? null,
      posQrForOrder: (orderId) => {
        const order = state.orders.find((item) => item.id === orderId);
        if (!order) return null;
        return POS_QRS.find((item) => item.context.posId === order.context.posId) ?? null;
      },
      reset: () => setState(emptyState(DEFAULT_LIMIT)),
    }),
    [
      cancelOrder,
      claimPayment,
      commit,
      confirmMerchantReceipt,
      decisionOrigin,
      ensureInstruction,
      evaluate,
      merchantAccept,
      merchantReject,
      openDispute,
      ready,
      scan,
      scanResolved,
      state,
      submitAmount,
    ],
  );

  return <SandboxContext.Provider value={value}>{children}</SandboxContext.Provider>;
}

export function useSandbox(): SandboxContextValue {
  const value = useContext(SandboxContext);
  if (!value) throw new Error('useSandbox debe usarse dentro de SandboxProvider');
  return value;
}

/** Sesion de escaneo por id, para la pantalla de monto. */
export function useScanSession(sessionId: string | undefined): ScanSession | null {
  const { state } = useSandbox();
  return useMemo(() => state.scanSessions.find((item) => item.id === sessionId) ?? null, [sessionId, state.scanSessions]);
}

export const posQrByToken = findPosQrByToken;

function releaseReservation(line: SandboxState['creditLine'], orderId: string): SandboxState['creditLine'] {
  return {
    ...line,
    reservations: line.reservations.map((item) => (item.orderId === orderId && item.status === 'ACTIVE' ? { ...item, status: 'RELEASED' } : item)),
  };
}

function releaseExpired(line: SandboxState['creditLine'], orders: PurchaseOrder[]): SandboxState['creditLine'] {
  const expired = new Set(orders.filter((order) => order.status === 'EXPIRED').map((order) => order.id));
  if (expired.size === 0) return line;
  return {
    ...line,
    reservations: line.reservations.map((item) => (expired.has(item.orderId) && item.status === 'ACTIVE' ? { ...item, status: 'EXPIRED' } : item)),
  };
}

/** La cuota siguiente pasa de PENDING a DUE cuando la anterior queda pagada. */
function promoteNextInstallment(items: ScheduleItem[]): ScheduleItem[] {
  const next = items.filter((item) => item.itemType === 'INSTALLMENT' && item.status === 'PENDING').sort((a, b) => a.sequenceNo - b.sequenceNo)[0];
  if (!next) return items;
  return items.map((item) => (item.id === next.id ? { ...item, status: 'DUE' as const } : item));
}

function instructionIdFor(instructions: PaymentInstruction[], itemId: string): string | null {
  return instructions.find((item) => item.scheduleItemId === itemId)?.id ?? null;
}

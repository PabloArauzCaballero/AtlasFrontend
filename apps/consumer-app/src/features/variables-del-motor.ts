/**
 * Cómo se llama, para una persona, cada dato con el que Atlas decide su línea, y de dónde salió.
 *
 * Los códigos (`ofac_screening_result`, `known_fraud_phone_flag`) son los del contrato con el Motor: son para
 * quien programa, no para quien mira «Mis datos». Cada uno se dice aquí en español llano y sin jerga de
 * fraude, y los que no figuran caen a un nombre legible hecho del propio código, nunca al código crudo.
 */
import type { BadgeTone } from '../ui/primitives';
import { marca } from '../theme/tokens';

export type Origen = 'expediente' | 'derivado' | 'ausente';

/** Un color por origen: verde lo que dijo la persona, azul lo que calculó Atlas, ámbar lo que falta. */
export const ORIGENES: Record<Origen, { titulo: string; resumen: string; tono: BadgeTone }> = {
  expediente: { titulo: 'Lo declaraste tú', resumen: 'Declarados', tono: 'success' },
  derivado: { titulo: `Lo calculó ${marca.nombre}`, resumen: 'Calculados', tono: 'info' },
  ausente: { titulo: 'Falta', resumen: 'Faltan', tono: 'warning' },
};

/** El orden en que se enseñan: primero lo suyo, luego lo calculado y al final lo que falta. */
export const ORDEN_DE_ORIGEN: Origen[] = ['expediente', 'derivado', 'ausente'];

const ETIQUETAS: Record<string, string> = {
  requested_amount: 'Monto que pediste',
  requested_term_months: 'Plazo que pediste',
  declared_monthly_income: 'Ingreso mensual declarado',
  disposable_income: 'Ingreso que te queda libre',
  affordability_ratio: 'Cuota frente a tu ingreso',
  debt_to_income_ratio: 'Deudas frente a tu ingreso',
  income_stability_score: 'Estabilidad de tu ingreso',
  employment_status: 'Situación laboral',
  self_employed_flag: 'Trabajas por cuenta propia',
  bank_statement_nsf_count: 'Rechazos por falta de fondos',
  tax_return_verified: 'Declaración de impuestos',
  source_of_funds_verified: 'Origen de tus fondos',
  bureau_score: 'Puntaje en buró de crédito',
  no_hit_flag: `Sin historial en ${marca.nombre}`,
  thin_file_flag: 'Historial corto',
  delinquency_count_12m: 'Atrasos en 12 meses',
  worst_delinquency_status: 'Peor atraso',
  charge_off_count: 'Deudas dadas por perdidas',
  public_records_count: 'Registros públicos',
  bankruptcy_flag: 'Quiebras',
  oldest_trade_age_months: 'Antigüedad de tu primer crédito',
  inquiries_last_6m: 'Solicitudes en 6 meses',
  revolving_utilization_ratio: 'Cuánto usas de tu línea',
  credit_mix_score: 'Variedad de tus créditos',
  payment_history_score: `Cómo pagas en ${marca.nombre}`,
  kyc_status: 'Verificación de identidad',
  national_id_verified: 'Carnet verificado',
  address_verified: 'Domicilio registrado',
  email_verified: 'Correo verificado',
  phone_verified: 'Teléfono verificado',
  liveness_check_passed: 'Prueba de vida',
  biometric_match_score: 'Parecido de tu selfie con el carnet',
  identity_confidence_score: 'Coincidencia de tu nombre',
  synthetic_identity_score: 'Riesgo de identidad falsa',
  consent_active: 'Tu consentimiento',
  pep_status: 'Cargo público importante',
  pep_relationship_type: 'Vínculo con un cargo público',
  sanctions_screening_result: 'Listas restrictivas',
  ofac_screening_result: 'Lista OFAC',
  adverse_media_hit: 'Noticias adversas',
  high_risk_jurisdiction_flag: 'País de alto riesgo',
  device_reputation: 'Reputación de tu celular',
  device_risk_score: 'Riesgo de tu celular',
  ip_address_risk_score: 'Riesgo de tu conexión',
  ip_tor_detected: 'Conexión anónima',
  geolocation_mismatch_flag: 'Ubicación distinta a tu domicilio',
  sim_swap_detected: 'Cambio reciente de SIM',
  browser_automation_detected: 'Uso automatizado',
  known_fraud_device_flag: 'Celular con fraude conocido',
  known_fraud_email_flag: 'Correo con fraude conocido',
  known_fraud_phone_flag: 'Teléfono con fraude conocido',
  previous_fraud_case_flag: 'Casos de fraude anteriores',
  fraud_signal: 'Caso de fraude abierto',
  account_takeover_risk_score: 'Riesgo de robo de cuenta',
  velocity_applications_24h: 'Solicitudes en 24 horas',
  usury_cap_rate: 'Tope legal de la tasa',
  product_base_annual_rate: 'Tasa base del producto',
  statement_available: 'Extracto bancario vigente',
  statement_verified_income: 'Ingreso medido en tu extracto',
  statement_nsf_events: 'Rechazos por fondos en el extracto',
  statement_months_negative: 'Meses en negativo',
  statement_collection_actions: 'Gestiones de cobranza',
  statement_high_risk_months: 'Meses de gasto de riesgo',
  capacity_recommended_limit: 'Límite que sostienen tus movimientos',
  capacity_monthly_installment: 'Cuota mensual que puedes pagar',
  capacity_binding_constraint: 'Qué limita tu capacidad',
  capacity_evidence_source: 'Con qué se midió tu capacidad',
  relationship_score: `Tu relación con ${marca.nombre}`,
  relationship_tier: 'Tu nivel de relación',
  tenure_score: `Tu antigüedad en ${marca.nombre}`,
  loyalty_score: 'Tu fidelidad',
  monthlyIncome: 'Ingreso mensual',
  incomeSource: 'Fuente de ingreso',
  employmentType: 'Tipo de empleo',
  monthlyExpenses: 'Gastos mensuales',
  dependents: 'Dependientes',
};

/** Un código sin traducción cae a palabras sueltas con mayúscula inicial, no al código tal cual. */
function legible(codigo: string): string {
  const palabras = codigo
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim()
    .toLowerCase();
  return palabras.charAt(0).toUpperCase() + palabras.slice(1);
}

export const etiquetaDeVariable = (codigo: string): string => ETIQUETAS[codigo] ?? legible(codigo);

/** Agrupa las entradas por origen, en el orden en que se enseñan, y cada grupo por nombre. */
export function agruparPorOrigen(inputs: Record<string, string>): { origen: Origen; filas: { codigo: string; etiqueta: string }[] }[] {
  return ORDEN_DE_ORIGEN.map((origen) => ({
    origen,
    filas: Object.entries(inputs)
      .filter(([, valor]) => valor === origen)
      .map(([codigo]) => ({ codigo, etiqueta: etiquetaDeVariable(codigo) }))
      .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es')),
  })).filter((grupo) => grupo.filas.length > 0);
}

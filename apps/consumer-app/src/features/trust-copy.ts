/**
 * Que se le dice a la persona sobre cada dato que le pedimos en el alta.
 *
 * ## Por que vive en un solo archivo
 *
 * Son promesas. Repartidas por las cinco pantallas del alta se contradicen en cuanto alguien toca
 * una —«se guarda cifrado» en una, «no lo guardamos» en otra sobre el mismo campo— y una promesa
 * que se contradice hace mas daño que no haberla hecho. Aqui se leen todas juntas, que es la unica
 * forma de mantenerlas coherentes.
 *
 * ## Las dos reglas al escribir esto
 *
 * **Una linea por «por que».** Si necesita dos, es que explica el sistema en vez de contestar a la
 * persona. La pregunta que responde es «¿para que quieren esto?», no «¿como funciona el credito?».
 *
 * **Ninguna garantia puede describir algo que el backend no haga.** Cada etiqueta de abajo
 * corresponde a un comportamiento comprobable hoy:
 *
 * - `Cifrado` en telefono y correo: `customer.customers` guarda `primary_phone_encrypted` /
 *   `primary_email_encrypted`, y en claro solo `primary_phone_last_4` y `primary_email_domain`.
 * - `No se guarda` en el PIN: en `iam.auth_credentials` vive su huella, no el PIN.
 * - `No se guarda` en el numero de carnet: viaja para consultar el registro y de el quedan
 *   `documentNumberHash` y `documentLast4` (ver la nota de
 *   `customer-identity-provider-verification.service.ts`).
 * - `Solo guardamos su huella` en el PIN: el servidor recibe el PIN y guarda su hash Argon2id; NO se
 *   dice «ni Atlas lo ve», porque pasa por el servidor.
 * - `Viaja por conexion segura` en las fotos: sube por https; el cifrado en el almacen no lo controla
 *   este codigo y no se promete.
 * - `Cada cierto tiempo` en la ubicacion: la app rastrea de forma continua si se da el permiso
 *   (`features/rastreo.ts`); no hay retencion definida y no se promete ninguna.
 * - `Lo decide el motor` en ingresos y gastos: la capacidad de pago la calcula un artefacto del
 *   motor de decision con el expediente, no una persona.
 *
 * Si un dia deja de ser verdad, esto miente antes de que nadie lo note.
 *
 * ## Lo que falta
 *
 * Es texto con implicaciones legales. Deberia pasar por quien firma la politica de privacidad, y la
 * version vigente deberia salir de los documentos que el backend ya sirve
 * (`GET /consent-documents/active`) en vez de vivir en el bundle.
 */
import type { TrustItem } from '../ui/trust-card';
import { marca } from '../theme/tokens';

/*
  Etiquetas compartidas. Repetir la misma promesa con dos redacciones —«no se comparte con el
  comercio» y «nunca al comercio»— es como se pierde la confianza en los detalles: el ojo nota que
  no es la misma frase y se pregunta si es la misma promesa.
*/
const CIFRADO = { icon: 'candado', label: 'Cifrado' } as const;
const NO_SE_GUARDA = { icon: 'escudo', label: 'No se guarda' } as const;
/*
  Las fotos suben a un almacen por URL prefirmada (https). Que el almacen las guarde cifradas
  depende de su configuracion, no de este codigo, asi que NO se promete: solo el trayecto.
*/
const CONEXION_SEGURA = { icon: 'candado', label: 'Viaja por conexión segura' } as const;
const SOLO_ATLAS = { icon: 'ojo', label: `Solo ${marca.nombre}` } as const;
const NUNCA_AL_COMERCIO = { icon: 'comercio', label: 'Nunca al comercio' } as const;

/**
 * Lo que dice la fila «Sesion» del perfil, segun donde corre la app.
 *
 * En el telefono los tokens van a `expo-secure-store` (llavero de iOS / Keystore de Android). En el
 * navegador el almacen es `localStorage`, que NO esta cifrado: decir «cifrados» ahi era falso.
 */
export const SESION_GUARDADA_MOVIL = 'Tus tokens se guardan cifrados en este dispositivo';
export const SESION_GUARDADA_WEB = 'Tu sesión se guarda en este navegador; cierra sesión si el equipo no es tuyo';

/** Crear cuenta: quien eres, como te contactamos, como entras. */
export const TRUST_REGISTRO: TrustItem[] = [
  {
    icon: 'perfil',
    dato: 'Tu nombre y tu apellido',
    porque: 'El crédito se abre a tu nombre, no a una cuenta anónima.',
    garantias: [SOLO_ATLAS, NUNCA_AL_COMERCIO],
  },
  {
    icon: 'reloj',
    dato: 'Tu fecha de nacimiento',
    porque: 'Para firmar un crédito hay que tener 18 años cumplidos.',
    garantias: [{ icon: 'check', label: 'Solo para la edad' }, SOLO_ATLAS],
  },
  {
    icon: 'telefono',
    dato: 'Tu teléfono y tu correo',
    porque: 'Ahí llega el código que confirma tu cuenta y los avisos de tus pagos.',
    garantias: [CIFRADO, { icon: 'ojo', label: 'Solo las últimas cifras' }],
  },
  {
    icon: 'candado',
    dato: 'Tu PIN de 4 dígitos',
    porque: 'Impide que alguien con tu teléfono en la mano compre en tu nombre.',
    garantias: [NO_SE_GUARDA, { icon: 'escudo', label: 'Solo guardamos su huella' }],
  },
];

/** Situacion economica. */
export const TRUST_ECONOMIA: TrustItem[] = [
  {
    icon: 'billetera',
    dato: 'Cuánto ingresas y cuánto gastas',
    porque: 'Es lo que fija una cuota que puedas pagar sin ahogarte.',
    garantias: [{ icon: 'chispa', label: 'Lo decide el motor' }, NUNCA_AL_COMERCIO],
  },
  {
    icon: 'grafico',
    dato: 'De qué trabajas y desde cuándo',
    porque: 'Un ingreso estable pesa distinto que uno que empezó el mes pasado.',
    garantias: [{ icon: 'telefono', label: 'Sin llamar sin avisarte' }, SOLO_ATLAS],
  },
];

/** Domicilio. */
export const TRUST_DOMICILIO: TrustItem[] = [
  {
    icon: 'ubicacion',
    dato: 'Dónde vives',
    /*
      Esta promesa estuvo un rato sin ser verdad: la pantalla decia «la direccion exacta se guarda
      cifrada» y la app no pedia calle ni numero, porque el backend esperaba recibirlos ya cifrados
      por el cliente y esa pieza no existia. Se resolvio por donde correspondia —el servidor los
      cifra al guardarlos, igual que el telefono— y ahora el texto vuelve a describir lo que pasa.
    */
    porque: 'Es requisito del expediente y por donde te buscamos si no contestas.',
    garantias: [CIFRADO, { icon: 'documento', label: 'Verificar y cobranza' }, SOLO_ATLAS],
  },
  {
    icon: 'chispa',
    dato: 'Tu ubicación, si la das',
    porque:
      'Con el botón de ubicación o pegando un enlace de Maps. Puedes seguir sin darla. Si das el permiso, la app registra tu ubicación cada cierto tiempo mientras el permiso siga dado.',
    garantias: [{ icon: 'check', label: 'Opcional' }, { icon: 'reloj', label: 'Cada cierto tiempo' }, NUNCA_AL_COMERCIO],
  },
];

/** Documento de identidad. */
export const TRUST_IDENTIDAD: TrustItem[] = [
  {
    icon: 'documento',
    dato: 'Tu número de carnet',
    porque: 'Se consulta en el registro oficial para confirmar que es tuyo.',
    garantias: [NO_SE_GUARDA, { icon: 'ojo', label: 'Solo las últimas cifras' }],
  },
  {
    icon: 'camara',
    dato: 'Las fotos del carnet y tu selfie',
    porque: 'Separan que pidas crédito tú de que lo pida quien consiguió tus datos.',
    garantias: [CONEXION_SEGURA, { icon: 'escudo', label: 'Solo verificación' }, NUNCA_AL_COMERCIO],
  },
];

/** Referencias personales. */
export const TRUST_REFERENCIAS: TrustItem[] = [
  {
    icon: 'sobre',
    dato: 'Dos personas de contacto',
    porque: 'Son a quienes acudimos solo si dejamos de poder contactarte a ti.',
    garantias: [
      { icon: 'alerta', label: 'Solo si no te ubicamos' },
      { icon: 'billetera', label: 'Sin datos de tu deuda' },
    ],
  },
];

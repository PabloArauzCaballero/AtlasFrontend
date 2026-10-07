/**
 * La fachada de la bitacora: lo unico que la interfaz toca.
 *
 * ## Ciclo de vida
 *
 * 1. `arrancar('crear_cuenta')` en el primer toque de la bienvenida. Desde ahi el cronometro corre
 *    y cada `registrar` entra en la cola en disco.
 * 2. `adjuntarSesion({customerId, sessionId, deviceId})` cuando la sesion de telemetria existe. A
 *    partir de ahi la cola se vacia: cada 20 eventos, cada 15 s, al salir de una pantalla y al pasar
 *    a segundo plano.
 * 3. `cerrar()` cuando el alta termina (envio de la solicitud) o al cerrar sesion: vacia lo que
 *    quede y borra la cola.
 *
 * ## Nunca lanza, nunca bloquea
 *
 * Todo lo que hace es anotar. Una anotacion que falla no puede impedir que alguien se registre, asi
 * que cada camino de error termina en silencio (y, cuando se puede, en un evento `lote_rechazado`
 * para que el servidor sepa que hubo un hueco).
 *
 * ## Sin React
 *
 * Es un singleton de modulo con transporte y almacen INYECTABLES (`configurar`). Los ganchos de la
 * interfaz (`ganchos.tsx`) lo llaman; las pruebas lo montan con fakes.
 */
import type { TelemetryBatch, TelemetryEvent } from '../../api/endpoints/telemetry';
import { Cola, type Almacen } from './cola';
import { abrirSesionDeCampo, anotarCambio, posicionRelativa, type SesionDeCampo } from './deteccion';
import { Reloj, type FuentesDeReloj } from './reloj';
import { traducir, ventanaDe } from './traduccion';
import { CAMPOS, CONTROLES, PANTALLAS, type AccionDeCaptura, type Campo, type Captura, type Control, type EventoBitacora, type Pantalla, type Permiso } from './tipos';

export type SesionDeBitacora = { customerId: string; sessionId: string; deviceId: string };

export type Transporte = (customerId: string, lote: TelemetryBatch) => Promise<unknown>;

export type Configuracion = {
  almacen: Almacen;
  transporte: Transporte;
  reloj?: FuentesDeReloj;
  /** Cuantos eventos disparan un vaciado. */
  umbralDeVaciado?: number;
  /** Cada cuanto se vacia aunque no se llegue al umbral. `0` apaga el temporizador (pruebas). */
  intervaloDeVaciadoMs?: number;
  temporizador?: { programar: (fn: () => void, ms: number) => unknown; cancelar: (id: unknown) => void };
};

export const TAMANO_DE_LOTE = 100;
const UMBRAL_POR_DEFECTO = 20;
const INTERVALO_POR_DEFECTO_MS = 15_000;

const PANTALLAS_SET = new Set<string>(PANTALLAS);
const CONTROLES_SET = new Set<string>(CONTROLES);
const CAMPOS_SET = new Set<string>(CAMPOS);

export function esPantalla(valor: string | null | undefined): valor is Pantalla {
  return typeof valor === 'string' && PANTALLAS_SET.has(valor);
}
export function esControl(valor: string | null | undefined): valor is Control {
  return typeof valor === 'string' && CONTROLES_SET.has(valor);
}
export function esCampo(valor: string | null | undefined): valor is Campo {
  return typeof valor === 'string' && CAMPOS_SET.has(valor);
}

/** De la ruta del router (`/(onboarding)/registro`, `/registro`) al codigo de pantalla. */
export function pantallaDeRuta(pathname: string | null | undefined): Pantalla | null {
  if (!pathname) return null;
  const ultimo = pathname.split('/').filter(Boolean).pop() ?? '';
  return esPantalla(ultimo) ? ultimo : null;
}

/** El `detalle` de los `flujo` de segundo/primer plano mientras el escaner del sistema tiene la pantalla. */
export const DETALLE_ESCANER = 'escaner_sistema';

class Bitacora {
  private config: Configuracion | null = null;
  private reloj = new Reloj();
  private cola: Cola | null = null;
  private sesion: SesionDeBitacora | null = null;
  private activa = false;
  private pantallaActual: { pantalla: Pantalla; entradaT: number } | null = null;
  private campos = new Map<Campo, SesionDeCampo>();
  /** El vaciado en curso, para que dos llamadas concurrentes esperen al mismo en vez de solaparse. */
  private vaciado: Promise<{ enviados: number }> | null = null;
  private temporizadorId: unknown = null;
  private desdeUltimoVaciado = 0;
  private capturaAbierta: Captura | null = null;
  /** El escaner del sistema tiene la pantalla (entre `escanea` y lo que venga despues). */
  private escanerAbierto = false;

  configurar(config: Configuracion): void {
    this.config = config;
    this.reloj = new Reloj(config.reloj);
    this.cola = new Cola(config.almacen);
    this.sesion = null;
    this.activa = false;
    this.pantallaActual = null;
    this.campos.clear();
    this.desdeUltimoVaciado = 0;
    this.capturaAbierta = null;
    this.escanerAbierto = false;
    this.pararTemporizador();
  }

  get estaActiva(): boolean {
    return this.activa;
  }

  get tieneSesion(): boolean {
    return this.sesion !== null;
  }

  /** El cronometro, en ms. Es lo que una pantalla puede enseñar; nunca se calcula un puntaje aqui. */
  transcurridoMs(): number {
    return this.reloj.ahora();
  }

  /**
   * Arranca (o retoma) la bitacora. Si en disco habia un alta a medias, se continua su linea de
   * tiempo en vez de abrir otra: el alta empezo cuando empezo.
   */
  async arrancar(motivo: 'crear_cuenta' | 'reanudado'): Promise<void> {
    if (!this.config || !this.cola) return;
    if (this.activa) return;
    try {
      const guardado = await this.cola.cargar();
      if (guardado.anclaEpoch !== null && guardado.eventos > 0) {
        this.reloj.retomar(guardado.anclaEpoch, guardado.transcurridoMs);
        this.activa = true;
        this.registrar({ tipo: 'flujo', accion: 'reanudado', t: this.reloj.ahora() });
      } else {
        this.reloj.iniciar();
        this.activa = true;
        this.cola.fijarReloj(this.reloj.ancla, 0);
        this.registrar({ tipo: 'flujo', accion: motivo === 'reanudado' ? 'reanudado' : 'inicio', t: this.reloj.ahora() });
      }
      this.programarTemporizador();
    } catch {
      /* sin bitacora no se detiene nada */
    }
  }

  adjuntarSesion(sesion: SesionDeBitacora): void {
    this.sesion = sesion;
    void this.vaciar();
  }

  /** Vacia lo que quede y borra la cola. Se llama al terminar el alta o al cerrar sesion. */
  async cerrar(): Promise<void> {
    if (!this.cola) return;
    this.pararTemporizador();
    if (this.sesion) await this.vaciar();
    await this.cola.vaciarDisco();
    this.reloj.reiniciar();
    this.activa = false;
    this.sesion = null;
    this.pantallaActual = null;
    this.campos.clear();
  }

  registrar(evento: EventoBitacora): void {
    if (!this.activa || !this.cola) return;
    const { recortados } = this.cola.encolar(evento);
    if (recortados > 0) {
      this.cola.encolar({ tipo: 'flujo', accion: 'cola_recortada', t: this.reloj.ahora(), detalle: String(recortados) });
    }
    this.cola.fijarReloj(this.reloj.ancla, this.reloj.ahora());
    this.desdeUltimoVaciado += 1;
    const umbral = this.config?.umbralDeVaciado ?? UMBRAL_POR_DEFECTO;
    if (this.sesion && this.desdeUltimoVaciado >= umbral) void this.vaciar();
  }

  /* ------------------------------------------------------------ atajos de la interfaz */

  entraEnPantalla(pantalla: Pantalla): void {
    if (!this.activa) return;
    const t = this.reloj.ahora();
    if (this.pantallaActual && this.pantallaActual.pantalla !== pantalla) this.saleDePantalla(this.pantallaActual.pantalla);
    this.pantallaActual = { pantalla, entradaT: t };
    this.registrar({ tipo: 'pantalla', accion: 'entra', pantalla, t });
  }

  saleDePantalla(pantalla: Pantalla, accion: 'sale' | 'atras' = 'sale'): void {
    if (!this.activa) return;
    const t = this.reloj.ahora();
    const desdeEntradaMs = this.pantallaActual?.pantalla === pantalla ? t - this.pantallaActual.entradaT : undefined;
    this.registrar({ tipo: 'pantalla', accion, pantalla, t, desdeEntradaMs });
    if (this.pantallaActual?.pantalla === pantalla) this.pantallaActual = null;
    if (this.sesion) void this.vaciar();
  }

  pantalla(): Pantalla | null {
    return this.pantallaActual?.pantalla ?? null;
  }

  toque(control: Control, toque: { x: number; y: number; ancho: number; alto: number; pageX: number; pageY: number; viewport: [number, number] }): void {
    const pantalla = this.pantallaActual?.pantalla;
    if (!this.activa || !pantalla) return;
    const { rx, ry } = posicionRelativa(toque.x, toque.y, toque.ancho, toque.alto);
    const { rx: sx, ry: sy } = posicionRelativa(toque.pageX, toque.pageY, toque.viewport[0], toque.viewport[1]);
    this.registrar({ tipo: 'toque', pantalla, control, rx, ry, sx, sy, viewport: toque.viewport, t: this.reloj.ahora() });
  }

  focoEnCampo(campo: Campo, longitudActual: number): void {
    const pantalla = this.pantallaActual?.pantalla;
    if (!this.activa || !pantalla) return;
    const t = this.reloj.ahora();
    this.campos.set(campo, abrirSesionDeCampo(campo, t, longitudActual));
    this.registrar({ tipo: 'campo', pantalla, campo, accion: 'foco', t });
  }

  cambioEnCampo(campo: Campo, longitudNueva: number): void {
    const pantalla = this.pantallaActual?.pantalla;
    if (!this.activa || !pantalla) return;
    let sesion = this.campos.get(campo);
    if (!sesion) {
      // Cambio sin foco previo: pasa con el autorrelleno y en web. Se abre la sesion aqui.
      sesion = abrirSesionDeCampo(campo, this.reloj.ahora(), 0);
      this.campos.set(campo, sesion);
    }
    const clase = anotarCambio(sesion, longitudNueva);
    if (clase === 'sin_cambio' || clase === 'tecleo') return;
    this.registrar({ tipo: 'campo', pantalla, campo, accion: clase, t: this.reloj.ahora() });
  }

  desenfoqueDeCampo(campo: Campo): void {
    const pantalla = this.pantallaActual?.pantalla;
    if (!this.activa || !pantalla) return;
    const t = this.reloj.ahora();
    const sesion = this.campos.get(campo);
    this.registrar({
      tipo: 'campo',
      pantalla,
      campo,
      accion: 'desenfoque',
      t,
      duracionMs: sesion ? t - sesion.focoEn : undefined,
      correcciones: sesion?.correcciones,
    });
    this.campos.delete(campo);
  }

  campoCompleto(campo: Campo): void {
    const pantalla = this.pantallaActual?.pantalla;
    if (!this.activa || !pantalla) return;
    this.registrar({ tipo: 'campo', pantalla, campo, accion: 'completo', t: this.reloj.ahora() });
  }

  validacion(codigo: string, campo?: Campo): void {
    const pantalla = this.pantallaActual?.pantalla;
    if (!this.activa || !pantalla) return;
    this.registrar({ tipo: 'validacion', pantalla, campo, codigo, t: this.reloj.ahora() });
  }

  envio(resultado: 'ok' | 'error', latenciaMs: number, codigo?: string): void {
    const pantalla = this.pantallaActual?.pantalla;
    if (!this.activa || !pantalla) return;
    this.registrar({ tipo: 'envio', pantalla, resultado, latenciaMs, codigo, t: this.reloj.ahora() });
  }

  /**
   * Mide un envio al servidor: latencia y resultado, con el codigo del error si lo hubo. Devuelve o
   * relanza lo que devuelva `fn`: medir no cambia el resultado.
   */
  async medirEnvio<T>(fn: () => Promise<T>): Promise<T> {
    const inicio = this.reloj.ahora();
    try {
      const resultado = await fn();
      this.envio('ok', this.reloj.ahora() - inicio);
      return resultado;
    } catch (error: unknown) {
      this.envio('error', this.reloj.ahora() - inicio, codigoDe(error));
      throw error;
    }
  }

  permiso(permiso: Permiso, decision: 'concedido' | 'denegado' | 'omitido'): void {
    if (!this.activa) return;
    this.registrar({ tipo: 'permiso', permiso, decision, t: this.reloj.ahora() });
  }

  captura(que: Captura, accion: AccionDeCaptura): void {
    if (!this.activa) return;
    /*
      Con la camara DE LA APP abierta, irse al fondo es una señal (`captura_<que>:segundo_plano`):
      alguien que sale a por otra imagen a mitad de la foto. Con el escaner DEL SISTEMA abierto no lo
      es: en Android el escaner es otra actividad y la app pasa a segundo plano sola, sin que nadie
      se haya ido. Por eso `escanea` no deja la captura «abierta» y marca en su lugar que el sistema
      tiene la pantalla; `respaldo_camara` si la abre, porque ahi vuelve a estar la camara de la app.
    */
    this.capturaAbierta = accion === 'abre' || accion === 'respaldo_camara' ? que : null;
    this.escanerAbierto = accion === 'escanea';
    this.registrar({ tipo: 'captura', que, accion, t: this.reloj.ahora() });
  }

  /**
   * La app se fue al fondo. Si habia una captura abierta, eso es lo primero que se anota.
   *
   * Con el escaner del sistema delante, el `flujo:segundo_plano` se anota igual —es verdad que la app
   * no estaba en pantalla— pero con `detalle: 'escaner_sistema'`, para que el tiempo en segundo plano
   * se pueda descontar sin adivinar.
   */
  segundoPlano(): void {
    if (!this.activa) return;
    const t = this.reloj.ahora();
    if (this.capturaAbierta) this.registrar({ tipo: 'captura', que: this.capturaAbierta, accion: 'segundo_plano', t });
    this.registrar({ tipo: 'flujo', accion: 'segundo_plano', t, ...(this.escanerAbierto ? { detalle: DETALLE_ESCANER } : {}) });
    if (this.sesion) void this.vaciar();
  }

  primerPlano(): void {
    if (!this.activa) return;
    this.registrar({ tipo: 'flujo', accion: 'primer_plano', t: this.reloj.ahora(), ...(this.escanerAbierto ? { detalle: DETALLE_ESCANER } : {}) });
  }

  /* ------------------------------------------------------------------- vaciado */

  vaciar(): Promise<{ enviados: number }> {
    if (!this.config || !this.cola || !this.sesion) return Promise.resolve({ enviados: 0 });
    if (this.vaciado) return this.vaciado;
    this.vaciado = this.vaciarDeVerdad().finally(() => {
      this.vaciado = null;
    });
    return this.vaciado;
  }

  private async vaciarDeVerdad(): Promise<{ enviados: number }> {
    if (!this.config || !this.cola || !this.sesion) return { enviados: 0 };
    let enviados = 0;
    {
      // Bucle hasta que no quede nada pendiente o falle un lote.
      for (;;) {
        const tramo = this.cola.tomar(TAMANO_DE_LOTE);
        if (tramo.length === 0) break;
        const eventos: TelemetryEvent[] = tramo.map((e) => traducir(e.evento, this.reloj));
        const ids = tramo.map((e) => e.id);
        try {
          await this.config.transporte(this.sesion.customerId, {
            sessionId: this.sesion.sessionId,
            deviceId: this.sesion.deviceId,
            ...ventanaDe(eventos),
            events: eventos,
          });
          this.cola.confirmar(ids);
          enviados += eventos.length;
        } catch (error: unknown) {
          if (esRechazoDefinitivo(error)) {
            // El servidor no lo va a aceptar nunca (esquema, tamaño, palabra prohibida): se descarta
            // el tramo y queda anotado el hueco.
            this.cola.confirmar(ids);
            this.cola.encolar({ tipo: 'flujo', accion: 'lote_rechazado', t: this.reloj.ahora(), detalle: codigoDe(error) });
          } else {
            this.cola.reponer(ids);
          }
          break;
        }
      }
      this.desdeUltimoVaciado = 0;
    }
    return { enviados };
  }

  /** Solo para pruebas. */
  async _sincronizar(): Promise<void> {
    await this.cola?.sincronizar();
  }

  private programarTemporizador(): void {
    const intervalo = this.config?.intervaloDeVaciadoMs ?? INTERVALO_POR_DEFECTO_MS;
    if (!intervalo) return;
    const temporizador = this.config?.temporizador ?? {
      programar: (fn: () => void, ms: number) => setInterval(fn, ms),
      cancelar: (id: unknown) => clearInterval(id as ReturnType<typeof setInterval>),
    };
    this.pararTemporizador();
    this.temporizadorId = temporizador.programar(() => {
      if (this.sesion && this.cola && this.cola.pendientes > 0) void this.vaciar();
    }, intervalo);
    this.pararTemporizadorFn = () => temporizador.cancelar(this.temporizadorId);
  }

  private pararTemporizadorFn: (() => void) | null = null;

  private pararTemporizador(): void {
    if (this.temporizadorId !== null) {
      this.pararTemporizadorFn?.();
      this.temporizadorId = null;
    }
  }
}

type ErrorConEstado = { status?: number; code?: string };

function esRechazoDefinitivo(error: unknown): boolean {
  const status = (error as ErrorConEstado)?.status;
  return typeof status === 'number' && status >= 400 && status < 500 && status !== 429 && status !== 401 && status !== 403;
}

function codigoDe(error: unknown): string {
  const e = error as ErrorConEstado;
  return e?.code ?? (e?.status ? `HTTP_${e.status}` : 'DESCONOCIDO');
}

export const bitacora = new Bitacora();

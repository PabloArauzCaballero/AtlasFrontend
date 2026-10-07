/**
 * La cola de eventos en disco.
 *
 * ## Por que en disco y no en memoria
 *
 * La bitacora arranca ANTES de que exista la cuenta —en el primer toque de «Crear mi cuenta»— y
 * hasta que hay sesion no se puede enviar nada. Si la app se cierra en ese tramo, o entre dos
 * envios, lo que hubiera en memoria se perderia, y lo que se perderia es justo el principio del
 * alta: el tramo que mide cuanto tardo alguien en decidirse.
 *
 * ## Tope
 *
 * 2 000 eventos. Un alta entera produce unos 200-300; el tope existe para que un bucle inesperado
 * no llene el disco de nadie. Al llegar se descartan los mas viejos y se anota `cola_recortada`, de
 * modo que el servidor sepa que la serie esta incompleta en vez de creer que empezo mas tarde.
 *
 * ## Tomar, confirmar, reponer
 *
 * Enviar es de tres pasos: `tomar(n)` marca un tramo como «en vuelo», `confirmar` lo borra cuando el
 * servidor acepto, `reponer` lo devuelve cuando no. Un evento en vuelo no se vuelve a tomar hasta
 * que se reponga: sin eso, un reintento lento y un vaciado por temporizador mandarian el mismo
 * tramo dos veces (el servidor lo deduplicaria por `clientBatchId`... si fuera el mismo lote, y no
 * lo seria).
 */
import type { EventoBitacora, EventoEnCola } from './tipos';

export type Almacen = {
  leer(clave: string): Promise<string | null>;
  escribir(clave: string, valor: string): Promise<void>;
  borrar(clave: string): Promise<void>;
};

export const CLAVE_DE_COLA = 'atlas.bitacora.v1';
export const TOPE_DE_COLA = 2000;

type Persistido = {
  version: 1;
  siguienteId: number;
  anclaEpoch: number | null;
  transcurridoMs: number;
  eventos: EventoEnCola[];
};

export class Cola {
  private eventos: EventoEnCola[] = [];
  private enVuelo = new Set<number>();
  private siguienteId = 1;
  private cargada = false;
  private escrituraPendiente: Promise<void> = Promise.resolve();
  /** Lo que se guarda junto a la cola para poder retomar el cronometro. */
  private anclaEpoch: number | null = null;
  private transcurridoMs = 0;

  constructor(
    private readonly almacen: Almacen,
    private readonly tope: number = TOPE_DE_COLA,
  ) {}

  /** Carga lo que hubiera en disco. Idempotente; un disco ilegible arranca vacio, no rompe. */
  async cargar(): Promise<{ anclaEpoch: number | null; transcurridoMs: number; eventos: number }> {
    if (!this.cargada) {
      this.cargada = true;
      try {
        const crudo = await this.almacen.leer(CLAVE_DE_COLA);
        if (crudo) {
          const datos = JSON.parse(crudo) as Persistido;
          if (datos.version === 1 && Array.isArray(datos.eventos)) {
            this.eventos = datos.eventos;
            this.siguienteId = datos.siguienteId;
            this.anclaEpoch = datos.anclaEpoch;
            this.transcurridoMs = datos.transcurridoMs;
          }
        }
      } catch {
        this.eventos = [];
      }
    }
    return { anclaEpoch: this.anclaEpoch, transcurridoMs: this.transcurridoMs, eventos: this.eventos.length };
  }

  fijarReloj(anclaEpoch: number | null, transcurridoMs: number): void {
    this.anclaEpoch = anclaEpoch;
    this.transcurridoMs = transcurridoMs;
  }

  get tamano(): number {
    return this.eventos.length;
  }

  get pendientes(): number {
    return this.eventos.filter((e) => !this.enVuelo.has(e.id)).length;
  }

  /** Encola. Devuelve si hubo que recortar, para que quien llama anote el hueco. */
  encolar(evento: EventoBitacora): { recortados: number } {
    this.eventos.push({ id: this.siguienteId++, evento });
    let recortados = 0;
    while (this.eventos.length > this.tope) {
      const viejo = this.eventos.shift();
      if (viejo) {
        this.enVuelo.delete(viejo.id);
        recortados += 1;
      }
    }
    this.programarEscritura();
    return { recortados };
  }

  /** Los siguientes `n` eventos que no estan en vuelo, en orden. */
  tomar(n: number): EventoEnCola[] {
    const tramo: EventoEnCola[] = [];
    for (const e of this.eventos) {
      if (this.enVuelo.has(e.id)) continue;
      tramo.push(e);
      if (tramo.length >= n) break;
    }
    for (const e of tramo) this.enVuelo.add(e.id);
    return tramo;
  }

  confirmar(ids: number[]): void {
    const borrar = new Set(ids);
    this.eventos = this.eventos.filter((e) => !borrar.has(e.id));
    for (const id of ids) this.enVuelo.delete(id);
    this.programarEscritura();
  }

  reponer(ids: number[]): void {
    for (const id of ids) this.enVuelo.delete(id);
  }

  async vaciarDisco(): Promise<void> {
    this.eventos = [];
    this.enVuelo.clear();
    this.anclaEpoch = null;
    this.transcurridoMs = 0;
    await this.escrituraPendiente;
    await this.almacen.borrar(CLAVE_DE_COLA).catch(() => undefined);
  }

  /** Espera a que lo ultimo encolado este en disco. Solo para pruebas y para el cierre. */
  async sincronizar(): Promise<void> {
    await this.escrituraPendiente;
  }

  /*
    Las escrituras van EN SERIE. Dos `escribir` en paralelo sobre la misma clave pueden acabar en
    cualquier orden, y el orden equivocado deja en disco una version anterior a la que la memoria
    cree que guardo.
  */
  private programarEscritura(): void {
    const datos: Persistido = {
      version: 1,
      siguienteId: this.siguienteId,
      anclaEpoch: this.anclaEpoch,
      transcurridoMs: this.transcurridoMs,
      eventos: this.eventos,
    };
    const serializado = JSON.stringify(datos);
    this.escrituraPendiente = this.escrituraPendiente
      .then(() => this.almacen.escribir(CLAVE_DE_COLA, serializado))
      .catch(() => undefined);
  }
}

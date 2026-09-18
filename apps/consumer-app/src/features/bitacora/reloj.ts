/**
 * El cronometro del alta.
 *
 * ## Monotonico, y anclado UNA vez
 *
 * Los tiempos se miden con `performance.now()`, que no salta si la persona cambia la hora del
 * telefono ni si el sistema la ajusta por red. La hora real se lee una sola vez, al arrancar, y a
 * partir de ahi cada marca es «ancla + lo que ha pasado». Asi dos eventos separados por tres segundos
 * estan a tres segundos aunque el reloj del sistema haya retrocedido diez minutos entre medias.
 *
 * ## Fuentes inyectables
 *
 * `ahoraMonotonico` y `ahoraEpoch` se pueden sustituir en pruebas. Un reloj que no se puede fijar
 * produce pruebas que dependen de la maquina en la que corren.
 */

export type FuentesDeReloj = {
  ahoraMonotonico: () => number;
  ahoraEpoch: () => number;
};

const porDefecto: FuentesDeReloj = {
  ahoraMonotonico: () =>
    typeof globalThis.performance?.now === 'function' ? globalThis.performance.now() : Date.now(),
  ahoraEpoch: () => Date.now(),
};

export class Reloj {
  private inicioMonotonico: number | null = null;
  private anclaEpoch: number | null = null;

  constructor(private readonly fuentes: FuentesDeReloj = porDefecto) {}

  /** Arranca el cronometro. Volver a llamar no reinicia: el alta empezo cuando empezo. */
  iniciar(): void {
    if (this.inicioMonotonico !== null) return;
    this.inicioMonotonico = this.fuentes.ahoraMonotonico();
    this.anclaEpoch = this.fuentes.ahoraEpoch();
  }

  /**
   * Retoma un cronometro guardado (la app se cerro a mitad del alta). Recibe el ancla original para
   * que los eventos nuevos sigan la misma linea de tiempo que los ya encolados.
   *
   * Lo transcurrido se recalcula contra la HORA REAL (`ahora − ancla`), no contra lo ultimo que se
   * guardo: el tiempo que la app estuvo cerrada tambien es tiempo del alta, y el evento `reanudado`
   * que se anota justo despues es lo que permite ver el hueco. Si el reloj del sistema retrocedio
   * por debajo del ancla, se usa lo guardado: un alta no puede durar menos de lo ya medido.
   */
  retomar(anclaEpoch: number, transcurridoGuardadoMs: number): void {
    this.anclaEpoch = anclaEpoch;
    const porHoraReal = this.fuentes.ahoraEpoch() - anclaEpoch;
    const transcurridoMs = Number.isFinite(porHoraReal) && porHoraReal >= transcurridoGuardadoMs ? porHoraReal : transcurridoGuardadoMs;
    this.inicioMonotonico = this.fuentes.ahoraMonotonico() - transcurridoMs;
  }

  get iniciado(): boolean {
    return this.inicioMonotonico !== null;
  }

  /** Milisegundos desde el arranque. Antes de arrancar vale 0: no hay «antes» que medir. */
  ahora(): number {
    if (this.inicioMonotonico === null) return 0;
    return Math.max(0, Math.round(this.fuentes.ahoraMonotonico() - this.inicioMonotonico));
  }

  /** La hora real de un instante monotonico. */
  epochDe(t: number): number {
    return (this.anclaEpoch ?? this.fuentes.ahoraEpoch()) + t;
  }

  marcaDe(t: number): string {
    return new Date(this.epochDe(t)).toISOString();
  }

  get ancla(): number | null {
    return this.anclaEpoch;
  }

  reiniciar(): void {
    this.inicioMonotonico = null;
    this.anclaEpoch = null;
  }
}

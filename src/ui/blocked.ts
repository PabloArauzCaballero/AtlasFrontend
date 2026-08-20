/**
 * Por que el boton principal no responde.
 *
 * Un formulario que apaga su boton sin decir nada obliga al cliente a adivinar cual de ocho campos
 * le falta. En estas pantallas el problema se agrava porque varios ejemplos tienen la forma exacta
 * del valor —`1996-04-12` en una fecha de nacimiento, `2031-03-10` en un vencimiento—: la pantalla
 * se ve completa y el boton sigue gris.
 *
 * La regla que sigue este modulo: **se nombra un solo motivo, el primero en el orden de la
 * pantalla**. Listar los cinco pendientes a la vez es un parrafo que nadie lee y que ademas se
 * contradice solo —cuatro de los cinco dejan de ser ciertos en cuanto se escribe el primero—.
 * Nombrar el primero apunta al sitio exacto donde hay que mirar, y el aviso se va reescribiendo
 * conforme la persona avanza.
 */

/**
 * Un requisito: la condicion que tiene que cumplirse y como se le cuenta al cliente si no.
 *
 * Se declara como par en lugar de como objeto porque estas listas se leen en vertical junto a los
 * campos que validan, y la version con llaves duplica el ancho sin anadir nada.
 */
export type Requirement = readonly [ok: boolean, reason: string];

/**
 * Devuelve el motivo del primer requisito incumplido, o `null` si estan todos cumplidos.
 *
 * El orden importa: hay que declararlos en el mismo orden en que los campos aparecen en pantalla,
 * porque el motivo se lee como una instruccion de "sube y mira ahi".
 *
 * Devolver `null` cuando todo esta bien permite pasarselo al boton sin condicionales en el JSX: el
 * boton solo muestra el aviso cuando ademas esta `disabled`, asi que un motivo vigente durante una
 * operacion en curso no llega a verse.
 */
export function firstBlocker(requirements: readonly Requirement[]): string | null {
  for (const [ok, reason] of requirements) {
    if (!ok) return reason;
  }
  return null;
}

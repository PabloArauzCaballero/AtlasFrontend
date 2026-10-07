/**
 * El código de un solo uso de seis dígitos, en seis casillas.
 *
 * Es el MISMO control que el PIN (`PinField`): un solo input invisible debajo y las casillas como
 * decorado, así que pegar, borrar y el autocompletado del SMS o del correo funcionan igual. Se
 * distingue en dos cosas: el código se ve siempre (se lee de otro sitio y se teclea mirando; no hay
 * ojo ni puntitos) y lleva seis casillas.
 *
 * Todo código que la app pida —verificar el contacto, recuperar el acceso, cambiar el PIN— usa este
 * componente. Un `Field` de texto suelto para un código se lee como «escribe lo que quieras» y no
 * dice cuántos dígitos faltan.
 */
import { PinField, type PinFieldProps } from './pin-field';

export const CODE_LENGTH = 6;

export function CodeField(props: Omit<PinFieldProps, 'length' | 'secret'>) {
  return <PinField testID="code-field" autoComplete="one-time-code" {...props} length={CODE_LENGTH} secret={false} />;
}

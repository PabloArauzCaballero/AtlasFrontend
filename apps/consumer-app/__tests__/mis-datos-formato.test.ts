import {
  antiguedadEnMeses,
  bandaDeIngreso,
  contactoLegible,
  estadoDeCuenta,
  etiquetaEconomia,
  fechaLarga,
  humanizar,
  oSinRegistrar,
  valorEconomia,
} from '../src/features/mis-datos-formato';

/** «Mis datos» enseña lo que Atlas sabe de la persona en lenguaje de persona, no el dato crudo de la base. */
describe('fechaLarga', () => {
  it('una fecha sin hora se lee por sus partes: no se corre un día por la zona horaria', () => {
    expect(fechaLarga('2001-12-06')).toBe('6 de diciembre de 2001');
    expect(fechaLarga('1990-05-17')).toBe('17 de mayo de 1990');
    expect(fechaLarga('2000-01-01')).toBe('1 de enero de 2000');
    expect(fechaLarga('1999-12-31')).toBe('31 de diciembre de 1999');
  });

  it('un instante con hora también sale en fecha larga', () => {
    expect(fechaLarga('2026-10-03T15:00:00')).toBe('3 de octubre de 2026');
  });

  it('lo que falta o no es una fecha no inventa nada', () => {
    expect(fechaLarga(null)).toBeNull();
    expect(fechaLarga(undefined)).toBeNull();
    expect(fechaLarga('')).toBeNull();
    expect(fechaLarga('no-es-fecha')).toBeNull();
    expect(fechaLarga('2001-13-06')).toBeNull();
  });
});

describe('oSinRegistrar', () => {
  it('deja pasar un valor y recorta espacios', () => expect(oSinRegistrar('  Equipetrol ')).toBe('Equipetrol'));
  it('lo que falta dice «Sin registrar», no un guion que parece un error', () => {
    for (const vacio of [null, undefined, '', '   ']) expect(oSinRegistrar(vacio)).toBe('Sin registrar');
  });
});

describe('estadoDeCuenta', () => {
  it('traduce los estados conocidos y marca el tono', () => {
    expect(estadoDeCuenta('active')).toEqual({ texto: 'Activa', tono: 'success' });
    expect(estadoDeCuenta('pending_review')).toEqual({ texto: 'En revisión', tono: 'warning' });
    expect(estadoDeCuenta('suspended')).toEqual({ texto: 'Suspendida', tono: 'danger' });
    expect(estadoDeCuenta('blocked').tono).toBe('danger');
  });
  it('un estado que no conocemos se humaniza: nunca sale el código tal cual', () => {
    expect(estadoDeCuenta('awaiting_documents')).toEqual({ texto: 'Awaiting documents', tono: 'primary' });
  });
  it('sin estado no revienta', () => expect(estadoDeCuenta(null).texto).toBe('Sin estado'));
});

describe('humanizar', () => {
  it('quita guiones bajos y camelCase y deja la primera en mayúscula', () => {
    expect(humanizar('employment_type')).toBe('Employment type');
    expect(humanizar('monthlyIncome')).toBe('Monthly income');
  });
});

describe('contactoLegible', () => {
  it('un teléfono principal verificado: últimos cuatro dígitos y su estado', () => {
    expect(contactoLegible({ contactType: 'phone', status: 'verified', isPrimary: true, valueLast4: '7232' })).toEqual({
      etiqueta: 'Teléfono principal',
      valor: '•••• 7232 · Verificado',
    });
  });

  it('un correo enseña la dirección ENMASCARADA que manda el servidor', () => {
    expect(contactoLegible({ contactType: 'email', status: 'verified', isPrimary: true, valueLast4: null, maskedValue: 'pa***@gmail.com' })).toEqual({
      etiqueta: 'Correo principal',
      valor: 'pa***@gmail.com · Verificado',
    });
  });

  it('un correo sin dirección enmascarada (backend viejo) dice «Correo registrado», nunca «…—»', () => {
    const fila = contactoLegible({ contactType: 'email', status: 'verified', isPrimary: false, valueLast4: null });
    expect(fila).toEqual({ etiqueta: 'Correo', valor: 'Correo registrado · Verificado' });
    expect(fila.valor).not.toContain('…');
  });

  it('lo no verificado lo dice', () => {
    expect(contactoLegible({ contactType: 'phone', status: 'pending', isPrimary: false, valueLast4: '1111' }).valor).toBe('•••• 1111 · Sin verificar');
  });

  it('un tipo de contacto desconocido se humaniza', () => {
    expect(contactoLegible({ contactType: 'whatsapp_business', status: 'verified', isPrimary: false, valueLast4: null }).etiqueta).toBe('Whatsapp business');
  });
});

describe('economía declarada', () => {
  it('etiquetas en lenguaje de persona', () => {
    expect(etiquetaEconomia('monthlyIncome')).toBe('Ingreso mensual');
    expect(etiquetaEconomia('dependents')).toBe('Personas que dependen de ti');
    expect(etiquetaEconomia('algoNuevo')).toBe('Algo nuevo');
  });

  it('el dinero sale en Bs con miles', () => {
    expect(valorEconomia('monthlyIncome', 4500)).toMatch(/^Bs 4[.,\s]?500$/);
    expect(valorEconomia('monthlyExpenses', '1200.5')).toMatch(/^Bs 1[.,\s]?200/);
  });

  it('un código snake_case se humaniza y una frase de la persona se respeta', () => {
    expect(valorEconomia('employmentType', 'self_employed')).toBe('Self employed');
    expect(valorEconomia('incomeSource', 'Vendo ropa en la feria')).toBe('Vendo ropa en la feria');
  });

  it('lo vacío dice «Sin registrar»', () => {
    expect(valorEconomia('monthlyIncome', null)).toBe('Sin registrar');
    expect(valorEconomia('dependents', '')).toBe('Sin registrar');
  });

  it('un número que no es dinero sale tal cual', () => expect(valorEconomia('dependents', 2)).toBe('2'));

  it('la situación laboral y la frecuencia de cobro salen en las palabras del formulario, no como código', () => {
    expect(valorEconomia('employmentStatus', 'self_employed')).toBe('Trabajo por cuenta propia');
    expect(valorEconomia('employmentStatus', 'employee')).toBe('Trabajo en relación de dependencia');
    expect(valorEconomia('employmentStatus', 'business_owner')).toBe('Tengo mi propio negocio');
    expect(valorEconomia('incomeFrequency', 'biweekly')).toBe('Cada quincena');
    expect(valorEconomia('incomeFrequency', 'irregular')).toBe('Sin fecha fija');
  });

  it('un código nuevo que no conocemos se humaniza, nunca sale crudo', () => {
    expect(valorEconomia('employmentStatus', 'retired_worker')).toBe('Retired worker');
  });

  it('el ingreso declarado y el rango salen en Bs', () => {
    expect(valorEconomia('monthlyIncomeDeclared', 3000)).toMatch(/^Bs 3[.,\s]?000$/);
    expect(valorEconomia('incomeBand', 'bs_3000_5000')).toMatch(/^Bs 3[.,\s]?000 a 5[.,\s]?000$/);
  });

  it('la antigüedad sale en años y meses', () => {
    expect(valorEconomia('employmentSeniorityMonths', 30)).toBe('2 años y 6 meses');
  });
});

describe('bandaDeIngreso', () => {
  it('traduce los seis rangos del formulario', () => {
    expect(bandaDeIngreso('bs_0_3000')).toMatch(/^Menos de Bs 3[.,\s]?000$/);
    expect(bandaDeIngreso('bs_8000_12000')).toMatch(/^Bs 8[.,\s]?000 a 12[.,\s]?000$/);
    expect(bandaDeIngreso('bs_20000_plus')).toMatch(/^Más de Bs 20[.,\s]?000$/);
  });
  it('un código que no es un rango no inventa nada', () => expect(bandaDeIngreso('otra_cosa')).toBeNull());
});

describe('antiguedadEnMeses', () => {
  it('meses sueltos, un año, años y meses', () => {
    expect(antiguedadEnMeses(1)).toBe('1 mes');
    expect(antiguedadEnMeses(5)).toBe('5 meses');
    expect(antiguedadEnMeses(12)).toBe('1 año');
    expect(antiguedadEnMeses(13)).toBe('1 año y 1 mes');
    expect(antiguedadEnMeses(36)).toBe('3 años');
  });
  it('un valor inválido dice «Sin registrar»', () => {
    expect(antiguedadEnMeses(Number.NaN)).toBe('Sin registrar');
    expect(antiguedadEnMeses(-3)).toBe('Sin registrar');
  });
});

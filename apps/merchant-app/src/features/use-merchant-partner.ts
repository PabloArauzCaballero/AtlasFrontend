/**
 * El expediente sobre el que opera cada sección. Copia de `AtlasERPFrontend/hooks/useMerchantPartner.ts`.
 *
 * Lo resuelve el PADRE de cada sección una vez (el aprobado primero) y se lo pasa a sus pestañas:
 * cuando cada pestaña lo resolvía por su cuenta, dos pestañas contiguas podían hablar de comercios
 * distintos sin decirlo. `partnerId === ''` con `cargando === false` significa «no hay expediente»,
 * no «todavía cargando» (memoria «Portal del comercio: de 12 a 5»).
 */
import { useCallback, useEffect, useState } from 'react';
import { mensajeDeError } from '@/api/client';
import { SIN_EXPEDIENTE } from '@/api/avisosDelComercio';
import { merchantCreditService } from '@/api/servicios/merchantCreditService';

export interface ExpedienteDelComercio {
  partnerId: string;
  legalName: string | null;
  tradeName: string | null;
  status: string;
}

export interface MerchantPartner {
  partnerId: string;
  nombre: string;
  estado: string;
  expedientes: ExpedienteDelComercio[];
  elegir: (partnerId: string) => void;
  cargando: boolean;
  error: string | null;
  /** Vuelve a pedir la lista (tirar hacia abajo, o tras abrir un expediente nuevo). */
  recargar: () => void;
}

export function useMerchantPartner(): MerchantPartner {
  const [expedientes, setExpedientes] = useState<ExpedienteDelComercio[]>([]);
  const [partnerId, setPartnerId] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vuelta, setVuelta] = useState(0);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    merchantCreditService
      .misExpedientes()
      .then((resultado) => {
        if (cancelado) return;
        const perfiles = resultado.profiles ?? [];
        const propio = perfiles.find((perfil) => perfil.status === 'approved') ?? perfiles[0];
        setExpedientes(perfiles);
        if (!propio) {
          setPartnerId('');
          setError(SIN_EXPEDIENTE);
        } else {
          setError(null);
          setPartnerId((actual) => (actual && perfiles.some((p) => p.partnerId === actual) ? actual : propio.partnerId));
        }
        setCargando(false);
      })
      .catch((fallo: unknown) => {
        if (cancelado) return;
        setError(mensajeDeError(fallo, 'No fue posible identificar su comercio.'));
        setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [vuelta]);

  const elegir = useCallback((id: string) => setPartnerId(id), []);
  const recargar = useCallback(() => setVuelta((v) => v + 1), []);
  const elegido = expedientes.find((perfil) => perfil.partnerId === partnerId);

  return {
    partnerId,
    nombre: elegido?.tradeName ?? elegido?.legalName ?? '',
    estado: elegido?.status ?? '',
    expedientes,
    elegir,
    cargando,
    error,
    recargar,
  };
}

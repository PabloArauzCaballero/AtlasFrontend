/**
 * Comercios de referencia del entorno sandbox.
 *
 * Cada uno tiene un QR interno ATLAS (token opaco) y un QR bancario propio. Son los datos que un
 * comercio real habria cargado en el portal merchant durante su onboarding de tres pasos.
 *
 * El token del QR interno es opaco a proposito: no lleva `merchant_id`, `branch_id` ni `pos_id`
 * editables (invariante R14). El contexto se resuelve del lado del servidor a partir del token.
 */
import type { MerchantContext } from './types';

export type PosQr = {
  posQrId: string;
  /** Lo que viaja dentro del codigo QR fisico pegado en la caja. */
  publicToken: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  context: MerchantContext;
  /** QR bancario del comercio: destino real del dinero. Distinto del QR interno (R13). */
  bankQr: { beneficiaryName: string; endpointMasked: string; payload: string };
};

export const POS_QRS: PosQr[] = [
  {
    posQrId: 'posqr_7f31c2',
    publicToken: 'atlas://pos/9f2b7c41d8a54e6fb03c15ae77d2be90',
    status: 'ACTIVE',
    context: {
      organizationId: 'org_1042',
      tradeName: 'Farmacia Bolivia',
      branchId: 'br_01',
      branchName: 'Sucursal Equipetrol',
      posId: 'pos_01',
      posName: 'Caja principal',
      city: 'Santa Cruz de la Sierra',
      industry: 'Farmacia',
      verified: true,
    },
    bankQr: {
      beneficiaryName: 'FARMACIA BOLIVIA SRL',
      endpointMasked: 'BNB ****4821',
      payload: '00020101021226580014BO.BCB.QRSIMPLE0136farmacia-bolivia-equipetrol-caja015204591253036805802BO',
    },
  },
  {
    posQrId: 'posqr_a90e18',
    publicToken: 'atlas://pos/1c48ae90bb2d47f2938ad6e15c7f4a33',
    status: 'ACTIVE',
    context: {
      organizationId: 'org_2288',
      tradeName: 'Muebles del Oriente',
      branchId: 'br_01',
      branchName: 'Showroom Av. Banzer',
      posId: 'pos_02',
      posName: 'Mostrador 2',
      city: 'Santa Cruz de la Sierra',
      industry: 'Muebleria',
      verified: true,
    },
    bankQr: {
      beneficiaryName: 'MUEBLES DEL ORIENTE SA',
      endpointMasked: 'BCP ****1157',
      payload: '00020101021226580014BO.BCB.QRSIMPLE0136muebles-oriente-banzer-mostrador2015204442153036805802BO',
    },
  },
  {
    posQrId: 'posqr_dd4471',
    publicToken: 'atlas://pos/55aa10cc74e8493cb6f0d2a91e3b7c64',
    status: 'REVOKED',
    context: {
      organizationId: 'org_3310',
      tradeName: 'Tecno Import',
      branchId: 'br_02',
      branchName: 'Sucursal Norte',
      posId: 'pos_05',
      posName: 'Caja 5',
      city: 'Santa Cruz de la Sierra',
      industry: 'Electronica',
      verified: true,
    },
    bankQr: {
      beneficiaryName: 'TECNO IMPORT SRL',
      endpointMasked: 'BUN ****9034',
      payload: '00020101021226580014BO.BCB.QRSIMPLE0136tecno-import-norte-caja5015204572253036805802BO',
    },
  },
];

export const findPosQrByToken = (token: string): PosQr | undefined =>
  POS_QRS.find((qr) => qr.publicToken === token.trim());

/** QR de demostracion sugerido cuando no hay uno fisico a mano. */
export const DEMO_TOKEN = POS_QRS[0]!.publicToken;

/** QR revocado, para poder demostrar el estado de error real (invariante R15). */
export const REVOKED_DEMO_TOKEN = POS_QRS[2]!.publicToken;

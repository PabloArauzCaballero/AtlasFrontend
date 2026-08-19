# Traza de la cadena movil -> backend -> motor de decision

Ejecutada el 2026-08-19 contra el stack local completo.

## 1. AtlasBackend devuelve el expediente decidido

```json
{
  "applicationCode": "CRA-ad7786db-7f80-4637-9ca4-c85ad74b75a1",
  "customerId": "13",
  "productCode": "bnpl_atlas_estandar",
  "status": "approved",
  "requestedAmount": "400.00",
  "requestedTermMonths": 2,
  "decisionMode": "decision_engine",
  "executionId": "2"
}
```

`decisionMode: decision_engine` dice que la decision NO la tomo el backend por su cuenta.
`executionId` es la ejecucion concreta del motor que la produjo.

## 2. El motor guarda esa misma ejecucion

```json
{
  "id": "2",
  "requestId": "credit-app-CRA-ad7786db-7f80-4637-9ca4-c85ad74b75a1",
  "idempotencyKey": "credit-app-3",
  "inputSnapshotJson": {
    "product_code": "bnpl_atlas_estandar",
    "purpose_code": "bnpl_purchase",
    "currency_code": "BOB",
    "requested_amount": 400,
    "requested_term_months": 2
  },
  "outputJson": {
    "outcome": "APPROVE",
    "decision_outcome": "APPROVE"
  },
  "decisionStatus": "SUCCEEDED",
  "artifactVersionId": "10",
  "deploymentId": "6",
  "subjectReferenceHash": "c2912aeb58fc7355eb4617ffaa1ce37a3ecbd2c9b9ad741070711036fa711ebf"
}
```

El `requestId` del motor es el codigo del expediente del backend, y el `inputSnapshotJson` es
exactamente el payload que AtlasBackend proyecto. La cadena se puede recorrer en los dos sentidos.

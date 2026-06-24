package com.ucgi.integrationapi.mikopbx;

/**
 * Representación inmutable de un registro CDR devuelto por MikoPBX
 * ({@code GET /pbxcore/api/v3/cdr}).
 *
 * @param linkedId    Identificador único de la llamada (mapea a {@code crm.cdr.call_id}).
 * @param startRaw    Timestamp de inicio en formato {@code "yyyy-MM-dd HH:mm:ss.SSS"}.
 * @param srcNum      Número que origina la llamada.
 * @param dstNum      Número destino (interno o externo).
 * @param did         DID entrante si aplica.
 * @param disposition Estado final: ANSWERED, NO_ANSWER, BUSY, FAILED.
 * @param duration    Duración total (segundos), incluye ringing.
 * @param billsec     Duración facturable (segundos), desde answer hasta end.
 */
public record MikoCdrRecord(
        String linkedId,
        String startRaw,
        String srcNum,
        String dstNum,
        String did,
        String disposition,
        int duration,
        int billsec
) {
}

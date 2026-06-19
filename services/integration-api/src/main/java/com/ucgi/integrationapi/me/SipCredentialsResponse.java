package com.ucgi.integrationapi.me;

/**
 * Datos mínimos que el CRM necesita para registrar el softphone WebRTC contra
 * MikoPBX. El frontend conoce de antemano la URL WSS y el dominio SIP por
 * variables {@code VITE_SIP_*}, así que aquí solo viajan los datos por usuario.
 */
public record SipCredentialsResponse(String extension, String displayName, String secret) {
}

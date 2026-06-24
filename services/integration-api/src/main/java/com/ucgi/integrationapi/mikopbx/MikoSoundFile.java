package com.ucgi.integrationapi.mikopbx;

/**
 * Representación de un archivo de sonido del catálogo de MikoPBX
 * ({@code /pbxcore/api/v3/sound-files}).
 */
public record MikoSoundFile(
        String id,
        String name,
        String path,
        String category,
        long fileSize,
        String duration
) {
}

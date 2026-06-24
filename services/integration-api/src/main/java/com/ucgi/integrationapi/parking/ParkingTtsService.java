package com.ucgi.integrationapi.parking;

import com.ucgi.integrationapi.mikopbx.MikoPbxRestClient;
import com.ucgi.integrationapi.mikopbx.MikoSoundFile;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * Genera una locución MP3 desde texto usando Google Translate TTS
 * (endpoint público, sin API key) y la sube al catálogo de sound-files de
 * MikoPBX como archivo {@code custom}.
 *
 * <p>El endpoint TTS de Google tiene un límite duro de ~200 caracteres por
 * request — para textos largos partimos por oración y concatenamos los MP3
 * resultantes en memoria. La concatenación de MP3 funciona porque los
 * decoders aceptan streams con múltiples frames seguidos.
 */
@Service
public class ParkingTtsService {

    private static final Logger log = LoggerFactory.getLogger(ParkingTtsService.class);
    private static final int CHUNK_LIMIT = 180;
    private static final Pattern SAFE_FILENAME = Pattern.compile("[^a-zA-Z0-9_-]");

    private final MikoPbxRestClient miko;
    private final HttpClient http;

    public ParkingTtsService(MikoPbxRestClient miko) {
        this.miko = miko;
        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    /**
     * Genera el MP3 desde {@code text} y lo registra como sound-file en MikoPBX.
     * Devuelve metadatos del archivo creado.
     */
    public MikoSoundFile generateAndUpload(String text, String lang) {
        if (text == null || text.isBlank()) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,
                    "El texto del TTS no puede estar vacío");
        }
        if (text.length() > 1000) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.PAYLOAD_TOO_LARGE,
                    "El texto supera 1000 caracteres — recortalo o partilo en varios prompts");
        }
        String lng = (lang == null || lang.isBlank()) ? "es" : lang;
        byte[] mp3 = fetchTtsConcat(text, lng);
        // MikoPBX `convertAudioFile` no tolera nombres largos / con timestamps
        // raros — quedaba intentando leer un archivo inexistente en /media/custom/.
        // Usamos un nombre corto y estable: `tts-<epoch>.mp3`.
        String filename = "tts-" + System.currentTimeMillis() + ".mp3";
        return miko.uploadSoundFile(mp3, filename, "audio/mpeg");
    }

    private byte[] fetchTtsConcat(String text, String lang) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (String chunk : splitForTts(text)) {
            byte[] mp3 = fetchTtsSingle(chunk, lang);
            try {
                out.write(mp3);
            } catch (IOException e) {
                throw new IllegalStateException("No se pudo concatenar TTS", e);
            }
        }
        return out.toByteArray();
    }

    private byte[] fetchTtsSingle(String chunk, String lang) {
        String url = "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob"
                + "&tl=" + URLEncoder.encode(lang, StandardCharsets.UTF_8)
                + "&q=" + URLEncoder.encode(chunk, StandardCharsets.UTF_8);
        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(20))
                    // Sin User-Agent realista Google bloquea con 403.
                    .header("User-Agent", "Mozilla/5.0 (compatible; DialFlowCRM/1.0)")
                    .GET()
                    .build();
            HttpResponse<byte[]> resp = http.send(req, HttpResponse.BodyHandlers.ofByteArray());
            if (resp.statusCode() != 200) {
                throw new ResponseStatusException(
                        org.springframework.http.HttpStatus.BAD_GATEWAY,
                        "Google TTS respondió HTTP " + resp.statusCode());
            }
            return resp.body();
        } catch (IOException e) {
            log.warn("TTS chunk falló: {}", e.getMessage());
            throw new ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_GATEWAY,
                    "No se pudo conectar a Google TTS: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(
                    org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR,
                    "TTS interrumpido");
        }
    }

    /** Divide el texto en bloques de hasta {@value #CHUNK_LIMIT} caracteres, cortando por espacios. */
    static java.util.List<String> splitForTts(String text) {
        java.util.List<String> chunks = new java.util.ArrayList<>();
        String[] words = text.trim().split("\\s+");
        StringBuilder current = new StringBuilder();
        for (String w : words) {
            if (current.length() + w.length() + 1 > CHUNK_LIMIT) {
                if (current.length() > 0) {
                    chunks.add(current.toString());
                    current.setLength(0);
                }
                if (w.length() > CHUNK_LIMIT) {
                    // palabra rara muy larga: la partimos por la fuerza.
                    for (int i = 0; i < w.length(); i += CHUNK_LIMIT) {
                        chunks.add(w.substring(i, Math.min(i + CHUNK_LIMIT, w.length())));
                    }
                    continue;
                }
            }
            if (current.length() > 0) current.append(' ');
            current.append(w);
        }
        if (current.length() > 0) chunks.add(current.toString());
        return chunks;
    }

    private static String safeStub(String text) {
        String stub = text.length() > 20 ? text.substring(0, 20) : text;
        return SAFE_FILENAME.matcher(stub.replace(' ', '-')).replaceAll("");
    }
}

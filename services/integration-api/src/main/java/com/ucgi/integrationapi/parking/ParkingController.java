package com.ucgi.integrationapi.parking;

import com.ucgi.integrationapi.mikopbx.MikoPbxRestClient;
import com.ucgi.integrationapi.mikopbx.MikoSoundFile;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/parking")
@PreAuthorize("hasRole('ADMIN')")
public class ParkingController {

    private final ParkingService service;
    private final ParkingTtsService ttsService;
    private final MikoPbxRestClient miko;

    public ParkingController(ParkingService service,
                             ParkingTtsService ttsService,
                             MikoPbxRestClient miko) {
        this.service = service;
        this.ttsService = ttsService;
        this.miko = miko;
    }

    @GetMapping
    public ResponseEntity<ParkingConfigResponse> getConfig() {
        return ResponseEntity.ok(service.getConfig());
    }

    @PutMapping
    public ResponseEntity<ParkingConfigResponse> updateConfig(
            @Valid @RequestBody ParkingConfigRequest req) {
        return ResponseEntity.ok(service.updateConfig(req));
    }

    @GetMapping("/options")
    public ResponseEntity<List<ParkingIvrOptionResponse>> listOptions() {
        return ResponseEntity.ok(service.listOptions());
    }

    @PostMapping("/options")
    public ResponseEntity<ParkingIvrOptionResponse> createOption(
            @Valid @RequestBody ParkingIvrOptionRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createOption(req));
    }

    @PutMapping("/options/{id}")
    public ResponseEntity<ParkingIvrOptionResponse> updateOption(@PathVariable Long id,
            @Valid @RequestBody ParkingIvrOptionRequest req) {
        return ResponseEntity.ok(service.updateOption(id, req));
    }

    @DeleteMapping("/options/{id}")
    public ResponseEntity<Void> deleteOption(@PathVariable Long id) {
        service.deleteOption(id);
        return ResponseEntity.noContent().build();
    }

    /** Devuelve el catálogo de sound-files de MikoPBX para que el frontend
     *  pueda elegir greeting/MoH desde un dropdown real. */
    @GetMapping("/sound-files")
    public ResponseEntity<List<MikoSoundFile>> listMikoSoundFiles() {
        return ResponseEntity.ok(miko.listSoundFiles());
    }

    /** Genera un MP3 desde texto usando Google TTS y lo registra como
     *  sound-file en MikoPBX. Devuelve el archivo creado. */
    @PostMapping("/tts")
    public ResponseEntity<MikoSoundFile> generateTts(@Valid @RequestBody TtsRequest req) {
        MikoSoundFile sf = ttsService.generateAndUpload(req.text(), req.lang());
        return ResponseEntity.status(HttpStatus.CREATED).body(sf);
    }

    public record TtsRequest(
            @NotBlank @Size(max = 1000) String text,
            @Size(max = 8) String lang
    ) {
    }
}

package com.ucgi.integrationapi.parking;

import jakarta.validation.Valid;
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

    public ParkingController(ParkingService service) {
        this.service = service;
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
}

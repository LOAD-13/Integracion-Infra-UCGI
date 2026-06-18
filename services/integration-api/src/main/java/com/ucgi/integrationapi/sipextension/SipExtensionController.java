package com.ucgi.integrationapi.sipextension;

import jakarta.validation.Valid;
import java.net.URI;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

@RestController
@RequestMapping("/api/v1/sip-extensions")
public class SipExtensionController {

    private final SipExtensionService service;

    public SipExtensionController(SipExtensionService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<SipExtensionResponse> create(@Valid @RequestBody SipExtensionCreateRequest request) {
        SipExtensionResponse created = service.create(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(created.id())
                .toUri();
        return ResponseEntity.created(location).body(created);
    }
}

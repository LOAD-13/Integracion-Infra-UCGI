package com.ucgi.integrationapi.note;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/notes")
public class NoteController {

    private final NoteService service;

    public NoteController(NoteService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<NoteResponse>> list(@RequestParam Long clientId) {
        return ResponseEntity.ok(service.listByClient(clientId));
    }

    @PostMapping
    public ResponseEntity<NoteResponse> create(@Valid @RequestBody NoteRequest req,
                                               Authentication auth) {
        NoteResponse created = service.create(req, auth.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<NoteResponse> update(@PathVariable Long id,
                                               @Valid @RequestBody NoteUpdateRequest req) {
        return ResponseEntity.ok(service.update(id, req));
    }
}

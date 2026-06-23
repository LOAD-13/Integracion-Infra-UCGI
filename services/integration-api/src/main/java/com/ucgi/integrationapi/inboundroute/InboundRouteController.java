package com.ucgi.integrationapi.inboundroute;

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
@RequestMapping("/api/v1/admin/inbound-routes")
@PreAuthorize("hasRole('ADMIN')")
public class InboundRouteController {

    private final InboundRouteService service;

    public InboundRouteController(InboundRouteService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<InboundRouteResponse>> list() {
        return ResponseEntity.ok(service.list());
    }

    @PostMapping
    public ResponseEntity<InboundRouteResponse> create(@Valid @RequestBody InboundRouteRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(req));
    }

    @PutMapping("/{id}")
    public ResponseEntity<InboundRouteResponse> update(@PathVariable Long id,
                                                       @Valid @RequestBody InboundRouteRequest req) {
        return ResponseEntity.ok(service.update(id, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/reorder")
    public ResponseEntity<List<InboundRouteResponse>> reorder(@RequestBody List<Long> orderedIds) {
        return ResponseEntity.ok(service.reorder(orderedIds));
    }
}

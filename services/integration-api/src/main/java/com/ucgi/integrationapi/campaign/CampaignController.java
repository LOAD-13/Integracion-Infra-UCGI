package com.ucgi.integrationapi.campaign;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/campaigns")
public class CampaignController {

    private final CampaignService service;

    public CampaignController(CampaignService service) {
        this.service = service;
    }

    @GetMapping("/mine")
    public ResponseEntity<List<CampaignResponse>> mine(Authentication auth) {
        return ResponseEntity.ok(service.listMine(auth.getName()));
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<CampaignResponse>> listAll() {
        return ResponseEntity.ok(service.listAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<CampaignResponse> get(@PathVariable Long id) {
        return ResponseEntity.ok(service.get(id));
    }

    @PostMapping
    public ResponseEntity<CampaignResponse> create(Authentication auth,
                                                   @Valid @RequestBody CampaignRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(auth.getName(), req));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CampaignResponse> update(@PathVariable Long id,
                                                   @Valid @RequestBody CampaignRequest req) {
        return ResponseEntity.ok(service.update(id, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/start")
    public ResponseEntity<CampaignResponse> start(@PathVariable Long id) {
        return ResponseEntity.ok(service.transition(id, Campaign.Status.RUNNING));
    }

    @PostMapping("/{id}/pause")
    public ResponseEntity<CampaignResponse> pause(@PathVariable Long id) {
        return ResponseEntity.ok(service.transition(id, Campaign.Status.PAUSED));
    }

    @PostMapping("/{id}/finish")
    public ResponseEntity<CampaignResponse> finish(@PathVariable Long id) {
        return ResponseEntity.ok(service.transition(id, Campaign.Status.FINISHED));
    }

    @GetMapping("/{id}/contacts")
    public ResponseEntity<List<CampaignContactResponse>> contacts(@PathVariable Long id) {
        return ResponseEntity.ok(service.listContacts(id));
    }

    @PostMapping("/{id}/contacts")
    public ResponseEntity<CampaignContactResponse> addContact(@PathVariable Long id,
            @Valid @RequestBody CampaignContactRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.addContact(id, req));
    }

    @PostMapping("/{id}/next")
    public ResponseEntity<CampaignContactResponse> next(@PathVariable Long id) {
        return service.nextContact(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PostMapping("/contacts/{contactId}/status/{status}")
    public ResponseEntity<CampaignContactResponse> setContactStatus(@PathVariable Long contactId,
            @PathVariable CampaignContact.Status status) {
        return ResponseEntity.ok(service.setContactStatus(contactId, status));
    }

    @GetMapping("/{id}/predictive-suggestion")
    public ResponseEntity<CampaignService.PredictiveSuggestion> suggestion(@PathVariable Long id) {
        return ResponseEntity.ok(service.predictiveSuggestion(id));
    }
}

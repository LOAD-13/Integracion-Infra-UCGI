package com.ucgi.integrationapi.cdr;

import java.time.LocalDateTime;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/cdr")
public class CdrController {

    private final CdrRepository repository;

    public CdrController(CdrRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public Page<CdrResponse> list(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @RequestParam(required = false) Long agentUserId,
            @RequestParam(required = false) Long clientId,
            @RequestParam(required = false) Cdr.Disposition disposition,
            @RequestParam(required = false) Cdr.Direction direction,
            @PageableDefault(size = 20, sort = "startTime", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        Specification<Cdr> spec = Specification.where(CdrSpecifications.startedAfter(from))
                .and(CdrSpecifications.startedBefore(to))
                .and(CdrSpecifications.agentIs(agentUserId))
                .and(CdrSpecifications.clientIs(clientId))
                .and(CdrSpecifications.dispositionIs(disposition))
                .and(CdrSpecifications.directionIs(direction));
        return repository.findAll(spec, pageable).map(CdrResponse::from);
    }
}

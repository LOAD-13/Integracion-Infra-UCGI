package com.ucgi.integrationapi.cdr;

import java.time.LocalDateTime;
import org.springframework.data.jpa.domain.Specification;

/**
 * Specifications JPA combinables para filtrar el listado de CDR.
 * Cada método devuelve {@code null} si el parámetro es {@code null}
 * (Spring Data ignora specs null al hacer {@code Specification.where(a).and(b)}).
 */
public final class CdrSpecifications {

    private CdrSpecifications() {
    }

    public static Specification<Cdr> startedAfter(LocalDateTime from) {
        if (from == null) return null;
        return (root, q, cb) -> cb.greaterThanOrEqualTo(root.get("startTime"), from);
    }

    public static Specification<Cdr> startedBefore(LocalDateTime to) {
        if (to == null) return null;
        return (root, q, cb) -> cb.lessThan(root.get("startTime"), to);
    }

    public static Specification<Cdr> agentIs(Long agentUserId) {
        if (agentUserId == null) return null;
        return (root, q, cb) -> cb.equal(root.get("agentUserId"), agentUserId);
    }

    public static Specification<Cdr> clientIs(Long clientId) {
        if (clientId == null) return null;
        return (root, q, cb) -> cb.equal(root.get("clientId"), clientId);
    }

    public static Specification<Cdr> dispositionIs(Cdr.Disposition disposition) {
        if (disposition == null) return null;
        return (root, q, cb) -> cb.equal(root.get("disposition"), disposition);
    }

    public static Specification<Cdr> directionIs(Cdr.Direction direction) {
        if (direction == null) return null;
        return (root, q, cb) -> cb.equal(root.get("direction"), direction);
    }
}

package com.ucgi.integrationapi.sipextension;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SipExtensionRepository extends JpaRepository<SipExtension, Long> {

    boolean existsByExtensionNumber(String extensionNumber);

    boolean existsByUserId(Long userId);

    Optional<SipExtension> findByUserId(Long userId);

    Optional<SipExtension> findByExtensionNumber(String extensionNumber);

    /**
     * Devuelve las extensiones habilitadas ordenadas ascendentemente por número.
     * El orden estable es crítico para la idempotencia de {@code pjsip.conf}.
     */
    List<SipExtension> findAllByEnabledTrueOrderByExtensionNumberAsc();
}

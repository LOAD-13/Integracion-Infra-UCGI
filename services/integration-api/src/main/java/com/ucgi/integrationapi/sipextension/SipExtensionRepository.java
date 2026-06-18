package com.ucgi.integrationapi.sipextension;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SipExtensionRepository extends JpaRepository<SipExtension, Long> {

    boolean existsByExtensionNumber(String extensionNumber);

    boolean existsByUserId(Long userId);
}

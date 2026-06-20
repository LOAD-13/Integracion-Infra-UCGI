package com.ucgi.integrationapi.note;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface NoteRepository extends JpaRepository<Note, Long> {

    List<Note> findByClientIdOrderByUpdatedAtDesc(Long clientId);
}

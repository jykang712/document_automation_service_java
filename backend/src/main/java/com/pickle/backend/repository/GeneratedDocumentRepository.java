package com.pickle.backend.repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import com.pickle.backend.entity.GeneratedDocument;

public interface GeneratedDocumentRepository extends JpaRepository<GeneratedDocument, Long> {
    List<GeneratedDocument> findAllByOrderByCreatedAtDescIdDesc();

    @Query("select d from GeneratedDocument d where d.ownerUserId = :ownerId "
            + "and d.isActive = true order by d.createdAt desc, d.id desc")
    List<GeneratedDocument> findVisibleByOwner(@Param("ownerId") Long ownerId);

    @Query("select d from GeneratedDocument d where d.id = :id "
            + "and d.ownerUserId = :ownerId and d.isActive = true")
    Optional<GeneratedDocument> findVisibleByIdAndOwner(
            @Param("id") Long id, @Param("ownerId") Long ownerId);
}

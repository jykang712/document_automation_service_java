package com.pickle.backend.repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import com.pickle.backend.entity.Role;
import com.pickle.backend.entity.User;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByLoginId(String loginId);
    boolean existsByLoginId(String loginId);
    long countByRoleAndActiveTrue(Role role);
    List<User> findAllByOrderByIdAsc();
}

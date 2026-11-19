package com.pickle.backend.security;

import java.util.Locale;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.pickle.backend.repository.UserRepository;

@Service
public class DatabaseUserDetailsService implements UserDetailsService {
    private final UserRepository users;
    public DatabaseUserDetailsService(UserRepository users) { this.users = users; }

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String loginId) {
        String normalized = loginId == null ? "" : loginId.strip().toLowerCase(Locale.ROOT);
        return users.findByLoginId(normalized)
                .map(ApplicationPrincipal::forLogin)
                .orElseThrow(() -> new UsernameNotFoundException("계정을 찾을 수 없습니다."));
    }
}

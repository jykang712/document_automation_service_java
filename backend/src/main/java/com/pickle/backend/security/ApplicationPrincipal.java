package com.pickle.backend.security;

import java.io.Serializable;
import java.util.Collection;
import java.util.List;
import org.springframework.security.core.CredentialsContainer;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import com.pickle.backend.dto.AuthUserResponse;
import com.pickle.backend.entity.Role;
import com.pickle.backend.entity.User;

public final class ApplicationPrincipal implements UserDetails, CredentialsContainer, Serializable {
    private static final long serialVersionUID = 1L;
    private final Long id;
    private final String loginId;
    private final String name;
    private final Role role;
    private final boolean active;
    private String passwordHash;

    private ApplicationPrincipal(User user, boolean includePassword) {
        this.id = user.getId();
        this.loginId = user.getLoginId();
        this.name = user.getName();
        this.role = user.getRole();
        this.active = user.isActive();
        this.passwordHash = includePassword ? user.getPasswordHash() : null;
    }

    public static ApplicationPrincipal forLogin(User user) {
        return new ApplicationPrincipal(user, true);
    }

    public static ApplicationPrincipal forSession(User user) {
        return new ApplicationPrincipal(user, false);
    }

    public Long getId() { return id; }
    public Role getRole() { return role; }
    public AuthUserResponse toResponse() {
        return new AuthUserResponse(id, loginId, name, role, active);
    }
    @Override public String getUsername() { return loginId; }
    @Override public String getPassword() { return passwordHash; }
    @Override public boolean isEnabled() { return active; }
    @Override public boolean isAccountNonExpired() { return true; }
    @Override public boolean isAccountNonLocked() { return true; }
    @Override public boolean isCredentialsNonExpired() { return true; }
    @Override public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }
    @Override public void eraseCredentials() { passwordHash = null; }
}

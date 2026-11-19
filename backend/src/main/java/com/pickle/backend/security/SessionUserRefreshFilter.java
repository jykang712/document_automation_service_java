package com.pickle.backend.security;

import java.io.IOException;
import java.util.Map;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.filter.OncePerRequestFilter;
import com.pickle.backend.entity.User;
import com.pickle.backend.repository.UserRepository;

// Servlet Filter로 자동 등록하지 않고 SecurityFilterChain 내부에만 추가합니다.
public class SessionUserRefreshFilter extends OncePerRequestFilter {
    private final UserRepository users;
    private final SecurityContextRepository contexts;
    private final JsonResponseWriter json;

    public SessionUserRefreshFilter(UserRepository users,
            SecurityContextRepository contexts, JsonResponseWriter json) {
        this.users = users;
        this.contexts = contexts;
        this.json = json;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain chain) throws ServletException, IOException {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated()
                && auth.getPrincipal() instanceof ApplicationPrincipal old) {
            User user = users.findById(old.getId()).orElse(null);
            var context = SecurityContextHolder.createEmptyContext();
            if (user == null || !user.isActive()) {
                SecurityContextHolder.setContext(context);
                contexts.saveContext(context, request, response);
                json.write(response, 401, Map.of("detail", "계정이 비활성화되었거나 존재하지 않습니다."));
                return;
            }
            // 역할·활성 여부를 매 요청 DB에서 확인: 기존 세션에도 다음 요청부터 반영.
            var principal = ApplicationPrincipal.forSession(user);
            context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(
                    principal, null, principal.getAuthorities()));
            SecurityContextHolder.setContext(context);
            contexts.saveContext(context, request, response);
        }
        chain.doFilter(request, response);
    }
}

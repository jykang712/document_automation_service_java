package com.pickle.backend.config;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import jakarta.servlet.DispatcherType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.security.web.context.DelegatingSecurityContextRepository;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.RequestAttributeSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.savedrequest.NullRequestCache;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import com.pickle.backend.repository.UserRepository;
import com.pickle.backend.security.ApplicationPrincipal;
import com.pickle.backend.security.DatabaseUserDetailsService;
import com.pickle.backend.security.JsonResponseWriter;
import com.pickle.backend.security.SessionUserRefreshFilter;

@Configuration
public class SecurityConfig {
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public DaoAuthenticationProvider authenticationProvider(
            DatabaseUserDetailsService details, PasswordEncoder encoder) {
        var provider = new DaoAuthenticationProvider(details);
        provider.setPasswordEncoder(encoder);
        return provider;
    }

    @Bean
    public SecurityContextRepository securityContextRepository() {
        return new DelegatingSecurityContextRepository(
                new RequestAttributeSecurityContextRepository(),
                new HttpSessionSecurityContextRepository());
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http,
            DaoAuthenticationProvider provider, UserRepository users,
            SecurityContextRepository contexts, JsonResponseWriter json) throws Exception {
        http
            .authenticationProvider(provider)
            .securityContext(c -> c.securityContextRepository(contexts))
            .cors(Customizer.withDefaults())
            .csrf(Customizer.withDefaults())
            .requestCache(c -> c.requestCache(new NullRequestCache()))
            .authorizeHttpRequests(a -> a
                .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                .requestMatchers(HttpMethod.GET, "/api/auth/csrf").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/auth/signup", "/api/auth/login").permitAll()
                .requestMatchers("/api/auth/me").authenticated()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                // 문서 작성자는 선택한 양식의 활성 규칙만 조회할 수 있습니다.
                .requestMatchers(HttpMethod.GET, "/api/available-approval-rules").hasAnyRole("ADMIN", "USER")
                .requestMatchers("/api/org-members", "/api/org-members/**",
                        "/api/templates", "/api/templates/**",
                        "/api/approval-rules", "/api/approval-rules/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET,
                        "/api/available-templates", "/api/available-templates/**").authenticated()
                // 문서 Service가 ADMIN/본인 소유권을 검사합니다.
                .requestMatchers("/api/generated-documents", "/api/generated-documents/**").authenticated()
                // 아직 구현하지 않은 경로는 권한 정책을 정한 뒤 명시적으로 허용합니다.
                .anyRequest().denyAll())
            .formLogin(f -> f
                .loginProcessingUrl("/api/auth/login")
                .usernameParameter("login_id")
                .passwordParameter("password")
                .successHandler((req, res, auth) -> {
                    var principal = (ApplicationPrincipal) auth.getPrincipal();
                    json.write(res, 200, Map.of("status", "ok", "user", principal.toResponse()));
                })
                .failureHandler((req, res, ex) ->
                    json.write(res, 401, Map.of("detail", "아이디 또는 비밀번호를 확인해 주세요."))))
            .logout(l -> l
                .logoutUrl("/api/auth/logout")
                .invalidateHttpSession(true)
                .clearAuthentication(true)
                .deleteCookies("JSESSIONID")
                .logoutSuccessHandler((req, res, auth) ->
                    json.write(res, 200, Map.of("status", "ok"))))
            .exceptionHandling(e -> e
                .authenticationEntryPoint((req, res, ex) ->
                    json.write(res, 401, Map.of("detail", "로그인이 필요합니다.")))
                .accessDeniedHandler((req, res, ex) ->
                    json.write(res, 403, Map.of("detail", "권한이 없거나 CSRF 토큰이 유효하지 않습니다."))))
            .addFilterBefore(new SessionUserRefreshFilter(users, contexts, json),
                    AuthorizationFilter.class);
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("${app.cors.allowed-origins:http://localhost:5173,http://127.0.0.1:5173}") String origins) {
        var config = new CorsConfiguration();
        config.setAllowedOrigins(Arrays.stream(origins.split(","))
                .map(String::strip).filter(s -> !s.isEmpty()).toList());
        config.setAllowedMethods(List.of("GET", "POST", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Content-Type", "X-CSRF-TOKEN"));
        config.setAllowCredentials(true);
        var source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
